<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { pwa } from '$lib/pwa.svelte';
	import { Sparkles, RefreshCw, X, Download, WifiOff, Share2 } from 'lucide-svelte';

	let updateDismissed = $state(false);
	let installDismissed = $state(false);
	let isUpdating = $state(false);

	onMount(() => {
		if (browser) {
			const dismissedTime = localStorage.getItem('pwa_install_dismissed_time');
			// If user dismissed install banner less than 3 days ago, keep it hidden
			if (dismissedTime && Date.now() - Number(dismissedTime) < 3 * 24 * 60 * 60 * 1000) {
				installDismissed = true;
			}
		}
	});

	function dismissInstall() {
		installDismissed = true;
		if (browser) {
			localStorage.setItem('pwa_install_dismissed_time', Date.now().toString());
		}
	}

	async function handleUpdate() {
		isUpdating = true;
		await pwa.applyUpdate();
	}

	async function handleInstall() {
		const installed = await pwa.install();
		if (installed) {
			installDismissed = true;
		}
	}
</script>

<!-- Wskaźnik trybu Offline -->
{#if !pwa.isOnline}
	<div
		class="fixed top-0 left-0 right-0 z-50 bg-rose-600/95 backdrop-blur text-white text-xs font-semibold py-1.5 px-4 text-center flex items-center justify-center gap-2 shadow-lg animate-in fade-in duration-200"
		role="status"
	>
		<WifiOff class="w-3.5 h-3.5 shrink-0" />
		<span>Brak połączenia z internetem. Aplikacja działa w trybie offline.</span>
	</div>
{/if}

<!-- Prawdziwe powiadomienie o nowej wersji (tylko gdy na serwerze pojawi się nowa wersja) -->
{#if pwa.updateAvailable && !updateDismissed}
	<div
		class="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 p-4 rounded-2xl bg-slate-900/95 border border-amber-500/40 backdrop-blur-xl shadow-2xl shadow-amber-500/10 text-slate-100 flex flex-col gap-3 animate-in slide-in-from-bottom-5 duration-300"
		role="alert"
	>
		<div class="flex items-start justify-between gap-3">
			<div class="flex items-center gap-2.5">
				<div
					class="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-sm"
				>
					<Sparkles class="w-4 h-4" />
				</div>
				<div>
					<h4 class="font-bold text-sm text-white leading-tight">Dostępna nowa wersja</h4>
					<p class="text-xs text-slate-400 mt-0.5 leading-normal">
						Opublikowano uaktualnienie aplikacji lub rozkładów jazdy.
					</p>
				</div>
			</div>
			<button
				onclick={() => (updateDismissed = true)}
				class="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition"
				aria-label="Zamknij powiadomienie"
			>
				<X class="w-4 h-4" />
			</button>
		</div>

		<div class="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80">
			<button
				onclick={() => (updateDismissed = true)}
				class="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
			>
				Później
			</button>
			<button
				onclick={handleUpdate}
				disabled={isUpdating}
				class="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 active:scale-95 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
			>
				<RefreshCw class="w-3.5 h-3.5 {isUpdating ? 'animate-spin' : ''}" />
				<span>{isUpdating ? 'Aktualizowanie...' : 'Zaktualizuj teraz'}</span>
			</button>
		</div>
	</div>
{/if}

<!-- Baner instalacji aplikacji PWA na telefonie i komputerze (tylko gdy aplikacja NIE jest jeszcze zainstalowana) -->
{#if !pwa.isInstalled && pwa.canInstall && !installDismissed && !pwa.updateAvailable}
	<div
		class="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-40 p-3.5 rounded-2xl bg-slate-900/95 border border-amber-500/30 backdrop-blur-xl shadow-2xl shadow-slate-950/50 text-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-in slide-in-from-bottom-3 duration-300 text-xs"
	>
		<div class="flex items-center gap-3">
			<div class="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-sm">
				<Download class="w-4 h-4" />
			</div>
			<div>
				<h4 class="font-bold text-white text-xs leading-tight">Zainstaluj aplikację Przystaneczki</h4>
				<p class="text-[11px] text-slate-400 mt-0.5 leading-tight">
					Szybki dostęp z ekranu głównego, pełny ekran i działanie offline.
				</p>
			</div>
		</div>

		<div class="flex items-center justify-end gap-2 shrink-0">
			<button
				onclick={dismissInstall}
				class="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 font-medium text-[11px] transition"
			>
				Nie teraz
			</button>
			<button
				onclick={handleInstall}
				class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 active:scale-95 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-1.5 whitespace-nowrap"
			>
				<Download class="w-3.5 h-3.5" />
				<span>Zainstaluj</span>
			</button>
		</div>
	</div>
{:else if !pwa.isInstalled && pwa.isIos && !installDismissed && !pwa.updateAvailable}
	<!-- Wskazówka instalacji dla użytkowników iOS Safari (Apple nie wspiera natywnego beforeinstallprompt) -->
	<div
		class="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-40 p-3.5 rounded-2xl bg-slate-900/95 border border-slate-800 backdrop-blur-xl shadow-2xl text-slate-200 flex items-start justify-between gap-3 animate-in slide-in-from-bottom-3 duration-300 text-xs"
	>
		<div class="flex items-start gap-2.5">
			<div class="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
				<Share2 class="w-4 h-4" />
			</div>
			<div class="space-y-0.5">
				<h4 class="font-bold text-white text-xs">Dodaj Przystaneczki do ekranu głównego</h4>
				<p class="text-[11px] text-slate-400 leading-normal">
					Kliknij ikonę <span class="font-semibold text-slate-200">Udostępnij</span> na dole Safari, a następnie wybierz <span class="font-semibold text-amber-400">„Do ekranu początkowego”</span>.
				</p>
			</div>
		</div>
		<button
			onclick={dismissInstall}
			class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition shrink-0"
			aria-label="Zamknij"
		>
			<X class="w-4 h-4" />
		</button>
	</div>
{/if}
