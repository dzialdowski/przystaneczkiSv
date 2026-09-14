import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/auth';
import { getUserSettings, toggleLegacyMode } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
	const user = getSessionUser(event);
	if (!user) {
		return json({ legacyMode: false, authenticated: false });
	}

	const settings = await getUserSettings(String(user.id), user.first_name);
	return json({ legacyMode: settings.legacyMode, authenticated: true, settings });
};

export const POST: RequestHandler = async (event) => {
	const user = getSessionUser(event);
	if (!user) {
		return json({ error: 'Brak autoryzacji' }, { status: 401 });
	}

	const body = await event.request.json().catch(() => ({}));
	const currentMode = typeof body.currentMode === 'boolean' ? body.currentMode : false;
	const newMode = await toggleLegacyMode(String(user.id), currentMode, user.first_name);

	return json({ success: true, legacyMode: newMode });
};
