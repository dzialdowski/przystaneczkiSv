import { getBusDetails, getRouteNameFromDb } from './db';
import { getLinesForStop, getStopLinesMap, type StopLineInfo } from './gtfs';

export type { StopLineInfo };

export const TRISTAR_API_BASE_URL = process.env.TRISTAR_API_BASE_URL || 'http://api.zdiz.gdynia.pl/pt';

export interface RawDelayItem {
	id: string;
	delayInSeconds: number;
	estimatedTime: string;
	headsign: string;
	routeId: number;
	tripId: number;
	status: string;
	theoreticalTime: string;
	timestamp: string;
	trip: number;
	vehicleCode: number;
	vehicleId: number;
}

export interface EnrichedDelayItem {
	id: string;
	routeId: number;
	line: string;
	headsign: string;
	theoreticalTime: string;
	estimatedTime: string;
	delayInSeconds: number;
	statusText: string;
	statusType: 'on-time' | 'delayed' | 'early';
	tripId: number;
	trip: number;
	vehicleCode: number;
	vehicleDetails?: {
		bus: number;
		marka?: string | null;
		model?: string | null;
		photoURL?: string | null;
		usb: boolean;
		klima: boolean;
		features: string[];
	} | null;
}

export interface DelaysResponse {
	stopId: string;
	stopName?: string;
	lastUpdate: string;
	delays: EnrichedDelayItem[];
	lines?: StopLineInfo[];
}

export interface TristarStop {
	stopId: number;
	stopCode: string;
	stopName: string;
	stopDesc: string;
	stopLat: number;
	stopLon: number;
	zoneId: string;
	lines?: StopLineInfo[];
	distance?: number;
	topLines?: StopLineInfo[];
}

export interface TristarRoute {
	routeId: number;
	routeShortName: string;
	routeLongName: string;
	routeType: string;
}

export interface DisplayMessage {
	displayCode: number;
	displayName: string;
	messagePart1: string;
	messagePart2: string;
	startDate: string;
	endDate: string;
}

// Prosty in-memory cache z TTL
let routesCache: { timestamp: number; data: Map<number, TristarRoute> } | null = null;
let stopsCache: { timestamp: number; data: TristarStop[] } | null = null;
let messagesCache: { timestamp: number; data: DisplayMessage[] } | null = null;

const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minut dla tras i przystanków
const MESSAGES_TTL_MS = 1000 * 60 * 2; // 2 minuty dla komunikatów

/**
 * Pobiera mapę wszystkich linii (routeId -> TristarRoute)
 */
export async function getRoutesMap(): Promise<Map<number, TristarRoute>> {
	const now = Date.now();
	if (routesCache && now - routesCache.timestamp < CACHE_TTL_MS) {
		return routesCache.data;
	}

	try {
		const res = await fetch(`${TRISTAR_API_BASE_URL}/routes`, {
			headers: { 'Accept': 'application/json' }
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		const items: TristarRoute[] = await res.json();
		const map = new Map<number, TristarRoute>();
		for (const route of items) {
			map.set(Number(route.routeId), route);
		}
		routesCache = { timestamp: now, data: map };
		return map;
	} catch (err) {
		console.error('Nie udało się pobrać tras z TRISTAR:', err);
		return routesCache ? routesCache.data : new Map();
	}
}

/**
 * Pobiera listę wszystkich przystanków
 */
export async function getAllStops(): Promise<TristarStop[]> {
	const now = Date.now();
	if (stopsCache && now - stopsCache.timestamp < CACHE_TTL_MS) {
		return stopsCache.data;
	}

	try {
		const res = await fetch(`${TRISTAR_API_BASE_URL}/stops`, {
			headers: { 'Accept': 'application/json' }
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		const routesMap = await getRoutesMap();
		const stopLinesMap = getStopLinesMap(routesMap);

		const rawStops: any[] = await res.json();
		const stops: TristarStop[] = rawStops.map((s) => {
			const sId = Number(s.stopId);
			return {
				stopId: sId,
				stopCode: s.stopCode ? String(s.stopCode) : '',
				stopName: s.stopName ? String(s.stopName).trim() : 'Przystanek',
				stopDesc: s.stopDesc ? String(s.stopDesc).trim() : '',
				stopLat: parseFloat(s.stopLat),
				stopLon: parseFloat(s.stopLon),
				zoneId: s.zoneId ? String(s.zoneId).trim() : '',
				lines: stopLinesMap.get(sId) || []
			};
		});

		stopsCache = { timestamp: now, data: stops };
		return stops;
	} catch (err) {
		console.error('Nie udało się pobrać przystanków z TRISTAR:', err);
		return stopsCache ? stopsCache.data : [];
	}
}

/**
 * Pobiera aktualne komunikaty dyspozytorskie
 */
export async function getDisplayMessages(): Promise<DisplayMessage[]> {
	const now = Date.now();
	if (messagesCache && now - messagesCache.timestamp < MESSAGES_TTL_MS) {
		return messagesCache.data;
	}

	try {
		const res = await fetch(`${TRISTAR_API_BASE_URL}/display_messages`, {
			headers: { 'Accept': 'application/json' }
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		const raw: any[] = await res.json();
		const messages: DisplayMessage[] = (raw || []).map((m) => ({
			displayCode: Number(m.displayCode || m.display_code),
			displayName: String(m.displayName || m.display_name || '').trim(),
			messagePart1: String(m.messagePart1 || m.message_part1 || '').trim(),
			messagePart2: String(m.messagePart2 || m.message_part2 || '').trim(),
			startDate: String(m.startDate || m.start_date || ''),
			endDate: String(m.endDate || m.end_date || '')
		}));

		messagesCache = { timestamp: now, data: messages };
		return messages;
	} catch (err) {
		console.error('Nie udało się pobrać komunikatów:', err);
		return messagesCache ? messagesCache.data : [];
	}
}

/**
 * Formatuje status opóźnienia
 */
export function formatDelayStatus(delayInSeconds: number): {
	statusText: string;
	statusType: 'on-time' | 'delayed' | 'early';
} {
	if (Math.abs(delayInSeconds) < 60) {
		return { statusText: 'Punktualnie', statusType: 'on-time' };
	}

	if (delayInSeconds > 0) {
		const minutes = Math.floor(delayInSeconds / 60);
		const seconds = delayInSeconds % 60;
		const text = seconds > 0 ? `+${minutes}m ${seconds}s` : `+${minutes}m`;
		return { statusText: text, statusType: 'delayed' };
	} else {
		const absSec = Math.abs(delayInSeconds);
		const minutes = Math.floor(absSec / 60);
		const seconds = absSec % 60;
		const text = seconds > 0 ? `-${minutes}m ${seconds}s` : `-${minutes}m`;
		return { statusText: text, statusType: 'early' };
	}
}

/**
 * Pobiera i wzbogaca odjazdy dla danego przystanku
 */
export async function getStopDelays(stopId: string | number): Promise<DelaysResponse> {
	const cleanStopId = String(stopId).trim();
	const url = `${TRISTAR_API_BASE_URL}/delays?stopId=${cleanStopId}`;
	let rawJson: { lastUpdate?: string; delay?: RawDelayItem[] } = {};
	try {
		const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
		if (res.ok) {
			rawJson = await res.json();
		}
	} catch (err) {
		console.error(`Błąd pobierania delays dla przystanku ${cleanStopId}:`, err);
	}

	const rawDelays = rawJson.delay || [];
	const lastUpdate = rawJson.lastUpdate || new Date().toLocaleTimeString('pl-PL');

	// Pobierz mapę linii
	const routesMap = await getRoutesMap();

	// Wzbogacamy każdy kurs o numer linii i dane techniczne pojazdu z MSSQL
	const enrichedDelays: EnrichedDelayItem[] = await Promise.all(
		rawDelays.map(async (item) => {
			const routeId = Number(item.routeId);
			const routeInfo = routesMap.get(routeId);

			// Nazwa linii: preferujemy TRISTAR routeShortName, potem MSSQL [dbo].[linie], potem routeId
			let line = routeInfo?.routeShortName;
			if (!line) {
				const dbName = await getRouteNameFromDb(routeId);
				line = dbName || String(routeId);
			}

			const vehicleCode = Number(item.vehicleCode);
			let vehicleDetails = null;
			if (vehicleCode > 0) {
				vehicleDetails = await getBusDetails(vehicleCode);
			}

			const delaySec = Number(item.delayInSeconds || 0);
			const { statusText, statusType } = formatDelayStatus(delaySec);

			return {
				id: item.id || `${item.routeId}_${item.tripId}_${item.theoreticalTime}`,
				routeId,
				line,
				headsign: item.headsign ? String(item.headsign).trim() : '',
				theoreticalTime: item.theoreticalTime || '',
				estimatedTime: item.estimatedTime || item.theoreticalTime || '',
				delayInSeconds: delaySec,
				statusText,
				statusType,
				tripId: Number(item.tripId),
				trip: Number(item.trip),
				vehicleCode,
				vehicleDetails
			};
		})
	);

	// Pobierz linie obsługujące ten przystanek
	const stopLines = getLinesForStop(cleanStopId, routesMap);

	return {
		stopId: cleanStopId,
		lastUpdate,
		delays: enrichedDelays,
		lines: stopLines
	};
}
