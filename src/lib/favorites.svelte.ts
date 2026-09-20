import { browser } from '$app/environment';
import type { FavoriteStop } from './server/db';
import {
	getLocalFavorites,
	saveLocalFavorite,
	deleteLocalFavorite,
	clearLocalFavorites,
	importFavoritesIntoLocal,
	exportFavoritesToJson,
	downloadJsonFile
} from './localFavorites';

function cleanStopName(raw: string): string {
	return raw
		.replace(/^[⭐📍]\s*/, '')
		.replace(/\s*\([^)]*\)\s*$/, '')
		.trim();
}

class FavoritesManager {
	items = $state<FavoriteStop[]>([]);
	isLoaded = $state(false);
	isLocal = $state(false);
	userId = $state<string | null>(null);
	localCount = $state(0);

	/**
	 * Inicjalizuje listę ulubionych w zależności od statusu zalogowania.
	 */
	async init(
		user: { id: string | number; first_name?: string } | null,
		serverFavorites: FavoriteStop[] = []
	) {
		if (!browser) return;

		if (user) {
			this.userId = String(user.id);
			this.isLocal = false;
			this.items = serverFavorites || [];
			this.isLoaded = true;

			// Sprawdź czy w tej przeglądarce istnieją niezsynchronizowane przystanki lokalne
			try {
				const local = await getLocalFavorites();
				this.localCount = local.length;
			} catch {
				this.localCount = 0;
			}
		} else {
			this.userId = null;
			this.isLocal = true;
			try {
				const local = await getLocalFavorites();
				this.items = local;
				this.localCount = local.length;
			} catch (err) {
				console.error('Błąd inicjalizacji ulubionych z IndexedDB:', err);
				this.items = [];
				this.localCount = 0;
			}
			this.isLoaded = true;
		}
	}

	/**
	 * Sprawdza czy dany przystanek znajduje się na liście ulubionych.
	 */
	isFavorite(stopId: string | number): boolean {
		const sId = String(stopId).trim();
		return this.items.some((f) => String(f.stop_id).trim() === sId);
	}

	/**
	 * Przełącza status ulubionego (dodaje jeśli brak, usuwa jeśli już jest).
	 */
	async toggle(
		stopId: string | number,
		stopName: string
	): Promise<{ isFavorite: boolean; success: boolean }> {
		const sId = String(stopId).trim();
		const name = cleanStopName(stopName);

		if (this.isFavorite(sId)) {
			const ok = await this.remove(sId);
			return { isFavorite: !ok, success: ok };
		} else {
			const ok = await this.add(sId, name);
			return { isFavorite: ok, success: ok };
		}
	}

	/**
	 * Dodaje przystanek do ulubionych (lokalnie w IndexedDB lub w chmurze serwera).
	 */
	async add(stopId: string | number, stopName: string): Promise<boolean> {
		const sId = String(stopId).trim();
		const name = cleanStopName(stopName);
		if (!sId || !name) return false;

		if (this.isLocal) {
			try {
				const saved = await saveLocalFavorite(sId, name);
				// Odśwież posortowaną listę
				this.items = await getLocalFavorites();
				this.localCount = this.items.length;
				return true;
			} catch (err) {
				console.error('Błąd zapisu przystanku w IndexedDB:', err);
				return false;
			}
		} else {
			try {
				const res = await fetch('/api/favorites', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ stopId: sId, stopName: name })
				});

				if (res.ok) {
					this.items = [
						...this.items.filter((f) => String(f.stop_id).trim() !== sId),
						{ user_id: this.userId || '', stop_id: sId, stop_name: name }
					].sort((a, b) => a.stop_name.localeCompare(b.stop_name, 'pl'));
					return true;
				}
				return false;
			} catch (err) {
				console.error('Błąd zapisu przystanku na serwerze:', err);
				return false;
			}
		}
	}

	/**
	 * Usuwa przystanek z ulubionych.
	 */
	async remove(stopId: string | number): Promise<boolean> {
		const sId = String(stopId).trim();
		if (!sId) return false;

		if (this.isLocal) {
			try {
				await deleteLocalFavorite(sId);
				this.items = this.items.filter((f) => String(f.stop_id).trim() !== sId);
				this.localCount = this.items.length;
				return true;
			} catch (err) {
				console.error('Błąd usuwania przystanku z IndexedDB:', err);
				return false;
			}
		} else {
			try {
				const res = await fetch(`/api/favorites?stopId=${encodeURIComponent(sId)}`, {
					method: 'DELETE'
				});

				if (res.ok) {
					this.items = this.items.filter((f) => String(f.stop_id).trim() !== sId);
					return true;
				}
				return false;
			} catch (err) {
				console.error('Błąd usuwania przystanku z serwera:', err);
				return false;
			}
		}
	}

	/**
	 * Aktualizuje własną nazwę przystanku.
	 */
	async updateName(stopId: string | number, newName: string): Promise<boolean> {
		const sId = String(stopId).trim();
		const name = cleanStopName(newName);
		if (!sId || !name) return false;

		if (this.isLocal) {
			try {
				await saveLocalFavorite(sId, name);
				this.items = await getLocalFavorites();
				return true;
			} catch (err) {
				console.error('Błąd aktualizacji nazwy w IndexedDB:', err);
				return false;
			}
		} else {
			try {
				const res = await fetch('/api/favorites', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ stopId: sId, stopName: name, action: 'update' })
				});

				if (res.ok) {
					this.items = this.items
						.map((f) => (String(f.stop_id).trim() === sId ? { ...f, stop_name: name } : f))
						.sort((a, b) => a.stop_name.localeCompare(b.stop_name, 'pl'));
					return true;
				}
				return false;
			} catch (err) {
				console.error('Błąd aktualizacji nazwy na serwerze:', err);
				return false;
			}
		}
	}

	/**
	 * Importuje przystanki z przetworzonej listy do aktualnego magazynu (IndexedDB lub serwera).
	 */
	async importFromList(
		list: Array<{ stop_id: string; stop_name: string }>
	): Promise<{ added: number; updated: number }> {
		if (this.isLocal) {
			const result = await importFavoritesIntoLocal(list);
			this.items = await getLocalFavorites();
			this.localCount = this.items.length;
			return result;
		} else {
			let added = 0;
			let updated = 0;

			for (const item of list) {
				const sId = String(item.stop_id).trim();
				const sName = cleanStopName(item.stop_name);
				if (!sId || !sName) continue;

				const exists = this.isFavorite(sId);
				const ok = await this.add(sId, sName);
				if (ok) {
					if (exists) updated++;
					else added++;
				}
			}

			return { added, updated };
		}
	}

	/**
	 * Pobiera plik JSON z aktualnymi przystankami.
	 */
	exportData(): void {
		const json = exportFavoritesToJson(this.items);
		const dateStr = new Date().toISOString().slice(0, 10);
		downloadJsonFile(`przystaneczki-ulubione-${dateStr}.json`, json);
	}

	/**
	 * Scalenie lokalnych przystanków z IndexedDB z kontem na serwerze.
	 */
	async mergeLocalDbToServer(): Promise<{ count: number }> {
		if (!this.userId) return { count: 0 };

		const localList = await getLocalFavorites();
		let count = 0;

		for (const item of localList) {
			if (!this.isFavorite(item.stop_id)) {
				const ok = await this.add(item.stop_id, item.stop_name);
				if (ok) count++;
			}
		}

		// Po udanym scaleniu czyścimy magazyn lokalny, by uniknąć duplikatów
		await clearLocalFavorites();
		this.localCount = 0;

		return { count };
	}

	/**
	 * Odrzuca lub usuwa lokalne przystanki z IndexedDB.
	 */
	async dismissLocalDb(): Promise<void> {
		await clearLocalFavorites();
		this.localCount = 0;
	}
}

export const favoritesManager = new FavoritesManager();
