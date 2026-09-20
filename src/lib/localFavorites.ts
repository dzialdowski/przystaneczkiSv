import { browser } from '$app/environment';
import type { FavoriteStop } from './server/db';

const DB_NAME = 'przystaneczki_db';
const DB_VERSION = 1;
const STORE_NAME = 'favorites';

/**
 * Otwiera połączenie z bazą IndexedDB w przeglądarce.
 */
export function openFavoritesDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (!browser || typeof window === 'undefined' || typeof indexedDB === 'undefined') {
			return reject(new Error('IndexedDB jest niedostępne poza środowiskiem przeglądarki.'));
		}

		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: 'stop_id' });
				store.createIndex('stop_name', 'stop_name', { unique: false });
				store.createIndex('created_at', 'created_at', { unique: false });
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error || new Error('Błąd otwierania bazy IndexedDB'));
	});
}

/**
 * Pobiera wszystkie lokalne ulubione przystanki z IndexedDB.
 */
export async function getLocalFavorites(): Promise<FavoriteStop[]> {
	if (!browser || typeof window === 'undefined' || typeof indexedDB === 'undefined') {
		return [];
	}

	try {
		const db = await openFavoritesDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readonly');
			const store = tx.objectStore(STORE_NAME);
			const req = store.getAll();

			req.onsuccess = () => {
				const list = (req.result || []).map((item: any) => ({
					user_id: 'local',
					stop_id: String(item.stop_id).trim(),
					stop_name: String(item.stop_name || '').trim()
				}));
				// Posortuj alfabetycznie wg nazwy przystanku
				list.sort((a: FavoriteStop, b: FavoriteStop) => a.stop_name.localeCompare(b.stop_name, 'pl'));
				resolve(list);
			};

			req.onerror = () => reject(req.error || new Error('Błąd odczytu przystanków z IndexedDB'));
		});
	} catch (err) {
		console.error('Błąd pobierania lokalnych ulubionych:', err);
		return [];
	}
}

/**
 * Zapisuje lub aktualizuje lokalny ulubiony przystanek w IndexedDB.
 */
export async function saveLocalFavorite(stopId: string, stopName: string): Promise<FavoriteStop> {
	const cleanId = String(stopId).trim();
	const cleanName = String(stopName).trim();

	if (!cleanId) throw new Error('ID przystanku jest wymagane');
	if (!cleanName) throw new Error('Nazwa przystanku jest wymagana');

	const favRecord = {
		user_id: 'local',
		stop_id: cleanId,
		stop_name: cleanName,
		created_at: Date.now()
	};

	const db = await openFavoritesDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const req = store.put(favRecord);

		req.onsuccess = () => {
			resolve({
				user_id: 'local',
				stop_id: cleanId,
				stop_name: cleanName
			});
		};

		req.onerror = () => reject(req.error || new Error('Błąd zapisu w IndexedDB'));
	});
}

/**
 * Usuwa przystanek z lokalnego magazynu IndexedDB.
 */
export async function deleteLocalFavorite(stopId: string): Promise<boolean> {
	const cleanId = String(stopId).trim();
	if (!cleanId) return false;

	const db = await openFavoritesDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const req = store.delete(cleanId);

		req.onsuccess = () => resolve(true);
		req.onerror = () => reject(req.error || new Error('Błąd usuwania z IndexedDB'));
	});
}

/**
 * Czyści wszystkie lokalne ulubione w IndexedDB.
 */
export async function clearLocalFavorites(): Promise<boolean> {
	const db = await openFavoritesDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const req = store.clear();

		req.onsuccess = () => resolve(true);
		req.onerror = () => reject(req.error || new Error('Błąd czyszczenia IndexedDB'));
	});
}

/**
 * Zapisuje zbiorczo listę przystanków do IndexedDB.
 */
export async function importFavoritesIntoLocal(
	list: Array<{ stop_id: string; stop_name: string }>
): Promise<{ added: number; updated: number }> {
	const db = await openFavoritesDb();
	const existing = await getLocalFavorites();
	const existingIds = new Set(existing.map((f) => f.stop_id));

	let added = 0;
	let updated = 0;

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);

		for (const item of list) {
			const cleanId = String(item.stop_id).trim();
			const cleanName = String(item.stop_name).trim();
			if (!cleanId || !cleanName) continue;

			if (existingIds.has(cleanId)) {
				updated++;
			} else {
				added++;
				existingIds.add(cleanId);
			}

			store.put({
				user_id: 'local',
				stop_id: cleanId,
				stop_name: cleanName,
				created_at: Date.now()
			});
		}

		tx.oncomplete = () => resolve({ added, updated });
		tx.onerror = () => reject(tx.error || new Error('Błąd importu do IndexedDB'));
	});
}

/**
 * Format eksportu danych ulubionych przystanków.
 */
export interface FavoritesExportData {
	app: 'przystaneczki';
	version: number;
	exportedAt: string;
	total: number;
	favorites: Array<{
		stop_id: string;
		stop_name: string;
	}>;
}

/**
 * Generuje sformatowany ciąg JSON do pobrania.
 */
export function exportFavoritesToJson(favorites: FavoriteStop[]): string {
	const data: FavoritesExportData = {
		app: 'przystaneczki',
		version: 1,
		exportedAt: new Date().toISOString(),
		total: favorites.length,
		favorites: favorites.map((f) => ({
			stop_id: String(f.stop_id).trim(),
			stop_name: String(f.stop_name).trim()
		}))
	};
	return JSON.stringify(data, null, 2);
}

/**
 * Wywołuje pobranie pliku JSON w przeglądarce.
 */
export function downloadJsonFile(filename: string, content: string): void {
	if (!browser || typeof window === 'undefined') return;

	const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

export interface ParseImportResult {
	valid: boolean;
	favorites: Array<{ stop_id: string; stop_name: string }>;
	error?: string;
	totalFound: number;
}

/**
 * Bezpiecznie parsuje i waliduje plik JSON zaimportowany przez użytkownika.
 * Obsługuje format standardowy aplikacji, proste tablice [{stop_id, stop_name}] lub alternatywne klucze (stopId, stopName).
 */
export function parseFavoritesJson(jsonText: string): ParseImportResult {
	if (!jsonText || !jsonText.trim()) {
		return { valid: false, favorites: [], totalFound: 0, error: 'Plik jest pusty.' };
	}

	let parsed: any;
	try {
		parsed = JSON.parse(jsonText);
	} catch (e: any) {
		return { valid: false, favorites: [], totalFound: 0, error: 'Nieprawidłowy format JSON: ' + (e?.message || 'Błąd składni') };
	}

	let rawList: any[] = [];

	if (Array.isArray(parsed)) {
		rawList = parsed;
	} else if (parsed && typeof parsed === 'object') {
		if (Array.isArray(parsed.favorites)) {
			rawList = parsed.favorites;
		} else if (Array.isArray(parsed.stops)) {
			rawList = parsed.stops;
		} else if (Array.isArray(parsed.przystanki)) {
			rawList = parsed.przystanki;
		} else {
			return {
				valid: false,
				favorites: [],
				totalFound: 0,
				error: 'Nie znaleziono listy przystanków w pliku JSON (oczekiwano tablicy lub obiektu z polem "favorites").'
			};
		}
	} else {
		return { valid: false, favorites: [], totalFound: 0, error: 'Nieprawidłowa struktura pliku JSON.' };
	}

	const sanitizedMap = new Map<string, string>();

	for (const item of rawList) {
		if (!item || typeof item !== 'object') continue;

		const id = String(item.stop_id ?? item.stopId ?? item.id ?? item.stopID ?? '').trim();
		const name = String(item.stop_name ?? item.stopName ?? item.name ?? item.nazwaPrzystanku ?? '').trim();

		if (id && name) {
			sanitizedMap.set(id, name);
		}
	}

	const favorites = Array.from(sanitizedMap.entries()).map(([stop_id, stop_name]) => ({
		stop_id,
		stop_name
	}));

	if (favorites.length === 0) {
		return {
			valid: false,
			favorites: [],
			totalFound: 0,
			error: 'Plik JSON nie zawiera żadnych poprawnych przystanków (wymagane pola stop_id oraz stop_name).'
		};
	}

	return {
		valid: true,
		favorites,
		totalFound: favorites.length
	};
}
