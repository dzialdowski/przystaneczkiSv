<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Navigation,
		MapPin,
		Bus,
		RefreshCw,
		AlertCircle,
		X,
		ArrowRight,
		ExternalLink,
		CheckCircle2,
		Sparkles
	} from 'lucide-svelte';
	import type { TristarStop } from '$lib/server/tristar';

	interface Props {
		selectedStopId?: string;
		onSelectStop: (stopId: string, stopName: string) => void;
		onClose?: () => void;
		autoRequest?: boolean;
	}

	let { selectedStopId = '', onSelectStop, onClose, autoRequest = true }: Props = $props();

	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let stops = $state<TristarStop[]>([]);
	let userCoords = $state<{ lat: number; lon: number; accuracy?: number } | null>(null);
	let lastFetchedAt = $state<string | null>(null);
	let hasRequested = $state(false);

	function formatDistance(meters: number): string {
		if (meters < 1000) {
			return `${meters} m`;
		}
		return `${meters.toLocaleString('pl-PL')} m`;
	}

	export function requestLocation() {
		hasRequested = true;
		error = null;

		if (typeof window === 'undefined' || !navigator.geolocation) {
			error = 'Geolokalizacja nie jest wspierana przez Twoją przeglądarkę.';
			return;
		}

		isLoading = true;

		navigator.geolocation.getCurrentPosition(
			async (pos) => {
				const lat = pos.coords.latitude;
				const lon = pos.coords.longitude;
				userCoords = {
					lat,
					lon,
					accuracy: Math.round(pos.coords.accuracy)
				};

				try {
					const res = await fetch(`/api/stops?lat=${lat}&lon=${lon}&limit=8`);
					if (!res.ok) {
						throw new Error(`Błąd serwera (${res.status})`);
					}
					const data: TristarStop[] = await res.json();
					stops = data;
					lastFetchedAt = new Date().toLocaleTimeString('pl-PL', {
						hour: '2-digit',
						minute: '2-digit',
						second: '2-digit'
					});
				} catch (fetchErr: any) {
					console.error('Błąd pobierania najbliższych przystanków:', fetchErr);
					error = 'Nie udało się pobrać listy przystanków z serwera. Spróbuj ponownie.';
				} finally {
					isLoading = false;
				}
			},
			(geoErr) => {
				isLoading = false;
				console.warn('Błąd geolokalizacji:', geoErr);
				switch (geoErr.code) {
					case geoErr.PERMISSION_DENIED:
						error =
							'Brak dostępu do lokalizacji GPS. Zezwól na dostęp do lokalizacji w ustawieniach przeglądarki.';
						break;
					case geoErr.POSITION_UNAVAILABLE:
						error =
							'Twoja pozycja GPS jest chwilowo niedostępna. Upewnij się, że masz włączoną lokalizację w urządzeniu.';
						break;
					case geoErr.TIMEOUT:
						error = 'Upłynął limit czasu oczekiwania na pozycję GPS. Spróbuj ponownie.';
						break;
					default:
						error = `Błąd lokalizacji: ${geoErr.message || 'Nieznany błąd'}`;
				}
			},
			{
				enableHighAccuracy: true,
				timeout: 10000,
				maximumAge: 30000
			}
		);
	}

	function handleStopClick(stop: TristarStop) {
		onSelectStop(String(stop.stopId), stop.stopName);
	}

	onMount(() => {
		if (autoRequest) {
			requestLocation();
		}
	});
</script>

<div
	class="bg-slate-900/90 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 transition-all"
>
	<!-- Nagłówek sekcji GPS -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
		<div class="flex items-center gap-2.5">
			<div class="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
				<Navigation class="w-5 h-5 {isLoading ? 'animate-spin' : ''}" />
			</div>
			<div>
				<div class="flex items-center gap-2">
					<h3 class="text-base sm:text-lg font-black text-white flex items-center gap-1.5">
						Najbliższe przystanki GPS
					</h3>
					<span
						class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
					>
						Na żywo
					</span>
				</div>
				<p class="text-xs text-slate-400">
					{#if userCoords}
						Współrzędne: {userCoords.lat.toFixed(4)}°N, {userCoords.lon.toFixed(4)}°E
						{#if userCoords.accuracy}
							(dokładność ~{userCoords.accuracy} m)
						{/if}
						{#if lastFetchedAt}
							• zaktualizowano o {lastFetchedAt}
						{/if}
					{:else if isLoading}
						Ustalanie współrzędnych i obliczanie odległości w metrach...
					{:else}
						Wyszukaj przystanki w promieniu Twojej obecnej lokalizacji
					{/if}
				</p>
			</div>
		</div>

		<div class="flex items-center gap-2 self-end sm:self-auto">
			<button
				onclick={requestLocation}
				disabled={isLoading}
				class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold border border-slate-700 hover:border-slate-600 transition shadow-sm cursor-pointer"
				title="Pobierz ponownie współrzędne GPS i odśwież odległości"
			>
				<RefreshCw class="w-3.5 h-3.5 {isLoading ? 'animate-spin text-emerald-400' : ''}" />
				<span>{isLoading ? 'Szukanie...' : 'Odśwież GPS'}</span>
			</button>

			{#if onClose}
				<button
					onclick={onClose}
					class="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer"
					title="Zwiń listę najbliższych przystanków"
				>
					<X class="w-4 h-4" />
				</button>
			{/if}
		</div>
	</div>

	<!-- Stan błędu geolokalizacji -->
	{#if error}
		<div
			class="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs flex items-start gap-3"
		>
			<AlertCircle class="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
			<div class="space-y-2 flex-1">
				<p class="font-medium">{error}</p>
				<button
					onclick={requestLocation}
					class="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 font-bold transition text-xs cursor-pointer"
				>
					Spróbuj ponownie pobrać pozycję
				</button>
			</div>
		</div>
	{/if}

	<!-- Stan ładowania -->
	{#if isLoading && stops.length === 0}
		<div class="py-10 text-center space-y-3">
			<div class="inline-block p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 animate-pulse">
				<Navigation class="w-8 h-8 text-emerald-400 animate-spin" />
			</div>
			<div class="space-y-1">
				<h4 class="text-sm font-bold text-white">Ustalanie pozycji i wyszukiwanie przystanków...</h4>
				<p class="text-xs text-slate-400 max-w-sm mx-auto">
					Pobieramy Twoje koordynaty z GPS oraz kalkulujemy odległości w metrach do każdego słupka ZKM Gdynia.
				</p>
			</div>
		</div>
	{/if}

	<!-- Lista znalezionych przystanków -->
	{#if stops.length > 0}
		<div class="space-y-2.5">
			<div class="flex items-center justify-between text-xs text-slate-400 px-1">
				<span>Znaleziono {stops.length} najbliższych przystanków (uszeregowane od najbliższego):</span>
				<span class="text-[11px] font-semibold text-emerald-400">Kliknij przystanek, by załadować odjazdy</span>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
				{#each stops as stop (stop.stopId)}
					{@const isCurrent = String(stop.stopId).trim() === String(selectedStopId).trim()}
					{@const topLines =
						stop.topLines && stop.topLines.length > 0
							? stop.topLines
							: [...(stop.lines || [])]
									.sort((a, b) => (b.tripCount ?? 0) - (a.tripCount ?? 0))
									.slice(0, 3)}

					<div
						role="button"
						tabindex="0"
						onclick={() => handleStopClick(stop)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								handleStopClick(stop);
							}
						}}
						class="group relative text-left p-4 rounded-2xl transition-all border flex flex-col justify-between gap-3 cursor-pointer shadow-lg {isCurrent
							? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/30'
							: 'bg-slate-950/70 border-slate-800/80 hover:border-emerald-500/50 hover:bg-slate-900/90'}"
					>
						<!-- Górny wiersz: Nazwa, słupek i badge odległości w metrach -->
						<div class="flex items-start justify-between gap-2.5">
							<div class="flex items-start gap-3 min-w-0">
								<div
									class="p-2.5 rounded-xl shrink-0 transition {isCurrent
										? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
										: 'bg-slate-800/80 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950'}"
								>
									<Bus class="w-4 h-4" />
								</div>
								<div class="min-w-0">
									<div class="flex items-center gap-1.5 flex-wrap">
										<h4
											class="font-black text-sm transition {isCurrent
												? 'text-amber-300'
												: 'text-white group-hover:text-emerald-300'} truncate"
											title={stop.stopName}
										>
											{stop.stopName}
										</h4>
										{#if isCurrent}
											<span
												class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30"
											>
												<CheckCircle2 class="w-3 h-3" />
												Aktywny
											</span>
										{/if}
									</div>
									<div class="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
										<span>{stop.zoneId || 'Gdynia'}</span>
										{#if stop.stopCode}
											<span>• Słupek {stop.stopCode}</span>
										{/if}
										<span class="text-slate-600">• ID: {stop.stopId}</span>
									</div>
								</div>
							</div>

							<!-- Odległość w metrach -->
							{#if typeof stop.distance === 'number'}
								<div
									class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs shrink-0 transition shadow-md {stop.distance < 200
										? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'
										: stop.distance < 600
											? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
											: 'bg-slate-800 border border-slate-700 text-slate-300'}"
									title="Odległość od Twojej pozycji GPS w linii prostej"
								>
									<Navigation class="w-3.5 h-3.5 shrink-0" />
									<span>{formatDistance(stop.distance)}</span>
								</div>
							{/if}
						</div>

						<!-- Szczegółowe zestawienie: Top 3 najczęściej kursujące linie z kierunkami -->
						<div class="pt-2 border-t border-slate-800/80 space-y-2">
							<div class="flex items-center justify-between text-[11px]">
								<span class="font-bold text-slate-300 flex items-center gap-1">
									<Sparkles class="w-3 h-3 text-amber-400" />
									Top 3 najczęstsze linie i kierunki:
								</span>
								{#if stop.lines && stop.lines.length > 3}
									<span class="text-[10px] text-slate-500">
										(z {stop.lines.length} linii łącznie)
									</span>
								{/if}
							</div>

							{#if topLines && topLines.length > 0}
								<div class="flex flex-col gap-1.5">
									{#each topLines as lineInfo (lineInfo.line)}
										<div
											class="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800/90 text-xs"
										>
											<span
												class="font-black text-amber-400 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-700 shrink-0 text-xs"
											>
												{lineInfo.line}
											</span>

											<div class="min-w-0 flex-1 flex items-center gap-1.5 text-slate-300 text-xs">
												{#if lineInfo.isTerminus}
													<span class="text-[10px] text-slate-400 italic">(przystanek końcowy)</span>
												{:else if lineInfo.directions && lineInfo.directions.length > 0}
													<span class="text-slate-500 text-[10px]">➔</span>
													<span
														class="font-medium truncate text-slate-200"
														title={lineInfo.directions.join(', ')}
													>
														{lineInfo.directions.join(', ')}
													</span>
												{:else}
													<span class="text-[10px] text-slate-500">Brak określonego kierunku</span>
												{/if}
											</div>

											{#if typeof lineInfo.tripCount === 'number' && lineInfo.tripCount > 0}
												<span
													class="text-[10px] font-semibold text-slate-400 bg-slate-950/60 px-1.5 py-0.5 rounded border border-slate-800/60 shrink-0"
													title="Liczba zaplanowanych kursów w rozkładzie jazdy"
												>
													~{lineInfo.tripCount} kursów
												</span>
											{/if}
										</div>
									{/each}
								</div>
							{:else}
								<div class="text-[11px] text-slate-500 italic py-1">
									Brak aktywnych linii w rozkładzie dla tego słupka
								</div>
							{/if}
						</div>

						<!-- Stopka karty: Szybka akcja i dedykowany link -->
						<div class="flex items-center justify-between pt-1 text-xs">
							<div
								class="flex items-center gap-1 font-bold text-xs {isCurrent
									? 'text-amber-400'
									: 'text-emerald-400 group-hover:text-emerald-300'}"
							>
								<span>{isCurrent ? 'Wyświetlany na tablicy' : 'Wybierz ten przystanek'}</span>
								<ArrowRight class="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
							</div>

							<a
								href="/przystanek/{stop.stopId}"
								onclick={(e) => e.stopPropagation()}
								class="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition"
								title="Otwórz pełną stronę słupka"
							>
								<span>Strona słupka</span>
								<ExternalLink class="w-3 h-3" />
							</a>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else if hasRequested && !isLoading && !error}
		<div class="py-6 text-center text-xs text-slate-400">
			Nie znaleziono przystanków w pobliżu podanych współrzędnych.
		</div>
	{/if}
</div>
