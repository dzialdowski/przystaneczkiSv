<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		Bus,
		Maximize2,
		Info,
		Compass
	} from 'lucide-svelte';
	import { getWarsawTime, diffMinutes } from '$lib/time';
	import { getCartoTileUrl, CARTO_ATTRIBUTION } from '$lib/carto';

	interface RouteStop {
		stopId: number;
		stopName: string;
		stopSequence: number;
		lat?: number;
		lon?: number;
		zone?: string;
		theoreticalTime: string;
		estimatedTime: string;
		status: 'passed' | 'next' | 'upcoming';
		isNext: boolean;
		isPassed: boolean;
		diffMin: number;
		estMinutes?: number;
		theoMinutes?: number;
	}

	interface Props {
		stops: RouteStop[];
		lineName: string;
		routeDescription?: string;
		vehicleCode?: string | number;
		vehicleDetails?: {
			bus: number;
			marka?: string | null;
			model?: string | null;
			photoURL?: string | null;
			usb?: boolean;
			klima?: boolean;
			features?: string[];
		} | null;
		delaySeconds?: number;
		serverNowMinutes?: number;
		serverTimestamp?: number;
		cartoApiKey?: string;
	}

	let {
		stops = [],
		lineName = '',
		routeDescription = '',
		vehicleCode = '',
		vehicleDetails = null,
		delaySeconds = 0,
		serverNowMinutes,
		serverTimestamp,
		cartoApiKey = ''
	}: Props = $props();

	let mapContainer: HTMLDivElement | null = $state(null);
	let mapInstance: any = null;
	let polylineLayer: any = null;
	let markersGroup: any = null;
	let busMarker: any = null;
	let leafletLib: any = null;
	let isMapReady = $state(false);
	let hasFittedBounds = false;

	// Odfiltruj tylko te przystanki, które mają prawidłowe współrzędne
	let validStops = $derived(
		stops.filter(
			(s): s is RouteStop & { lat: number; lon: number } =>
				typeof s.lat === 'number' &&
				typeof s.lon === 'number' &&
				!isNaN(s.lat) &&
				!isNaN(s.lon)
		)
	);

	// Płynny upływ czasu od załadowania widoku
	let elapsedMs = $state(0);

	$effect(() => {
		const start = performance.now();
		const timer = setInterval(() => {
			elapsedMs = performance.now() - start;
		}, 3000);

		return () => clearInterval(timer);
	});

	// Zegar minutowy zsynchronizowany z czasem polskim (Europe/Warsaw) i płynnie kroczący
	let clientNowMinutes = $derived.by(() => {
		const baseMin = serverNowMinutes ?? getWarsawTime().nowMinutes;
		return baseMin + elapsedMs / 60000;
	});

	function getStopMinutes(s: RouteStop): number {
		if (typeof s.estMinutes === 'number' && !isNaN(s.estMinutes)) {
			return s.estMinutes;
		}
		if (s.estimatedTime && s.estimatedTime.includes(':')) {
			const [hh, mm] = s.estimatedTime.split(':').map(Number);
			if (!isNaN(hh) && !isNaN(mm)) return hh * 60 + mm;
		}
		if (s.theoreticalTime && s.theoreticalTime.includes(':')) {
			const [hh, mm] = s.theoreticalTime.split(':').map(Number);
			if (!isNaN(hh) && !isNaN(mm)) return hh * 60 + mm;
		}
		return 0;
	}

	function formatDelay(sec: number): { text: string; type: 'on-time' | 'delayed' | 'early' } {
		const m = Math.round(sec / 60);
		if (m > 0) return { text: `+${m} min`, type: 'delayed' };
		if (m < 0) return { text: `${m} min`, type: 'early' };
		return { text: 'O czasie', type: 'on-time' };
	}

	// Dynamiczne wyliczenie szacowanej pozycji autobusu w czasie rzeczywistym
	let busLocation = $derived.by(() => {
		if (validStops.length === 0) return null;

		// Znajdź indeks następnego przystanku (isNext === true lub pierwszy nie-isPassed z czasem >= teraz)
		let nextIdx = validStops.findIndex((s) => s.isNext);
		if (nextIdx === -1) {
			nextIdx = validStops.findIndex((s) => !s.isPassed);
		}

		// Przypadek 1: Wszystkie przystanki zostały już obsłużone (kurs dojechał do pętli)
		if (nextIdx === -1) {
			const lastStop = validStops[validStops.length - 1];
			return {
				lat: lastStop.lat,
				lon: lastStop.lon,
				heading: 0,
				statusText: `Kurs zakończony (przystanek końcowy: ${lastStop.stopName})`,
				subText: `Przyjechał o: ${lastStop.estimatedTime}`,
				statusType: 'at_destination' as const,
				nextStop: null,
				prevStop: lastStop,
				progressPercent: 100
			};
		}

		// Przypadek 2: Pierwszy przystanek ma diff >= 0 (autobus jeszcze nie wystartował)
		if (nextIdx === 0) {
			const firstStop = validStops[0];
			const diff = diffMinutes(getStopMinutes(firstStop), clientNowMinutes);
			return {
				lat: firstStop.lat,
				lon: firstStop.lon,
				heading: 0,
				statusText: `Oczekuje na start kursu (${firstStop.stopName})`,
				subText: `Planowany odjazd za ok. ${Math.max(1, Math.round(diff))} min (${firstStop.estimatedTime})`,
				statusType: 'at_origin' as const,
				nextStop: firstStop,
				prevStop: null,
				progressPercent: 0
			};
		}

		// Przypadek 3: W trasie między przystankiem nextIdx - 1 a nextIdx
		const prevStop = validStops[nextIdx - 1];
		const nextStop = validStops[nextIdx];

		const tPrev = getStopMinutes(prevStop);
		const tNext = getStopMinutes(nextStop);
		let segmentDuration = diffMinutes(tNext, tPrev);
		if (segmentDuration <= 0) segmentDuration = 2; // Domyślnie 2 minuty między przystankami

		const elapsed = diffMinutes(clientNowMinutes, tPrev);
		let ratio = elapsed / segmentDuration;
		// Zapewniamy, że ikona autobusu znajduje się widocznie na odcinku drogi
		ratio = Math.max(0.06, Math.min(0.94, ratio));

		const lat = prevStop.lat + ratio * (nextStop.lat - prevStop.lat);
		const lon = prevStop.lon + ratio * (nextStop.lon - prevStop.lon);

		// Obliczenie kąta kierunku jazdy (bearing)
		const dLon = ((nextStop.lon - prevStop.lon) * Math.PI) / 180;
		const y = Math.sin(dLon) * Math.cos((nextStop.lat * Math.PI) / 180);
		const x =
			Math.cos((prevStop.lat * Math.PI) / 180) * Math.sin((nextStop.lat * Math.PI) / 180) -
			Math.sin((prevStop.lat * Math.PI) / 180) *
				Math.cos((nextStop.lat * Math.PI) / 180) *
				Math.cos(dLon);
		const heading = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

		const remainingMin = Math.max(0, Math.round(diffMinutes(tNext, clientNowMinutes)));

		return {
			lat,
			lon,
			heading,
			statusText: `W trasie: ${prevStop.stopName} ➔ ${nextStop.stopName}`,
			subText:
				remainingMin <= 1
					? `Dojeżdża do ${nextStop.stopName} (${nextStop.estimatedTime})`
					: `Do ${nextStop.stopName} za ok. ${remainingMin} min (${nextStop.estimatedTime})`,
			statusType: 'in_transit' as const,
			prevStop,
			nextStop,
			progressPercent: Math.round(ratio * 100)
		};
	});

	function createBusIconHtml(heading: number = 0) {
		const vCodeLabel = vehicleCode ? `${vehicleCode}` : `Linia ${lineName}`;
		return `
			<div class="route-bus-marker-wrapper" style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
				<div style="position: absolute; inset: -2px; border-radius: 9999px; background: rgba(245, 158, 11, 0.35); animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
				<div style="position: relative; z-index: 2; width: 36px; height: 36px; border-radius: 12px; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); border: 2.5px solid #090d16; box-shadow: 0 4px 14px rgba(245,158,11,0.6), 0 2px 5px rgba(0,0,0,0.6); display: flex; flex-direction: column; align-items: center; justify-content: center; color: #090d16;">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M8 6v6"/>
						<path d="M15 6v6"/>
						<path d="M2 12h19.6"/>
						<path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.2 6 18.1 6H5.9C4.8 6 3.9 6.8 3.6 7.8l-1.4 5c-.1.4-.2.8-.2 1.2 0 .4.1.8.2 1.2.3 1.1.8 2.8.8 2.8h3"/>
						<circle cx="7" cy="18" r="2"/>
						<path d="M9 18h5"/>
						<circle cx="16" cy="18" r="2"/>
					</svg>
					<span style="font-size: 9px; font-weight: 900; line-height: 1; font-family: monospace; margin-top: -1px;">${lineName}</span>
				</div>
				${
					vehicleCode
						? `<div style="position: absolute; bottom: -5px; z-index: 3; background: #0f172a; color: #f59e0b; border: 1.5px solid #f59e0b; border-radius: 6px; padding: 0.5px 4px; font-size: 8px; font-weight: 900; font-family: monospace; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.6);">${vCodeLabel}</div>`
						: ''
				}
			</div>
		`;
	}

	function createBusPopupHtml() {
		const delayInfo = formatDelay(delaySeconds);
		const vCode = vehicleCode || vehicleDetails?.bus;
		return `
			<div style="font-family: Outfit, sans-serif; min-width: 210px; color: #f8fafc; padding: 4px;">
				<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; border-bottom: 1px solid #334155; padding-bottom: 6px;">
					<div style="display: flex; align-items: center; gap: 6px;">
						<span style="background: #f59e0b; color: #020617; font-weight: 900; font-size: 13px; padding: 2px 8px; border-radius: 6px; font-family: monospace;">
							${lineName}
						</span>
						<span style="font-weight: 800; font-size: 13px; color: #f8fafc;">
							${vCode ? `Pojazd ${vCode}` : 'Autobus na trasie'}
						</span>
					</div>
					<span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px; ${
						delayInfo.type === 'on-time'
							? 'background: rgba(16,185,129,0.2); color: #34d399; border: 1px solid rgba(16,185,129,0.3);'
							: delayInfo.type === 'delayed'
								? 'background: rgba(244,63,94,0.2); color: #fb7185; border: 1px solid rgba(244,63,94,0.3);'
								: 'background: rgba(14,165,233,0.2); color: #38bdf8; border: 1px solid rgba(14,165,233,0.3);'
					}">
						${delayInfo.text}
					</span>
				</div>

				${
					vehicleDetails?.marka
						? `<div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">
							<strong style="color: #cbd5e1;">Model:</strong> ${vehicleDetails.marka} ${vehicleDetails.model || ''}
						</div>`
						: ''
				}

				${
					routeDescription
						? `<div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">
							<strong style="color: #cbd5e1;">Kierunek:</strong> ${routeDescription}
						</div>`
						: ''
				}

				<div style="margin-top: 6px; padding: 8px; border-radius: 8px; background: rgba(15,23,42,0.8); border: 1px solid #1e293b;">
					<div style="font-size: 11px; font-weight: 800; color: #f59e0b; margin-bottom: 2px;">
						${busLocation?.statusText || 'Trwa kursowanie'}
					</div>
					<div style="font-size: 11px; color: #94a3b8;">
						${busLocation?.subText || ''}
					</div>
				</div>

				<div style="font-size: 9px; color: #64748b; margin-top: 8px; text-align: center;">
					Szacowana pozycja wg rozkładu i opóźnień TRISTAR
				</div>
			</div>
		`;
	}

	function createStopPopupHtml(stop: RouteStop) {
		return `
			<div style="font-family: Outfit, sans-serif; min-width: 190px; color: #f8fafc; padding: 4px;">
				<div style="font-weight: 800; font-size: 14px; line-height: 1.2; color: #ffffff; margin-bottom: 3px;">
					${stop.stopName}
				</div>
				${stop.zone ? `<div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">Strefa: ${stop.zone}</div>` : `<div style="margin-bottom: 8px;"></div>`}

				<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; background: rgba(15,23,42,0.7); padding: 6px 8px; border-radius: 8px; border: 1px solid #334155;">
					<span style="font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 2px 6px; border-radius: 6px; ${
						stop.isNext
							? 'background: rgba(245,158,11,0.25); color: #fbbf24; border: 1px solid #f59e0b;'
							: stop.isPassed
								? 'background: rgba(71,85,105,0.4); color: #94a3b8;'
								: 'background: rgba(30,41,59,0.8); color: #cbd5e1;'
					}">
						${stop.isNext ? 'Następny' : stop.isPassed ? 'Odjechał' : 'Planowany'}
					</span>

					<span style="font-family: monospace; font-size: 12px; font-weight: 800; color: #ffffff;">
						${stop.estimatedTime}
					</span>
				</div>

				<a href="/przystanek/${stop.stopId}" style="display: block; text-align: center; background: #f59e0b; color: #020617; font-weight: 800; font-size: 11px; padding: 6px 10px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
					Odjazdy z tego przystanku ➔
				</a>
			</div>
		`;
	}

	async function initMap() {
		if (typeof window === 'undefined' || !mapContainer || mapInstance) return;

		try {
			const L = await import('leaflet');
			leafletLib = L;

			// Inicjalizacja instancji mapy Leaflet
			mapInstance = L.map(mapContainer, {
				zoomControl: true,
				attributionControl: true
			});

			const effectiveCartoApiKey = cartoApiKey || page.data.cartoApiKey || '';

			// Stylowe kafelki CartoDB Voyager z dobrą widocznością ulic i przystanków
			L.tileLayer(
				getCartoTileUrl(effectiveCartoApiKey, 'voyager'),
				{
					attribution: CARTO_ATTRIBUTION,
					subdomains: 'abcd',
					maxZoom: 19
				}
			).addTo(mapInstance);

			markersGroup = L.layerGroup().addTo(mapInstance);

			renderRouteAndStops();
			isMapReady = true;

			setTimeout(() => {
				if (mapInstance) mapInstance.invalidateSize();
			}, 250);
		} catch (err) {
			console.error('Błąd inicjalizacji mapy Leaflet:', err);
		}
	}

	function renderRouteAndStops() {
		if (!mapInstance || !leafletLib || validStops.length === 0) return;
		const L = leafletLib;

		if (polylineLayer) {
			mapInstance.removeLayer(polylineLayer);
			polylineLayer = null;
		}
		if (markersGroup) {
			markersGroup.clearLayers();
		}

		const latLngs = validStops.map((s) => [s.lat, s.lon] as [number, number]);

		// Zarys ścieżki trasy (podwójna linia dla kontrastu)
		L.polyline(latLngs, {
			color: '#090d16',
			weight: 7,
			opacity: 0.8,
			lineCap: 'round',
			lineJoin: 'round'
		}).addTo(markersGroup);

		polylineLayer = L.polyline(latLngs, {
			color: '#f59e0b',
			weight: 4,
			opacity: 0.95,
			lineCap: 'round',
			lineJoin: 'round'
		}).addTo(markersGroup);

		// Dodaj markery dla przystanków
		validStops.forEach((stop, index) => {
			let iconHtml = '';
			let iconSize: [number, number] = [22, 22];
			let iconAnchor: [number, number] = [11, 11];

			if (stop.isNext) {
				iconSize = [30, 30];
				iconAnchor = [15, 15];
				iconHtml = `
					<div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
						<div style="position: absolute; inset: -4px; border-radius: 9999px; background: rgba(245, 158, 11, 0.4); animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
						<div style="width: 26px; height: 26px; background: #f59e0b; border: 2.5px solid #020617; border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(245,158,11,0.7); font-weight: 900; font-size: 11px; color: #020617;">
							${index + 1}
						</div>
					</div>
				`;
			} else if (stop.isPassed) {
				iconSize = [20, 20];
				iconAnchor = [10, 10];
				iconHtml = `
					<div style="width: 20px; height: 20px; background: #1e293b; border: 2px solid #475569; border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-weight: 700; font-size: 9px; color: #94a3b8;">
						${index + 1}
					</div>
				`;
			} else {
				iconSize = [22, 22];
				iconAnchor = [11, 11];
				iconHtml = `
					<div style="width: 22px; height: 22px; background: #0f172a; border: 2px solid #f59e0b; border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.4); font-weight: 700; font-size: 10px; color: #f59e0b;">
						${index + 1}
					</div>
				`;
			}

			const stopIcon = L.divIcon({
				className: 'custom-route-stop-marker',
				html: iconHtml,
				iconSize,
				iconAnchor,
				popupAnchor: [0, -iconAnchor[1] - 4]
			});

			const marker = L.marker([stop.lat, stop.lon], { icon: stopIcon }).addTo(markersGroup);
			marker.bindPopup(createStopPopupHtml(stop), {
				className: 'route-map-popup',
				maxWidth: 260
			});
		});

		// Dopasuj widok do całej trasy tylko raz na początku
		if (!hasFittedBounds && polylineLayer && latLngs.length > 0) {
			mapInstance.fitBounds(polylineLayer.getBounds(), {
				padding: [35, 35],
				maxZoom: 16
			});
			hasFittedBounds = true;
		}

		updateBusMarker();
	}

	function updateBusMarker() {
		if (!mapInstance || !leafletLib) return;
		const L = leafletLib;
		const bus = busLocation;

		if (!bus) {
			if (busMarker) {
				mapInstance.removeLayer(busMarker);
				busMarker = null;
			}
			return;
		}

		const busIcon = L.divIcon({
			className: 'custom-route-bus-marker',
			html: createBusIconHtml(bus.heading),
			iconSize: [44, 44],
			iconAnchor: [22, 22],
			popupAnchor: [0, -22]
		});

		if (!busMarker) {
			busMarker = L.marker([bus.lat, bus.lon], {
				icon: busIcon,
				zIndexOffset: 1000
			}).addTo(mapInstance);

			busMarker.bindPopup(createBusPopupHtml(), {
				className: 'route-map-popup',
				maxWidth: 280
			});
		} else {
			busMarker.setLatLng([bus.lat, bus.lon]);
			busMarker.setIcon(busIcon);
			busMarker.setPopupContent(createBusPopupHtml());
		}
	}

	// Aktualizuj pozycję markera autobusu przy każdej zmianie busLocation
	$effect(() => {
		if (busLocation && isMapReady) {
			updateBusMarker();
		}
	});

	// Odśwież trasę przy zmianie przystanków
	$effect(() => {
		if (validStops.length > 0 && isMapReady) {
			renderRouteAndStops();
		}
	});

	function fitRoute() {
		if (mapInstance && polylineLayer) {
			mapInstance.fitBounds(polylineLayer.getBounds(), {
				padding: [35, 35],
				maxZoom: 16
			});
		}
	}

	function focusBus() {
		if (mapInstance && busLocation) {
			mapInstance.flyTo([busLocation.lat, busLocation.lon], 16, {
				duration: 0.8
			});
			if (busMarker) {
				setTimeout(() => busMarker.openPopup(), 400);
			}
		}
	}

	onMount(() => {
		initMap();
		return () => {
			if (mapInstance) {
				mapInstance.remove();
				mapInstance = null;
			}
		};
	});
</script>

<div class="bg-slate-900/40 rounded-3xl p-6 border border-slate-800/80 shadow-lg space-y-4">
	<!-- Nagłówek i przyciski kontrolne -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-4">
		<div>
			<div class="flex items-center gap-2">
				<h2 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
					<Compass class="w-5 h-5 text-amber-400" />
					Mapa trasy i lokalizacja autobusu
				</h2>
				<span class="text-xs font-mono font-black px-2 py-0.5 rounded-md bg-amber-400 text-slate-950">
					Linia {lineName}
				</span>
				{#if vehicleCode}
					<span class="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-800 text-amber-400 border border-amber-400/30">
						{vehicleCode}
					</span>
				{/if}
			</div>
			<p class="text-xs text-slate-400 mt-1">
				Przebieg linii ze wszystkimi przystankami oraz szacowana pozycja na żywo
			</p>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={fitRoute}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
			>
				<Maximize2 class="w-3.5 h-3.5 text-amber-400" />
				Cała trasa
			</button>

			<button
				type="button"
				onclick={focusBus}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition disabled:opacity-50"
				disabled={!busLocation}
			>
				<Bus class="w-3.5 h-3.5" />
				Gdzie jest autobus?
			</button>
		</div>
	</div>

	<!-- Status położenia pojazdu banner -->
	{#if busLocation}
		<div class="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
					<Bus class="w-4 h-4" />
				</div>
				<div>
					<div class="font-bold text-white flex items-center gap-2">
						<span>{busLocation.statusText}</span>
						{#if busLocation.statusType === 'in_transit'}
							<span class="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 font-mono font-bold">
								{busLocation.progressPercent}% trasy
							</span>
						{/if}
					</div>
					<div class="text-slate-400 text-[11px] mt-0.5">
						{busLocation.subText}
					</div>
				</div>
			</div>

			<div class="flex items-center gap-2 text-slate-400 text-[11px] shrink-0 self-end sm:self-auto">
				<Info class="w-3.5 h-3.5 text-amber-400" />
				<span>Kliknij marker na mapie, aby zobaczyć szczegóły</span>
			</div>
		</div>
	{/if}

	<!-- Kontener mapy Leaflet -->
	<div
		bind:this={mapContainer}
		class="w-full h-80 sm:h-96 rounded-2xl overflow-hidden border border-slate-800 relative z-10 shadow-inner"
	></div>
</div>
