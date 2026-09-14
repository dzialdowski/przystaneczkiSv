import fs from 'fs';
import path from 'path';
import sql from 'mssql';
import { getDbPool } from './db';

export const ZKM_BASE_URL = process.env.ZKM_BASE_URL || 'https://zkmgdynia.pl';

export interface ScrapedVehicle {
	bus: number;
	marka: string | null;
	model: string | null;
	photoURL: string | null;
	usb: boolean;
	klima: boolean;
	features: string[];
}

export interface ScrapeResult {
	total: number;
	vehicles: ScrapedVehicle[];
	dbUpdated: number;
	dbErrors: number;
	durationMs: number;
}

/**
 * Parsuje wiersze pojazdów z kodu HTML strony ZKM Gdynia
 */
export function parseVehiclesFromHtml(html: string): ScrapedVehicle[] {
	const parts = html.split('<div class="vehicles-row">');
	const vehicles: ScrapedVehicle[] = [];

	for (let i = 1; i < parts.length; i++) {
		const block = parts[i];

		// Numer inwentarzowy (taborowy)
		const nrMatch = block.match(/<div class="nr-inventory">\s*([0-9]+)\s*<\/div>/);
		if (!nrMatch) continue;
		const bus = parseInt(nrMatch[1], 10);

		// Marka
		const brandMatch = block.match(/<div class="detail brand-id">\s*([^<]+)\s*<\/div>/);
		const marka = brandMatch ? brandMatch[1].trim() : null;

		// Model
		const modelMatch = block.match(/<div class="detail model-id">\s*([^<]+)\s*<\/div>/);
		const model = modelMatch ? modelMatch[1].trim() : null;

		// Zdjęcie
		let photoURL: string | null = null;
		const imgMatch = block.match(/<img[^>]+src="([^">]+)"/);
		if (imgMatch) {
			const src = imgMatch[1];
			if (!src.includes('vehicle_placeholder')) {
				photoURL = src.startsWith('http') ? src : `${ZKM_BASE_URL}${src}`;
			}
		}

		// Wyposażenie / cechy
		const features: string[] = [];
		const featRegex = /<div class="equipment-el">\s*([^<]+)\s*<\/div>/g;
		let fMatch;
		while ((fMatch = featRegex.exec(block)) !== null) {
			features.push(fMatch[1].trim());
		}

		const featLower = features.map((f) => f.toLowerCase());
		const hasUsb = featLower.some((f) => f.includes('usb') || f.includes('ładowar'));
		const hasKlima = featLower.some((f) => f.includes('klima') || f.includes('klimatyzacja'));

		vehicles.push({
			bus,
			marka,
			model,
			photoURL,
			usb: hasUsb,
			klima: hasKlima,
			features
		});
	}

	return vehicles;
}

/**
 * Scrapuje wszystkie pojazdy ze wszystkich stron wyszukiwarki ZKM Gdynia
 */
export async function scrapeAllVehicles(
	onProgress?: (page: number, currentCount: number) => void
): Promise<ScrapedVehicle[]> {
	const allVehicles: ScrapedVehicle[] = [];
	let page = 1;
	const maxPages = 25; // Bezpieczny limit

	while (page <= maxPages) {
		const url =
			page === 1
				? `${ZKM_BASE_URL}/pojazdy/search`
				: `${ZKM_BASE_URL}/pojazdy/search,page${page}?`;

		const res = await fetch(url, {
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
			}
		});

		if (!res.ok) {
			console.warn(`ZKM search zwrócił status ${res.status} na stronie ${page}`);
			break;
		}

		const html = await res.text();
		const pageVehicles = parseVehiclesFromHtml(html);

		if (pageVehicles.length === 0) {
			break;
		}

		allVehicles.push(...pageVehicles);

		if (onProgress) {
			onProgress(page, allVehicles.length);
		}

		page++;
	}

	return allVehicles;
}

/**
 * Zapisuje pobrane pojazdy do pliku JSON w aplikacji jako lokalny cache
 */
export function saveVehiclesToJson(vehicles: ScrapedVehicle[]): string {
	const dataDir = path.resolve('src/lib/data');
	if (!fs.existsSync(dataDir)) {
		fs.mkdirSync(dataDir, { recursive: true });
	}

	const filePath = path.join(dataDir, 'vehicles.json');
	fs.writeFileSync(filePath, JSON.stringify(vehicles, null, 2), 'utf8');
	return filePath;
}

/**
 * Synchronizuje pobrane pojazdy z bazą Azure SQL (tabele [dbo].[busy] i [dbo].[busFeatures])
 */
export async function syncVehiclesToMSSQL(vehicles: ScrapedVehicle[]) {
	const pool = await getDbPool();
	let updated = 0;
	let errors = 0;

	for (const v of vehicles) {
		try {
			// 1. Zaktualizuj lub wstaw do tabeli [dbo].[busy]
			const check = await pool
				.request()
				.input('bus', sql.Int, v.bus)
				.query('SELECT 1 FROM [dbo].[busy] WHERE Bus = @bus');

			if (check.recordset.length > 0) {
				await pool
					.request()
					.input('bus', sql.Int, v.bus)
					.input('marka', sql.VarChar, v.marka)
					.input('model', sql.VarChar, v.model)
					.input('photoURL', sql.VarChar, v.photoURL)
					.query(
						'UPDATE [dbo].[busy] SET marka = @marka, model = @model, photoURL = @photoURL WHERE Bus = @bus'
					);
			} else {
				await pool
					.request()
					.input('bus', sql.Int, v.bus)
					.input('marka', sql.VarChar, v.marka)
					.input('model', sql.VarChar, v.model)
					.input('photoURL', sql.VarChar, v.photoURL)
					.query(
						'INSERT INTO [dbo].[busy] (Bus, marka, model, photoURL) VALUES (@bus, @marka, @model, @photoURL)'
					);
			}

			// 2. Synchronizuj cechy w [dbo].[busFeatures]
			if (v.features && v.features.length > 0) {
				await pool
					.request()
					.input('vehicleId', sql.Int, v.bus)
					.query('DELETE FROM [dbo].[busFeatures] WHERE vehicleID = @vehicleId');

				for (const feat of v.features) {
					await pool
						.request()
						.input('vehicleId', sql.Int, v.bus)
						.input('featureName', sql.VarChar, feat)
						.query('INSERT INTO [dbo].[busFeatures] (vehicleID, featureName) VALUES (@vehicleId, @featureName)');
				}
			}

			updated++;
		} catch (err) {
			console.error(`Błąd synchronizacji pojazdu ${v.bus}:`, err);
			errors++;
		}
	}

	return { updated, errors };
}
