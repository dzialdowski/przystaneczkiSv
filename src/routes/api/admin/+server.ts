import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser, isUserAdmin } from '$lib/server/auth';
import { getAdminData } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
	const user = getSessionUser(event);

	if (!user || !isUserAdmin(user.id)) {
		return json({ error: 'Brak uprawnień administratora' }, { status: 403 });
	}

	try {
		const data = await getAdminData();
		return json(data);
	} catch (err: any) {
		return json({ error: err?.message || 'Błąd odczytu danych administratora' }, { status: 500 });
	}
};
