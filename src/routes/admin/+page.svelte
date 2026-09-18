<script lang="ts">
	import { page } from '$app/state';
	import { Shield, ArrowLeft, Users, Star, Database } from 'lucide-svelte';
	import Navbar from '$lib/components/Navbar.svelte';

	let data = $derived(page.data);
	let user = $derived(page.data.user);
	let legacyMode = $derived(page.data.legacyMode || false);

	let activeTab = $state<'favs' | 'users' | 'vehicles'>('vehicles');
	let isScraping = $state(false);
	let scrapeStatus = $state<string | null>(null);
	let isSyncingGtfs = $state(false);
	let gtfsStatus = $state<string | null>(null);
	let vehicleSearch = $state('');
	let filteredVehicles = $derived(
		(data.vehicles || []).filter((v: any) => {
			if (!vehicleSearch.trim()) return true;
			const q = vehicleSearch.toLowerCase();
			return (
				String(v.Bus).includes(q) ||
				(v.marka && v.marka.toLowerCase().includes(q)) ||
				(v.model && v.model.toLowerCase().includes(q))
			);
		})
	);

	async function runScraper() {
		isScraping = true;
		scrapeStatus = 'Pobieranie i synchronizowanie pojazdów...';
		try {
			const res = await fetch('/api/admin/scrape-vehicles', { method: 'POST' });
			if (res.ok) {
				const result = await res.json();
				scrapeStatus = `Sukces! Pobrano ${result.totalScraped} pojazdów, zaktualizowano ${result.dbUpdated} w MSSQL w ${(result.durationMs / 1000).toFixed(1)}s. Odśwież stronę, aby zobaczyć zaktualizowaną listę.`;
			} else {
				const err = await res.json();
				scrapeStatus = `Błąd: ${err.error || 'Nie udało się wykonać scrapowania'}`;
			}
		} catch (e: any) {
			scrapeStatus = `Błąd sieci: ${e.message}`;
		} finally {
			isScraping = false;
		}
	}

	async function runGtfsSync() {
		isSyncingGtfs = true;
		gtfsStatus = 'Pobieranie pliku GTFS i aktualizowanie tras w bazie...';
		try {
			const res = await fetch('/api/gtfs/sync', { method: 'POST' });
			const result = await res.json();
			if (res.ok && result.success) {
				gtfsStatus = `Sukces! Zsynchronizowano ${result.routesCount} linii, ${result.stopsCount} przystanków oraz ${result.trasyCount} pozycji wariantów tras w ${(result.durationMs / 1000).toFixed(1)}s.`;
			} else {
				gtfsStatus = `Błąd synchronizacji GTFS: ${result.error || 'Nieznany błąd'}`;
			}
		} catch (e: any) {
			gtfsStatus = `Błąd sieci: ${e.message}`;
		} finally {
			isSyncingGtfs = false;
		}
	}
</script>

<div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">
	<Navbar {user} {legacyMode} isAdmin={true} />

	<main class="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
		<div class="flex items-center justify-between">
			<a
				href="/"
				class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition"
			>
				<ArrowLeft class="w-4 h-4" />
				Strona główna
			</a>

			<div class="flex items-center gap-2">
				<span class="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-1.5">
					<Shield class="w-3.5 h-3.5" /> Administrator: {user?.first_name} ({user?.id})
				</span>
			</div>
		</div>

		<div class="bg-slate-900/60 rounded-3xl p-6 border border-slate-800">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 class="text-2xl font-black text-white flex items-center gap-2.5">
						<Database class="w-6 h-6 text-amber-400" />
						Panel Zarządzania Bazą MSSQL & Taborem ZKM
					</h1>
					{#if data.dbServer}
						<p class="text-xs text-slate-400 mt-1">
							Serwer bazy danych: <code class="text-amber-400 font-mono-board">{data.dbServer}</code>
						</p>
					{/if}
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<button
						onclick={runGtfsSync}
						disabled={isSyncingGtfs}
						class="px-4 py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 active:scale-95 shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
					>
						<span>{isSyncingGtfs ? 'Synchronizacja GTFS...' : '🔄 Synchronizuj trasy z GTFS'}</span>
					</button>

					<button
						onclick={runScraper}
						disabled={isScraping}
						class="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 hover:brightness-110 active:scale-95 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
					>
						<span>{isScraping ? 'Scrapowanie w toku...' : '🚀 Uruchom scraper pojazdów ZKM'}</span>
					</button>
				</div>
			</div>

			{#if gtfsStatus}
				<div class="mt-4 p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-xs flex items-center gap-2">
					<span class="font-bold">GTFS:</span>
					<span>{gtfsStatus}</span>
				</div>
			{/if}

			{#if scrapeStatus}
				<div class="mt-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
					<span class="font-bold">Pojazdy:</span>
					<span>{scrapeStatus}</span>
				</div>
			{/if}

			<!-- Przełącznik zakładek -->
			<div class="flex items-center gap-2 mt-6 border-b border-slate-800 pb-3 overflow-x-auto">
				<button
					onclick={() => activeTab = 'vehicles'}
					class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 {activeTab === 'vehicles' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'bg-slate-800 text-slate-300 hover:text-white'}"
				>
					Tabor pojazdów (busy: {data.vehicles.length})
				</button>
				<button
					onclick={() => activeTab = 'favs'}
					class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 {activeTab === 'favs' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'bg-slate-800 text-slate-300 hover:text-white'}"
				>
					<Star class="w-4 h-4" />
					Wszystkie ulubione (VancoFavs: {data.favs.length})
				</button>
				<button
					onclick={() => activeTab = 'users'}
					class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 {activeTab === 'users' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'bg-slate-800 text-slate-300 hover:text-white'}"
				>
					<Users class="w-4 h-4" />
					Użytkownicy (VancoUsers: {data.users.length})
				</button>
			</div>
		</div>

		<!-- Tabela danych -->
		{#if activeTab === 'vehicles'}\
			<div class="bg-slate-900/40 rounded-3xl p-6 border border-slate-800 space-y-4">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div>
						<h2 class="text-sm font-bold text-white">Baza taboru ZKM Gdynia ([dbo].[busy])</h2>
						<p class="text-xs text-slate-400">Pojazdy zsynchronizowane z oficjalnej bazy taboru</p>
					</div>
					<input
						type="text"
						bind:value={vehicleSearch}
						placeholder="Filtruj (np. 3254, Solaris, MAN)..."
						class="px-3.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 w-full sm:w-64"
					/>
				</div>

				<div class="overflow-x-auto max-h-[500px]">
					<table class="w-full text-xs text-left border-collapse">
						<thead class="sticky top-0 bg-slate-900 z-10">
							<tr class="border-b border-slate-800 text-amber-400 font-bold uppercase tracking-wider">
								<th class="p-3">Nr boczny (Bus)</th>
								<th class="p-3">Zdjęcie</th>
								<th class="p-3">Marka</th>
								<th class="p-3">Model</th>
								<th class="p-3 text-right">Karta pojazdu</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-850">
							{#each filteredVehicles as v}
								<tr class="hover:bg-slate-900/50">
									<td class="p-3 font-mono-board font-black text-amber-400">#{v.Bus}</td>
									<td class="p-3">
										{#if v.photoURL}
											<img src={v.photoURL} alt="Bus {v.Bus}" class="w-14 h-9 object-cover rounded-lg border border-slate-700" />
										{:else}
											<span class="text-[10px] text-slate-400">Brak</span>
										{/if}
									</td>
									<td class="p-3 font-bold text-white">{v.marka || '-'}</td>
									<td class="p-3 text-slate-300">{v.model || '-'}</td>
									<td class="p-3 text-right">
										<a
											href="https://zkmgdynia.pl/pojazdy/search?action%5B0%5D=search&nr_inventory={v.Bus}&typ=&brand_id=&model_id=&carrier_id="
											target="_blank"
											rel="noreferrer"
											class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
										>
											Karta pojazdu ↗
										</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{:else if activeTab === 'favs'}
			<div class="bg-slate-900/40 rounded-3xl p-6 border border-slate-800 overflow-x-auto">
				<table class="w-full text-xs text-left border-collapse">
					<thead>
						<tr class="border-b border-slate-800 text-amber-400 font-bold uppercase tracking-wider">
							<th class="p-3">User ID</th>
							<th class="p-3">Własna nazwa przystanku</th>
							<th class="p-3">Stop ID</th>
							<th class="p-3 text-right">Akcja</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-850">
						{#each data.favs as f}
							<tr class="hover:bg-slate-900/50">
								<td class="p-3 font-mono-board text-slate-300">{f.user_id}</td>
								<td class="p-3 font-semibold text-white">{f.stop_name}</td>
								<td class="p-3 font-mono-board text-amber-400">#{f.stop_id}</td>
								<td class="p-3 text-right">
									<a
										href="/przystanek/{f.stop_id}"
										class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
									>
										Podgląd
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="bg-slate-900/40 rounded-3xl p-6 border border-slate-800 overflow-x-auto">
				<table class="w-full text-xs text-left border-collapse">
					<thead>
						<tr class="border-b border-slate-800 text-amber-400 font-bold uppercase tracking-wider">
							<th class="p-3">User ID</th>
							<th class="p-3">Imię / Nazwa</th>
							<th class="p-3">Tryb Legacy</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-850">
						{#each data.users as u}
							<tr class="hover:bg-slate-900/50">
								<td class="p-3 font-mono-board text-slate-300">{u.userID}</td>
								<td class="p-3 font-semibold text-white">{u.Name}</td>
								<td class="p-3">
									<span class="px-2 py-0.5 rounded-full text-[10px] font-bold {u.LegacyMode ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}">
										{u.LegacyMode ? 'Włączony' : 'Wyłączony'}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</main>
</div>
