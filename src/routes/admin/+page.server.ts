import type { PageServerLoad } from './$types';
import { getSessionUser, isUserAdmin } from '$lib/server/auth';
import { getAdminData } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const user = getSessionUser(event);

	if (!user || !isUserAdmin(user.id)) {
		throw error(403, 'Brak uprawnień administratora. Dostęp wyłącznie dla zdefiniowanych administratorów systemu.');
	}

	const data = await getAdminData();

	return {
		user,
		favs: data.favs,
		users: data.users,
		vehicles: data.vehicles || []
	};
};
