import type { LayoutServerLoad } from './$types';
import { getSessionUser, isUserAdmin, BOT_USERNAME, BOT_ID } from '$lib/server/auth';
import { getUserFavorites, getUserSettings } from '$lib/server/db';

export const load: LayoutServerLoad = async (event) => {
	const user = getSessionUser(event);
	const enableDevLogin = process.env.ENABLE_DEV_LOGIN === 'true';
	const botName = process.env.PUBLIC_BOT_NAME || BOT_USERNAME;
	const botId = process.env.PUBLIC_BOT_ID || BOT_ID;
	const dbServer = process.env.MSSQL_SERVER || '';
	const cartoApiKey =
		process.env.PUBLIC_CARTO_API_KEY ||
		process.env.CARTO_API_KEY ||
		process.env.PUBLIC_CARTO_BASEMAPS_API_KEY ||
		process.env.CARTO_BASEMAPS_API_KEY ||
		'';

	if (user) {
		const [favorites, settings] = await Promise.all([
			getUserFavorites(String(user.id)),
			getUserSettings(String(user.id), user.first_name)
		]);

		return {
			user,
			favorites,
			legacyMode: settings.legacyMode,
			isAdmin: isUserAdmin(user.id),
			botName,
			botId,
			enableDevLogin,
			dbServer,
			cartoApiKey
		};
	}

	return {
		user: null,
		favorites: [],
		legacyMode: false,
		isAdmin: false,
		botName,
		botId,
		enableDevLogin,
		dbServer,
		cartoApiKey
	};
};
