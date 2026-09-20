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

export const GET: RequestHandler = async ({ url }) => {
	try {
		const query = url.searchParams.get('q')?.toLowerCase().trim();
		const limit = parseInt(url.searchParams.get('limit') || '0', 10);
		const latParam = url.searchParams.get('lat');
		const lonParam = url.searchParams.get('lon');

		const allStops = await getAllStops();

		// Jeśli podano koordynaty GPS (lat i lon), zwróć najbliższe przystanki posortowane rosnąco wg odległości
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

				let filtered = stopsWithDistance;
				if (query) {
					filtered = stopsWithDistance.filter((s) => {
						const textMatch =
							s.stopName.toLowerCase().includes(query) ||
							(s.stopCode && s.stopCode.toLowerCase().includes(query)) ||
							(s.stopDesc && s.stopDesc.toLowerCase().includes(query)) ||
							String(s.stopId).includes(query);

						if (textMatch) return true;

						if (s.lines && s.lines.length > 0) {
							return s.lines.some((l) => {
								const lineMatch =
									l.line.toLowerCase() === query ||
									l.line.toLowerCase().startsWith(query);
								const dirMatch = l.directions.some((d) => d.toLowerCase().includes(query));
								return lineMatch || dirMatch;
							});
						}

						return false;
					});
				}

				filtered.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
				return json(filtered.slice(0, maxLimit));
			}
		}

		if (!query) {
			if (limit > 0) {
				return json(allStops.slice(0, limit));
			}
			return json(allStops);
		}

		const filtered = allStops.filter((s) => {
			const textMatch =
				s.stopName.toLowerCase().includes(query) ||
				(s.stopCode && s.stopCode.toLowerCase().includes(query)) ||
				(s.stopDesc && s.stopDesc.toLowerCase().includes(query)) ||
				String(s.stopId).includes(query);

			if (textMatch) return true;

			if (s.lines && s.lines.length > 0) {
				return s.lines.some((l) => {
					const lineMatch =
						l.line.toLowerCase() === query ||
						l.line.toLowerCase().startsWith(query);
					const dirMatch = l.directions.some((d) => d.toLowerCase().includes(query));
					return lineMatch || dirMatch;
				});
			}

			return false;
		});

		return json(limit > 0 ? filtered.slice(0, limit) : filtered);
	} catch (err: any) {
		console.error('Błąd w /api/stops:', err);
		return json({ error: err?.message || 'Błąd pobierania przystanków' }, { status: 500 });
	}
};
