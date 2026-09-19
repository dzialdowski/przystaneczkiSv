<script lang="ts">
	import { page } from '$app/state';
	import {
		ArrowLeft,
		Bus,
		Clock,
		MapPin,
		CheckCircle2,
		AlertCircle,
		Wind,
		Zap,
		ExternalLink,
		ShieldCheck,
		Volume2,
		Tv,
		Heart,
		Ticket,
		Accessibility,
		Info
	} from 'lucide-svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import RouteMap from '$lib/components/RouteMap.svelte';
	import { getWarsawTime, diffMinutes } from '$lib/time';

	interface RouteStop {
		stopId: number;
		stopName: string;
		stopSequence: number;
		lat?: number;
		lon?: number;
		zone?: string;
		theoreticalTime: string;
		estimatedTime: string;
		status: 'passed' | 'next' | 'upcoming';
		isNext: boolean;
		isPassed: boolean;
		diffMin: number;
		estMinutes?: number;
		theoMinutes?: number;
	}

	let data = $derived(page.data);
	let user = $derived(page.data.user);
	let legacyMode = $derived(page.data.legacyMode || false);
	let isAdmin = $derived(page.data.isAdmin || false);

	// Dynamiczny zegar kroczący od czasu serwera
	let elapsedMs = $state(0);
	$effect(() => {
		const start = performance.now();
		const timer = setInterval(() => {
			elapsedMs = performance.now() - start;
		}, 3000);
		return () => clearInterval(timer);
	});

	let liveNowMinutes = $derived.by(() => {
		const base = data.serverNowMinutes ?? getWarsawTime().nowMinutes;
		return base + elapsedMs / 60000;
	});

	let displayStops = $derived.by(() => {
		const rawStops = (data.stops || []) as RouteStop[];
		if (rawStops.length === 0) return [];

		let nextFound = false;
		const mapped = rawStops.map((stop: RouteStop): RouteStop => {
			const estMin =
				typeof stop.estMinutes === 'number' && !isNaN(stop.estMinutes)
					? stop.estMinutes
					: (() => {
							const [h, m] = (stop.estimatedTime || '00:00').split(':').map(Number);
							return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
						})();

			const diff = diffMinutes(estMin, liveNowMinutes);
			let isPassed = false;
			let isNext = false;
			let status: 'passed' | 'next' | 'upcoming' = 'upcoming';

			if (diff < 0) {
				isPassed = true;
				status = 'passed';
			} else if (!nextFound && diff >= 0) {
				isNext = true;
				status = 'next';
				nextFound = true;
			} else {
				status = 'upcoming';
			}

			return {
				...stop,
				diffMin: diff,
				isPassed,
				isNext,
				status
			};
		});

		const allPassed = mapped.every((s: RouteStop) => s.isPassed);
		if (!nextFound && !allPassed && mapped.length > 0) {
			mapped[0].isNext = true;
			mapped[0].status = 'next';
		}

		return mapped;
	});

	function formatDelay(sec: number) {
		if (Math.abs(sec) < 60) return { text: 'Punktualnie', type: 'on-time' };
		if (sec > 0) {
			const m = Math.floor(sec / 60);
			const s = sec % 60;
			return { text: s > 0 ? `Opóźniony +${m}m ${s}s` : `Opóźniony +${m}m`, type: 'delayed' };
		} else {
			const m = Math.floor(Math.abs(sec) / 60);
			return { text: `Przyspieszony -${m}m`, type: 'early' };
		}
	}

	let delayInfo = $derived(formatDelay(data.delaySeconds));
	let vCode = $derived(data.vehicleCode || (data.vehicleDetails ? String(data.vehicleDetails.bus) : ''));

	// Odfiltrowanie udogodnień, aby nie dublować klimatyzacji i USB pokazywanych jako dedykowane odznaki
	let otherFeatures = $derived.by(() => {
		const feats = (data.vehicleDetails?.features || []) as string[];
		return feats.filter((f) => {
			const lower = f.toLowerCase();
			return (
				!lower.includes('klima') &&
				!lower.includes('ac') &&
				!lower.includes('usb') &&
				!lower.includes('ładowar')
			);
		});
	});
</script>

<div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">
	<Navbar {user} {legacyMode} {isAdmin} />

	<main class="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
		<div class="flex items-center justify-between gap-3">
			<a
				href={data.stops[0]?.stopId ? `/przystanek/${data.stops[0].stopId}` : '/'}
				onclick={(e) => {
					if (typeof window !== 'undefined' && window.history.length > 1) {
						e.preventDefault();
						window.history.back();
					}
				}}
				class="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white transition group py-2"
			>
				<ArrowLeft class="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
				<span>Powrót do odjazdów</span>
			</a>
		</div>

		<!-- Karta nagłówkowa linii -->
		<div class="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
			<div class="absolute -right-8 -top-8 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
				<div class="space-y-3">
					<div class="flex items-center gap-3">
						<span class="px-3.5 py-1.5 rounded-2xl bg-amber-500 text-slate-950 font-black text-2xl sm:text-3xl font-mono-board shadow-lg shadow-amber-500/20">
							{data.lineName}
						</span>
						{#if data.vehicleCode}
							<div class="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/80 text-amber-400 text-xs font-mono font-bold">
								<Bus class="w-3.5 h-3.5" />
								<span>Pojazd {data.vehicleCode}</span>
							</div>
						{/if}
					</div>

					<h1 class="text-xl sm:text-2xl font-black text-white tracking-tight">
						{data.routeDescription}
					</h1>

					<div class="flex flex-wrap items-center gap-4 text-xs text-slate-400">
						<span class="flex items-center gap-1.5">
							<MapPin class="w-3.5 h-3.5 text-amber-400" />
							{displayStops.length} przystanków na trasie
						</span>
						{#if data.stops.length > 0}
							<span class="flex items-center gap-1.5">
								<Clock class="w-3.5 h-3.5 text-amber-400" />
								{displayStops[0]?.theoreticalTime} ➔ {displayStops[displayStops.length - 1]?.estimatedTime}
							</span>
						{/if}
					</div>
				</div>

				<!-- Status punktualności -->
				<div class="shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 sm:border-l border-slate-800/80 pt-4 sm:pt-0 sm:pl-6 gap-2">
					<span class="text-xs text-slate-400 font-medium">Status kursu:</span>
					<div class="flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-bold {
						delayInfo.type === 'on-time'
							? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
							: delayInfo.type === 'early'
								? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
								: 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
					}">
						{#if delayInfo.type === 'on-time'}
							<CheckCircle2 class="w-4 h-4" />
						{:else}
							<AlertCircle class="w-4 h-4" />
						{/if}
						<span>{delayInfo.text}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Informacje o pojeździe (jeśli znaleziono w bazie 'busy') -->
		{#if vCode}
			<div class="bg-slate-900/40 rounded-3xl p-6 border border-slate-800/80 shadow-lg space-y-4">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/60">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
							<Bus class="w-5 h-5" />
						</div>
						<div>
							<div class="flex items-center gap-2">
								<h2 class="text-sm sm:text-base font-bold text-white">Pojazd obsługujący ten kurs</h2>
								<span class="text-xs font-mono-board font-black px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 shadow-sm">
									{vCode}
								</span>
							</div>
							<p class="text-xs text-slate-400 mt-0.5">
								{#if data.vehicleDetails?.marka}
									{data.vehicleDetails.marka} {data.vehicleDetails.model || ''}
								{:else}
									Szczegóły techniczne taboru ZKM Gdynia
								{/if}
							</p>
						</div>
					</div>

					<a
						href="https://zkmgdynia.pl/pojazdy/search?action%5B0%5D=search&nr_inventory={vCode}&typ=&brand_id=&model_id=&carrier_id="
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition self-start sm:self-auto"
					>
						<span>Metryka ZKM</span>
						<ExternalLink class="w-3.5 h-3.5 text-slate-400" />
					</a>
				</div>

				<div class="flex flex-col sm:flex-row gap-6 items-start">
					{#if data.vehicleDetails?.photoURL}
						<div class="w-full sm:w-48 rounded-2xl overflow-hidden border border-slate-700/80 shrink-0 bg-slate-950 relative group">
							<img
								src={data.vehicleDetails.photoURL}
								alt="Pojazd {vCode}"
								class="w-full h-auto block group-hover:scale-105 transition duration-300"
								loading="lazy"
							/>
						</div>
					{/if}

					<div class="flex-1 space-y-3 w-full">
						<!-- Odznaki udogodnień: klimatyzacja, USB, niska podłoga itp. -->
						<div class="flex flex-wrap items-center gap-2">
							{#if data.vehicleDetails?.klima}
								<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
									<Wind class="w-3.5 h-3.5" />
									Klimatyzacja
								</span>
							{/if}

							{#if data.vehicleDetails?.usb}
								<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
									<Zap class="w-3.5 h-3.5" />
									Ładowarki USB
								</span>
							{/if}

							{#if otherFeatures.length > 0}
								{#each otherFeatures as feat}
									<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
										<ShieldCheck class="w-3.5 h-3.5 text-slate-400" />
										{feat}
									</span>
								{/each}
							{/if}

							{#if !data.vehicleDetails}
								<span class="text-xs text-slate-500 italic">
									Brak dalszych parametrów technicznych w lokalnej bazie taboru.
								</span>
							{/if}
						</div>

						<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
							<div class="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
								<span class="text-slate-500 block text-[10px]">Numer boczny</span>
								<span class="font-bold text-white font-mono-board text-sm">{vCode}</span>
							</div>

							{#if data.vehicleDetails?.marka}
								<div class="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
									<span class="text-slate-500 block text-[10px]">Marka i Model</span>
									<span class="font-bold text-white truncate block">
										{data.vehicleDetails.marka} {data.vehicleDetails.model || ''}
									</span>
								</div>
							{/if}

							<div class="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
								<span class="text-slate-500 block text-[10px]">Opóźnienie na trasie</span>
								<span class="font-bold font-mono-board {
									delayInfo.type === 'on-time'
										? 'text-emerald-400'
										: delayInfo.type === 'early'
											? 'text-sky-400'
											: 'text-rose-400'
								}">
									{delayInfo.text}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Sekwencja przystanków (oś czasu / timeline) -->
		<div class="bg-slate-900/40 rounded-3xl p-6 border border-slate-800/80 shadow-lg">
			{#if displayStops.length === 0}
				<div class="text-center py-12 text-slate-400 text-sm">
					Brak szczegółowych danych sekwencji przystanków dla tego wariantu trasy.
				</div>
			{:else}
				<div class="relative border-l-2 border-slate-800 ml-4 sm:ml-6 pl-6 sm:pl-8 space-y-5 py-2">
					{#each displayStops as stop, idx (stop.stopId || idx)}
						<div class="relative group">
							<!-- Kropka na osi czasu -->
							{#if stop.isNext}
								<div class="absolute -left-[33px] sm:-left-[41px] top-1.5 w-4 h-4 rounded-full bg-amber-400 ring-4 ring-amber-400/30 animate-pulse shadow-lg shadow-amber-400/50 z-10"></div>
							{:else if stop.isPassed}
								<div class="absolute -left-[31px] sm:-left-[39px] top-2 w-3 h-3 rounded-full bg-slate-700/80 border border-slate-600"></div>
							{:else}
								<div class="absolute -left-[31px] sm:-left-[39px] top-2 w-3 h-3 rounded-full bg-slate-800 border-2 border-slate-600 group-hover:border-amber-400 group-hover:bg-amber-400/20 transition"></div>
							{/if}

							<div class="flex items-center justify-between gap-4">
								<div class="min-w-0">
									<div class="flex items-center gap-2 flex-wrap">
										<a
											href="/przystanek/{stop.stopId}"
											class="text-sm font-bold transition block truncate {stop.isNext
												? 'text-white text-base font-black hover:text-amber-400'
												: stop.isPassed
													? 'text-slate-400 hover:text-slate-200'
													: 'text-slate-200 hover:text-amber-300'}"
										>
											{stop.stopName}
										</a>

										{#if stop.isNext}
											<span class="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md shadow-sm shadow-amber-400/30">
												Następny
											</span>
										{/if}
									</div>

									{#if stop.zone}
										<div class="flex items-center gap-2 text-[11px] text-slate-500 font-mono-board mt-0.5">
											<span>Strefa: {stop.zone}</span>
										</div>
									{/if}
								</div>

								<!-- Czasy przyjazdu/odjazdu -->
								<div class="text-right shrink-0">
									{#if stop.isPassed}
										<div class="flex items-center gap-2 justify-end">
											<span class="text-xs text-slate-600 font-mono-board line-through">
												{stop.theoreticalTime}
											</span>
											<span class="text-[11px] font-semibold text-slate-500">
												Odjechał
											</span>
										</div>
									{:else if stop.isNext}
										<div class="flex items-center gap-2 justify-end">
											{#if stop.estimatedTime !== stop.theoreticalTime}
												<span class="text-xs text-slate-400 font-mono-board line-through">
													{stop.theoreticalTime}
												</span>
											{/if}
											<span class="font-mono-board text-sm font-black text-amber-400 bg-amber-500/15 px-3 py-1 rounded-xl border border-amber-500/30 shadow-sm shadow-amber-500/20">
												{stop.estimatedTime}
											</span>
										</div>
									{:else}
										<div class="flex items-center gap-2 justify-end">
											{#if stop.estimatedTime !== stop.theoreticalTime}
												<span class="text-xs text-slate-500 font-mono-board line-through">
													{stop.theoreticalTime}
												</span>
												<span class="font-mono-board text-xs font-bold text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
													{stop.estimatedTime}
												</span>
											{:else}
												<span class="font-mono-board text-xs font-semibold text-slate-300 bg-slate-800/60 px-2 py-0.5 rounded-lg border border-slate-700/60">
													{stop.theoreticalTime}
												</span>
											{/if}
										</div>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Mapa trasy z przystankami i szacowaną pozycją autobusu na żywo -->
		<RouteMap
			stops={displayStops}
			lineName={data.lineName}
			routeDescription={data.routeDescription}
			vehicleCode={data.vehicleCode}
			vehicleDetails={data.vehicleDetails}
			delaySeconds={data.delaySeconds}
			serverNowMinutes={data.serverNowMinutes}
			serverTimestamp={data.serverTimestamp}
		/>
	</main>
</div>
