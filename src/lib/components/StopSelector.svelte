<script lang="ts">
	import { Search, Star, Bus, MapPin, X } from 'lucide-svelte';
	import type { FavoriteStop } from '$lib/server/db';
	import type { TristarStop } from '$lib/server/tristar';

	interface Props {
		selectedStopId: string;
		favorites: FavoriteStop[];
		onSelect: (stopId: string, stopName: string) => void;
	}

	let { selectedStopId, favorites, onSelect }: Props = $props();

	let searchQuery = $state('');
	let searchResults = $state<TristarStop[]>([]);
	let isSearching = $state(false);
	let searchTimeout: any;

	// Domyślne przystanki z oryginalnego index.php
	const DEFAULT_GROUPS = [
		{
			name: 'Vanco',
			stops: [
				{ id: '37200', name: 'Cisowa SKM 06 ➔ Centrum' },
				{ id: '37540', name: 'Jęczmienna 02 ➔ Centrum' },
				{ id: '37350', name: 'Owsiana 01 ➔ Centrum' },
				{ id: '37700', name: 'Chylonia Dworzec PKP ➔ Cisowa' },
				{ id: '37380', name: 'Chylonia Centrum ➔ Centrum' },
				{ id: '37320', name: 'Owsiana ➔ Rumia' },
				{ id: '38460', name: 'Handlowa 02 (NŻ) ➔ Rumia' },
				{ id: '31329', name: 'Janowo SKM - Sobieskiego ➔ Cisowa' }
			]
		},
		{
			name: 'Brzoza',
			stops: [
				{ id: '39380', name: 'Stocznia Marynarki Woj. 01 ➔ Estakada' },
				{ id: '39070', name: 'Stocznia Marynarki Woj. 01 ➔ AMW' },
				{ id: '39040', name: 'Obłuże Centrum ➔ Brzozen' },
				{ id: '36140', name: 'Gdynia Dw. Główny PKP - Hala ➔ Brzozen' },
				{ id: '39320', name: 'Alzacka ➔ Brzozen' }
			]
		},
		{
			name: 'Diana & Centrum',
			stops: [
				{ id: '38100', name: 'Wiklinowa ➔ Centrum' },
				{ id: '35113', name: 'Wzg. św. Maksymiliana SKM 03 ➔ Cisowa' },
				{ id: '35111', name: 'Wzg. św. Maksymiliana SKM 01 ➔ Oksywie' },
				{ id: '36050', name: 'Armii Krajowej ➔ Domki' },
				{ id: '37070', name: 'Mireckiego 02 ➔ Cisowa' },
				{ id: '39370', name: 'Akademia Marynarki Wojennej' },
				{ id: '39360', name: 'Oksywie Dolne' }
			]
		}
	];

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
			placeholder="Wpisz nazwę przystanku lub numer (np. Dworzec Główny, Cisowa)..."
			class="w-full pl-10 pr-10 py-3 bg-slate-900/90 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition shadow-lg"
		/>
		{#if searchQuery}
			<button
				onclick={() => { searchQuery = ''; searchResults = []; }}
				class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
			>
				<X class="w-4 h-4" />
			</button>
		{/if}

		<!-- Wyniki wyszukiwania w locie -->
		{#if searchQuery.trim().length >= 2}
			<div class="absolute left-0 right-0 top-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl z-30 max-h-72 overflow-y-auto divide-y divide-slate-800/60">
				{#if isSearching}
					<div class="p-4 text-center text-xs text-slate-400">Szukanie przystanków...</div>
				{:else if searchResults.length === 0}
					<div class="p-4 text-center text-xs text-slate-400">Nie znaleziono przystanków pasujących do frazy.</div>
				{:else}
					{#each searchResults as item}
						<button
							onclick={() => handleSelect(String(item.stopId), item.stopName)}
							class="w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-amber-500/10 transition group"
						>
							<div class="flex items-center gap-2.5">
								<Bus class="w-4 h-4 text-amber-400 group-hover:scale-110 transition" />
								<div>
									<span class="font-bold text-white text-xs block group-hover:text-amber-300">
										{item.stopName}
									</span>
									<span class="text-[10px] text-slate-400">
										{item.zoneId || 'Gdynia'} {item.stopCode ? `• Słupek ${item.stopCode}` : ''}
									</span>
								</div>
							</div>
							<span class="text-[10px] font-mono-board text-slate-400">ID: {item.stopId}</span>
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	</div>

	<!-- Lista wyboru (select) oraz szybkie pigułki ulubionych -->
	<div class="flex flex-col gap-2">
		<div class="relative">
			<select
				value={selectedStopId}
				onchange={(e) => {
					const sel = e.target as HTMLSelectElement;
					const opt = sel.options[sel.selectedIndex];
					if (sel.value) {
						onSelect(sel.value, opt.text);
					}
				}}
				class="w-full py-2.5 px-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-500 transition appearance-none cursor-pointer"
			>
				<option value="" disabled>-- WYBIERZ PRZYSTANEK Z LISTY --</option>

				{#if favorites && favorites.length > 0}
					<optgroup label="⭐ Moje ulubione przystanki (Baza MSSQL)">
						{#each favorites as fav}
							<option value={fav.stop_id}>⭐ {fav.stop_name}</option>
						{/each}
					</optgroup>
				{/if}

				{#each DEFAULT_GROUPS as group}
					<optgroup label="📍 {group.name}">
						{#each group.stops as s}
							<option value={s.id}>{s.name}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
			<div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
				▼
			</div>
		</div>

		<!-- Pigułki szybkiego wyboru dla ulubionych -->
		{#if favorites && favorites.length > 0}
			<div class="flex items-center gap-1.5 overflow-x-auto py-1 text-xs no-scrollbar">
				<span class="text-[11px] font-semibold text-amber-400 shrink-0 flex items-center gap-1">
					<Star class="w-3 h-3 fill-amber-400" /> Szybki wybór:
				</span>
				{#each favorites as fav}
					<button
						onclick={() => onSelect(fav.stop_id, fav.stop_name)}
						class="px-2.5 py-1 rounded-xl shrink-0 font-medium transition border text-[11px] {selectedStopId === fav.stop_id ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-500/20' : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'}"
					>
						{fav.stop_name}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
