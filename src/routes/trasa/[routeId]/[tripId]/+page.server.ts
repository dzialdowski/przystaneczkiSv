import type { PageServerLoad } from './$types';
import { getRouteStops, getRouteNameFromDb } from '$lib/server/db';
import { getStopDelays, getRoutesMap } from '$lib/server/tristar';
import { getShapeIdForTrip, getShapeOffsets, getTripStartTime, resolveShapeId } from '$lib/server/gtfs';

function formatHHMM(min: number): string {
	const m = ((Math.round(min) % 1440) + 1440) % 1440;
	const h = Math.floor(m / 60);
	const mins = m % 60;
	return String(h).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
}

export const load: PageServerLoad = async ({ params, url }) => {
	const routeId = parseInt(params.routeId, 10);
	const tripId = parseInt(params.tripId, 10);
	const trip = parseInt(url.searchParams.get('trip') || '0', 10);
	const fromStop = parseInt(url.searchParams.get('fromStop') || '0', 10);
	let theoParam = url.searchParams.get('theo') || '';
	let estParam = url.searchParams.get('est') || '';
	let delayParam = url.searchParams.get('delay');
	let headsignParam = url.searchParams.get('headsign') || '';
	const vehicleCode = url.searchParams.get('vCode') || '';

	// 1. Nazwa linii
	const routesMap = await getRoutesMap();
	const rInfo = routesMap.get(routeId);
	let lineName = rInfo?.routeShortName;
	if (!lineName) {
		const dbName = await getRouteNameFromDb(routeId);
		lineName = dbName || String(routeId).replace(/^10+/, '') || String(routeId);
	}

	// 2. Jeśli brak headsignParam w URL, ale mamy fromStop, spróbuj odnaleźć w TRISTAR
	if (!headsignParam || !theoParam) {
		const checkStopId = fromStop > 0 ? fromStop : null;
		if (checkStopId) {
			try {
				const delaysRes = await getStopDelays(checkStopId);
				const match = delaysRes.delays.find(
					(d) => (trip > 0 && d.trip === trip) || (d.routeId === routeId && d.tripId === tripId)
				);
				if (match) {
					if (!headsignParam) headsignParam = match.headsign;
					if (!theoParam) theoParam = match.theoreticalTime;
					if (!estParam) estParam = match.estimatedTime;
					if (delayParam === null) delayParam = String(match.delayInSeconds);
				}
			} catch (err) {
				console.warn('Błąd sprawdzania odjazdów z TRISTAR:', err);
			}
		}
	}

	// 3. Rozpoznaj właściwy wariant trasy (shape_id) dla tej linii i kierunku
	const shapeId = resolveShapeId(routeId, headsignParam, fromStop);

	// 4. Pobierz przystanki dla danego wariantu trasy
	const routeStops = await getRouteStops(routeId, {
		shapeId: shapeId || undefined,
		tripId,
		headsign: headsignParam,
		fromStop
	});

	// 5. Pobierz przesunięcia czasowe (offsets) dla danego wariantu
	let offsets = shapeId ? getShapeOffsets(shapeId) : null;
	if (!offsets || offsets.length !== routeStops.length) {
		offsets = routeStops.map((_, idx) => idx * 2);
	}

	// 4. Ustalenie czasu bazowego i opóźnienia
	let delaySec = delayParam !== null && delayParam !== undefined ? parseInt(delayParam, 10) : 0;
	if (isNaN(delaySec)) delaySec = 0;

	// Jeśli nie otrzymaliśmy theo w URL, spróbuj odnaleźć kurs w TRISTAR lub rozkładzie GTFS
	if (!theoParam) {
		// Próba A: Sprawdzenie pierwszego przystanku lub przystanku fromStop w TRISTAR
		const checkStopId = fromStop > 0 ? fromStop : routeStops[0]?.stopId;
		if (checkStopId) {
			try {
				const delaysRes = await getStopDelays(checkStopId);
				const match = delaysRes.delays.find(
					(d) => (trip > 0 && d.trip === trip) || d.tripId === tripId || d.routeId === routeId
				);
				if (match) {
					theoParam = match.theoreticalTime;
					estParam = match.estimatedTime;
					delaySec = match.delayInSeconds;
					if (!headsignParam && match.headsign) {
						headsignParam = match.headsign;
					}
				}
			} catch (err) {
				console.warn('Błąd sprawdzania odjazdów dla trasy:', err);
			}
		}

		// Próba B: Rozkład z GTFS
		if (!theoParam) {
			const gtfsStart = getTripStartTime(tripId) || (trip > 0 ? getTripStartTime(trip) : null);
			if (gtfsStart) {
				theoParam = gtfsStart;
			} else {
				// Fallback: Aktualny czas
				const now = new Date();
				theoParam = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
			}
		}
	}

	// 5. Wyznaczenie czasu startu z przystanku 0 (startMinutes)
	let fromIdx = 0;
	if (fromStop > 0) {
		const found = routeStops.findIndex((s) => s.stopId === fromStop);
		if (found >= 0) fromIdx = found;
	}

	const fromOffset = offsets[fromIdx] ?? fromIdx * 2;
	const [theoH, theoM] = theoParam.split(':').map(Number);
	const theoMinAtFrom = (isNaN(theoH) ? 12 : theoH) * 60 + (isNaN(theoM) ? 0 : theoM);
	const startMinutes = theoMinAtFrom - fromOffset;
	const delayMin = Math.round(delaySec / 60);

	// 6. Porównanie z aktualnym czasem dla określenia statusu (odjechał / następny / przyszły)
	const now = new Date();
	const nowMinutes = now.getHours() * 60 + now.getMinutes();

	let nextStopFound = false;

	const stopsWithTimes = routeStops.map((s, index) => {
		const stopOffset = offsets![index] ?? index * 2;
		const sTheoMin = startMinutes + stopOffset;
		const sEstMin = sTheoMin + delayMin;

		const theoreticalTime = formatHHMM(sTheoMin);
		const estimatedTime = formatHHMM(sEstMin);

		// Obliczenie różnicy czasu w minutach względem teraz
		// uwzględniając zawijanie doby (-720 .. +720)
		let diffMin = (sEstMin - nowMinutes) % 1440;
		if (diffMin < -720) diffMin += 1440;
		if (diffMin > 720) diffMin -= 1440;

		let status: 'passed' | 'next' | 'upcoming' = 'upcoming';
		let isNext = false;
		let isPassed = false;

		if (diffMin < -1) {
			status = 'passed';
			isPassed = true;
		} else if (!nextStopFound && diffMin >= -1) {
			status = 'next';
			isNext = true;
			nextStopFound = true;
		} else {
			status = 'upcoming';
		}

		return {
			...s,
			theoreticalTime,
			estimatedTime,
			status,
			isNext,
			isPassed,
			diffMin
		};
	});

	// Jeśli żaden nie został oznaczony jako następny (np. cały kurs jest w przyszłości),
	// pierwszy przystanek staje się następnym
	if (!nextStopFound && stopsWithTimes.length > 0) {
		stopsWithTimes[0].isNext = true;
		stopsWithTimes[0].status = 'next';
	}

	return {
		routeId,
		tripId,
		trip,
		lineName,
		routeDescription: headsignParam || rInfo?.routeLongName || `Trasa linii ${lineName}`,
		vehicleCode,
		delaySeconds: delaySec,
		stops: stopsWithTimes
	};
};
