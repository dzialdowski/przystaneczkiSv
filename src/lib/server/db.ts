import fs from 'fs';
import sql from 'mssql';

/**
 * Zapewnia, że zmienne z pliku .env są załadowane do process.env w środowisku dev i skryptach Node.
 */
export function loadEnvFileIfNeeded() {
	if (typeof process.loadEnvFile === 'function') {
		try {
			process.loadEnvFile('.env');
		} catch {
			// Ignoruj jeśli już wczytany lub plik nie istnieje
		}
	}

	if (fs.existsSync('.env')) {
		try {
			const content = fs.readFileSync('.env', 'utf-8');
			for (const line of content.split(/\r?\n/)) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith('#')) continue;
				const eq = trimmed.indexOf('=');
				if (eq > 0) {
					const key = trimmed.slice(0, eq).trim();
					let val = trimmed.slice(eq + 1).trim();
					if (
						(val.startsWith('"') && val.endsWith('"')) ||
						(val.startsWith("'") && val.endsWith("'"))
					) {
						val = val.slice(1, -1);
					}
					if (process.env[key] === undefined) {
						process.env[key] = val;
					}
				}
			}
		} catch {
			// Ignoruj błędy odczytu
		}
	}
}

// Inicjalizacja natychmiast przy imporcie modułu
loadEnvFileIfNeeded();

function getSqlConfig(): sql.config {
	loadEnvFileIfNeeded();
	return {
		user: process.env.MSSQL_USER || '',
		password: process.env.MSSQL_PASSWORD || '',
		server: process.env.MSSQL_SERVER || '',
		database: process.env.MSSQL_DATABASE || '',
		port: process.env.MSSQL_PORT ? parseInt(process.env.MSSQL_PORT, 10) : 1433,
		options: {
			encrypt: process.env.MSSQL_ENCRYPT !== 'false',
			trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE !== 'false'
		},
		pool: {
			max: 10,
			min: 0,
			idleTimeoutMillis: 30000
		},
		connectionTimeout: 15000,
		requestTimeout: 15000
	};
}

let poolPromise: Promise<sql.ConnectionPool> | null = null;

export async function getDbPool(): Promise<sql.ConnectionPool> {
	if (!poolPromise) {
		const config = getSqlConfig();
		if (!config.server || !config.database) {
			const errMsg = 'Brak wymaganych zmiennych środowiskowych bazy danych MSSQL (MSSQL_SERVER, MSSQL_DATABASE). Ustaw je w pliku .env.';
			console.error(errMsg);
			throw new Error(errMsg);
		}

		poolPromise = sql.connect(config).catch((err) => {
			poolPromise = null;
			console.error('Błąd połączenia z bazą MSSQL:', err);
			throw err;
		});
	}
	return poolPromise;
}

export interface FavoriteStop {
	user_id: string;
	stop_id: string;
	stop_name: string;
}

export interface BusDetails {
	bus: number;
	marka?: string | null;
	model?: string | null;
	photoURL?: string | null;
	usb: boolean;
	klima: boolean;
	features: string[];
}

export interface UserSettings {
	userId: string;
	name: string;
	legacyMode: boolean;
}

/**
 * Pobiera ulubione przystanki użytkownika
 */
export async function getUserFavorites(userId: string): Promise<FavoriteStop[]> {
	try {
		const pool = await getDbPool();
		const result = await pool
			.request()
			.input('userId', sql.NVarChar, userId.trim())
			.query(
				'SELECT RTRIM(user_id) AS user_id, RTRIM(stop_id) AS stop_id, RTRIM(stop_name) AS stop_name FROM [dbo].[VancoFavs] WHERE RTRIM(user_id) = @userId ORDER BY stop_name'
			);

		return result.recordset.map((row) => ({
			user_id: row.user_id,
			stop_id: String(row.stop_id).trim(),
			stop_name: row.stop_name
		}));
	} catch (error) {
		console.error('Błąd pobierania ulubionych:', error);
		return [];
	}
}

/**
 * Dodaje ulubiony przystanek do bazy MSSQL
 */
export async function addFavorite(userId: string, stopId: string, stopName: string): Promise<boolean> {
	try {
		const pool = await getDbPool();
		const cleanUserId = userId.trim();
		const cleanStopId = stopId.trim();
		const cleanName = stopName.trim();

		// Sprawdź czy już istnieje
		const existing = await pool
			.request()
			.input('userId', sql.NVarChar, cleanUserId)
			.input('stopId', sql.NVarChar, cleanStopId)
			.query('SELECT 1 FROM [dbo].[VancoFavs] WHERE RTRIM(user_id) = @userId AND RTRIM(stop_id) = @stopId');

		if (existing.recordset.length > 0) {
			await pool
				.request()
				.input('userId', sql.NVarChar, cleanUserId)
				.input('stopId', sql.NVarChar, cleanStopId)
				.input('stopName', sql.NVarChar, cleanName)
				.query(
					'UPDATE [dbo].[VancoFavs] SET stop_name = @stopName WHERE RTRIM(user_id) = @userId AND RTRIM(stop_id) = @stopId'
				);
		} else {
			await pool
				.request()
				.input('userId', sql.NVarChar, cleanUserId)
				.input('stopId', sql.NVarChar, cleanStopId)
				.input('stopName', sql.NVarChar, cleanName)
				.query('INSERT INTO [dbo].[VancoFavs] (user_id, stop_id, stop_name) VALUES (@userId, @stopId, @stopName)');
		}
		return true;
	} catch (error) {
		console.error('Błąd dodawania ulubionego:', error);
		return false;
	}
}

/**
 * Aktualizuje nazwę ulubionego przystanku
 */
export async function updateFavorite(userId: string, stopId: string, stopName: string): Promise<boolean> {
	try {
		const pool = await getDbPool();
		await pool
			.request()
			.input('userId', sql.NVarChar, userId.trim())
			.input('stopId', sql.NVarChar, stopId.trim())
			.input('stopName', sql.NVarChar, stopName.trim())
			.query(
				'UPDATE [dbo].[VancoFavs] SET stop_name = @stopName WHERE RTRIM(user_id) = @userId AND RTRIM(stop_id) = @stopId'
			);
		return true;
	} catch (error) {
		console.error('Błąd aktualizacji ulubionego:', error);
		return false;
	}
}

/**
 * Usuwa przystanek z ulubionych
 */
export async function deleteFavorite(userId: string, stopId: string): Promise<boolean> {
	try {
		const pool = await getDbPool();
		await pool
			.request()
			.input('userId', sql.NVarChar, userId.trim())
			.input('stopId', sql.NVarChar, stopId.trim())
			.query('DELETE FROM [dbo].[VancoFavs] WHERE RTRIM(user_id) = @userId AND RTRIM(stop_id) = @stopId');
		return true;
	} catch (error) {
		console.error('Błąd usuwania ulubionego:', error);
		return false;
	}
}

/**
 * Pobiera ustawienia użytkownika z [dbo].[VancoUsers]
 */
export async function getUserSettings(userId: string, defaultName = 'Użytkownik'): Promise<UserSettings> {
	try {
		const pool = await getDbPool();
		const result = await pool
			.request()
			.input('userId', sql.VarChar, userId.trim())
			.query('SELECT userID, Name, LegacyMode FROM [dbo].[VancoUsers] WHERE RTRIM(userID) = @userId');

		if (result.recordset.length > 0) {
			const row = result.recordset[0];
			return {
				userId: String(row.userID).trim(),
				name: row.Name || defaultName,
				legacyMode: Boolean(row.LegacyMode)
			};
		}

		// Jeśli użytkownik jeszcze nie istnieje w tabeli, dodaj go z LegacyMode = false
		await pool
			.request()
			.input('userId', sql.VarChar, userId.trim())
			.input('name', sql.VarChar, defaultName)
			.query('INSERT INTO [dbo].[VancoUsers] (userID, Name, LegacyMode) VALUES (@userId, @name, 0)');

		return {
			userId: userId.trim(),
			name: defaultName,
			legacyMode: false
		};
	} catch (error) {
		console.error('Błąd pobierania ustawień usera:', error);
		return {
			userId: userId.trim(),
			name: defaultName,
			legacyMode: false
		};
	}
}

/**
 * Przełącza tryb LegacyMode dla użytkownika
 */
export async function toggleLegacyMode(userId: string, currentMode: boolean, name?: string): Promise<boolean> {
	try {
		const pool = await getDbPool();
		const newMode = !currentMode;
		const cleanUserId = userId.trim();

		const check = await pool
			.request()
			.input('userId', sql.VarChar, cleanUserId)
			.query('SELECT 1 FROM [dbo].[VancoUsers] WHERE RTRIM(userID) = @userId');

		if (check.recordset.length > 0) {
			await pool
				.request()
				.input('userId', sql.VarChar, cleanUserId)
				.input('mode', sql.Bit, newMode)
				.query('UPDATE [dbo].[VancoUsers] SET LegacyMode = @mode WHERE RTRIM(userID) = @userId');
		} else {
			await pool
				.request()
				.input('userId', sql.VarChar, cleanUserId)
				.input('name', sql.VarChar, name || 'Użytkownik')
				.input('mode', sql.Bit, newMode)
				.query('INSERT INTO [dbo].[VancoUsers] (userID, Name, LegacyMode) VALUES (@userId, @name, @mode)');
		}
		return newMode;
	} catch (error) {
		console.error('Błąd toggleLegacyMode:', error);
		return currentMode;
	}
}

/**
 * Pobiera dane techniczne pojazdu (marka, model, zdjęcie, udogodnienia)
 */
export async function getBusDetails(vehicleCode: number): Promise<BusDetails | null> {
	try {
		const pool = await getDbPool();

		const [busRes, featRes] = await Promise.all([
			pool
				.request()
				.input('bus', sql.Int, vehicleCode)
				.query('SELECT TOP 1 Bus, marka, model, photoURL FROM [dbo].[busy] WHERE Bus = @bus'),
			pool
				.request()
				.input('vehicleId', sql.Int, vehicleCode)
				.query('SELECT featureName FROM [dbo].[busFeatures] WHERE vehicleID = @vehicleId')
		]);

		const features = featRes.recordset.map((f) => String(f.featureName).trim());
		const featLower = features.map((f) => f.toLowerCase());
		const hasUsb = featLower.some((f) => f.includes('usb') || f.includes('ładowar'));
		const hasKlima = featLower.some((f) => f.includes('klima') || f.includes('ac'));

		if (busRes.recordset.length > 0) {
			const b = busRes.recordset[0];
			return {
				bus: b.Bus,
				marka: b.marka,
				model: b.model,
				photoURL: b.photoURL,
				usb: hasUsb,
				klima: hasKlima,
				features
			};
		}

		return {
			bus: vehicleCode,
			marka: null,
			model: null,
			photoURL: null,
			usb: hasUsb,
			klima: hasKlima,
			features
		};
	} catch {
		return null;
	}
}

/**
 * Pobiera nazwę linii z bazy [dbo].[linie]
 */
export async function getRouteNameFromDb(routeId: number): Promise<string | null> {
	try {
		const pool = await getDbPool();
		const result = await pool
			.request()
			.input('routeId', sql.Int, routeId)
			.query('SELECT NrBusa FROM [dbo].[linie] WHERE routeID = @routeId');

		if (result.recordset.length > 0 && result.recordset[0].NrBusa) {
			return String(result.recordset[0].NrBusa).trim();
		}
		return null;
	} catch {
		return null;
	}
}

export interface GetRouteStopsOptions {
	shapeId?: number;
	tripId?: number;
	headsign?: string;
	fromStop?: number;
}

/**
 * Pobiera listę przystanków na trasie danego kursu/wariantu trasy
 */
export async function getRouteStops(
	routeId: number,
	optionsOrTripId?: GetRouteStopsOptions | number
) {
	try {
		let shapeId: number | null = null;
		let tripId = 0;
		let headsign: string | undefined;
		let fromStop: number | undefined;

		if (typeof optionsOrTripId === 'number') {
			tripId = optionsOrTripId;
		} else if (optionsOrTripId) {
			shapeId = optionsOrTripId.shapeId || null;
			tripId = optionsOrTripId.tripId || 0;
			headsign = optionsOrTripId.headsign;
			fromStop = optionsOrTripId.fromStop;
		}

		const { resolveShapeId, getShapeIdForTrip, getGtfsData } = await import('./gtfs.ts');

		// 1. Rozpoznaj właściwy wariant trasy (shape_id) dla tej linii
		if (!shapeId) {
			shapeId = resolveShapeId(routeId, headsign, fromStop);
		}

		// 2. Jeśli nadal brak, sprawdź mapowanie tripId -> shapeId
		if (!shapeId && tripId > 0) {
			shapeId = getShapeIdForTrip(tripId);
		}

		// 3. Fallback: najpopularniejszy wariant trasy dla danej linii
		if (!shapeId) {
			const gtfs = getGtfsData();
			const shapesForRoute = gtfs?.routeShapes?.[String(routeId)];
			if (shapesForRoute && shapesForRoute.length > 0) {
				shapeId = shapesForRoute[0].shapeId;
			}
		}

		const pool = await getDbPool();
		const targetId = shapeId || tripId;

		const result = await pool
			.request()
			.input('targetId', sql.Int, targetId)
			.query(`
				SELECT 
					t.stop_id AS stopID, 
					t.stop_sequence AS stopSequence,
					COALESCE(p.nazwaPrzystanku, 'Słupek ' + CAST(t.stop_id AS NVARCHAR(20))) AS nazwaPrzystanku,
					p.Latitude,
					p.Longitude,
					p.zoneName
				FROM [dbo].[trasy] t
				LEFT JOIN [dbo].[przystanki] p ON t.stop_id = p.idPrzystanku
				WHERE t.trip_id = @targetId
				ORDER BY t.stop_sequence
			`);

		// Jeśli w bazie nic nie ma, sprawdź bufor GTFS (shapePatterns)
		if (result.recordset.length === 0 && shapeId) {
			const gtfs = getGtfsData();
			const cachedStops = gtfs?.shapePatterns?.[String(shapeId)];
			if (cachedStops && cachedStops.length > 0) {
				const stopIds = cachedStops.filter((id): id is number => id !== null);
				if (stopIds.length > 0) {
					const stopsRes = await pool.request().query(`
						SELECT idPrzystanku, nazwaPrzystanku, Latitude, Longitude, zoneName
						FROM [dbo].[przystanki]
						WHERE idPrzystanku IN (${stopIds.join(',')})
					`);
					const stopsMap = new Map(stopsRes.recordset.map((r) => [r.idPrzystanku, r]));
					return stopIds.map((sId, idx) => {
						const row = stopsMap.get(sId);
						return {
							stopId: sId,
							stopName: row?.nazwaPrzystanku?.trim() || `Słupek ${sId}`,
							stopSequence: idx,
							lat: row?.Latitude ? parseFloat(row.Latitude) : undefined,
							lon: row?.Longitude ? parseFloat(row.Longitude) : undefined,
							zone: row?.zoneName?.trim() || undefined
						};
					});
				}
			}
		}

		return result.recordset.map((row) => ({
			stopId: Number(row.stopID),
			stopName: String(row.nazwaPrzystanku).trim(),
			stopSequence: Number(row.stopSequence),
			lat: row.Latitude ? parseFloat(row.Latitude) : undefined,
			lon: row.Longitude ? parseFloat(row.Longitude) : undefined,
			zone: row.zoneName ? String(row.zoneName).trim() : undefined
		}));
	} catch (error) {
		console.error('Błąd getRouteStops:', error);
		return [];
	}
}

/**
 * Pobiera wszystkich użytkowników i ulubione dla panelu admina
 */
export async function getAdminData() {
	try {
		const pool = await getDbPool();
		const [favs, users, vehicles] = await Promise.all([
			pool.request().query('SELECT RTRIM(user_id) AS user_id, RTRIM(stop_id) AS stop_id, RTRIM(stop_name) AS stop_name FROM [dbo].[VancoFavs]'),
			pool.request().query('SELECT RTRIM(userID) AS userID, RTRIM(Name) AS Name, LegacyMode FROM [dbo].[VancoUsers]'),
			pool.request().query('SELECT Bus, marka, model, photoURL FROM [dbo].[busy] ORDER BY Bus')
		]);

		return {
			favs: favs.recordset,
			users: users.recordset,
			vehicles: vehicles.recordset
		};
	} catch (error) {
		console.error('Błąd getAdminData:', error);
		return { favs: [], users: [], vehicles: [] };
	}
}
