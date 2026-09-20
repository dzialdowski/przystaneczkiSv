<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { Star, ArrowLeft, RefreshCw, Bus, Share2 } from 'lucide-svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import DepartureBoard from '$lib/components/DepartureBoard.svelte';
	import { favoritesManager } from '$lib/favorites.svelte';
	import type { DelaysResponse } from '$lib/server/tristar';
	import type { FavoriteStop } from '$lib/server/db';

	let { data } = $props();
	let user = $derived(data.user);
	let legacyMode = $state(false);
	let isAdmin = $derived(data.isAdmin || false);

	let delaysData = $state<DelaysResponse>({
		stopId: '',
		lastUpdate: '',
		delays: []
	});

	$effect(() => {
		legacyMode = data.legacyMode || false;
		if (data.initialDelays) {
			delaysData = data.initialDelays;
		}
	});
	let loading = $state(false);
	let autoRefresh: any;
	let toastMsg = $state<string | null>(null);

	let isFav = $derived(favoritesManager.isFavorite(data.stopId));

	async function refresh() {
		loading = true;
		try {
			const res = await fetch(`/api/delays?stopId=${data.stopId}`);
			if (res.ok) {
				delaysData = await res.json();
			}
		} finally {
			loading = false;
		}
	}

	async function toggleFav() {
		const res = await favoritesManager.toggle(data.stopId, data.stopName);
		if (res.success) {
			if (res.isFavorite) {
				toastMsg = 'Dodano do ulubionych! ⭐';
			} else {
				toastMsg = 'Usunięto z ulubionych';
			}
		} else {
			toastMsg = 'Nie udało się zapisać przystanku.';
		}
	}

	onMount(async () => {
		await favoritesManager.init(data.user, data.favorites);
		autoRefresh = setInterval(refresh, 20000);
	});

	onDestroy(() => {
		if (autoRefresh) clearInterval(autoRefresh);
	});
</script>

<div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">
	<Navbar {user} {legacyMode} {isAdmin} isRefreshing={loading} onRefresh={refresh} />

	{#if toastMsg}
		<div class="fixed bottom-6 right-6 bg-amber-500 text-slate-950 font-bold px-4 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-2 text-xs">
			<Star class="w-4 h-4 fill-slate-950" />
			<span>{toastMsg}</span>
		</div>
	{/if}

	<main class="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
		<div class="flex items-center justify-between">
			<a
				href="/"
				onclick={(e) => {
					if (typeof window !== 'undefined' && window.history.length > 1) {
						e.preventDefault();
						window.history.back();
					}
				}}
				class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition"
			>
				<ArrowLeft class="w-4 h-4" />
				Powrót do strony głównej
			</a>

			<div class="flex items-center gap-2">
				<button
					onclick={toggleFav}
					class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer {isFav ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}"
				>
					<Star class="w-3.5 h-3.5 {isFav ? 'fill-slate-950' : ''}" />
					<span>{isFav ? 'Ulubiony' : 'Dodaj do ulubionych'}</span>
				</button>
			</div>
		</div>

		<!-- Karta tytułowa przystanku -->
		<div class="bg-slate-900/60 rounded-3xl p-6 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div>
				<h1 class="text-2xl sm:text-3xl font-black text-white">{data.stopName}</h1>
				<p class="text-xs text-slate-400 mt-1">Zarząd Komunikacji Miejskiej w Gdyni • TRISTAR</p>
			</div>
			<div class="flex items-center gap-2">
				<button
					onclick={refresh}
					disabled={loading}
					class="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 hover:bg-amber-400 active:scale-95 transition shadow-lg shadow-amber-500/20"
				>
					<RefreshCw class="w-3.5 h-3.5 {loading ? 'animate-spin' : ''}" />
					<span>Odśwież teraz</span>
				</button>
			</div>
		</div>

		<!-- Tablica odjazdów -->
		<DepartureBoard
			delays={delaysData.delays}
			lines={delaysData.lines || data.lines || []}
			lastUpdate={delaysData.lastUpdate}
			{loading}
			{legacyMode}
			stopName={data.stopName}
			stopId={data.stopId}
		/>
	</main>
</div>
