import { describe, it, expect } from 'vitest';
import { parseFavoritesJson, exportFavoritesToJson } from './localFavorites';
import type { FavoriteStop } from './server/db';

describe('localFavorites helper', () => {
	it('exports favorites to valid JSON with metadata', () => {
		const stops: FavoriteStop[] = [
			{ user_id: 'local', stop_id: '2001', stop_name: 'Gdynia Dworzec Główny' },
			{ user_id: 'local', stop_id: '1002', stop_name: 'Plac Kaszubski' }
		];

		const jsonStr = exportFavoritesToJson(stops);
		const parsed = JSON.parse(jsonStr);

		expect(parsed.app).toBe('przystaneczki');
		expect(parsed.version).toBe(1);
		expect(parsed.total).toBe(2);
		expect(parsed.favorites).toHaveLength(2);
		expect(parsed.favorites[0]).toEqual({ stop_id: '2001', stop_name: 'Gdynia Dworzec Główny' });
	});

	it('parses exported przystaneczki JSON structure', () => {
		const raw = JSON.stringify({
			app: 'przystaneczki',
			version: 1,
			exportedAt: '2026-09-20T10:00:00.000Z',
			total: 2,
			favorites: [
				{ stop_id: '2001', stop_name: 'Gdynia Dworzec Główny' },
				{ stop_id: '1002', stop_name: 'Plac Kaszubski' }
			]
		});

		const res = parseFavoritesJson(raw);
		expect(res.valid).toBe(true);
		expect(res.totalFound).toBe(2);
		expect(res.favorites).toEqual([
			{ stop_id: '2001', stop_name: 'Gdynia Dworzec Główny' },
			{ stop_id: '1002', stop_name: 'Plac Kaszubski' }
		]);
	});

	it('parses raw array of stops with stopId/stopName properties', () => {
		const raw = JSON.stringify([
			{ stopId: 3001, stopName: 'Wzgórze Św. Maksymiliana' },
			{ stopId: '4001', stopName: 'Redłowo Szpital' }
		]);

		const res = parseFavoritesJson(raw);
		expect(res.valid).toBe(true);
		expect(res.totalFound).toBe(2);
		expect(res.favorites).toContainEqual({ stop_id: '3001', stop_name: 'Wzgórze Św. Maksymiliana' });
		expect(res.favorites).toContainEqual({ stop_id: '4001', stop_name: 'Redłowo Szpital' });
	});

	it('parses legacy format with stops key and deduplicates by stop_id', () => {
		const raw = JSON.stringify({
			stops: [
				{ id: '100', name: 'Przystanek A' },
				{ id: '100', name: 'Przystanek A Zmieniona Nazwa' },
				{ id: '200', name: 'Przystanek B' }
			]
		});

		const res = parseFavoritesJson(raw);
		expect(res.valid).toBe(true);
		expect(res.totalFound).toBe(2);
		expect(res.favorites).toContainEqual({ stop_id: '100', stop_name: 'Przystanek A Zmieniona Nazwa' });
		expect(res.favorites).toContainEqual({ stop_id: '200', stop_name: 'Przystanek B' });
	});

	it('returns error when JSON is invalid or empty', () => {
		expect(parseFavoritesJson('').valid).toBe(false);
		expect(parseFavoritesJson('{ not valid json').valid).toBe(false);
		expect(parseFavoritesJson('{"unknownKey": []}').valid).toBe(false);
		expect(parseFavoritesJson('[]').valid).toBe(false);
	});
});
