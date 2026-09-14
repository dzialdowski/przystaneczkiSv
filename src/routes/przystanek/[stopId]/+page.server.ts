import type { PageServerLoad } from './$types';
import { getStopDelays, getAllStops } from '$lib/server/tristar';
import { getDbPool } from '$lib/server/db';
import sql from 'mssql';

export const load: PageServerLoad = async ({ params }) => {
	const stopId = params.stopId;

	let stopName = `Przystanek #${stopId}`;

	// Najpierw sprawdź w bazie MSSQL
	try {
		const pool = await getDbPool();
		const result = await pool
			.request()
			.input('stopId', sql.Int, parseInt(stopId, 10))
			.query('SELECT nazwaPrzystanku FROM [dbo].[przystanki] WHERE idPrzystanku = @stopId');

		if (result.recordset.length > 0 && result.recordset[0].nazwaPrzystanku) {
			stopName = result.recordset[0].nazwaPrzystanku.trim();
		} else {
			// Fallback do listy TRISTAR
			const allStops = await getAllStops();
			const found = allStops.find((s) => String(s.stopId) === String(stopId));
			if (found) {
				stopName = found.stopName;
			}
		}
	} catch (e) {
		console.error('Błąd pobierania nazwy przystanku:', e);
	}

	const initialDelays = await getStopDelays(stopId);

	return {
		stopId,
		stopName,
		initialDelays
	};
};
