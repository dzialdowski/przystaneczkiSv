import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/auth';
import { getUserFavorites, addFavorite, updateFavorite, deleteFavorite } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
	const user = getSessionUser(event);
	if (!user) {
		return json({ favorites: [], authenticated: false });
	}

	const favorites = await getUserFavorites(String(user.id));
	return json({ favorites, authenticated: true, user });
};

export const POST: RequestHandler = async (event) => {
	const user = getSessionUser(event);
	if (!user) {
		return json({ error: 'Musisz być zalogowany, aby zarządzać ulubionymi' }, { status: 401 });
	}

	try {
		const body = await event.request.json();
		const { stopId, stopName, action } = body;

		if (!stopId) {
			return json({ error: 'Brak stopId' }, { status: 400 });
		}

		if (action === 'delete') {
			const success = await deleteFavorite(String(user.id), String(stopId));
			return json({ success });
		}

		if (!stopName || !stopName.trim()) {
			return json({ error: 'Nazwa przystanku nie może być pusta' }, { status: 400 });
		}

		if (action === 'update') {
			const success = await updateFavorite(String(user.id), String(stopId), stopName);
			return json({ success });
		}

		const success = await addFavorite(String(user.id), String(stopId), stopName);
		return json({ success });
	} catch (err: any) {
		console.error('Błąd w /api/favorites POST:', err);
		return json({ error: err?.message || 'Błąd serwera' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const user = getSessionUser(event);
	if (!user) {
		return json({ error: 'Musisz być zalogowany' }, { status: 401 });
	}

	const url = new URL(event.request.url);
	const stopId = url.searchParams.get('stopId');
	if (!stopId) {
		return json({ error: 'Brak stopId' }, { status: 400 });
	}

	const success = await deleteFavorite(String(user.id), stopId);
	return json({ success });
};
