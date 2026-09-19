import { env } from '$env/dynamic/public';

export const DEFAULT_CARTO_STYLE = 'voyager';
export const CARTO_ATTRIBUTION =
	'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>';

/**
 * Zwraca szablon URL kafelków rastrowych CARTO Basemaps.
 * Jeśli podano klucz API lub zdefiniowano go w zmiennych środowiskowych
 * (PUBLIC_CARTO_API_KEY, CARTO_API_KEY, PUBLIC_CARTO_BASEMAPS_API_KEY, CARTO_BASEMAPS_API_KEY),
 * do adresu doklejany jest parametr `?key=...`, co usuwa znak wodny
 * i autoryzuje żądania zgodnie z wymogami CARTO.
 *
 * @param apiKey - Opcjonalny bezpośredni klucz API (jeśli niepodany, pobierany ze środowiska)
 * @param style - Styl mapy CARTO (np. 'voyager', 'dark_all', 'light_all'). Domyślnie 'voyager'.
 */
export function getCartoTileUrl(apiKey?: string, style: string = DEFAULT_CARTO_STYLE): string {
	const key =
		(apiKey && apiKey.trim().length > 0 ? apiKey : '') ||
		env?.PUBLIC_CARTO_API_KEY ||
		env?.PUBLIC_CARTO_BASEMAPS_API_KEY ||
		(typeof process !== 'undefined'
			? process.env?.PUBLIC_CARTO_API_KEY ||
				process.env?.CARTO_API_KEY ||
				process.env?.PUBLIC_CARTO_BASEMAPS_API_KEY ||
				process.env?.CARTO_BASEMAPS_API_KEY
			: '') ||
		'';

	const trimmedKey = typeof key === 'string' ? key.trim() : '';
	const baseUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}{r}.png`;

	if (trimmedKey) {
		return `${baseUrl}?key=${encodeURIComponent(trimmedKey)}`;
	}

	return baseUrl;
}
