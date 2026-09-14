import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStopDelays } from '$lib/server/tristar';

export const GET: RequestHandler = async ({ url }) => {
	const stopId = url.searchParams.get('stopId');
	if (!stopId) {
		return json({ error: 'Nie podano stopId' }, { status: 400 });
	}

	try {
		const data = await getStopDelays(stopId);
		return json(data);
	} catch (err: any) {
		return json({ error: err?.message || 'Błąd serwera' }, { status: 500 });
	}
};
