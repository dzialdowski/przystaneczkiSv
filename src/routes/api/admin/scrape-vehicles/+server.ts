import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser, isUserAdmin } from '$lib/server/auth';
import { scrapeAllVehicles, saveVehiclesToJson, syncVehiclesToMSSQL } from '$lib/server/scraper';

export const POST: RequestHandler = async (event) => {
	const user = getSessionUser(event);

	if (!user || !isUserAdmin(user.id)) {
		return json({ error: 'Brak uprawnień administratora' }, { status: 403 });
	}

	const startTime = Date.now();

	try {
		console.log('Rozpoczynam scrapowanie pojazdów na żądanie administratora...');
		const vehicles = await scrapeAllVehicles();

		// Zapisz lokalnie jako fallback cache
		saveVehiclesToJson(vehicles);

		// Synchronizuj z MSSQL
		const { updated, errors } = await syncVehiclesToMSSQL(vehicles);

		return json({
			success: true,
			totalScraped: vehicles.length,
			dbUpdated: updated,
			dbErrors: errors,
			durationMs: Date.now() - startTime
		});
	} catch (err: any) {
		console.error('Błąd podczas scrapowania pojazdów:', err);
		return json({ error: err?.message || 'Błąd scrapowania' }, { status: 500 });
	}
};
