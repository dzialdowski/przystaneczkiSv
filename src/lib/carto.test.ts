import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCartoTileUrl, DEFAULT_CARTO_STYLE, CARTO_ATTRIBUTION } from './carto';

describe('CARTO Basemaps tile URL helper', () => {
	const originalCartoKey = process.env.PUBLIC_CARTO_API_KEY;
	const originalCartoKeyPlain = process.env.CARTO_API_KEY;
	const originalCartoBasemapsKey = process.env.PUBLIC_CARTO_BASEMAPS_API_KEY;
	const originalCartoBasemapsKeyPlain = process.env.CARTO_BASEMAPS_API_KEY;

	beforeEach(() => {
		delete process.env.PUBLIC_CARTO_API_KEY;
		delete process.env.CARTO_API_KEY;
		delete process.env.PUBLIC_CARTO_BASEMAPS_API_KEY;
		delete process.env.CARTO_BASEMAPS_API_KEY;
	});

	afterEach(() => {
		if (originalCartoKey !== undefined) process.env.PUBLIC_CARTO_API_KEY = originalCartoKey;
		else delete process.env.PUBLIC_CARTO_API_KEY;

		if (originalCartoKeyPlain !== undefined) process.env.CARTO_API_KEY = originalCartoKeyPlain;
		else delete process.env.CARTO_API_KEY;

		if (originalCartoBasemapsKey !== undefined)
			process.env.PUBLIC_CARTO_BASEMAPS_API_KEY = originalCartoBasemapsKey;
		else delete process.env.PUBLIC_CARTO_BASEMAPS_API_KEY;

		if (originalCartoBasemapsKeyPlain !== undefined)
			process.env.CARTO_BASEMAPS_API_KEY = originalCartoBasemapsKeyPlain;
		else delete process.env.CARTO_BASEMAPS_API_KEY;
	});

	it('returns default tile URL without key when no API key is provided or set in env', () => {
		expect(DEFAULT_CARTO_STYLE).toBe('voyager');
		const url = getCartoTileUrl();
		expect(url).toBe('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png');
	});

	it('appends key query parameter when apiKey is explicitly passed', () => {
		const url = getCartoTileUrl('my-test-carto-key');
		expect(url).toBe(
			'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=my-test-carto-key'
		);
	});

	it('supports custom basemap style with explicit apiKey', () => {
		const url = getCartoTileUrl('my-test-carto-key', 'dark_all');
		expect(url).toBe(
			'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=my-test-carto-key'
		);
	});

	it('reads apiKey from PUBLIC_CARTO_API_KEY environment variable when not passed', () => {
		process.env.PUBLIC_CARTO_API_KEY = 'env-public-key-123';
		const url = getCartoTileUrl();
		expect(url).toBe(
			'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=env-public-key-123'
		);
	});

	it('reads apiKey from CARTO_API_KEY fallback environment variable', () => {
		process.env.CARTO_API_KEY = 'server-key-456';
		const url = getCartoTileUrl();
		expect(url).toBe(
			'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=server-key-456'
		);
	});

	it('reads apiKey from PUBLIC_CARTO_BASEMAPS_API_KEY alias', () => {
		process.env.PUBLIC_CARTO_BASEMAPS_API_KEY = 'alias-key-789';
		const url = getCartoTileUrl();
		expect(url).toBe(
			'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=alias-key-789'
		);
	});

	it('properly URL-encodes special characters in API key and trims whitespace', () => {
		const url = getCartoTileUrl('  key with spaces&symbols=true  ');
		expect(url).toBe(
			'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=key%20with%20spaces%26symbols%3Dtrue'
		);
	});

	it('exports valid attribution string', () => {
		expect(CARTO_ATTRIBUTION).toContain('OpenStreetMap');
		expect(CARTO_ATTRIBUTION).toContain('CARTO');
	});
});
