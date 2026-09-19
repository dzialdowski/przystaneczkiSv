<script lang="ts">
	import { pwa } from '$lib/pwa.svelte';
	import { Sparkles, RefreshCw, X, Download, WifiOff } from 'lucide-svelte';

	let dismissed = $state(false);
	let isUpdating = $state(false);

	async function handleUpdate() {
		isUpdating = true;
		await pwa.applyUpdate();
	}

	async function handleInstall() {
		await pwa.install();
	}
</script>

<!-- Offline indicator -->
{#if !pwa.isOnline}
	<div
		class="fixed top-0 left-0 right-0 z-50 bg-rose-600/90 backdrop-blur text-white text-xs font-semibold py-1.5 px-4 text-center flex items-center justify-center gap-2 shadow-lg animate-in fade-in duration-200"
	>
		<WifiOff class="w-3.5 h-3.5" />
		<span>Brak połączenia z internetem. Aplikacja działa w trybie offline z pamięci podręcznej.</span>
	</div>
{/if}

<!-- Update notification banner / toast -->
{#if pwa.updateAvailable && !dismissed}
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
						Nowe rozkłady i ulepszenia aplikacji są gotowe do zainstalowania.
					</p>
				</div>
			</div>
			<button
				onclick={() => (dismissed = true)}
				class="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition"
				aria-label="Zamknij powiadomienie"
			>
				<X class="w-4 h-4" />
			</button>
		</div>

		<div class="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80">
			<button
				onclick={() => (dismissed = true)}
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

<!-- Optional PWA install banner for mobile/desktop browsers supporting beforeinstallprompt -->
{#if pwa.canInstall && !pwa.updateAvailable && !dismissed}
	<div
		class="hidden sm:flex fixed bottom-4 left-4 z-40 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-lg shadow-xl text-slate-200 items-center gap-3 animate-in slide-in-from-bottom-3 duration-300 text-xs"
	>
		<div class="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
			<Download class="w-4 h-4" />
		</div>
		<span>Zainstaluj aplikację na urządzeniu, aby mieć szybki dostęp z ekranu domowego.</span>
		<button
			onclick={handleInstall}
			class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold text-xs border border-amber-500/20 hover:border-amber-500/40 transition whitespace-nowrap"
		>
			Zainstaluj
		</button>
	</div>
{/if}
