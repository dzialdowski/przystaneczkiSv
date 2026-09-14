import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRouteStops } from '$lib/server/db';
import { getStopDelays } from '$lib/server/tristar';

export const GET: RequestHandler = async ({ url }) => {
	const routeId = parseInt(url.searchParams.get('routeId') || '0', 10);
	const tripId = parseInt(url.searchParams.get('tripId') || '0', 10);
	const trip = parseInt(url.searchParams.get('trip') || '0', 10);

	if (!routeId || !tripId) {
		return json({ error: 'Brak routeId lub tripId' }, { status: 400 });
	}

	try {
		const stops = await getRouteStops(routeId, tripId);

		// Dla każdego przystanku sprawdzamy czy w delays jest ten trip
		const stopsWithTimes = await Promise.all(
			stops.map(async (s) => {
				let estimatedTime = '---';
				let theoreticalTime = '---';
				let isNext = false;

				try {
					const delaysData = await getStopDelays(s.stopId);
					const match = delaysData.delays.find((d) => d.trip === trip || d.tripId === tripId);
					if (match) {
						estimatedTime = match.estimatedTime;
						theoreticalTime = match.theoreticalTime;
						isNext = true;
					}
				} catch {
					// opcjonalne pobieranie
				}

				return {
					...s,
					estimatedTime,
					theoreticalTime,
					isNext
				};
			})
		);

		return json({ routeId, tripId, trip, stops: stopsWithTimes });
	} catch (err: any) {
		return json({ error: err?.message || 'Błąd trasy' }, { status: 500 });
	}
};
