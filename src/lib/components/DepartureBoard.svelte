<script lang="ts">
	import {
		Clock,
		AlertTriangle,
		CheckCircle,
		ArrowRight,
		Bus,
		Sparkles,
		ShieldCheck,
		ExternalLink,
		RefreshCw
	} from 'lucide-svelte';
	import type { EnrichedDelayItem, StopLineInfo } from '$lib/server/tristar';
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		delays: EnrichedDelayItem[];
		lines?: StopLineInfo[];
		lastUpdate: string;
		loading?: boolean;
		legacyMode?: boolean;
		stopName?: string;
		stopId?: string;
	}

	let {
		delays = [],
		lines = [],
		lastUpdate = '',
		loading = false,
		legacyMode = false,
		stopName = '',
		stopId = ''
	}: Props = $props();

	// Rozwijanie pełnej listy kierunków dla linii
	let showAllServedLines = $state(false);

	// Helper do budowania linku do strony trasy/pojazdu
	function getRouteUrl(row: EnrichedDelayItem): string {
		const base = `/trasa/${row.routeId}/${row.tripId || 0}`;
		const params = new URLSearchParams();
		if (row.vehicleCode) params.set('vCode', String(row.vehicleCode));
		if (stopId) params.set('fromStop', stopId);
		if (row.headsign) params.set('headsign', row.headsign);
		const qs = params.toString();
		return qs ? `${base}?${qs}` : base;
	}

	// Dynamiczne odliczanie w czasie rzeczywistym
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

	function calculateLiveCountdown(
		theoreticalTime: string,
		delayInSeconds: number
	): { isDeparting: boolean; text: string } {
		if (!theoreticalTime) return { isDeparting: false, text: '--' };

		try {
			const [hours, minutes, seconds] = theoreticalTime.split(':').map(Number);
			const targetDate = new Date();
			targetDate.setHours(hours, minutes, seconds || 0, 0);

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
			<p class="text-sm font-medium">Pobieranie odjazdów...</p>
		</div>
	{:else if !delays || delays.length === 0}
		<!-- SZCZEGÓLNIE WYRÓŻNIONA SEKCJA GDY NIC NIE JEDZIE W NAJBLIŻSZYM CZASIE -->
		{#if legacyMode}
			<!-- RETRO STYL PUSTEGO STANU -->
			<div class="overflow-x-auto rounded-xl border-2 border-amber-500 bg-black p-5 text-xs font-mono text-amber-400 shadow-2xl">
				<div class="text-center font-bold text-base mb-2 uppercase tracking-widest text-amber-300">
					[ BRAK ODJAZDÓW W NAJBLIŻSZYM CZASIE ]
				</div>
				<div class="text-center text-[11px] text-neutral-400 mb-4">
					AKTUALIZACJA: {lastUpdate || 'BRAK DANYCH'} • {stopName}
				</div>

				<div class="border-t-2 border-b-2 border-amber-500 py-2.5 px-3 mb-4 bg-amber-950/40 font-bold text-amber-200 text-center tracking-wider uppercase">
					*** OBSŁUGIWANE LINIE I KIERUNKI ***
				</div>

				{#if lines && lines.length > 0}
					<table class="w-full border-collapse text-neutral-200">
						<thead>
							<tr class="border-b border-neutral-700 text-amber-400 bg-neutral-900/90">
								<th class="p-2.5 text-left w-24">LINIA</th>
								<th class="p-2.5 text-left">KIERUNEK (DOKĄD JEDZIE)</th>
								<th class="p-2.5 text-center w-36">STATUS</th>
								<th class="p-2.5 text-right w-24">TRASA</th>
							</tr>
						</thead>
						<tbody>
							{#each lines as l}
								<tr class="border-b border-neutral-800 hover:bg-neutral-900/60">
									<td class="p-2.5 font-bold text-amber-400 text-sm">{l.line}</td>
									<td class="p-2.5 text-white font-semibold">
										{#if l.isTerminus}
											<span class="text-neutral-400">Dla wysiadających (przyjazdy z: {l.directions.join(', ')})</span>
										{:else}
											<span class="text-amber-400 mr-1">➔</span> {l.directions.join(' / ')}
										{/if}
									</td>
									<td class="p-2.5 text-center">
										{#if l.isTerminus}
											<span class="text-rose-400 font-bold">[KONIEC TRASY]</span>
										{:else}
											<span class="text-emerald-400">[PRZYSTANEK NA TRASIE]</span>
										{/if}
									</td>
									<td class="p-2.5 text-right">
										<a
											href="/trasa/{l.routeId || ''}/0?fromStop={stopId}&headsign={encodeURIComponent(l.directions[0] || '')}"
											class="text-amber-400 underline hover:text-amber-300"
										>
											TRASA &gt;&gt;
										</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else}
					<div class="p-4 text-center text-neutral-400">BRAK LINII DLA TEGO PRZYSTANKU</div>
				{/if}
			</div>
		{:else}
			<!-- NOWOCZESNY WIDOK: WYRÓŻNIONA KARTA BRAKU ODJAZDÓW Z BOGATĄ SEKTOROWĄ PREZENTACJĄ LINII -->
			<div class="space-y-4">
				<!-- Komunikat o braku bieżących kursów -->
				<div class="p-5 sm:p-6 bg-slate-900/70 rounded-3xl border border-slate-800/90 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
					<div class="p-3.5 rounded-2xl bg-amber-500/10 text-amber-400 shrink-0 border border-amber-500/20">
						<Clock class="w-7 h-7" />
					</div>
					<div class="flex-1">
						<h3 class="text-base sm:text-lg font-bold text-white mb-0.5">Brak odjazdów w najbliższym czasie</h3>
						<p class="text-xs text-slate-400 max-w-xl">
							W tej chwili żaden pojazd nie ma zaplanowanego odjazdu. Poniżej sprawdzisz wszystkie linie i kierunki obsługujące ten przystanek.
						</p>
					</div>
					{#if lastUpdate}
						<div class="text-[11px] text-slate-500 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800/80 shrink-0">
							Aktualizacja: {lastUpdate}
						</div>
					{/if}
				</div>

				<!-- WYRÓŻNIONA SEKCJA OBSŁUGIWANYCH LINII I KIERUNKÓW -->
				<div class="bg-gradient-to-b from-amber-500/15 via-slate-900/95 to-slate-950 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-500/10 space-y-6">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-4">
						<div>
							<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider mb-2 shadow-md shadow-amber-500/20">
								<Bus class="w-3.5 h-3.5" />
								<span>Rozkładowe linie na tym przystanku</span>
							</div>
							<h2 class="text-xl sm:text-2xl font-black text-white">
								Obsługiwane linie i kierunki
							</h2>
							<p class="text-xs text-slate-300 mt-1">
								Z tego przystanku ({stopName || 'Wybrany przystanek'}) regularnie kursują następujące linie:
							</p>
						</div>

						{#if lines && lines.length > 0}
							<div class="text-xs font-bold text-amber-400 bg-slate-950/80 px-3.5 py-2 rounded-2xl border border-amber-500/30 shrink-0">
								Liczba linii: {lines.length}
							</div>
						{/if}
					</div>

					{#if lines && lines.length > 0}
						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
							{#each lines as lineInfo}
								<div class="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/30 hover:border-amber-400 transition-all duration-200 shadow-lg hover:shadow-amber-500/10 flex flex-col justify-between gap-3 group">
									<div class="flex items-start gap-3">
										<!-- Wyróżniony numer linii -->
										<div class="w-13 h-11 px-3 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 font-black text-lg flex items-center justify-center shrink-0 shadow-md shadow-amber-500/30 group-hover:scale-105 transition">
											{lineInfo.line}
										</div>

										<div class="min-w-0 flex-1">
											{#if lineInfo.isTerminus}
												<span class="inline-block px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wider mb-1">
													Koniec trasy
												</span>
												<div class="text-xs text-slate-400">
													Dla wysiadających (przyjazd z: {lineInfo.directions.join(', ')})
												</div>
											{:else}
												<span class="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
													Kierunki:
												</span>
												<div class="space-y-1">
													{#each lineInfo.directions as dir}
														<div class="flex items-center gap-1.5 text-white font-bold text-xs sm:text-sm leading-tight">
															<ArrowRight class="w-3.5 h-3.5 text-amber-400 shrink-0" />
															<span class="truncate" title={dir}>{dir}</span>
														</div>
													{/each}
												</div>
											{/if}
										</div>
									</div>

									<!-- Przycisk podglądu trasy -->
									<a
										href="/trasa/{lineInfo.routeId || ''}/0?fromStop={stopId}&headsign={encodeURIComponent(lineInfo.directions[0] || '')}"
										class="mt-2 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-amber-400 transition"
									>
										<span>Zobacz trasę i przystanki</span>
										<ArrowRight class="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
									</a>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	{:else if legacyMode}
		<!-- RETRO TABLICA W STYLU SYSTEMU TRISTAR (Bursztynowy LED / Matrix) -->
		<div class="overflow-x-auto rounded-xl border-2 border-amber-500 bg-black p-4 text-xs font-mono text-amber-400 shadow-2xl">
			<div class="text-center font-bold text-sm mb-2 uppercase tracking-widest text-amber-300">
				TABLICA ODJAZDÓW • {stopName}
			</div>

			{#if lines && lines.length > 0}
				<div class="mb-3 p-2 bg-neutral-900 border border-neutral-800 text-neutral-300 text-[11px]">
					<span class="text-amber-400 font-bold">LINIE NA PRZYSTANKU:</span>
					{#each lines as l, idx}
						<span class="font-bold text-amber-300 ml-1">{l.line}</span>
						{#if !l.isTerminus && l.directions.length > 0}
							<span class="text-neutral-400"> (➔ {l.directions[0]})</span>
						{/if}
						{idx < lines.length - 1 ? ',' : ''}
					{/each}
				</div>
			{/if}

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
										{row.vehicleCode}
									</a>
									{#if row.vehicleDetails?.usb}
										<img src="/USB.png" alt="USB" class="inline-block w-3.5 h-3.5 ml-1 align-middle" title="Ładowarki USB w pojeździe" />
									{/if}
									{#if row.vehicleDetails?.klima}
										<img src="/Klima.png" alt="Klima" class="inline-block w-3.5 h-3.5 ml-1 align-middle" title="Pojazd klimatyzowany" />
									{/if}
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
					Aktualizacja: {lastUpdate}
				</div>
			</div>
		</div>
	{:else}
		<!-- NOWOCZESNY WIDOK TABLICY ODJAZDÓW (Sleek Dark Glass & Amber LED) -->
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
					<span class="text-xs font-bold tracking-wider text-slate-300 uppercase">
						Tablica odjazdów na żywo
					</span>
				</div>

				<div class="flex items-center gap-4 text-xs text-slate-400">
					{#if loading}
						<span class="text-amber-400 font-medium flex items-center gap-1.5 animate-pulse">
							<RefreshCw class="w-3.5 h-3.5 animate-spin" />
							<span>Aktualizowanie...</span>
						</span>
					{/if}
					<span>Aktualizacja: <strong class="text-slate-200">{lastUpdate}</strong></span>
				</div>
			</div>

			<!-- Pasek obsługiwanych linii i kierunków z opcją rozwinięcia -->
			{#if lines && lines.length > 0}
				<div class="px-5 py-2.5 border-b border-slate-800/60 bg-slate-950/50 flex flex-wrap items-center justify-between gap-2">
					<div class="flex items-center gap-2 text-xs flex-wrap min-w-0">
						<span class="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
							<Bus class="w-3.5 h-3.5" /> Linie:
						</span>
						<div class="flex flex-wrap gap-1.5 items-center">
							{#each lines as l}
								<div
									class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 hover:border-amber-500/50 transition cursor-default"
									title="{l.line}: {l.directions.join(', ')}"
								>
									<span class="font-extrabold text-amber-400">{l.line}</span>
									{#if !l.isTerminus && l.directions.length > 0}
										<span class="text-slate-500 text-[9px]">➔</span>
										<span class="text-slate-300 truncate max-w-[120px]">{l.directions[0]}</span>
									{:else if l.isTerminus}
										<span class="text-[9px] text-slate-400">(koniec)</span>
									{/if}
								</div>
							{/each}
						</div>
					</div>

					<button
						onclick={() => (showAllServedLines = !showAllServedLines)}
						class="text-[11px] font-semibold text-slate-400 hover:text-amber-400 flex items-center gap-1 transition shrink-0 ml-auto cursor-pointer"
					>
						<span>{showAllServedLines ? 'Zwiń kierunki' : 'Wszystkie kierunki'}</span>
						<span class="text-[9px]">{showAllServedLines ? '▲' : '▼'}</span>
					</button>
				</div>

				{#if showAllServedLines}
					<div class="p-4 border-b border-slate-800/80 bg-slate-900/95 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
						{#each lines as l}
							<div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-2.5 shadow-sm">
								<span class="font-black text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 text-xs shrink-0">
									{l.line}
								</span>
								<div class="min-w-0 flex-1">
									{#if l.isTerminus}
										<div class="text-[11px] text-rose-400 font-semibold">Koniec trasy (dla wysiadających)</div>
									{:else}
										<div class="space-y-0.5">
											{#each l.directions as dir}
												<div class="flex items-center gap-1 text-slate-200 truncate" title={dir}>
													<span class="text-amber-400 text-[10px]">➔</span>
													<span class="truncate">{dir}</span>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/if}

			<!-- Lista pozycji odjazdów -->
			<div class="divide-y divide-slate-800/60 bg-slate-950/40">
				{#each delays as row, idx (`${row.line}-${row.tripId || ''}-${row.theoreticalTime}-${idx}`)}
					{@const countdown = calculateLiveCountdown(row.theoreticalTime, row.delayInSeconds)}
					<div class="p-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-slate-900/40 transition">
						<!-- Lewa strona: Linia i Kierunek -->
						<div class="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
							<!-- Pigułka numeru linii -->
							<a
								href="https://zkmgdynia.pl/rozklad-jazdy"
								target="_blank"
								class="w-12 h-11 sm:w-14 sm:h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-base sm:text-lg shrink-0 shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition"
								title="Otwórz oficjalny rozkład jazdy ZKM Gdynia dla linii {row.line}"
							>
								{row.line}
							</a>

							<!-- Kierunek i szczegóły kursu -->
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<a
										href={getRouteUrl(row)}
										class="font-extrabold text-white text-base sm:text-lg truncate block hover:text-amber-400 transition"
										title="Kliknij, aby zobaczyć trasę i przystanki tego kursu"
									>
										{row.headsign}
									</a>
									<a
										href={getRouteUrl(row)}
										class="text-slate-500 hover:text-amber-400 transition"
										title="Zobacz pełną trasę i pozycję na mapie"
									>
										<ExternalLink class="w-3.5 h-3.5" />
									</a>
								</div>

								<div class="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
									<span>Rozkład: <strong class="text-slate-300 font-semibold">{row.theoreticalTime}</strong></span>
									<span class="text-slate-600">•</span>
									<span>Oczekiwany: <strong class="text-slate-300 font-semibold">{row.estimatedTime}</strong></span>

									{#if row.vehicleCode}
										<span class="text-slate-600">•</span>
										<a
											href="https://zkmgdynia.pl/pojazdy/search?action%5B0%5D=search&nr_inventory={row.vehicleCode}&typ=&brand_id=&model_id=&carrier_id="
											target="_blank"
											class="inline-flex items-center gap-1 font-mono text-[11px] text-amber-400/90 hover:text-amber-300 hover:underline bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800"
											title="Pojazd nr {row.vehicleCode} {row.vehicleDetails?.marka || ''} {row.vehicleDetails?.model || ''}"
										>
											Nr {row.vehicleCode}
											{#if row.vehicleDetails?.marka}
												<span class="text-slate-400 text-[10px]">({row.vehicleDetails.marka} {row.vehicleDetails.model || ''})</span>
											{/if}
										</a>

										{#if row.vehicleDetails?.usb}
											<img src="/USB.png" alt="USB" class="inline-block w-3.5 h-3.5 align-middle" title="Ładowarki USB w pojeździe" />
										{/if}
										{#if row.vehicleDetails?.klima}
											<img src="/Klima.png" alt="Klima" class="inline-block w-3.5 h-3.5 align-middle" title="Pojazd klimatyzowany" />
										{/if}
									{/if}
								</div>
							</div>
						</div>

						<!-- Prawa strona: Odliczanie i badge punktualności -->
						<div class="flex items-center justify-between sm:justify-end gap-3 sm:gap-5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/60">
							<!-- Status opóźnienia -->
							<div class="text-left sm:text-right">
								{#if row.statusType === 'on-time'}
									<div class="flex items-center sm:justify-end gap-1.5 text-xs font-bold text-emerald-400">
										<CheckCircle class="w-3.5 h-3.5" />
										<span>Punktualnie</span>
									</div>
								{:else if row.statusType === 'early'}
									<div class="flex items-center sm:justify-end gap-1.5 text-xs font-bold text-sky-400">
										<Clock class="w-3.5 h-3.5" />
										<span>{row.statusText}</span>
									</div>
								{:else}
									<div class="flex items-center sm:justify-end gap-1.5 text-xs font-bold text-rose-400">
										<AlertTriangle class="w-3.5 h-3.5" />
										<span>{row.statusText}</span>
									</div>
								{/if}
							</div>

							<!-- Odliczanie (Live countdown) -->
							<div class="text-right shrink-0 min-w-[90px]">
								{#if countdown.isDeparting}
									<div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 text-slate-950 font-black text-xs sm:text-sm animate-pulse shadow-lg shadow-rose-500/20">
										<span class="tracking-widest">&gt;&gt;&gt;&gt;</span>
										<span>Odjeżdża</span>
									</div>
								{:else}
									<div class="text-base sm:text-xl font-mono font-black text-amber-400 tracking-tight">
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
