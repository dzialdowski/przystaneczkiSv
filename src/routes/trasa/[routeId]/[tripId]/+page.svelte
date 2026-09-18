<script lang="ts">
	import { page } from '$app/state';
	import { ArrowLeft, Bus, Clock, MapPin, CheckCircle2, AlertCircle } from 'lucide-svelte';
	import Navbar from '$lib/components/Navbar.svelte';

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
				<div class="flex items-center gap-2">
					<span
						class="text-xs font-bold px-3 py-1 rounded-full border {delayInfo.type === 'on-time'
							? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
							: delayInfo.type === 'delayed'
								? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
								: 'bg-sky-500/10 text-sky-400 border-sky-500/30'}"
					>
						{delayInfo.text}
					</span>
					{#if data.vehicleCode}
						<a
							href="https://zkmgdynia.pl/sprawdz-pojazd/{data.vehicleCode}"
							target="_blank"
							rel="noreferrer"
							class="text-xs font-mono-board font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 hover:bg-amber-500 hover:text-slate-950 transition border border-slate-700"
						>
							Pojazd #{data.vehicleCode}
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

		<!-- Sekwencja przystanków (oś czasu / timeline) -->
		<div class="bg-slate-900/40 rounded-3xl p-6 border border-slate-800/80 shadow-lg">
			{#if data.stops.length === 0}
				<div class="text-center py-12 text-slate-400 text-sm">
					Brak szczegółowych danych sekwencji przystanków dla tego wariantu trasy.
				</div>
			{:else}
				<div class="relative border-l-2 border-slate-800 ml-4 sm:ml-6 pl-6 sm:pl-8 space-y-5 py-2">
					{#each data.stops as stop, idx}
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
	</main>
</div>
