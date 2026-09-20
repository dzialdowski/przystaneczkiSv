import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllStops, type TristarStop } from '$lib/server/tristar';
import { getTopLinesForStop } from '$lib/server/gtfs';

/**
 * Oblicza odległość w metrach po krzywiźnie Ziemi (formuła Haversine)
 */
function calculateHaversineDistanceMeters(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number {
	const R = 6371000; // promień Ziemi w metrach
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return Math.round(R * c);
}

/**
 * Normalizuje tekst do wyszukiwania (małe litery, bez polskich znaków diakrytycznych)
 */
function normalizeForSearch(str: string): string {
	return (str || '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/ł/g, 'l')
		.replace(/Ł/g, 'l')
		.trim();
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Oblicza ocenę trafności (relevance score) przystanku dla podanego zapytania.
 * Przystanki, których nazwa pasuje do zapytania, mają bezwzględny priorytet
 * nad przystankami, które pasują jedynie ze względu na kierunek linii (headsign).
 */
function calculateStopScore(
	stop: TristarStop,
	rawQuery: string,
	queryNorm: string,
	queryTokens: string[]
): number {
	let score = 0;

	const rawName = (stop.stopName || '').toLowerCase().trim();
	const nameNorm = normalizeForSearch(stop.stopName);

	// Nazwa bez numeru słupka na końcu (np. "Cisowa SKM 02" -> "Cisowa SKM")
	const cleanRawName = rawName.replace(/\s+\d+$/, '').trim();
	const cleanNorm = nameNorm.replace(/\s+\d+$/, '').trim();

	// 1. DOPASOWANIE NAZWY PRZYSTANKU (Najwyższy priorytet: 3500 - 10000+ pkt)
	if (cleanRawName === rawQuery || cleanNorm === queryNorm) {
		// Dokładna nazwa zespołu przystankowego (np. "Cisowa SKM")
		score += 10000;
	} else if (rawName === rawQuery || nameNorm === queryNorm) {
		// Dokładna nazwa z numerem słupka (np. "Cisowa SKM 02")
		score += 9500;
	} else if (cleanNorm.startsWith(queryNorm) || nameNorm.startsWith(queryNorm)) {
		// Nazwa przystanku zaczyna się od zapytania (np. "Cisowa" -> "Cisowa SKM")
		score += 7000;
		const diff = Math.max(0, cleanNorm.length - queryNorm.length);
		score += Math.max(0, 500 - diff * 10);
	} else if (nameNorm.includes(queryNorm)) {
		// Nazwa zawiera frazę w środku
		const isWordBoundary = new RegExp(`(?:^|\\s)${escapeRegex(queryNorm)}`).test(nameNorm);
		score += isWordBoundary ? 5000 : 4000;
	} else if (queryTokens.length > 1 && queryTokens.every((tok) => nameNorm.includes(tok))) {
		// Wszystkie słowa z zapytania występują w nazwie w dowolnej kolejności (np. "SKM Cisowa")
		score += 3500;
	}

	// 2. KOD SŁUPKA, ID PRZYSTANKU, OPIS
	if (stop.stopCode) {
		const codeNorm = normalizeForSearch(stop.stopCode);
		if (stop.stopCode.toLowerCase() === rawQuery || codeNorm === queryNorm) {
			score += 3000;
		} else if (codeNorm.startsWith(queryNorm)) {
			score += 1500;
		}
	}
	if (String(stop.stopId) === rawQuery) {
		score += 3000;
	}
	if (stop.stopDesc) {
		const descNorm = normalizeForSearch(stop.stopDesc);
		if (descNorm.includes(queryNorm)) {
			score += 800;
		}
	}

	// 3. NUMER LINII ORAZ KIERUNEK
	let hasExactLineMatch = false;
	let hasPrefixLineMatch = false;
	let bestDirMatchScore = 0;

	if (stop.lines && stop.lines.length > 0) {
		for (const l of stop.lines) {
			const lineRaw = (l.line || '').toLowerCase().trim();
			const lineNorm = normalizeForSearch(l.line);

			if (lineRaw === rawQuery || lineNorm === queryNorm) {
				hasExactLineMatch = true;
			} else if (lineRaw.startsWith(rawQuery) || lineNorm.startsWith(queryNorm)) {
				hasPrefixLineMatch = true;
			}

			// Kierunki linii odjeżdżających / przyjeżdżających (Najniższy priorytet: 10 - 80 pkt)
			for (const dir of l.directions || []) {
				const dirRaw = dir.toLowerCase().trim();
				const dirNorm = normalizeForSearch(dir);
				const cleanDirNorm = dirNorm.replace(/\s+\d+$/, '').trim();

				if (cleanDirNorm === queryNorm || dirRaw === rawQuery) {
					bestDirMatchScore = Math.max(bestDirMatchScore, 80);
				} else if (cleanDirNorm.startsWith(queryNorm) || dirNorm.startsWith(queryNorm)) {
					bestDirMatchScore = Math.max(bestDirMatchScore, 60);
				} else if (dirNorm.includes(queryNorm)) {
					bestDirMatchScore = Math.max(bestDirMatchScore, 40);
				} else if (queryTokens.length > 1 && queryTokens.every((tok) => dirNorm.includes(tok))) {
					bestDirMatchScore = Math.max(bestDirMatchScore, 30);
				}
			}
		}
	}

	if (hasExactLineMatch) {
		score += 500;
	} else if (hasPrefixLineMatch) {
		score += 250;
	}

	if (bestDirMatchScore > 0) {
		score += bestDirMatchScore;
	}

	// Dodatkowe punkty dla ważnych węzłów / pętli przy remisach
	if (score > 0) {
		if (stop.lines?.some((l) => l.isTerminus)) {
			score += 50;
		}
		const linesCount = stop.lines?.length || 0;
		score += Math.min(50, linesCount * 5);

		const totalTrips = stop.lines?.reduce((sum, l) => sum + (l.tripCount || 0), 0) || 0;
		score += Math.min(50, Math.round(totalTrips / 20));
	}

	return score;
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const rawQuery = (url.searchParams.get('q') || '').trim();
		const limit = parseInt(url.searchParams.get('limit') || '0', 10);
		const latParam = url.searchParams.get('lat');
		const lonParam = url.searchParams.get('lon');

		const allStops = await getAllStops();

		// Jeśli podano koordynaty GPS (lat i lon), zwróć najbliższe przystanki
		if (latParam !== null && lonParam !== null) {
			const lat = parseFloat(latParam);
			const lon = parseFloat(lonParam);

			if (!isNaN(lat) && !isNaN(lon)) {
				const maxLimit = limit > 0 ? limit : 10;

				const stopsWithDistance: TristarStop[] = allStops
					.filter((s) => !isNaN(s.stopLat) && !isNaN(s.stopLon) && s.stopLat !== 0 && s.stopLon !== 0)
					.map((s) => {
						const dist = calculateHaversineDistanceMeters(lat, lon, s.stopLat, s.stopLon);
						const topLines = getTopLinesForStop(s.lines || [], 3);
						return {
							...s,
							distance: dist,
							topLines
						};
					});

				if (!rawQuery) {
					stopsWithDistance.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
					return json(stopsWithDistance.slice(0, maxLimit));
				}

				const queryLower = rawQuery.toLowerCase();
				const queryNorm = normalizeForSearch(rawQuery);
				const queryTokens = queryNorm.split(/\s+/).filter(Boolean);

				const scoredGps = stopsWithDistance
					.map((s) => ({ stop: s, score: calculateStopScore(s, queryLower, queryNorm, queryTokens) }))
					.filter((item) => item.score > 0);

				scoredGps.sort((a, b) => {
					// Poziom trafności (tysiące punktów) ma pierwszeństwo przed odległością
					const aTier = Math.floor(a.score / 1000);
					const bTier = Math.floor(b.score / 1000);
					if (bTier !== aTier) {
						return bTier - aTier;
					}
					return (a.stop.distance ?? 0) - (b.stop.distance ?? 0);
				});

				return json(scoredGps.slice(0, maxLimit).map((item) => item.stop));
			}
		}

		if (!rawQuery) {
			if (limit > 0) {
				return json(allStops.slice(0, limit));
			}
			return json(allStops);
		}

		const queryLower = rawQuery.toLowerCase();
		const queryNorm = normalizeForSearch(rawQuery);
		const queryTokens = queryNorm.split(/\s+/).filter(Boolean);

		const scoredStops: { stop: TristarStop; score: number }[] = [];

		for (const s of allStops) {
			const score = calculateStopScore(s, queryLower, queryNorm, queryTokens);
			if (score > 0) {
				scoredStops.push({ stop: s, score });
			}
		}

		scoredStops.sort((a, b) => {
			if (b.score !== a.score) {
				return b.score - a.score;
			}
			return a.stop.stopName.localeCompare(b.stop.stopName, 'pl', { numeric: true });
		});

		const result = scoredStops.map((item) => item.stop);
		return json(limit > 0 ? result.slice(0, limit) : result);
	} catch (err: any) {
		console.error('Błąd w /api/stops:', err);
		return json({ error: err?.message || 'Błąd pobierania przystanków' }, { status: 500 });
	}
};
