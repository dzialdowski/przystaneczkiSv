import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/auth';
import { getUserFavorites, getUserSettings, addFavorite, updateFavorite, deleteFavorite, toggleLegacyMode } from '$lib/server/db';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const user = getSessionUser(event);
	if (!user) {
		return {
			authenticated: false,
			favorites: [],
			legacyMode: false
		};
	}

	const [favorites, settings] = await Promise.all([
		getUserFavorites(String(user.id)),
		getUserSettings(String(user.id), user.first_name)
	]);

	return {
		authenticated: true,
		favorites,
		legacyMode: settings.legacyMode
	};
};

export const actions: Actions = {
	addOrUpdate: async (event) => {
		const user = getSessionUser(event);
		if (!user) return fail(401, { message: 'Niezalogowany' });

		const formData = await event.request.formData();
		const stopId = String(formData.get('stopID') || '').trim();
		const stopName = String(formData.get('stopName') || '').trim();
		const isDelete = formData.get('del') === 'on' || formData.get('action') === 'delete';

		if (!stopId) return fail(400, { message: 'Brak stopID' });

		if (isDelete) {
			await deleteFavorite(String(user.id), stopId);
			return { success: true, deleted: true };
		}

		if (!stopName) return fail(400, { message: 'Nazwa nie może być pusta' });

		await addFavorite(String(user.id), stopId, stopName);
		return { success: true };
	},

	toggleLegacy: async (event) => {
		const user = getSessionUser(event);
		if (!user) return fail(401, { message: 'Niezalogowany' });

		const settings = await getUserSettings(String(user.id), user.first_name);
		const newMode = await toggleLegacyMode(String(user.id), settings.legacyMode, user.first_name);
		return { success: true, legacyMode: newMode };
	}
};
