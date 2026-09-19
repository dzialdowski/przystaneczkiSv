<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Clock, AlertTriangle, CheckCircle2, Zap, Wind, ExternalLink, Compass, RefreshCw } from 'lucide-svelte';
	import type { EnrichedDelayItem } from '$lib/server/tristar';

	interface Props {
		delays?: EnrichedDelayItem[];
		lastUpdate?: string;
		loading?: boolean;
		legacyMode?: boolean;
		stopName?: string;
		stopId?: string | number;
	}

	let {
		delays = [],
		lastUpdate = '',
		loading = false,
		legacyMode = false,
		stopName = '',
		stopId = ''
	}: Props = $props();

	function getRouteUrl(row: EnrichedDelayItem) {
		const params = new URLSearchParams();
		if (row.trip) params.set('trip', String(row.trip));
		if (stopId) params.set('fromStop', String(stopId));
		if (row.theoreticalTime && row.theoreticalTime !== '--:--') params.set('theo', row.theoreticalTime);
		if (row.estimatedTime && row.estimatedTime !== '--:--') params.set('est', row.estimatedTime);
		if (typeof row.delayInSeconds === 'number') params.set('delay', String(row.delayInSeconds));
		if (row.headsign) params.set('headsign', row.headsign);
		if (row.vehicleCode) params.set('vCode', String(row.vehicleCode));
		return `/trasa/${row.routeId}/${row.tripId}?${params.toString()}`;
	}

	let currentTime = $state(Date.now());
	let intervalId: any;

	onMount(() => {
		intervalId = setInterval(() => {
			currentTime = Date.now();
		}, 1000);
	});

	onDestroy(() => {
		if (intervalId) clearInterval(intervalId);
	});

	/**
	 * Oblicza czas pozostały do odjazdu w sekundach i minutach na żywo (jak stary czas.js)
	 */
	function calculateLiveCountdown(theoreticalTime: string, delayInSeconds: number) {
		if (!theoreticalTime || theoreticalTime === '--:--') {
			return { isDeparting: false, text: '---' };
		}

		try {
			const parts = theoreticalTime.split(':');
			const hours = parseInt(parts[0], 10);
			const minutes = parseInt(parts[1], 10);
			const seconds = parts.length > 2 ? parseInt(parts[2], 10) : 0;

			const targetDate = new Date();
			targetDate.setHours(hours, minutes, seconds, 0);

			// Dodaj opóźnienie w sekundach
			const targetTimestamp = targetDate.getTime() + (delayInSeconds || 0) * 1000;
			let diffSeconds = Math.floor((targetTimestamp - currentTime) / 1000);

			// Obsługa przełomu północy
			if (diffSeconds < -7200) {
				diffSeconds += 86400;
			}

			if (diffSeconds <= 60) {
				return { isDeparting: true, text: '>>>>' };
			}

			const m = Math.floor(diffSeconds / 60);
			const s = Math.abs(diffSeconds % 60);

			return {
				isDeparting: false,
				text: `${m} min ${s < 10 ? '0' + s : s} s`
			};
		} catch {
			return { isDeparting: false, text: theoreticalTime };
		}
	}
</script>

<div class="w-full">
	{#if loading && (!delays || delays.length === 0)}
		<div class="flex flex-col items-center justify-center p-12 text-slate-400 bg-slate-900/40 rounded-3xl border border-slate-800">
			<div class="w-8 h-8 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-3"></div>
			<p class="text-sm font-medium">Pobieranie odjazdów TRISTAR...</p>
		</div>
	{:else if !delays || delays.length === 0}
		<div class="p-8 text-center bg-slate-900/40 rounded-3xl border border-slate-800/80">
			<div class="inline-flex p-3 rounded-2xl bg-amber-500/10 text-amber-400 mb-3">
				<Clock class="w-6 h-6" />
			</div>
			<h3 class="text-base font-bold text-white mb-1">Brak odjazdów w najbliższym czasie</h3>
			<p class="text-xs text-slate-400 max-w-sm mx-auto">
				W najbliższych minutach z tego słupka nie są planowane żadne odjazdy autobusów ani trolejbusów.
			</p>
			{#if lastUpdate}
				<p class="mt-3 text-[11px] text-slate-400">Aktualizacja: {lastUpdate}</p>
			{/if}
		</div>
	{:else if legacyMode}
		<!-- TRYB RETRO (Klasyczny bursztynowy styl tabeli) -->
		<div class="overflow-x-auto rounded-xl border border-neutral-700 bg-black p-4 text-xs font-mono transition-opacity duration-200 {loading ? 'opacity-85' : 'opacity-100'}">
			<div class="text-center font-bold text-amber-400 text-sm mb-2 uppercase flex items-center justify-center gap-2">
				<span>[ TRYB RETRO ] {stopName}</span>
				{#if loading}
					<span class="inline-flex items-center gap-1 text-[11px] text-amber-300 font-normal lowercase">
						<RefreshCw class="w-3 h-3 animate-spin" />
						<span>odświeżanie...</span>
					</span>
				{/if}
			</div>
			<table class="w-full border-collapse text-neutral-200">
				<thead>
					<tr class="border-b border-neutral-700 text-amber-500 bg-neutral-900/80">
						<th class="p-2 text-left">Linia</th>
						<th class="p-2 text-left">Kierunek</th>
						<th class="p-2 text-center">Odjazd</th>
						<th class="p-2 text-center">Rzeczywisty</th>
						<th class="p-2 text-center">Rozkładowy</th>
						<th class="p-2 text-center">Opóźnienie</th>
						<th class="p-2 text-center">Pojazd</th>
					</tr>
				</thead>
				<tbody>
					{#each delays as row, idx (`${row.line}-${row.tripId || ''}-${row.theoreticalTime}-${idx}`)}
						{@const countdown = calculateLiveCountdown(row.theoreticalTime, row.delayInSeconds)}
						<tr class="border-b border-neutral-800 hover:bg-neutral-900/50">
							<td class="p-2 font-bold text-amber-400">
								<a
									href="https://zkmgdynia.pl/rozklad-jazdy"
									target="_blank"
									class="hover:underline"
								>
									{row.line}
								</a>
							</td>
							<td class="p-2">
								<a
									href={getRouteUrl(row)}
									class="hover:text-amber-300"
								>
									{row.headsign}
								</a>
							</td>
							<td class="p-2 text-center font-bold {countdown.isDeparting ? 'text-rose-500 animate-pulse' : 'text-cyan-400'}">
								{countdown.text}
							</td>
							<td class="p-2 text-center text-neutral-300">{row.estimatedTime}</td>
							<td class="p-2 text-center text-neutral-400">{row.theoreticalTime}</td>
							<td class="p-2 text-center">
								{#if row.statusType === 'on-time'}
									<span class="text-emerald-400">Punktualnie</span>
								{:else if row.statusType === 'early'}
									<span class="text-sky-400">Przyspieszony {row.statusText}</span>
								{:else}
									<span class="text-rose-400">Opóźniony {row.statusText}</span>
								{/if}
							</td>
							<td class="p-2 text-center">
								{#if row.vehicleCode}
									<a
										href="https://zkmgdynia.pl/pojazdy/search?action%5B0%5D=search&nr_inventory={row.vehicleCode}&typ=&brand_id=&model_id=&carrier_id="
										target="_blank"
										class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-200 hover:bg-amber-500 hover:text-black transition"
									>
										#{row.vehicleCode}
									</a>
									{#if row.vehicleDetails?.usb}🔋{/if}
									{#if row.vehicleDetails?.klima}❄️{/if}
								{:else}
									-
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<div class="mt-3 flex items-center justify-between text-[10px] text-neutral-400">
				<div>
					{#if loading}
						<span class="text-amber-400 font-semibold flex items-center gap-1">
							<RefreshCw class="w-3 h-3 animate-spin" /> Pobieranie aktualizacji...
						</span>
					{/if}
				</div>
				<div>
					Aktualizacja TRISTAR: {lastUpdate}
				</div>
			</div>
		</div>
	{:else}
		<!-- NOWOCZESNY WIDOK TABLICY TRISTAR (Sleek Dark Glass & Amber LED) -->
		<div class="rounded-3xl tristar-board border border-slate-800/90 overflow-hidden shadow-2xl transition-opacity duration-200 {loading ? 'opacity-90' : 'opacity-100'}">
			<!-- Belka nagłówkowa tablicy -->
			<div class="px-5 py-4 border-b border-slate-800/80 bg-slate-900/70 flex flex-wrap items-center justify-between gap-3">
				<div class="flex items-center gap-2">
					<span class="relative flex h-2.5 w-2.5">
						{#if loading}
							<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
							<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
						{:else}
							<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
							<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
						{/if}
					</span>
					<span class="text-xs font-bold uppercase tracking-wider text-slate-300">
						Tablica TRISTAR na żywo
					</span>
					{#if loading}
						<span class="inline-flex items-center gap-1.5 text-[11px] text-amber-400 font-medium ml-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
							<RefreshCw class="w-2.5 h-2.5 animate-spin" />
							<span>Aktualizowanie...</span>
						</span>
					{/if}
				</div>
				<div class="text-[11px] font-mono-board text-slate-400">
					Aktualizacja: <span class="text-amber-400 font-semibold">{lastUpdate}</span>
				</div>
			</div>

			<!-- Lista odjazdów -->
			<div class="divide-y divide-slate-850">
				{#each delays as row, idx (`${row.line}-${row.tripId || ''}-${row.theoreticalTime}-${idx}`)}
					{@const countdown = calculateLiveCountdown(row.theoreticalTime, row.delayInSeconds)}
					<div class="p-4 sm:p-5 hover:bg-slate-900/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
						<!-- Lewa strona: Linia i Kierunek -->
						<div class="flex items-start sm:items-center gap-3.5 min-w-0">
							<!-- Pigułka z numerem linii -->
							<a
								href={getRouteUrl(row)}
								title="Zobacz trasę linii {row.line}"
								class="shrink-0 w-14 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 flex flex-col items-center justify-center font-black text-lg shadow-md shadow-amber-500/20 group-hover:scale-105 transition"
							>
								<span>{row.line}</span>
							</a>

							<!-- Szczegóły kursu -->
							<div class="min-w-0">
								<div class="flex items-center gap-2 flex-wrap">
									<a
										href={getRouteUrl(row)}
										class="font-bold text-white text-base sm:text-lg hover:text-amber-400 transition truncate block"
									>
										{row.headsign}
									</a>
								</div>

								<!-- Parametry pojazdu i rozkładu -->
								<div class="flex items-center gap-2.5 mt-1 text-xs text-slate-400 flex-wrap">
									<span class="font-mono-board text-slate-300">
										Rozkład: {row.theoreticalTime}
									</span>

									{#if row.estimatedTime !== row.theoreticalTime}
										<span class="text-slate-500">•</span>
										<span class="font-mono-board text-amber-300">
											Rzeczywisty: {row.estimatedTime}
										</span>
									{/if}

									<!-- Informacje o pojeździe -->
									{#if row.vehicleCode}
										<span class="text-slate-500">•</span>
										<a
											href="https://zkmgdynia.pl/pojazdy/search?action%5B0%5D=search&nr_inventory={row.vehicleCode}&typ=&brand_id=&model_id=&carrier_id="
											target="_blank"
											rel="noreferrer"
											class="inline-flex items-center gap-1 text-slate-400 hover:text-white transition"
										>
											<span>Pojazd #{row.vehicleCode}</span>
											{#if row.vehicleDetails?.marka}
												<span class="text-slate-400 font-medium">({row.vehicleDetails.marka} {row.vehicleDetails.model || ''})</span>
											{/if}
										</a>
									{/if}

									<!-- Pigułki udogodnień -->
									{#if row.vehicleDetails?.klima}
										<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 text-[10px] font-semibold border border-cyan-500/20" title="Pojazd klimatyzowany">
											<Wind class="w-2.5 h-2.5" /> Klima
										</span>
									{/if}

									{#if row.vehicleDetails?.usb}
										<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20" title="Ładowarki USB w pojeździe">
											<Zap class="w-2.5 h-2.5" /> USB
										</span>
									{/if}
								</div>
							</div>
						</div>

						<!-- Prawa strona: Czas do odjazdu i Badge opóźnienia -->
						<div class="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/60">
							<!-- Status opóźnienia -->
							<div class="text-right">
								{#if row.statusType === 'on-time'}
									<div class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
										<CheckCircle2 class="w-3 h-3" />
										Punktualnie
									</div>
								{:else if row.statusType === 'early'}
									<div class="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
										<Clock class="w-3 h-3" />
										Przyspieszony {row.statusText}
									</div>
								{:else}
									<div class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
										<AlertTriangle class="w-3 h-3" />
										Opóźniony {row.statusText}
									</div>
								{/if}
							</div>

							<!-- Główny licznik czasu na żywo -->
							<div class="text-right min-w-[110px]">
								{#if countdown.isDeparting}
									<div class="font-mono-board text-rose-500 font-extrabold text-base sm:text-lg animate-departing flex items-center justify-end gap-1">
										<span>ODJEŻDŻA</span>
										<span class="tracking-tighter">&gt;&gt;&gt;</span>
									</div>
								{:else}
									<div class="font-mono-board font-black text-lg sm:text-xl text-amber-400 amber-glow">
										{countdown.text}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
