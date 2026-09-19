import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllStops } from '$lib/server/tristar';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const query = url.searchParams.get('q')?.toLowerCase().trim();
		const limit = parseInt(url.searchParams.get('limit') || '0', 10);
		const allStops = await getAllStops();

		if (!query) {
			if (limit > 0) {
				return json(allStops.slice(0, limit));
			}
			return json(allStops);
		}

		const filtered = allStops.filter((s) => {
			const textMatch =
				s.stopName.toLowerCase().includes(query) ||
				(s.stopCode && s.stopCode.toLowerCase().includes(query)) ||
				(s.stopDesc && s.stopDesc.toLowerCase().includes(query)) ||
				String(s.stopId).includes(query);

			if (textMatch) return true;

			if (s.lines && s.lines.length > 0) {
				return s.lines.some((l) => {
					const lineMatch =
						l.line.toLowerCase() === query ||
						l.line.toLowerCase().startsWith(query);
					const dirMatch = l.directions.some((d) => d.toLowerCase().includes(query));
					return lineMatch || dirMatch;
				});
			}

			return false;
		});

		return json(limit > 0 ? filtered.slice(0, limit) : filtered);
	} catch (err: any) {
		console.error('Błąd w /api/stops:', err);
		return json({ error: err?.message || 'Błąd pobierania przystanków' }, { status: 500 });
	}
};
