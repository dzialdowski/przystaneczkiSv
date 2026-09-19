<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { ArrowLeft, MapPin, Navigation, Search, Star, Bus } from 'lucide-svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import type { TristarStop } from '$lib/server/tristar';
	import { getCartoTileUrl, CARTO_ATTRIBUTION } from '$lib/carto';

	let user = $derived(page.data.user);
	let legacyMode = $derived(page.data.legacyMode || false);
	let isAdmin = $derived(page.data.isAdmin || false);

	let mapContainer: HTMLDivElement;
	let mapInstance: any = null;
	let stops = $state<TristarStop[]>([]);
	let loading = $state(true);
	let mapQuery = $state('');
	let filteredStops = $state<TristarStop[]>([]);

	async function initMap() {
		if (typeof window === 'undefined') return;

		// Dynamiczny import Leaflet po stronie klienta
		const L = await import('leaflet');

		// Domyślne współrzędne: Gdynia (54.5189, 18.5305)
		mapInstance = L.map(mapContainer, {
			zoomControl: true
		}).setView([54.5189, 18.5305], 13);

		// Stylowe kafelki CartoDB Voyager z obsługą klucza API
		L.tileLayer(getCartoTileUrl(page.data.cartoApiKey), {
			attribution: CARTO_ATTRIBUTION,
			subdomains: 'abcd',
			maxZoom: 19
		}).addTo(mapInstance);

		// Niestandardowa ikona przystanku
		const stopIcon = L.divIcon({
			className: 'custom-stop-marker',
			html: `<div style="width: 26px; height: 26px; background: #f59e0b; border: 2px solid #090d16; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5); font-size: 13px;">🚏</div>`,
			iconSize: [26, 26],
			iconAnchor: [13, 13],
			popupAnchor: [0, -13]
		});

		// Pobierz przystanki
		try {
			const res = await fetch('/api/stops');
			if (res.ok) {
				stops = await res.json();

				// Dodaj markery dla przystanków
				stops.forEach((s) => {
					if (s.stopLat && s.stopLon && !isNaN(s.stopLat) && !isNaN(s.stopLon)) {
						const marker = L.marker([s.stopLat, s.stopLon], { icon: stopIcon }).addTo(mapInstance);

						const popupContent = document.createElement('div');
						popupContent.style.fontFamily = 'Outfit, sans-serif';
						popupContent.style.padding = '4px';
						popupContent.innerHTML = `
							<div style="font-weight: 800; font-size: 14px; color: #0f172a; margin-bottom: 2px;">
								${s.stopName}
							</div>
							${s.zoneId ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">Strefa: ${s.zoneId}</div>` : `<div style="margin-bottom: 8px;"></div>`}
							<div style="display: flex; gap: 6px;">
								<a href="/przystanek/${s.stopId}" style="display: inline-block; background: #f59e0b; color: #090d16; font-weight: 700; font-size: 11px; padding: 6px 10px; border-radius: 8px; text-decoration: none;">
									Odjazdy na żywo ➔
								</a>
							</div>
						`;

						marker.bindPopup(popupContent);
					}
				});
			}
		} catch (e) {
			console.error('Błąd ładowania przystanków na mapę:', e);
		} finally {
			loading = false;
		}
	}

	function locateUser() {
		if (navigator.geolocation && mapInstance) {
			navigator.geolocation.getCurrentPosition(
				(pos) => {
					const lat = pos.coords.latitude;
					const lon = pos.coords.longitude;
					mapInstance.flyTo([lat, lon], 16);
				},
				(err) => {
					alert('Nie udało się pobrać lokalizacji: ' + err.message);
				}
			);
		}
	}

	function handleSearchMap() {
		if (!mapQuery.trim() || !mapInstance) return;
		const query = mapQuery.toLowerCase().trim();
		const found = stops.find(
			(s) => s.stopName.toLowerCase().includes(query) || String(s.stopId) === query
		);
		if (found && found.stopLat && found.stopLon) {
			mapInstance.flyTo([found.stopLat, found.stopLon], 16);
		}
	}

	onMount(() => {
		initMap();
		return () => {
			if (mapInstance) mapInstance.remove();
		};
	});
</script>

<div class="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
	<Navbar {user} {legacyMode} {isAdmin} />

	<!-- Pasek narzędzi mapy -->
	<div class="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 z-10 flex flex-wrap items-center justify-between gap-3 shrink-0">
		<div class="flex items-center gap-2">
			<a
				href="/"
				onclick={(e) => {
					if (typeof window !== 'undefined' && window.history.length > 1) {
						e.preventDefault();
						window.history.back();
					}
				}}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition"
			>
				<ArrowLeft class="w-3.5 h-3.5" />
				Powrót
			</a>

			<span class="text-xs font-bold text-white hidden sm:inline">
				Mapa przystanków ZKM Gdynia ({stops.length} słupków)
			</span>
		</div>

		<!-- Wyszukiwarka na mapie -->
		<div class="flex items-center gap-2">
			<div class="relative">
				<input
					type="text"
					bind:value={mapQuery}
					onkeydown={(e) => e.key === 'Enter' && handleSearchMap()}
					placeholder="Przejdź do przystanku..."
					class="w-48 sm:w-64 pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
				/>
				<Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
			</div>

			<button
				onclick={handleSearchMap}
				class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
			>
				Szukaj
			</button>

			<button
				onclick={locateUser}
				class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-sm"
			>
				<Navigation class="w-3.5 h-3.5" />
				Moja pozycja
			</button>
		</div>
	</div>

	<!-- Kontener mapy -->
	<div class="flex-1 relative w-full h-full">
		{#if loading}
			<div class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3">
				<div class="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
				<span class="text-xs text-slate-400 font-medium">Ładowanie przystanków na mapę...</span>
			</div>
		{/if}
		<div bind:this={mapContainer} class="w-full h-full z-0"></div>
	</div>
</div>

<style>
	:global(.custom-stop-marker) {
		background: transparent;
		border: none;
	}
	:global(.leaflet-popup-content-wrapper) {
		background: #ffffff !important;
		border-radius: 14px !important;
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5) !important;
		border: 1px solid #e2e8f0 !important;
	}
	:global(.leaflet-popup-tip) {
		background: #ffffff !important;
	}
</style>
