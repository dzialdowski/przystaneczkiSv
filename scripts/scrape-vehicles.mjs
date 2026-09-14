import fs from 'fs';
import path from 'path';
import sql from 'mssql';

// Ładowanie zmiennych środowiskowych z .env w Node.js
if (fs.existsSync('.env')) {
	try {
		process.loadEnvFile?.('.env');
	} catch {
		// loadEnvFile jest dostępne od Node.js 20.6.0+
	}
}

const ZKM_BASE_URL = process.env.ZKM_BASE_URL || 'https://zkmgdynia.pl';

const sqlConfig = {
	user: process.env.MSSQL_USER || '',
	password: process.env.MSSQL_PASSWORD || '',
	server: process.env.MSSQL_SERVER || 'localhost',
	database: process.env.MSSQL_DATABASE || '',
	port: process.env.MSSQL_PORT ? parseInt(process.env.MSSQL_PORT, 10) : 1433,
	options: {
		encrypt: process.env.MSSQL_ENCRYPT !== 'false',
		trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE !== 'false'
	},
	connectionTimeout: 15000,
	requestTimeout: 15000
};

function parseVehiclesFromHtml(html) {
	const parts = html.split('<div class="vehicles-row">');
	const vehicles = [];

	for (let i = 1; i < parts.length; i++) {
		const block = parts[i];

		const nrMatch = block.match(/<div class="nr-inventory">\s*([0-9]+)\s*<\/div>/);
		if (!nrMatch) continue;
		const bus = parseInt(nrMatch[1], 10);

		const brandMatch = block.match(/<div class="detail brand-id">\s*([^<]+)\s*<\/div>/);
		const marka = brandMatch ? brandMatch[1].trim() : null;

		const modelMatch = block.match(/<div class="detail model-id">\s*([^<]+)\s*<\/div>/);
		const model = modelMatch ? modelMatch[1].trim() : null;

		let photoURL = null;
		const imgMatch = block.match(/<img[^>]+src="([^">]+)"/);
		if (imgMatch) {
			const src = imgMatch[1];
			if (!src.includes('vehicle_placeholder')) {
				photoURL = src.startsWith('http') ? src : `${ZKM_BASE_URL}${src}`;
			}
		}

		const features = [];
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

async function scrapeAndSync() {
	console.log(`🚀 Rozpoczynam scrapowanie pojazdów z ${ZKM_BASE_URL}/pojazdy/search ...`);
	const startTime = Date.now();
	const allVehicles = [];
	let page = 1;

	while (page <= 30) {
		const url =
			page === 1
				? `${ZKM_BASE_URL}/pojazdy/search`
				: `${ZKM_BASE_URL}/pojazdy/search,page${page}?`;

		process.stdout.write(`⏳ Pobieranie strony ${page}... `);
		try {
			const res = await fetch(url, {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
				}
			});

			if (!res.ok) {
				console.log(`Błąd HTTP ${res.status}`);
				break;
			}

			const html = await res.text();
			const vehicles = parseVehiclesFromHtml(html);

			if (vehicles.length === 0) {
				console.log('Brak dalszych pojazdów. Koniec stron.');
				break;
			}

			allVehicles.push(...vehicles);
			console.log(`znaleziono ${vehicles.length} pojazdów (łącznie: ${allVehicles.length})`);
			page++;
		} catch (err) {
			console.error(`Błąd na stronie ${page}:`, err.message);
			break;
		}
	}

	console.log(`\n✅ Pomyślnie zescrapowano ${allVehicles.length} pojazdów z ZKM Gdynia!`);

	// Zapisz do JSON
	const outDir = path.resolve('src/lib/data');
	if (!fs.existsSync(outDir)) {
		fs.mkdirSync(outDir, { recursive: true });
	}
	const jsonPath = path.join(outDir, 'vehicles.json');
	fs.writeFileSync(jsonPath, JSON.stringify(allVehicles, null, 2), 'utf8');
	console.log(`📁 Zapisano dane do pliku: ${jsonPath}`);

	// Synchronizacja z bazą MSSQL
	if (!sqlConfig.server || !sqlConfig.database || !sqlConfig.user) {
		console.log('ℹ️ Pomijanie synchronizacji MSSQL (brak zmiennych MSSQL_* w .env). Dane zapisano do pliku JSON.');
		return;
	}

	console.log(`\n🔄 Łączenie z bazą MSSQL (${sqlConfig.server})...`);
	let pool;
	try {
		pool = await sql.connect(sqlConfig);
		console.log('✅ Połączono z bazą MSSQL. Aktualizowanie tabel [busy] i [busFeatures]...');

		let updated = 0;
		for (const v of allVehicles) {
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

			if (v.features && v.features.length > 0) {
				await pool
					.request()
					.input('vehicleId', sql.Int, v.bus)
					.query('DELETE FROM [dbo].[busFeatures] WHERE vehicleID = @vehicleId');

				for (const feat of v.features) {
					await pool
						.request()
						.input('vehicleId', sql.Int, v.bus)
						.input('feat', sql.VarChar, feat)
						.query(
							'INSERT INTO [dbo].[busFeatures] (vehicleID, featureName) VALUES (@vehicleId, @feat)'
						);
				}
			}

			updated++;
		}

		console.log(`🎉 Zaktualizowano ${updated} pojazdów w bazie MSSQL!`);
	} catch (err) {
		console.error('⚠️ Błąd synchronizacji z bazą MSSQL:', err.message);
	} finally {
		if (pool) await pool.close();
	}

	const duration = ((Date.now() - startTime) / 1000).toFixed(1);
	console.log(`✨ Gotowe w ${duration}s!`);
}

scrapeAndSync();
