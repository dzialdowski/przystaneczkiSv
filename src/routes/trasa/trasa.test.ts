import { describe, it, expect, vi } from 'vitest';
import { load } from './[routeId]/[tripId]/+page.server';
import { getWarsawTime, diffMinutes } from '$lib/time';

describe('Warsaw time utility', () => {
	it('converts UTC time to Poland Europe/Warsaw local time accurately (summer CEST = UTC+2)', () => {
		// 16:09 UTC on 19 September is 18:09 CEST
		const utcDate = new Date('2026-09-19T16:09:00Z');
		const warsaw = getWarsawTime(utcDate);

		expect(warsaw.hours).toBe(18);
		expect(warsaw.minutes).toBe(9);
		expect(warsaw.timeString).toBe('18:09');
		expect(warsaw.nowMinutes).toBe(18 * 60 + 9);
	});

	it('calculates diffMinutes correctly with midnight wrap-around', () => {
		// 18:09 vs 18:08 -> target 18:08 is 1 min ago (-1)
		expect(diffMinutes(18 * 60 + 8, 18 * 60 + 9)).toBe(-1);
		// 18:09 vs 18:09 -> target 18:09 is 0 min (now)
		expect(diffMinutes(18 * 60 + 9, 18 * 60 + 9)).toBe(0);
		// 18:11 vs 18:09 -> target 18:11 is 2 min ahead (+2)
		expect(diffMinutes(18 * 60 + 11, 18 * 60 + 9)).toBe(2);
		// 00:05 vs 23:55 -> target is 10 min ahead (+10)
		expect(diffMinutes(5, 23 * 60 + 55)).toBe(10);
	});
});

describe('Route trip page load', () => {
	it('resolves live vehicle info for trip 4672319 on line 10770 / stop 36050 if active', async () => {
		const url = new URL(
			'http://localhost:5173/trasa/10770/311?trip=4672319&fromStop=36050&theo=20%3A19&est=20%3A18&delay=-13'
		);
		const params = { routeId: '10770', tripId: '311' };
		const result = (await load({
			params,
			url,
			fetch: globalThis.fetch,
			setHeaders: () => {},
			cookies: {} as any,
			request: {} as any,
			route: { id: '/trasa/[routeId]/[tripId]' },
			depends: () => {},
			parent: async () => ({})
		} as any)) as any;

		expect(result).toBeDefined();
		expect(result.lineName).toBeDefined();
		if (result.vehicleCode) {
			expect(result.vehicleDetails).toBeDefined();
			expect(result.vehicleDetails.bus).toBe(parseInt(result.vehicleCode, 10));
			expect(result.vehicleDetails.marka).toBeTruthy();
			expect(result.vehicleDetails.model).toBeTruthy();
			expect(result.vehicleDetails.features).toBeInstanceOf(Array);
		}
	});

	it('handles trip when vehicleCode is explicitly passed in URL (vCode)', async () => {
		const url = new URL(
			'http://localhost:5173/trasa/10770/311?trip=4672319&fromStop=36050&theo=20%3A19&est=20%3A18&delay=-13&vCode=5334'
		);
		const params = { routeId: '10770', tripId: '311' };
		const result = (await load({
			params,
			url,
			fetch: globalThis.fetch,
			setHeaders: () => {},
			cookies: {} as any,
			request: {} as any,
			route: { id: '/trasa/[routeId]/[tripId]' },
			depends: () => {},
			parent: async () => ({})
		} as any)) as any;

		expect(result.vehicleCode).toBe('5334');
		expect(result.vehicleDetails).toBeDefined();
		expect(result.vehicleDetails.bus).toBe(5334);
		expect(result.vehicleDetails.marka).toBe('MERCEDES-BENZ');
		expect(result.vehicleDetails.model).toBe('eCitaro G');
		expect(result.vehicleDetails.usb).toBe(true);
		expect(result.vehicleDetails.klima).toBe(true);
		expect(result.vehicleDetails.features).toContain('rampa dla wózków');
	});

	it('marks past stops as passed and sets current or upcoming stop as next based on Warsaw time', async () => {
		// Mock only Date to 18:09:00 Warsaw time (16:09:00 UTC) so async I/O is unaffected
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-09-19T16:09:00Z'));

		try {
			// Trip 311 on line 10770: starts at 17:57 / 17:58 from Witomino Leśniczówka 04
			const url = new URL(
				'http://localhost:5173/trasa/10770/311?trip=4672319&fromStop=36040&theo=18%3A08&est=18%3A09&delay=60&vCode=5334'
			);
			const params = { routeId: '10770', tripId: '311' };
			const result = (await load({
				params,
				url,
				fetch: globalThis.fetch,
				setHeaders: () => {},
				cookies: {} as any,
				request: {} as any,
				route: { id: '/trasa/[routeId]/[tripId]' },
				depends: () => {},
				parent: async () => ({})
			} as any)) as any;

			expect(result.stops.length).toBeGreaterThan(0);

			// Przystanek 0 (Witomino Leśniczówka o 17:58) musi być oznaczony jako odjechany (isPassed = true, isNext = false)
			const firstStop = result.stops[0];
			expect(firstStop.isPassed).toBe(true);
			expect(firstStop.isNext).toBe(false);
			expect(firstStop.status).toBe('passed');

			// Znajdź przystanek oznaczony jako następny
			const nextStop = result.stops.find((s: any) => s.isNext);
			expect(nextStop).toBeDefined();
			// Następny przystanek to Kilińskiego 01 (18:09) lub kolejny
			expect(nextStop.estMinutes).toBeGreaterThanOrEqual(18 * 60 + 9);
		} finally {
			vi.useRealTimers();
		}
	}, 15000);
});
