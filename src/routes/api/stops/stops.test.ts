import { describe, it, expect } from 'vitest';
import { GET } from './+server';

describe('/api/stops endpoint', () => {
	it('returns nearest stops sorted by distance in meters when lat & lon are provided', async () => {
		// Gdynia Główna coordinates: ~54.5189, 18.5305
		const url = new URL('http://localhost:5173/api/stops?lat=54.5189&lon=18.5305&limit=5');
		const res = await GET({ url } as any);
		expect(res.status).toBe(200);

		const stops = await res.json();
		expect(Array.isArray(stops)).toBe(true);
		expect(stops.length).toBeGreaterThan(0);
		expect(stops.length).toBeLessThanOrEqual(5);

		// Check distance is present and sorted ascending
		for (let i = 0; i < stops.length; i++) {
			const s = stops[i];
			expect(typeof s.distance).toBe('number');
			expect(s.distance).toBeGreaterThanOrEqual(0);

			if (i > 0) {
				expect(s.distance).toBeGreaterThanOrEqual(stops[i - 1].distance);
			}

			// Check topLines contains at most 3 lines with directions
			expect(Array.isArray(s.topLines)).toBe(true);
			expect(s.topLines.length).toBeLessThanOrEqual(3);
			for (const line of s.topLines) {
				expect(typeof line.line).toBe('string');
				expect(Array.isArray(line.directions)).toBe(true);
			}
		}
	});

	it('returns stops matching query string by name or line direction when q parameter is provided', async () => {
		const url = new URL('http://localhost:5173/api/stops?q=Kaszubski&limit=3');
		const res = await GET({ url } as any);
		expect(res.status).toBe(200);

		const stops = await res.json();
		expect(Array.isArray(stops)).toBe(true);
		expect(stops.length).toBeGreaterThan(0);
		for (const s of stops) {
			const nameMatch = s.stopName.toLowerCase().includes('kaszubski');
			const dirMatch = s.lines?.some((l: any) =>
				l.directions.some((d: string) => d.toLowerCase().includes('kaszubski'))
			);
			expect(nameMatch || dirMatch).toBe(true);
		}
	});
});
