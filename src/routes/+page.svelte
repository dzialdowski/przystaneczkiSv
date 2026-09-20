<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import type { Snapshot } from './$types';
	import { Star, MapPin, RefreshCw, Bus, Share2, Sparkles, Navigation } from 'lucide-svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import DepartureBoard from '$lib/components/DepartureBoard.svelte';
	import StopSelector from '$lib/components/StopSelector.svelte';
	import NearestStops from '$lib/components/NearestStops.svelte';
	import MessageTicker from '$lib/components/MessageTicker.svelte';
	import { favoritesManager } from '$lib/favorites.svelte';
	import type { DelaysResponse } from '$lib/server/tristar';
	import type { FavoriteStop } from '$lib/server/db';
	import { DEMO_STOPS } from '$lib/demoStops';

	interface PageSnapshot {
		selectedStopId: string;
		currentStopName: string;
		delaysData: DelaysResponse;
	}

	// Dane z layoutu
	let { data } = $props();
	let user = $derived(data.user);
	let legacyMode = $state(false);
	let isAdmin = $derived(data.isAdmin || false);

	$effect(() => {
		legacyMode = data.legacyMode || false;
	});

	// Domyślny przystanek bez zalogowania (#1 z wyselekcjonowanego Top 20)
	let selectedStopId = $state(DEMO_STOPS[0].id);
	let currentStopName = $state(DEMO_STOPS[0].name);
	let delaysData = $state<DelaysResponse>({
		stopId: DEMO_STOPS[0].id,
		lastUpdate: '',
		delays: []
	});
	let loadingDelays = $state(false);
	let autoRefreshTimer: any;
	let toastMessage = $state<string | null>(null);
	let restoredFromSnapshot = false;

	// Stan widoczności sekcji najbliższych przystanków
	let showNearestStops = $state(false);
	let nearestStopsComponent = $state<any>(null);

	// SvelteKit snapshot do zapamiętywania stanu przed nawigacją i odtwarzania go po powrocie
	export const snapshot: Snapshot<PageSnapshot> = {
		capture: () => ({
			selectedStopId,
			currentStopName,
			delaysData: delaysData && delaysData.delays ? $state.snapshot(delaysData) : { stopId: selectedStopId, lastUpdate: '', delays: [] }
		}),
		restore: (value) => {
			if (!value) return;
			if (value.selectedStopId) selectedStopId = String(value.selectedStopId);
			if (value.currentStopName) currentStopName = value.currentStopName;
			if (value.delaysData && Array.isArray(value.delaysData.delays) && value.delaysData.delays.length > 0) {
				delaysData = value.delaysData;
				restoredFromSnapshot = true;
			}
		}
	};

	// Czy ten przystanek jest w ulubionych
	let isFavorite = $derived(favoritesManager.isFavorite(selectedStopId));

	async function loadDelays(stopId: string) {
		loadingDelays = true;
		try {
			const res = await fetch(`/api/delays?stopId=${encodeURIComponent(stopId)}`);
			if (res.ok) {
				const responseData = await res.json();
				// Zabezpieczenie przed race condition: przypisz dane tylko jeśli wciąż wybrany jest ten sam przystanek
				if (String(stopId).trim() === String(selectedStopId).trim()) {
					delaysData = responseData;
				}
			}
		} catch (err) {
			console.error('Błąd pobierania odjazdów:', err);
		} finally {
			loadingDelays = false;
		}
	}

	function handleSelectStop(id: string, name: string) {
		selectedStopId = String(id);
		currentStopName = name.replace(/^[⭐📍]\s*/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
		loadDelays(selectedStopId);
	}

	function handleToggleGps() {
		showNearestStops = !showNearestStops;
		if (showNearestStops && nearestStopsComponent) {
			nearestStopsComponent.requestLocation();
		}
	}

	function handleOpenGps() {
		showNearestStops = true;
		if (nearestStopsComponent) {
			nearestStopsComponent.requestLocation();
		}
	}

	async function toggleFavorite() {
		const res = await favoritesManager.toggle(selectedStopId, currentStopName);
		if (res.success) {
			if (res.isFavorite) {
				showToast('Dodano przystanek do ulubionych! ⭐');
			} else {
				showToast('Usunięto z ulubionych');
			}
		} else {
			showToast('Nie udało się zapisać przystanku w ulubionych.');
		}
	}

	async function handleToggleLegacy() {
		if (user) {
			const res = await fetch('/api/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentMode: legacyMode })
			});
			if (res.ok) {
				const data = await res.json();
				legacyMode = data.legacyMode;
			}
		} else {
			legacyMode = !legacyMode;
		}
	}

	function showToast(msg: string) {
		toastMessage = msg;
		setTimeout(() => {
			if (toastMessage === msg) toastMessage = null;
		}, 3500);
	}

	onMount(async () => {
		await favoritesManager.init(data.user, data.favorites);

		// Jeśli są ulubione i stan NIE został odtworzony ze snapshotu, ustaw pierwszy jako domyślny
		if (!restoredFromSnapshot && favoritesManager.items && favoritesManager.items.length > 0) {
			selectedStopId = String(favoritesManager.items[0].stop_id);
			currentStopName = favoritesManager.items[0].stop_name;
		}

		// Pobierz świeże dane z API (jeśli ze snapshotu, lista już jest wyrenderowana, a w tle pobierze najświeższe dane)
		loadDelays(selectedStopId);

		// Odświeżaj co 25 sekund w tle
		autoRefreshTimer = setInterval(() => {
			loadDelays(selectedStopId);
		}, 25000);
	});

	onDestroy(() => {
		if (autoRefreshTimer) clearInterval(autoRefreshTimer);
	});
</script>

<div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">
	<Navbar
		{user}
		{legacyMode}
		{isAdmin}
		isRefreshing={loadingDelays}
		onRefresh={() => loadDelays(selectedStopId)}
		onToggleLegacy={handleToggleLegacy}
	/>

	<!-- Toast -->
	{#if toastMessage}
		<div class="fixed bottom-6 right-6 bg-amber-500 text-slate-950 font-bold px-4 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-2 text-xs animate-bounce">
			<Star class="w-4 h-4 fill-slate-950" />
			<span>{toastMessage}</span>
		</div>
	{/if}

	<main class="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
		<!-- Komunikaty dyspozytorskie -->
		<MessageTicker />

		<!-- Panel wyboru przystanku -->
		<div class="bg-slate-900/50 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-slate-800/80 shadow-xl space-y-4">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div>
					<h1 class="text-xl sm:text-2xl font-black text-white">
						{currentStopName}
					</h1>
					<p class="text-xs text-slate-400 mt-0.5">
						Odjazdy na żywo z sieci ZKM Gdynia
					</p>
				</div>

				<!-- Przyciski akcji dla wybranego przystanku -->
				<div class="flex flex-wrap items-center gap-2">
					<!-- Przycisk dla najbliższych przystanków -->
					<button
						onclick={handleToggleGps}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer shadow-sm {showNearestStops ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-emerald-500/20' : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 hover:text-white'}"
						title="Znajdź najbliższe przystanki na podstawie lokalizacji"
					>
						<Navigation class="w-3.5 h-3.5 {showNearestStops ? 'fill-slate-950' : ''}" />
						<span>{showNearestStops ? 'Zwiń listę' : 'W pobliżu'}</span>
					</button>

					<button
						onclick={toggleFavorite}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer {isFavorite ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm shadow-amber-500/20' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}"
					>
						<Star class="w-3.5 h-3.5 {isFavorite ? 'fill-slate-950' : ''}" />
						<span>{isFavorite ? 'Ulubiony' : 'Dodaj do ulubionych'}</span>
					</button>

					<a
						href="/przystanek/{selectedStopId}"
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition"
					>
						<span>Szczegóły</span>
					</a>
				</div>
			</div>

			<!-- Komponent selektora i wyszukiwarki -->
			<StopSelector
				{selectedStopId}
				favorites={favoritesManager.items}
				onSelect={handleSelectStop}
				onOpenGps={handleOpenGps}
			/>

			<!-- Sekcja najbliższych przystanków -->
			{#if showNearestStops}
				<div class="pt-2">
					<NearestStops
						bind:this={nearestStopsComponent}
						onClose={() => { showNearestStops = false; }}
					/>
				</div>
			{/if}
		</div>

		<!-- Główna tablica odjazdów -->
		<DepartureBoard
			delays={delaysData.delays}
			lines={delaysData.lines || []}
			lastUpdate={delaysData.lastUpdate}
			loading={loadingDelays}
			{legacyMode}
			stopName={currentStopName}
			stopId={selectedStopId}
		/>

		<!-- Szybkie odnośniki w stopce strony głównej -->
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
			<a
				href="/mapa"
				class="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900/80 transition flex items-center gap-3 group"
			>
				<div class="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:scale-105 transition">
					<MapPin class="w-5 h-5" />
				</div>
				<div>
					<h3 class="text-xs font-bold text-white group-hover:text-cyan-400 transition">Interaktywna mapa</h3>
					<p class="text-[11px] text-slate-400">Znajdź przystanki na mapie Trójmiasta</p>
				</div>
			</a>

			<a
				href="/moje"
				class="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-amber-500/40 hover:bg-slate-900/80 transition flex items-center gap-3 group"
			>
				<div class="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-105 transition">
					<Star class="w-5 h-5" />
				</div>
				<div>
					<h3 class="text-xs font-bold text-white group-hover:text-amber-400 transition">Moje przystanki</h3>
					<p class="text-[11px] text-slate-400">Zarządzaj swoimi ulubionymi przystankami</p>
				</div>
			</a>

			<a
				href="/api/sync-gtfs"
				target="_blank"
				class="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900/80 transition flex items-center gap-3 group"
			>
				<div class="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition">
					<RefreshCw class="w-5 h-5" />
				</div>
				<div>
					<h3 class="text-xs font-bold text-white group-hover:text-emerald-400 transition">Stan rozkładów</h3>
					<p class="text-[11px] text-slate-400">Informacje o aktualizacji danych ZDiZ</p>
				</div>
			</a>
		</div>
	</main>
</div>
