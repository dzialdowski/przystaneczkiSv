/**
 * Moduł narzędziowy do obsługi czasu w polskiej strefie czasowej (Europe/Warsaw).
 * Zapewnia poprawną obsługę czasu lokalnego ZKM Gdynia / TRISTAR niezależnie od tego,
 * czy serwer działa w strefie UTC (np. Azure App Service / Docker / Linux), czy lokalnie.
 */

export interface WarsawTime {
	hours: number;
	minutes: number;
	seconds: number;
	nowMinutes: number;
	timeString: string;
}

/**
 * Zwraca bieżący czas w strefie czasowej Europe/Warsaw (uwzględniając czas letni CEST i zimowy CET)
 */
export function getWarsawTime(date = new Date()): WarsawTime {
	const formatter = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/Warsaw',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	});

	const parts = formatter.formatToParts(date);
	const hours = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
	const minutes = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
	const seconds = parseInt(parts.find((p) => p.type === 'second')?.value || '0', 10);
	const nowMinutes = hours * 60 + minutes + seconds / 60;
	const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

	return { hours, minutes, seconds, nowMinutes, timeString };
}

/**
 * Oblicza różnicę w minutach pomiędzy czasem docelowym a bieżącym (targetMin - currentMin)
 * z poprawnym zawijaniem doby (-720 .. +720 minut).
 */
export function diffMinutes(targetMin: number, currentMin: number): number {
	let diff = (targetMin - currentMin) % 1440;
	if (diff < -720) diff += 1440;
	if (diff > 720) diff -= 1440;
	return diff;
}
