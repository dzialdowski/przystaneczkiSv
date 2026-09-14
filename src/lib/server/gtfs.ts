import AdmZip from 'adm-zip';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { getDbPool } from './db.ts';

export interface GtfsSyncResult {
	success: boolean;
	routesCount: number;
	stopsCount: number;
	trasyCount: number;
	durationMs: number;
	error?: string;
}

export const GTFS_ZIP_URL =
	process.env.GTFS_ZIP_URL ||
	(process.env.TRISTAR_API_BASE_URL
		? `${process.env.TRISTAR_API_BASE_URL}/gtfs.zip`
		: 'http://api.zdiz.gdynia.pl/pt/gtfs.zip');

const GTFS_CACHE_DIR = path.resolve('src/lib/data');
const GTFS_ROUTES_FILE = path.join(GTFS_CACHE_DIR, 'gtfs_routes.json');

export interface RouteShapeOption {
	shapeId: number;
	headsign: string;
	count: number;
}

export interface GtfsCacheData {
	updatedAt: string;
	tripToShape: Record<string, number>;
	shapePatterns: Record<string, (number | null)[]>;
	shapeOffsets?: Record<string, number[]>;
	tripStart?: Record<string, string>;
	routeShapes?: Record<string, RouteShapeOption[]>;
}

// Pamięć podręczna w procesie dla szybkiego dostępu
let inMemoryGtfsData: GtfsCacheData | null = null;

export function getGtfsData(): GtfsCacheData | null {
	if (inMemoryGtfsData) return inMemoryGtfsData;
	if (fs.existsSync(GTFS_ROUTES_FILE)) {
		try {
			inMemoryGtfsData = JSON.parse(fs.readFileSync(GTFS_ROUTES_FILE, 'utf8'));
			return inMemoryGtfsData;
		} catch (err) {
			console.warn('Błąd czytania gtfs_routes.json:', err);
		}
	}
	return null;
}

function normalizeHeadsign(str: string): string {
	return (str || '')
		.toLowerCase()
		.replace(/\s+\d+$/, '') // usuń końcowe numery słupków np. " 01", " 02"
		.replace(/[^a-ząćęłńóśźż0-9]/gi, '')
		.trim();
}

/**
 * Rozpoznaje właściwy wariant trasy (shape_id) dla danej linii na podstawie kierunku (headsign) lub przystanku
 */
export function resolveShapeId(
	routeId: number | string,
	headsign?: string,
	fromStop?: number | string
): number | null {
	const data = getGtfsData();
	if (!data) return null;

	const rKey = String(routeId).trim();
	const shapesForRoute = data.routeShapes?.[rKey];
	if (!shapesForRoute || shapesForRoute.length === 0) {
		return null;
	}

	const stopIdNum = fromStop ? Number(fromStop) : 0;

	// 1. Jeśli podano headsign, dopasuj po nazwie kierunku
	if (headsign) {
		const cleanHs = headsign.trim();
		const normInput = normalizeHeadsign(cleanHs);

		// Próba A: Dokładne dopasowanie headsign
		const exactMatches = shapesForRoute.filter(
			(s) => s.headsign.toLowerCase() === cleanHs.toLowerCase()
		);
		if (exactMatches.length > 0) {
			if (stopIdNum > 0 && data.shapePatterns) {
				const matchWithStop = exactMatches.find((s) =>
					data.shapePatterns[String(s.shapeId)]?.includes(stopIdNum)
				);
				if (matchWithStop) return matchWithStop.shapeId;
			}
			return exactMatches[0].shapeId;
		}

		// Próba B: Znormalizowane dopasowanie (bez numeru słupka, małe litery)
		const normMatches = shapesForRoute.filter(
			(s) => normalizeHeadsign(s.headsign) === normInput
		);
		if (normMatches.length > 0) {
			if (stopIdNum > 0 && data.shapePatterns) {
				const matchWithStop = normMatches.find((s) =>
					data.shapePatterns[String(s.shapeId)]?.includes(stopIdNum)
				);
				if (matchWithStop) return matchWithStop.shapeId;
			}
			return normMatches[0].shapeId;
		}

		// Próba C: Zawieranie tekstu
		const subMatches = shapesForRoute.filter((s) => {
			const n = normalizeHeadsign(s.headsign);
			return n.includes(normInput) || normInput.includes(n);
		});
		if (subMatches.length > 0) {
			if (stopIdNum > 0 && data.shapePatterns) {
				const matchWithStop = subMatches.find((s) =>
					data.shapePatterns[String(s.shapeId)]?.includes(stopIdNum)
				);
				if (matchWithStop) return matchWithStop.shapeId;
			}
			return subMatches[0].shapeId;
		}
	}

	// 2. Jeśli nie dopasowano po headsign, ale mamy fromStop: znajdź shape zawierający ten przystanek
	if (stopIdNum > 0 && data.shapePatterns) {
		const shapeWithStop = shapesForRoute.find((s) =>
			data.shapePatterns[String(s.shapeId)]?.includes(stopIdNum)
		);
		if (shapeWithStop) return shapeWithStop.shapeId;
	}

	// 3. Fallback: najpopularniejszy wariant trasy dla tej linii (najwięcej kursów)
	return shapesForRoute[0].shapeId;
}

/**
 * Zwraca shape_id przypisany do danego trip_id
 */
export function getShapeIdForTrip(tripId: number | string): number | null {
	const data = getGtfsData();
	const key = String(tripId).trim();
	return data?.tripToShape?.[key] ?? null;
}

/**
 * Zwraca przesunięcia czasowe w minutach dla danego wariantu trasy (shape_id)
 */
export function getShapeOffsets(shapeId: number | string): number[] | null {
	const data = getGtfsData();
	const key = String(shapeId).trim();
	return data?.shapeOffsets?.[key] ?? null;
}

/**
 * Zwraca planowany czas odjazdu z pierwszego przystanku (HH:mm) dla danego kursu
 */
export function getTripStartTime(tripId: number | string): string | null {
	const data = getGtfsData();
	const key = String(tripId).trim();
	return data?.tripStart?.[key] ?? null;
}

/**
 * Główna funkcja synchronizująca trasy, linie i przystanki z GTFS
 */
export async function syncGtfsData(onProgress?: (msg: string) => void): Promise<GtfsSyncResult> {
	const startTime = Date.now();
	const log = (msg: string) => {
		console.log(`[GTFS Sync] ${msg}`);
		if (onProgress) onProgress(msg);
	};

	try {
		log('Rozpoczynanie pobierania archiwum gtfs.zip...');
		const response = await fetch(GTFS_ZIP_URL);
		if (!response.ok) {
			throw new Error(`Nie udało się pobrać pliku GTFS: HTTP ${response.status} ${response.statusText}`);
		}

		const zipBuffer = Buffer.from(await response.arrayBuffer());
		log(`Pobrano gtfs.zip (${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MB). Rozpakowywanie...`);

		const zip = new AdmZip(zipBuffer);
		const pool = await getDbPool();

		// 1. Synchronizacja linii z routes.txt
		let routesCount = 0;
		const routesEntry = zip.getEntry('routes.txt');
		if (routesEntry) {
			log('Synchronizowanie linii (routes.txt)...');
			const routesText = routesEntry.getData().toString('utf8');
			const parser = Readable.from(routesText).pipe(
				parse({
					columns: true,
					skip_empty_lines: true,
					trim: true,
					relax_quotes: true,
					relax_column_count: true
				})
			);

			const routesBatch: { routeId: number; nrBusa: string }[] = [];
			for await (const row of parser) {
				const rId = parseInt(row.route_id, 10);
				const shortName = (row.route_short_name || '').slice(0, 5).trim();
				if (!isNaN(rId) && shortName) {
					routesBatch.push({ routeId: rId, nrBusa: shortName });
				}
			}

			// Upsert linii
			for (const r of routesBatch) {
				await pool
					.request()
					.input('rId', sql.Int, r.routeId)
					.input('nrBusa', sql.NVarChar(5), r.nrBusa)
					.query(`
						MERGE [dbo].[linie] AS target
						USING (VALUES (@rId, @nrBusa)) AS source (routeID, NrBusa)
						ON (target.routeID = source.routeID)
						WHEN MATCHED THEN
							UPDATE SET NrBusa = source.NrBusa
						WHEN NOT MATCHED THEN
							INSERT (routeID, NrBusa) VALUES (source.routeID, source.NrBusa);
					`);
			}
			routesCount = routesBatch.length;
			log(`Zsynchronizowano ${routesCount} linii w tabeli [dbo].[linie].`);
		}

		// 2. Synchronizacja przystanków z stops.txt
		let stopsCount = 0;
		const stopsEntry = zip.getEntry('stops.txt');
		if (stopsEntry) {
			log('Synchronizowanie przystanków (stops.txt)...');
			const stopsText = stopsEntry.getData().toString('utf8');
			const parser = Readable.from(stopsText).pipe(
				parse({
					columns: true,
					skip_empty_lines: true,
					trim: true,
					relax_quotes: true,
					relax_column_count: true
				})
			);

			const stopsBatch: any[] = [];
			for await (const row of parser) {
				const sId = parseInt(row.stop_id, 10);
				const name = (row.stop_name || 'Przystanek').slice(0, 100).trim();
				if (!isNaN(sId)) {
					stopsBatch.push({
						id: sId,
						name,
						lat: row.stop_lat ? String(row.stop_lat).slice(0, 50) : null,
						lon: row.stop_lon ? String(row.stop_lon).slice(0, 50) : null,
						zone: row.zone_id ? String(row.zone_id).slice(0, 50) : 'Gdynia'
					});
				}
			}

			// Batch upsert dla przystanków w partiach po 100
			for (let i = 0; i < stopsBatch.length; i += 100) {
				const chunk = stopsBatch.slice(i, i + 100);
				const req = pool.request();
				const valuesClause = chunk
					.map(
						(s, idx) =>
							`(@id${idx}, @name${idx}, @lat${idx}, @lon${idx}, @zone${idx}, 0)`
					)
					.join(', ');

				chunk.forEach((s, idx) => {
					req.input(`id${idx}`, sql.Int, s.id);
					req.input(`name${idx}`, sql.NVarChar(200), s.name);
					req.input(`lat${idx}`, sql.NVarChar(50), s.lat);
					req.input(`lon${idx}`, sql.NVarChar(50), s.lon);
					req.input(`zone${idx}`, sql.NVarChar(50), s.zone);
				});

				await req.query(`
					MERGE [dbo].[przystanki] AS target
					USING (VALUES ${valuesClause}) AS source (idPrzystanku, nazwaPrzystanku, Latitude, Longitude, zoneName, subName)
					ON (target.idPrzystanku = source.idPrzystanku)
					WHEN MATCHED THEN
						UPDATE SET 
							nazwaPrzystanku = source.nazwaPrzystanku,
							Latitude = source.Latitude,
							Longitude = source.Longitude,
							zoneName = source.zoneName
					WHEN NOT MATCHED THEN
						INSERT (idPrzystanku, nazwaPrzystanku, Latitude, Longitude, zoneName, subName)
						VALUES (source.idPrzystanku, source.nazwaPrzystanku, source.Latitude, source.Longitude, source.zoneName, 0);
				`);
			}
			stopsCount = stopsBatch.length;
			log(`Zsynchronizowano ${stopsCount} przystanków w tabeli [dbo].[przystanki].`);
		}

		// 3. Mapowanie trips.txt -> shape_id
		log('Parsowanie trips.txt i tworzenie mapy trip_id -> shape_id...');
		const tripsEntry = zip.getEntry('trips.txt');
		const tripToShape: Record<string, number> = {};
		const routeShapesObj: Record<string, RouteShapeOption[]> = {};

		if (tripsEntry) {
			const tripsText = tripsEntry.getData().toString('utf8');
			const parser = Readable.from(tripsText).pipe(
				parse({
					columns: true,
					skip_empty_lines: true,
					trim: true,
					relax_quotes: true,
					relax_column_count: true
				})
			);
			const routeShapesMap = new Map<number, Map<number, { shapeId: number; headsign: string; count: number }>>();
			for await (const t of parser) {
				const sId = parseInt(t.shape_id, 10);
				const rId = parseInt(t.route_id, 10);
				const hs = (t.trip_headsign || '').trim();
				if (!isNaN(sId)) {
					tripToShape[t.trip_id] = sId;
				}
				if (!isNaN(rId) && !isNaN(sId)) {
					if (!routeShapesMap.has(rId)) routeShapesMap.set(rId, new Map());
					const m = routeShapesMap.get(rId)!;
					if (!m.has(sId)) m.set(sId, { shapeId: sId, headsign: hs, count: 0 });
					m.get(sId)!.count++;
				}
			}
			for (const [rId, shapes] of routeShapesMap.entries()) {
				routeShapesObj[String(rId)] = Array.from(shapes.values()).sort((a, b) => b.count - a.count);
			}
			inMemoryGtfsData = null;
		}

		// 4. Synchronizacja tras z stop_times.txt
		let trasyCount = 0;
		const stEntry = zip.getEntry('stop_times.txt');
		if (stEntry) {
			log('Czyszczenie tabeli [dbo].[trasy]...');
			await pool.request().query('TRUNCATE TABLE [dbo].[trasy]');

			log('Włączanie kompresji PAGE na tabeli [dbo].[trasy]...');
			await pool.request().query('ALTER TABLE [dbo].[trasy] REBUILD WITH (DATA_COMPRESSION = PAGE)');

			log('Parsowanie stop_times.txt i wyodrębnianie wariantów tras...');
			const stBuffer = stEntry.getData();
			const parser = Readable.from(stBuffer).pipe(
				parse({
					columns: true,
					skip_empty_lines: true,
					trim: true,
					relax_quotes: true,
					relax_column_count: true
				})
			);

			// Wyodrębnij unikalne sekwencje przystanków dla każdego shape_id oraz bezpośrednie kursy
			const shapeStops = new Map<number, { stopId: number | null; seq: number }[]>();

			// Kolekcjonujemy przystanki dla każdego trip_id oraz czasy
			const tripStopsCollector = new Map<number, { stopId: number | null; seq: number }[]>();
			const tripStart: Record<string, string> = {};
			const shapeTripSamples: Record<string, { tripId: string; stops: { stopId: number | null; seq: number; arr: string }[] }> = {};

			const toSec = (t: string) => {
				if (!t) return 0;
				const parts = t.split(':').map(Number);
				return parts[0] * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
			};

			for await (const row of parser) {
				const tripId = parseInt(row.trip_id, 10);
				const stopId = parseInt(row.stop_id, 10);
				const stopSeq = parseInt(row.stop_sequence, 10);
				const arr = row.arrival_time;

				if (stopSeq === 0 && arr) {
					tripStart[String(tripId)] = arr.slice(0, 5);
				}

				if (!isNaN(tripId) && !isNaN(stopSeq)) {
					if (!tripStopsCollector.has(tripId)) {
						tripStopsCollector.set(tripId, []);
					}
					tripStopsCollector.get(tripId)!.push({
						stopId: isNaN(stopId) ? null : stopId,
						seq: stopSeq
					});

					const shapeId = tripToShape[String(tripId)];
					if (shapeId) {
						const sKey = String(shapeId);
						if (!shapeTripSamples[sKey]) {
							shapeTripSamples[sKey] = { tripId: String(tripId), stops: [] };
						}
						if (shapeTripSamples[sKey].tripId === String(tripId)) {
							shapeTripSamples[sKey].stops.push({
								stopId: isNaN(stopId) ? null : stopId,
								seq: stopSeq,
								arr
							});
						}
					}
				}
			}

			// Dla każdego trip_id kojarzymy jego shape_id
			for (const [tripId, stops] of tripStopsCollector.entries()) {
				const shapeId = tripToShape[String(tripId)];
				if (shapeId && !shapeStops.has(shapeId)) {
					stops.sort((a, b) => a.seq - b.seq);
					shapeStops.set(shapeId, stops);
				}
			}

			// Oblicz typowe przesunięcia czasowe (shapeOffsets)
			const shapeOffsets: Record<string, number[]> = {};
			for (const [shapeIdStr, data] of Object.entries(shapeTripSamples)) {
				data.stops.sort((a, b) => a.seq - b.seq);
				const baseSec = toSec(data.stops[0].arr);
				shapeOffsets[shapeIdStr] = data.stops.map((s) => Math.round((toSec(s.arr) - baseSec) / 60));
			}

			log(`Zidentyfikowano ${shapeStops.size} unikalnych geometrii tras (shapes) dla wszystkich ${tripStopsCollector.size} kursów.`);

			// Zapisujemy w [dbo].[trasy]:
			// A. Każdy unikalny shape_id jako trip_id (aby bezpośrednie zapytanie z fallbackiem shapeId zawsze trafiało)
			// B. Bezpośrednie trip_id dla pierwszych ~50 000 wpisów (mieszczących się z ogromnym zapasem w 32MB)
			const BATCH_SIZE = 10000;
			let currentTable = createTrasyTable();
			let batchIndex = 0;
			const insertedKeys = new Set<string>();

			// 1. Wgraj wszystkie unikalne kształty (shapes)
			for (const [shapeId, stops] of shapeStops.entries()) {
				for (const s of stops) {
					const key = `${shapeId}:${s.seq}`;
					if (!insertedKeys.has(key)) {
						insertedKeys.add(key);
						currentTable.rows.add(shapeId, s.stopId, s.seq);
						trasyCount++;

						if (currentTable.rows.length >= BATCH_SIZE) {
							batchIndex++;
							log(`Wgrywanie partii ${batchIndex} (${trasyCount} pozycji tras)...`);
							const req = pool.request();
							(req as any).timeout = 120000;
							await req.bulk(currentTable);
							currentTable = createTrasyTable();
						}
					}
				}
			}

			// 2. Wgraj bezpośrednie powiązania trip_id -> stop_id (z limitem, żeby nie przekroczyć rozmiaru bazy)
			const MAX_DIRECT_ROWS = 50000;
			let directRows = 0;
			for (const [tripId, stops] of tripStopsCollector.entries()) {
				if (directRows >= MAX_DIRECT_ROWS) break;
				for (const s of stops) {
					const key = `${tripId}:${s.seq}`;
					if (!insertedKeys.has(key)) {
						insertedKeys.add(key);
						currentTable.rows.add(tripId, s.stopId, s.seq);
						trasyCount++;
						directRows++;

						if (currentTable.rows.length >= BATCH_SIZE) {
							batchIndex++;
							log(`Wgrywanie partii bezpośrednich kursów ${batchIndex} (${trasyCount} pozycji tras)...`);
							const req = pool.request();
							(req as any).timeout = 120000;
							await req.bulk(currentTable);
							currentTable = createTrasyTable();
						}
					}
				}
			}

			// Wgraj pozostałe rekordy w buforze
			if (currentTable.rows.length > 0) {
				batchIndex++;
				log(`Wgrywanie partii końcowej ${batchIndex} (${currentTable.rows.length} rekordów)...`);
				const req = pool.request();
				(req as any).timeout = 120000;
				await req.bulk(currentTable);
			}

			log(`Zapisano ${trasyCount} pozycji kanonicznych wariantów tras w [dbo].[trasy] w bazie Azure SQL.`);

			// Zapisz kompletne mapowanie shape Patterns do pliku JSON dla natychmiastowego dostępu offline
			try {
				if (!fs.existsSync(GTFS_CACHE_DIR)) {
					fs.mkdirSync(GTFS_CACHE_DIR, { recursive: true });
				}
				const shapePatternsObj: Record<string, (number | null)[]> = {};
				for (const [sId, stops] of shapeStops.entries()) {
					shapePatternsObj[String(sId)] = stops.map((s) => s.stopId);
				}

				fs.writeFileSync(
					GTFS_ROUTES_FILE,
					JSON.stringify({
						updatedAt: new Date().toISOString(),
						tripToShape,
						shapePatterns: shapePatternsObj,
						shapeOffsets,
						tripStart,
						routeShapes: routeShapesObj
					})
				);
				inMemoryGtfsData = null; // Zresetuj pamięć podręczną
				log(`Zapisano kompletne mapowanie GTFS do ${GTFS_ROUTES_FILE} (${(fs.statSync(GTFS_ROUTES_FILE).size / 1024).toFixed(1)} KB).`);
			} catch (cacheErr) {
				console.warn('Ostrzeżenie przy zapisie cache gtfs_routes.json:', cacheErr);
			}

			// Optymalizacja końcowa tabeli trasy
			try {
				await pool.request().query('ALTER TABLE [dbo].[trasy] REBUILD WITH (DATA_COMPRESSION = PAGE)');
				await pool.request().query("DBCC SHRINKFILE('data_0', 15)");
			} catch (shrinkErr) {
				console.warn('Ostrzeżenie przy shrinku:', shrinkErr);
			}
		}

		const durationMs = Date.now() - startTime;
		log(`Synchronizacja GTFS zakończona pełnym sukcesem w ${(durationMs / 1000).toFixed(1)} s!`);

		return {
			success: true,
			routesCount,
			stopsCount,
			trasyCount,
			durationMs
		};
	} catch (error: any) {
		console.error('[GTFS Sync] Błąd:', error);
		return {
			success: false,
			routesCount: 0,
			stopsCount: 0,
			trasyCount: 0,
			durationMs: Date.now() - startTime,
			error: error.message || 'Nieznany błąd podczas synchronizacji GTFS'
		};
	}
}

function createTrasyTable(): sql.Table {
	const table = new sql.Table('trasy');
	table.create = false;
	table.columns.add('trip_id', sql.Int, { nullable: false });
	table.columns.add('stop_id', sql.Int, { nullable: true });
	table.columns.add('stop_sequence', sql.Int, { nullable: false });
	return table;
}
