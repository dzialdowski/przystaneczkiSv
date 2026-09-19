import type { PageServerLoad } from './$types';
import { getRouteStops, getRouteNameFromDb, getBusDetails, type BusDetails } from '$lib/server/db';
import { getStopDelays, getRoutesMap, getAllStops } from '$lib/server/tristar';
import { getShapeIdForTrip, getShapeOffsets, getTripStartTime, resolveShapeId } from '$lib/server/gtfs';
import { getWarsawTime, diffMinutes } from '$lib/time';

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
	let vehicleCode = url.searchParams.get('vCode') || '';

	// 1. Nazwa linii
	const routesMap = await getRoutesMap();
	const rInfo = routesMap.get(routeId);
	let lineName = rInfo?.routeShortName;
	if (!lineName) {
		const dbName = await getRouteNameFromDb(routeId);
		lineName = dbName || String(routeId).replace(/^10+/, '') || String(routeId);
	}

	// 2. Jeśli brak headsignParam w URL lub brakuje vehicleCode, spróbuj odnaleźć w TRISTAR
	if (!headsignParam || !theoParam || !vehicleCode) {
		const checkStopId = fromStop > 0 ? fromStop : null;
		if (checkStopId) {
			try {
				const delaysRes = await getStopDelays(checkStopId);
				const match = delaysRes.delays.find(
					(d) => (trip > 0 && d.trip === trip) || (d.routeId === routeId && d.tripId === tripId)
				);
				if (match) {
					if (!headsignParam && match.headsign) headsignParam = match.headsign;
					if (!theoParam && match.theoreticalTime) theoParam = match.theoreticalTime;
					if (!estParam && match.estimatedTime) estParam = match.estimatedTime;
					if (delayParam === null && match.delayInSeconds !== undefined) delayParam = String(match.delayInSeconds);
					if (!vehicleCode && match.vehicleCode) vehicleCode = String(match.vehicleCode);
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

	// 4b. Uzupełnij ewentualne brakujące współrzędne z rejestru przystanków TRISTAR
	const missingCoords = routeStops.some((s) => typeof s.lat !== 'number' || typeof s.lon !== 'number');
	if (missingCoords) {
		try {
			const allStops = await getAllStops();
			const stopsMap = new Map(allStops.map((s) => [s.stopId, s]));
			for (const s of routeStops) {
				if (typeof s.lat !== 'number' || typeof s.lon !== 'number') {
					const found = stopsMap.get(s.stopId);
					if (found && found.stopLat && found.stopLon) {
						s.lat = found.stopLat;
						s.lon = found.stopLon;
					}
				}
			}
		} catch (err) {
			console.warn('Błąd pobierania współrzędnych przystanków:', err);
		}
	}

	// 5. Jeśli nadal nie mamy vehicleCode, sprawdź początkowe przystanki trasy w TRISTAR
	if (!vehicleCode && routeStops.length > 0) {
		const candidateStops = [routeStops[0]?.stopId, routeStops[1]?.stopId].filter(
			(id): id is number => typeof id === 'number' && id > 0 && id !== fromStop
		);
		for (const checkId of candidateStops) {
			try {
				const delaysRes = await getStopDelays(checkId);
				const match = delaysRes.delays.find(
					(d) => (trip > 0 && d.trip === trip) || (d.routeId === routeId && d.tripId === tripId)
				);
				if (match?.vehicleCode) {
					vehicleCode = String(match.vehicleCode);
					if (!headsignParam && match.headsign) headsignParam = match.headsign;
					if (!theoParam && match.theoreticalTime) theoParam = match.theoreticalTime;
					if (!estParam && match.estimatedTime) estParam = match.estimatedTime;
					if (delayParam === null && match.delayInSeconds !== undefined) delayParam = String(match.delayInSeconds);
					break;
				}
			} catch (err) {
				console.warn(`Błąd sprawdzania TRISTAR na przystanku ${checkId}:`, err);
			}
		}
	}

	// 6. Pobierz przesunięcia czasowe (offsets) dla danego wariantu
	let offsets = shapeId ? getShapeOffsets(shapeId) : null;
	if (!offsets || offsets.length !== routeStops.length) {
		offsets = routeStops.map((_, idx) => idx * 2);
	}

	// 7. Ustalenie czasu bazowego i opóźnienia
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
					if (!vehicleCode && match.vehicleCode) {
						vehicleCode = String(match.vehicleCode);
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
				// Fallback: Aktualny czas w strefie polskiej (Europe/Warsaw)
				theoParam = getWarsawTime().timeString;
			}
		}
	}

	// 8. Pobierz szczegółowe dane techniczne pojazdu
	let vehicleDetails: BusDetails | null = null;
	const vCodeNum = parseInt(vehicleCode, 10);
	if (vCodeNum > 0) {
		vehicleDetails = await getBusDetails(vCodeNum);
	}

	// 9. Wyznaczenie czasu startu z przystanku 0 (startMinutes)
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

	// 10. Porównanie z aktualnym czasem w strefie Europe/Warsaw
	// (gwarantuje poprawne wyliczanie niezależnie od strefy serwera np. UTC w chmurze/Azure)
	const warsawNow = getWarsawTime();
	const nowMinutes = warsawNow.hours * 60 + warsawNow.minutes;

	let nextStopFound = false;

	const stopsWithTimes = routeStops.map((s, index) => {
		const stopOffset = offsets![index] ?? index * 2;
		const sTheoMin = startMinutes + stopOffset;
		const sEstMin = sTheoMin + delayMin;

		const theoreticalTime = formatHHMM(sTheoMin);
		const estimatedTime = formatHHMM(sEstMin);

		// Obliczenie różnicy czasu w minutach względem teraz (z uwzględnieniem zawijania doby)
		const diffMin = diffMinutes(sEstMin, nowMinutes);

		let status: 'passed' | 'next' | 'upcoming' = 'upcoming';
		let isNext = false;
		let isPassed = false;

		if (diffMin < 0) {
			status = 'passed';
			isPassed = true;
		} else if (!nextStopFound && diffMin >= 0) {
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
			theoMinutes: sTheoMin,
			estMinutes: sEstMin,
			status,
			isNext,
			isPassed,
			diffMin
		};
	});

	// Jeśli żaden nie został oznaczony jako następny, sprawdzamy:
	// - Jeśli wszystkie minęły (kurs zakończony) -> żaden nie jest "następny"
	// - Jeśli kurs jest w przyszłości -> pierwszy staje się następnym
	const allPassed = stopsWithTimes.every((s) => s.isPassed);
	if (!nextStopFound && !allPassed && stopsWithTimes.length > 0) {
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
		vehicleDetails,
		delaySeconds: delaySec,
		serverNowMinutes: warsawNow.nowMinutes,
		serverTimestamp: Date.now(),
		stops: stopsWithTimes
	};
};
