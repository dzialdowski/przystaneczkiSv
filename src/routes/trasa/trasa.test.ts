import { describe, it, expect } from 'vitest';
import { load } from './[routeId]/[tripId]/+page.server';

describe('Route trip page load', () => {
	it('resolves live vehicle info for trip 4672319 on line 10770 / stop 36050', async () => {
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
		expect(result.vehicleCode).toBeTruthy();
		expect(result.vehicleDetails).toBeDefined();
		expect(result.vehicleDetails.bus).toBe(parseInt(result.vehicleCode, 10));
		expect(result.vehicleDetails.marka).toBeTruthy();
		expect(result.vehicleDetails.model).toBeTruthy();
		expect(result.vehicleDetails.features).toBeInstanceOf(Array);
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
});
