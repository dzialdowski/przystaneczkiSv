<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		Star,
		Trash2,
		Edit3,
		Plus,
		ArrowLeft,
		Sparkles,
		MapPin,
		Bus,
		Check,
		Save,
		Download,
		Upload,
		RefreshCw,
		X
	} from 'lucide-svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import ImportFavoritesModal from '$lib/components/ImportFavoritesModal.svelte';
	import { favoritesManager } from '$lib/favorites.svelte';
	import type { FavoriteStop } from '$lib/server/db';
	import type { TristarStop } from '$lib/server/tristar';

	let { data } = $props();
	let user = $derived(data.user);
	let isAdmin = $derived(data.isAdmin || false);

	let legacyMode = $state<boolean>(false);

	$effect(() => {
		legacyMode = data.legacyMode || false;
	});

	onMount(async () => {
		await favoritesManager.init(data.user, data.favorites);
	});

	// Stan dodawania nowego przystanku
	let showAddModal = $state(false);
	let showImportModal = $state(false);
	let searchAddQuery = $state('');
	let addResults = $state<TristarStop[]>([]);
	let searchingStops = $state(false);
	let addSearchTimeout: any;

	let customName = $state('');
	let selectedForAdd = $state<TristarStop | null>(null);

	let toast = $state<string | null>(null);
	let editingStopId = $state<string | null>(null);
	let editingName = $state<string>('');
	let isMerging = $state(false);

	function showToast(msg: string) {
		toast = msg;
		setTimeout(() => {
			if (toast === msg) toast = null;
		}, 3500);
	}

	function handleSearchStops(e: Event) {
		const q = (e.target as HTMLInputElement).value;
		searchAddQuery = q;

		clearTimeout(addSearchTimeout);
		if (!q || q.length < 2) {
			addResults = [];
			searchingStops = false;
			return;
		}

		searchingStops = true;
		addSearchTimeout = setTimeout(async () => {
			try {
				const res = await fetch(`/api/stops?q=${encodeURIComponent(q)}&limit=15`);
				if (res.ok) {
					addResults = await res.json();
				}
			} finally {
				searchingStops = false;
			}
		}, 250);
	}

	async function handleSaveNew() {
		if (!selectedForAdd) return;
		const nameToSave = customName.trim() || selectedForAdd.stopName;

		const ok = await favoritesManager.add(selectedForAdd.stopId, nameToSave);
		if (ok) {
			showAddModal = false;
			selectedForAdd = null;
			searchAddQuery = '';
			customName = '';
			showToast('Dodano przystanek do ulubionych! ⭐');
		} else {
			showToast('Nie udało się zapisać przystanku.');
		}
	}

	async function handleDelete(stopId: string) {
		const ok = await favoritesManager.remove(stopId);
		if (ok) {
			showToast('Usunięto przystanek z ulubionych.');
		}
	}

	function startEdit(fav: FavoriteStop) {
		editingStopId = fav.stop_id;
		editingName = fav.stop_name;
	}

	async function saveEdit(stopId: string) {
		if (!editingName.trim()) return;

		const ok = await favoritesManager.updateName(stopId, editingName.trim());
		if (ok) {
			editingStopId = null;
			showToast('Zaktualizowano nazwę przystanku.');
		}
	}

	function handleExport() {
		if (favoritesManager.items.length === 0) {
			showToast('Brak przystanków do wyeksportowania.');
			return;
		}
		favoritesManager.exportData();
		showToast(`Pobrano plik z ${favoritesManager.items.length} przystankami! 💾`);
	}

	async function handleImportConfirm(list: Array<{ stop_id: string; stop_name: string }>) {
		const result = await favoritesManager.importFromList(list);
		showToast(
			`Zaimportowano ${result.added} ${result.added === 1 ? 'nowy przystanek' : 'nowych przystanków'}${result.updated > 0 ? ` (${result.updated} zaktualizowano)` : ''}! 🎉`
		);
	}

	async function handleMergeLocal() {
		isMerging = true;
		try {
			const res = await favoritesManager.mergeLocalDbToServer();
			showToast(`Przeniesiono ${res.count} przystanków na Twoje konto! ⭐`);
		} finally {
			isMerging = false;
		}
	}

	async function toggleLegacy() {
		if (user) {
			const res = await fetch('/api/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentMode: legacyMode })
			});
			if (res.ok) {
				const resData = await res.json();
				legacyMode = resData.legacyMode;
				showToast(`Zmieniono styl na: ${legacyMode ? 'Bursztynowy (Retro)' : 'Nowoczesny'}`);
			}
		} else {
			legacyMode = !legacyMode;
			showToast(`Zmieniono styl na: ${legacyMode ? 'Bursztynowy (Retro)' : 'Nowoczesny'}`);
		}
	}
</script>

<div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">
	<Navbar {user} {legacyMode} {isAdmin} onToggleLegacy={toggleLegacy} />

	{#if toast}
		<div class="fixed bottom-6 right-6 bg-amber-500 text-slate-950 font-bold px-4 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-2 text-xs">
			<Star class="w-4 h-4 fill-slate-950" />
			<span>{toast}</span>
		</div>
	{/if}

	<main class="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
		<!-- Pasek nawigacji górnej i narzędzi -->
		<div class="flex flex-wrap items-center justify-between gap-3">
			<a
				href="/"
				onclick={(e) => {
					if (typeof window !== 'undefined' && window.history.length > 1) {
						e.preventDefault();
						window.history.back();
					}
				}}
				class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
			>
				<ArrowLeft class="w-4 h-4" />
				Powrót do odjazdów
			</a>

			<div class="flex flex-wrap items-center gap-2">
				<!-- Przycisk Import -->
				<button
					onclick={() => (showImportModal = true)}
					class="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-white text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
					title="Zaimportuj ulubione przystanki z pliku"
				>
					<Upload class="w-3.5 h-3.5 text-cyan-400" />
					<span>Importuj</span>
				</button>

				<!-- Przycisk Eksport -->
				<button
					onclick={handleExport}
					disabled={favoritesManager.items.length === 0}
					class="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-white text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
					title="Pobierz ulubione przystanki jako plik"
				>
					<Download class="w-3.5 h-3.5 text-emerald-400" />
					<span>Eksportuj</span>
				</button>

				<!-- Przycisk Dodaj -->
				<button
					onclick={() => {
						showAddModal = true;
						selectedForAdd = null;
						searchAddQuery = '';
						customName = '';
					}}
					class="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-amber-500/20 cursor-pointer"
				>
					<Plus class="w-4 h-4" />
					Dodaj przystanek
				</button>
			</div>
		</div>

		<div>
			<h1 class="text-2xl font-black text-white flex items-center gap-2">
				<Star class="w-6 h-6 text-amber-400 fill-amber-400" />
				Moje ulubione przystanki
			</h1>
			<p class="text-xs text-slate-400 mt-1">
				Zarządzaj swoją listą ulubionych przystanków, zmieniaj ich nazwy oraz twórz kopie zapasowe.
			</p>
		</div>

		<!-- Baner informacyjny: Zapis lokalny bez logowania -->
		{#if !user}
			<div class="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
				<div class="flex items-start gap-3">
					<div class="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5 sm:mt-0">
						<Star class="w-5 h-5" />
					</div>
					<div>
						<h2 class="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-1.5">
							Ulubione na tym urządzeniu (bez logowania)
						</h2>
						<p class="text-[11px] sm:text-xs text-slate-300 mt-0.5 leading-relaxed">
							Twoje przystanki są zapisywane na tym urządzeniu. Nie synchronizują się automatycznie z innymi telefonami czy komputerami, ale możesz je w każdej chwili wyeksportować do pliku lub zalogować się przez Telegram.
						</p>
					</div>
				</div>
			</div>
		{:else if favoritesManager.localCount > 0}
			<!-- Baner dla zalogowanego użytkownika, który posiada wcześniejsze przystanki zapisane lokalnie -->
			<div class="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
				<div class="flex items-start gap-3">
					<div class="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shrink-0 mt-0.5 sm:mt-0">
						<Sparkles class="w-5 h-5" />
					</div>
					<div>
						<h2 class="text-xs sm:text-sm font-bold text-cyan-200">
							Wykryto {favoritesManager.localCount} {favoritesManager.localCount === 1 ? 'przystanek' : 'przystanki/ów'} zapisanych na tym urządzeniu
						</h2>
						<p class="text-[11px] sm:text-xs text-slate-300 mt-0.5">
							Przystanki dodane przed zalogowaniem możesz łatwo przenieść na swoje konto Telegram.
						</p>
					</div>
				</div>
				<div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
					<button
						onclick={handleMergeLocal}
						disabled={isMerging}
						class="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
					>
						<Check class="w-3.5 h-3.5" />
						<span>{isMerging ? 'Przenoszenie...' : 'Przenieś na konto'}</span>
					</button>
					<button
						onclick={() => favoritesManager.dismissLocalDb()}
						class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition cursor-pointer"
					>
						Pomiń
					</button>
				</div>
			</div>
		{/if}

		<!-- Główna zawartość: lista przystanków lub stan pusty -->
		{#if favoritesManager.items.length === 0}
			<div class="p-12 text-center bg-slate-900/40 rounded-3xl border border-slate-800 space-y-4">
				<div class="inline-flex p-4 rounded-2xl bg-amber-500/10 text-amber-400">
					<Star class="w-8 h-8" />
				</div>
				<h2 class="text-base font-bold text-white">Brak ulubionych przystanków</h2>
				<p class="text-xs text-slate-400 max-w-sm mx-auto">
					Nie masz jeszcze żadnych ulubionych przystanków. Dodaj swój pierwszy przystanek lub wczytaj listę z pliku!
				</p>
				<div class="flex flex-wrap items-center justify-center gap-2 pt-2">
					<button
						onclick={() => (showAddModal = true)}
						class="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-2 hover:bg-amber-400 active:scale-95 transition shadow-lg shadow-amber-500/20 cursor-pointer"
					>
						<Plus class="w-4 h-4" />
						Dodaj pierwszy przystanek
					</button>
					<button
						onclick={() => (showImportModal = true)}
						class="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs inline-flex items-center gap-2 hover:bg-slate-700 hover:text-white transition cursor-pointer"
					>
						<Upload class="w-4 h-4 text-cyan-400" />
						Importuj z pliku
					</button>
				</div>
			</div>
		{:else}
			<!-- Lista ulubionych -->
			<div class="space-y-2.5">
				{#each favoritesManager.items as fav (fav.stop_id)}
					<div class="p-4 bg-slate-900/60 border border-slate-800/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition">
						<div class="flex items-center gap-3 min-w-0">
							<div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
								<MapPin class="w-5 h-5" />
							</div>

							<div class="min-w-0 flex-1">
								{#if editingStopId === fav.stop_id}
									<div class="flex items-center gap-2">
										<input
											type="text"
											bind:value={editingName}
											onkeydown={(e) => {
												if (e.key === 'Enter') saveEdit(fav.stop_id);
												if (e.key === 'Escape') editingStopId = null;
											}}
											class="px-3 py-1.5 bg-slate-950 border border-amber-500 rounded-lg text-sm text-white focus:outline-none w-full max-w-md"
										/>
										<button
											onclick={() => saveEdit(fav.stop_id)}
											class="p-2 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition cursor-pointer"
											title="Zapisz"
										>
											<Check class="w-4 h-4" />
										</button>
										<button
											onclick={() => (editingStopId = null)}
											class="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
											title="Anuluj"
										>
											<X class="w-4 h-4" />
										</button>
									</div>
								{:else}
									<h2 class="font-bold text-white text-base truncate">{fav.stop_name}</h2>
								{/if}
							</div>
						</div>

						<div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
							<a
								href="/przystanek/{fav.stop_id}"
								class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
							>
								Podgląd odjazdów
							</a>

							{#if editingStopId !== fav.stop_id}
								<button
									onclick={() => startEdit(fav)}
									class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
									title="Zmień nazwę"
								>
									<Edit3 class="w-4 h-4" />
								</button>
							{/if}

							<button
								onclick={() => handleDelete(fav.stop_id)}
								class="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white transition cursor-pointer"
								title="Usuń z ulubionych"
							>
								<Trash2 class="w-4 h-4" />
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</main>

	<!-- Modal dodawania nowego przystanku -->
	{#if showAddModal}
		<div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
			<div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
				<div class="flex items-center justify-between border-b border-slate-800 pb-3">
					<h3 class="font-bold text-white text-base">Dodaj przystanek do ulubionych</h3>
					<button onclick={() => (showAddModal = false)} class="text-slate-400 hover:text-white cursor-pointer">✕</button>
				</div>

				<div>
					<label for="stop-search-modal" class="text-xs text-slate-400 block mb-1">
						Krok 1: Wyszukaj słupek przystankowy ZKM (np. nazwa lub linia):
					</label>
					<input
						id="stop-search-modal"
						type="text"
						value={searchAddQuery}
						oninput={handleSearchStops}
						placeholder="Wpisz nazwę (np. Chylonia, Morska, Wzgórze) lub linię..."
						class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
					/>
				</div>

				{#if searchingStops}
					<p class="text-xs text-slate-400 text-center py-2">Wyszukiwanie przystanków...</p>
				{:else if addResults.length > 0}
					<div class="max-h-56 overflow-y-auto divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/80">
						{#each addResults as item}
							<button
								onclick={() => {
									selectedForAdd = item;
									customName = item.stopName;
								}}
								class="w-full p-2.5 text-left text-xs hover:bg-amber-500/10 flex flex-col gap-1 transition cursor-pointer {selectedForAdd?.stopId === item.stopId ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-200'}"
							>
								<div class="flex items-center justify-between">
									<span>{item.stopName} {item.stopCode ? `(${item.stopCode})` : ''}</span>
									<span class="text-[10px] text-slate-400">{item.zoneId || 'Gdynia'}</span>
								</div>
								{#if item.lines && item.lines.length > 0}
									<div class="flex flex-wrap gap-1 items-center">
										{#each item.lines as lineInfo}
											<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300">
												<span class="font-extrabold text-amber-400">{lineInfo.line}</span>
												{#if !lineInfo.isTerminus && lineInfo.directions.length > 0}
													<span class="text-slate-500 text-[8px]">➔</span>
													<span class="text-slate-400 truncate max-w-[140px]">{lineInfo.directions[0]}</span>
												{/if}
											</span>
										{/each}
									</div>
								{/if}
							</button>
						{/each}
					</div>
				{/if}

				{#if selectedForAdd}
					<div class="p-3.5 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-2">
						<span class="text-xs text-slate-400 block">Krok 2: Własna nazwa (np. "Do pracy", "Dom"):</span>
						<input
							type="text"
							bind:value={customName}
							class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
						/>
						<p class="text-[11px] text-slate-400">Wybrany przystanek: <strong>{selectedForAdd.stopName}</strong></p>
					</div>

					<div class="flex items-center justify-end gap-2 pt-2">
						<button
							onclick={() => (showAddModal = false)}
							class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:text-white cursor-pointer"
						>
							Anuluj
						</button>
						<button
							onclick={handleSaveNew}
							class="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition shadow-lg shadow-amber-500/20 cursor-pointer"
						>
							Zapisz przystanek
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Modal importu z pliku JSON -->
	<ImportFavoritesModal
		isOpen={showImportModal}
		onClose={() => (showImportModal = false)}
		onImport={handleImportConfirm}
		isLocalMode={favoritesManager.isLocal}
	/>
</div>
