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

	let data = $derived(page.data);
	let user = $derived(page.data.user);
	let legacyMode = $derived(page.data.legacyMode || false);
	let isAdmin = $derived(page.data.isAdmin || false);

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
				href="/"
				onclick={(e) => {
					if (typeof window !== 'undefined' && window.history.length > 1) {
						e.preventDefault();
						window.history.back();
					}
				}}
				class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition hover:border-slate-700"
			>
				<ArrowLeft class="w-4 h-4" />
				Powrót do odjazdów
			</a>

			{#if data.delaySeconds !== undefined}
				{@const delayInfo = formatDelay(data.delaySeconds)}
				<div class="flex items-center gap-2 flex-wrap justify-end">
					<span
						class="text-xs font-bold px-3 py-1 rounded-full border {delayInfo.type === 'on-time'
							? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
							: delayInfo.type === 'delayed'
								? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
								: 'bg-sky-500/10 text-sky-400 border-sky-500/30'}"
					>
						{delayInfo.text}
					</span>
					{#if data.vehicleCode || data.vehicleDetails?.bus}
						{@const vCode = data.vehicleCode || data.vehicleDetails?.bus}
						<a
							href="https://zkmgdynia.pl/pojazdy/search?action%5B0%5D=search&nr_inventory={vCode}&typ=&brand_id=&model_id=&carrier_id="
							target="_blank"
							rel="noreferrer"
							class="text-xs font-mono-board font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 hover:bg-amber-500 hover:text-slate-950 transition border border-slate-700 inline-flex items-center gap-1.5"
						>
							<span>Pojazd #{vCode}</span>
							{#if data.vehicleDetails?.marka}
								<span class="text-slate-400 font-normal">({data.vehicleDetails.marka} {data.vehicleDetails.model || ''})</span>
							{/if}
							{#if data.vehicleDetails?.klima}
								<span title="Klimatyzacja">❄️</span>
							{/if}
							{#if data.vehicleDetails?.usb}
								<span title="Ładowarki USB">⚡</span>
							{/if}
						</a>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Nagłówek trasy -->
		<div class="bg-slate-900/70 rounded-3xl p-6 border border-slate-800/90 shadow-xl flex items-center gap-5 backdrop-blur-sm">
			<div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
				{data.lineName}
			</div>
			<div class="min-w-0">
				<div class="flex items-center gap-2 text-xs font-mono-board text-amber-400 mb-0.5">
					<span>Kurs #{data.trip || data.tripId}</span>
					{#if data.stops.length > 0}
						<span class="text-slate-500">•</span>
						<span class="text-slate-400">{data.stops.length} przystanków</span>
					{/if}
				</div>
				<h1 class="text-xl sm:text-2xl font-black text-white truncate">{data.routeDescription || `Trasa linii ${data.lineName}`}</h1>
				<p class="text-xs text-slate-400 mt-0.5">Lista przystanków, estymowane i rozkładowe czasy przyjazdu</p>
			</div>
		</div>

		<!-- Karta Informacji o Pojeździe -->
		{#if data.vehicleCode || data.vehicleDetails}
			{@const vCode = data.vehicleCode || data.vehicleDetails?.bus}
			<div class="bg-slate-900/70 rounded-3xl p-5 sm:p-6 border border-slate-800/90 shadow-xl backdrop-blur-sm space-y-4">
				<!-- Pasek nagłówka sekcji pojazdu -->
				<div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
					<div class="flex items-center gap-2.5">
						<div class="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
							<Bus class="w-5 h-5" />
						</div>
						<div>
							<div class="flex items-center gap-2">
								<h2 class="text-sm sm:base font-bold text-white">Pojazd obsługujący ten kurs</h2>
								<span class="text-xs font-mono-board font-black px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 shadow-sm">
									#{vCode}
								</span>
							</div>
							<p class="text-[11px] text-slate-400">Dane taborowe ZKM Gdynia & telemetryczne TRISTAR</p>
						</div>
					</div>

					<a
						href="https://zkmgdynia.pl/pojazdy/search?action%5B0%5D=search&nr_inventory={vCode}&typ=&brand_id=&model_id=&carrier_id="
						target="_blank"
						rel="noreferrer"
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-xs font-semibold border border-slate-700 transition"
					>
						<span>Karta pojazdu w ZKM</span>
						<ExternalLink class="w-3.5 h-3.5" />
					</a>
				</div>

				<!-- Zawartość: Zdjęcie + Parametry i Udogodnienia -->
				<div class="flex flex-col sm:flex-row gap-5 items-start">
					{#if data.vehicleDetails?.photoURL}
						<div class="w-full sm:w-60 md:w-72 h-44 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 relative group shadow-inner">
							<img
								src={data.vehicleDetails.photoURL}
								alt="Pojazd #{vCode}"
								class="w-full h-full object-cover group-hover:scale-105 transition duration-300"
								loading="lazy"
							/>
							<div class="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-mono-board font-bold text-amber-400 shadow">
								#{vCode}
							</div>
						</div>
					{:else}
						<div class="w-full sm:w-44 h-36 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col items-center justify-center p-4 text-center shrink-0">
							<div class="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-2">
								<Bus class="w-6 h-6" />
							</div>
							<span class="text-xs font-mono-board font-bold text-slate-200">
								#{vCode}
							</span>
							<span class="text-[10px] text-slate-500 mt-0.5">Brak zdjęcia</span>
						</div>
					{/if}

					<!-- Dane techniczne i wyposażenie -->
					<div class="min-w-0 flex-1 space-y-3.5">
						<div>
							{#if data.vehicleDetails?.marka}
								<h3 class="text-lg sm:text-xl font-black text-white tracking-tight">
									{data.vehicleDetails.marka} {data.vehicleDetails.model || ''}
								</h3>
							{:else}
								<h3 class="text-lg sm:text-xl font-black text-white tracking-tight">
									Pojazd #{vCode}
								</h3>
							{/if}
							<div class="flex items-center gap-2 text-xs font-mono-board text-slate-400 mt-0.5">
								<span>Numer taborowy: <strong class="text-amber-400">#{vCode}</strong></span>
								<span class="text-slate-600">•</span>
								<span>Ewidencja ZKM Gdynia</span>
							</div>
						</div>

						<!-- Główne udogodnienia (Klima, USB) i cechy taboru -->
						<div class="space-y-2">
							<div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
								Wyposażenie i udogodnienia:
							</div>
							<div class="flex flex-wrap gap-2">
								{#if data.vehicleDetails?.klima}
									<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 text-xs font-semibold shadow-sm shadow-cyan-500/10">
										<Wind class="w-3.5 h-3.5 text-cyan-400" />
										<span>Klimatyzacja</span>
									</span>
								{/if}
								{#if data.vehicleDetails?.usb}
									<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 text-xs font-semibold shadow-sm shadow-emerald-500/10">
										<Zap class="w-3.5 h-3.5 text-emerald-400" />
										<span>Ładowarki USB</span>
									</span>
								{/if}

								{#each otherFeatures as feat (feat)}
									{@const lower = feat.toLowerCase()}
									<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 text-slate-300 border border-slate-700/80 text-xs font-medium">
										{#if lower.includes('rampa') || lower.includes('wózk')}
											<Accessibility class="w-3.5 h-3.5 text-indigo-400" />
										{:else if lower.includes('przyklęk') || lower.includes('niska')}
											<Accessibility class="w-3.5 h-3.5 text-violet-400" />
										{:else if lower.includes('monitoring')}
											<ShieldCheck class="w-3.5 h-3.5 text-slate-400" />
										{:else if lower.includes('zapowia') || lower.includes('głosow')}
											<Volume2 class="w-3.5 h-3.5 text-amber-400" />
										{:else if lower.includes('monitor') || lower.includes('ekran')}
											<Tv class="w-3.5 h-3.5 text-sky-400" />
										{:else if lower.includes('biletomat')}
											<Ticket class="w-3.5 h-3.5 text-emerald-400" />
										{:else if lower.includes('aed') || lower.includes('defibryl')}
											<Heart class="w-3.5 h-3.5 text-rose-400" />
										{:else}
											<CheckCircle2 class="w-3.5 h-3.5 text-slate-400" />
										{/if}
										<span>{feat}</span>
									</span>
								{/each}

								{#if !data.vehicleDetails?.klima && !data.vehicleDetails?.usb && otherFeatures.length === 0}
									<span class="text-xs text-slate-500 italic">
										Brak szczegółowego wykazu wyposażenia dla tego pojazdu.
									</span>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<!-- Brak przypisanego pojazdu -->
			<div class="bg-slate-900/40 rounded-3xl p-5 border border-slate-800/80 shadow-lg flex items-center gap-4 text-slate-400">
				<div class="w-10 h-10 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center shrink-0 text-slate-400">
					<Info class="w-5 h-5 text-slate-400" />
				</div>
				<div class="text-xs">
					<div class="font-bold text-slate-300">Pojazd według rozkładu (brak danych TRISTAR)</div>
					<div class="text-slate-400 mt-0.5">
						Ten kurs realizowany jest zgodnie z rozkładem jazdy. Numer boczny pojazdu oraz udogodnienia pojawią się na żywo, gdy pojazd zaloguje się do systemu TRISTAR.
					</div>
				</div>
			</div>
		{/if}

		<!-- Sekwencja przystanków (oś czasu / timeline) -->
		<div class="bg-slate-900/40 rounded-3xl p-6 border border-slate-800/80 shadow-lg">
			{#if data.stops.length === 0}
				<div class="text-center py-12 text-slate-400 text-sm">
					Brak szczegółowych danych sekwencji przystanków dla tego wariantu trasy.
				</div>
			{:else}
				<div class="relative border-l-2 border-slate-800 ml-4 sm:ml-6 pl-6 sm:pl-8 space-y-5 py-2">
					{#each data.stops as stop, idx (stop.stopId || idx)}
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

									<div class="flex items-center gap-2 text-[11px] text-slate-500 font-mono-board mt-0.5">
										<span>Przystanek #{stop.stopId}</span>
										{#if stop.zone}
											<span>•</span>
											<span>Strefa: {stop.zone}</span>
										{/if}
									</div>
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
			stops={data.stops}
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
