import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncGtfsData } from '$lib/server/gtfs';
import { getSessionUser, isUserAdmin } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	// Sprawdź uprawnienia (np. admin lub localhost)
	const user = getSessionUser(event);
	const isLocalhost =
		event.url.hostname === 'localhost' ||
		event.url.hostname === '127.0.0.1' ||
		event.url.hostname === '::1';

	if (!isLocalhost && (!user || !isUserAdmin(user.id))) {
		return json({ error: 'Brak uprawnień do synchronizacji GTFS (wymagany administrator)' }, { status: 403 });
	}

	try {
		const result = await syncGtfsData();
		return json(result);
	} catch (err: any) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
};
