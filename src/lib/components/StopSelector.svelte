<script lang="ts">
	import { Search, Star, Bus, MapPin, X, Sparkles, Navigation } from 'lucide-svelte';
	import type { FavoriteStop } from '$lib/server/db';
	import type { TristarStop } from '$lib/server/tristar';
	import { DEMO_STOPS } from '$lib/demoStops';

	interface Props {
		selectedStopId: string;
		favorites: FavoriteStop[];
		onSelect: (stopId: string, stopName: string) => void;
		onOpenGps?: () => void;
	}

	let { selectedStopId, favorites, onSelect, onOpenGps }: Props = $props();

	let searchQuery = $state('');
	let searchResults = $state<TristarStop[]>([]);
	let isSearching = $state(false);
	let searchTimeout: any;

	function handleSearchInput(e: Event) {
		const target = e.target as HTMLInputElement;
		searchQuery = target.value;

		clearTimeout(searchTimeout);
		if (!searchQuery || searchQuery.trim().length < 2) {
			searchResults = [];
			isSearching = false;
			return;
		}

		isSearching = true;
		searchTimeout = setTimeout(async () => {
			try {
				const res = await fetch(`/api/stops?q=${encodeURIComponent(searchQuery)}&limit=15`);
				if (res.ok) {
					searchResults = await res.json();
				}
			} finally {
				isSearching = false;
			}
		}, 250);
	}

	function handleSelect(id: string, name: string) {
		searchQuery = '';
		searchResults = [];
		onSelect(id, name);
	}
</script>

<div class="w-full space-y-3">
	<!-- Pasek wyszukiwania z autouzupełnianiem -->
	<div class="relative">
		<div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
			<Search class="w-4 h-4" />
		</div>
		<input
			type="text"
			value={searchQuery}
			oninput={handleSearchInput}
			placeholder="Wpisz przystanek, linię lub kierunek (np. 21, Dworzec Główny, Sopot)..."
			class="w-full pl-10 pr-28 py-3 bg-slate-900/90 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition shadow-lg"
		/>
		{#if searchQuery}
			<button
				onclick={() => { searchQuery = ''; searchResults = []; }}
				class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
				title="Wyczyść"
			>
				<X class="w-4 h-4" />
			</button>
		{:else if onOpenGps}
			<button
				type="button"
				onclick={onOpenGps}
				class="absolute inset-y-0 right-0 pr-3.5 flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold text-xs transition cursor-pointer"
				title="Znajdź najbliższe przystanki w okolicy"
			>
				<Navigation class="w-4 h-4" />
				<span class="hidden sm:inline text-[11px]">W pobliżu</span>
			</button>
		{/if}

		<!-- Wyniki wyszukiwania w locie -->
		{#if searchQuery.trim().length >= 2}
			<div class="absolute left-0 right-0 top-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl z-30 max-h-80 overflow-y-auto divide-y divide-slate-800/60">
				{#if isSearching}
					<div class="p-4 text-center text-xs text-slate-400">Szukanie przystanków...</div>
				{:else if searchResults.length === 0}
					<div class="p-4 text-center text-xs text-slate-400">Nie znaleziono pasujących przystanków.</div>
				{:else}
					{#each searchResults as item}
						<button
							onclick={() => handleSelect(String(item.stopId), item.stopName)}
							class="w-full px-4 py-3 text-left flex flex-col gap-1.5 hover:bg-amber-500/10 transition group cursor-pointer"
						>
							<div class="flex items-center justify-between gap-2">
								<div class="flex items-center gap-2.5 min-w-0">
									<Bus class="w-4 h-4 text-amber-400 shrink-0 group-hover:scale-110 transition" />
									<span class="font-bold text-white text-xs block group-hover:text-amber-300 truncate">
										{item.stopName}
									</span>
								</div>
								<span class="text-[10px] text-slate-400 shrink-0 font-medium">
									{item.zoneId || 'Gdynia'}{item.stopCode ? ` • Słupek ${item.stopCode}` : ''}
								</span>
							</div>

							<!-- Linie i kierunki na tym słupku -->
							{#if item.lines && item.lines.length > 0}
								<div class="flex flex-wrap gap-1.5 pl-6 pt-0.5 items-center">
									{#each item.lines as lineInfo}
										<div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] leading-tight">
											<span class="font-extrabold text-amber-400">{lineInfo.line}</span>
											{#if lineInfo.isTerminus}
												<span class="text-[9px] text-slate-400">(koniec)</span>
											{:else if lineInfo.directions && lineInfo.directions.length > 0}
												<span class="text-slate-500 text-[9px]">➔</span>
												<span class="text-slate-300 truncate max-w-[140px] sm:max-w-[200px]" title={lineInfo.directions.join(', ')}>
													{lineInfo.directions.join(', ')}
												</span>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	</div>

	<!-- Lista wyboru (select) oraz szybkie pigułki ulubionych/demo -->
	<div class="flex flex-col gap-2">
		<div class="relative">
			<select
				value={selectedStopId}
				onchange={(e) => {
					const sel = e.target as HTMLSelectElement;
					if (sel.value) {
						const fav = favorites?.find((f) => String(f.stop_id).trim() === sel.value);
						const demo = DEMO_STOPS.find((s) => s.id === sel.value);
						const stopName = fav ? fav.stop_name : (demo ? demo.name : sel.options[sel.selectedIndex].text);
						onSelect(sel.value, stopName);
					}
				}}
				class="w-full py-2.5 px-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-500 transition appearance-none cursor-pointer"
			>
				<option value="" disabled>-- Wybierz przystanek z listy --</option>

				{#if favorites && favorites.length > 0}
					<optgroup label="⭐ Moje ulubione przystanki">
						{#each favorites as fav}
							<option value={fav.stop_id}>⭐ {fav.stop_name}</option>
						{/each}
					</optgroup>
				{/if}

				<optgroup label="📍 Główne węzły i przystanki">
					{#each DEMO_STOPS as s}
						<option value={s.id}>📍 {s.name} ({s.region})</option>
					{/each}
				</optgroup>
			</select>
			<div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
				▼
			</div>
		</div>

		<!-- Pigułki szybkiego wyboru: ulubione dla zalogowanych LUB kluczowe węzły dla niezalogowanych -->
		{#if favorites && favorites.length > 0}
			<div class="flex items-center gap-1.5 overflow-x-auto py-1 text-xs no-scrollbar">
				<span class="text-[11px] font-semibold text-amber-400 shrink-0 flex items-center gap-1">
					<Star class="w-3 h-3 fill-amber-400" /> Szybki wybór:
				</span>
				{#if onOpenGps}
					<button
						type="button"
						onclick={onOpenGps}
						class="px-2.5 py-1 rounded-xl shrink-0 font-bold transition border text-[11px] bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25 hover:text-emerald-300 flex items-center gap-1 shadow-sm cursor-pointer"
					>
						<Navigation class="w-3 h-3" />
						<span>W pobliżu</span>
					</button>
				{/if}
				{#each favorites as fav}
					<button
						onclick={() => onSelect(fav.stop_id, fav.stop_name)}
						class="px-2.5 py-1 rounded-xl shrink-0 font-medium transition border text-[11px] cursor-pointer {selectedStopId === fav.stop_id ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-500/20' : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'}"
					>
						{fav.stop_name}
					</button>
				{/each}
			</div>
		{:else}
			<div class="flex items-center gap-1.5 overflow-x-auto py-1 text-xs no-scrollbar">
				<span class="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
					<Sparkles class="w-3 h-3 text-amber-400" /> Węzły:
				</span>
				{#if onOpenGps}
					<button
						type="button"
						onclick={onOpenGps}
						class="px-2.5 py-1 rounded-xl shrink-0 font-bold transition border text-[11px] bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25 hover:text-emerald-300 flex items-center gap-1 shadow-sm cursor-pointer"
					>
						<Navigation class="w-3 h-3" />
						<span>W pobliżu</span>
					</button>
				{/if}
				{#each DEMO_STOPS.slice(0, 6) as s}
					<button
						onclick={() => onSelect(s.id, s.name)}
						class="px-2.5 py-1 rounded-xl shrink-0 font-medium transition border text-[11px] cursor-pointer {selectedStopId === s.id ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-500/20' : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'}"
					>
						{s.name}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
