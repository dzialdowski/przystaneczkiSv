<script lang="ts">
	import { page } from '$app/state';
	import { Bus, MapPin, Star, Settings, Shield, LogOut, User, Sparkles, RefreshCw, KeyRound } from 'lucide-svelte';
	import TelegramLoginWidget from './TelegramLoginWidget.svelte';

	interface Props {
		user: { id: string | number; first_name: string; username?: string } | null;
		legacyMode: boolean;
		isAdmin: boolean;
		onRefresh?: () => void;
		onToggleLegacy?: () => void;
		isRefreshing?: boolean;
	}

	let { user, legacyMode, isAdmin, onRefresh, onToggleLegacy, isRefreshing = false }: Props = $props();

	let showUserModal = $state(false);
	let loggingInDev = $state(false);

	const botName = $derived(page.data.botName || 'przystaneczkiBot');
	const enableDevLogin = $derived(Boolean(page.data.enableDevLogin));

	async function handleLogout() {
		await fetch('/api/auth', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'logout' })
		});
		window.location.reload();
	}

	async function handleDevLogin(id: string, name: string) {
		loggingInDev = true;
		try {
			await fetch('/api/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'dev_login', id, first_name: name })
			});
			window.location.reload();
		} finally {
			loggingInDev = false;
		}
	}
</script>

<header class="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
	<div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
		<!-- Logo -->
		<a href="/" class="flex items-center gap-2.5 group">
			<div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 group-hover:scale-105 transition">
				<Bus class="w-5 h-5" />
			</div>
			<div>
				<span class="font-extrabold tracking-wider text-base sm:text-lg block leading-tight text-white group-hover:text-amber-400 transition">
					PRZYSTANECZKI
				</span>
				<span class="text-[10px] font-mono-board text-amber-500/90 uppercase tracking-widest block font-bold">
					GDYNIA TRISTAR
				</span>
			</div>
		</a>

		<!-- Nawigacja główna -->
		<nav class="hidden md:flex items-center gap-1 text-xs font-semibold">
			<a
				href="/"
				class="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 transition flex items-center gap-1.5"
			>
				<Bus class="w-3.5 h-3.5 text-amber-400" />
				Odjazdy
			</a>
			<a
				href="/mapa"
				class="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 transition flex items-center gap-1.5"
			>
				<MapPin class="w-3.5 h-3.5 text-emerald-400" />
				Mapa przystanków
			</a>
			<a
				href="/moje"
				class="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 transition flex items-center gap-1.5"
			>
				<Star class="w-3.5 h-3.5 text-amber-400" />
				Moje przystanki
			</a>
			{#if isAdmin}
				<a
					href="/admin"
					class="px-3.5 py-2 rounded-xl text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 transition flex items-center gap-1.5 font-bold"
				>
					<Shield class="w-3.5 h-3.5" />
					Panel Admina
				</a>
			{/if}
		</nav>

		<!-- Narzędzia prawej strony -->
		<div class="flex items-center gap-2">
			{#if onRefresh}
				<button
					onclick={onRefresh}
					title="Odśwież tablicę"
					class="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-700 active:scale-95 transition"
				>
					<RefreshCw class="w-4 h-4 {isRefreshing ? 'animate-spin text-amber-400' : ''}" />
				</button>
			{/if}

			{#if onToggleLegacy}
				<button
					onclick={onToggleLegacy}
					title="Przełącz styl tablicy (Nowoczesny / Bursztynowy klasyczny)"
					class="px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition active:scale-95 {legacyMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'}"
				>
					<Sparkles class="w-3.5 h-3.5 {legacyMode ? 'text-amber-400' : 'text-slate-400'}" />
					<span class="hidden sm:inline">{legacyMode ? 'Tryb Retro' : 'Tryb Modern'}</span>
				</button>
			{/if}

			<!-- Profil użytkownika / Logowanie Telegram -->
			{#if user}
				<div class="relative">
					<button
						onclick={() => showUserModal = !showUserModal}
						class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition"
					>
						<div class="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-xs font-bold uppercase">
							{user.first_name ? user.first_name[0] : 'U'}
						</div>
						<span class="max-w-[100px] truncate">{user.first_name}</span>
						{#if isAdmin}
							<span class="w-2 h-2 rounded-full bg-amber-400" title="Administrator"></span>
						{/if}
					</button>

					{#if showUserModal}
						<div class="absolute right-0 top-12 w-64 p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 text-xs text-slate-300 space-y-2.5">
							<div class="pb-2 border-b border-slate-800">
								<div class="font-bold text-white flex items-center gap-1.5">
									<User class="w-4 h-4 text-amber-400" />
									{user.first_name} {user.username ? `(@${user.username})` : ''}
								</div>
								<div class="text-[10px] text-slate-400 font-mono-board mt-0.5">
									ID: {user.id}
								</div>
							</div>

							<div class="space-y-1">
								<a
									href="/moje"
									onclick={() => showUserModal = false}
									class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 transition"
								>
									<Star class="w-3.5 h-3.5 text-amber-400" />
									Moje przystanki
								</a>
								<a
									href="/mapa"
									onclick={() => showUserModal = false}
									class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 transition"
								>
									<MapPin class="w-3.5 h-3.5 text-emerald-400" />
									Mapa przystanków
								</a>
								{#if isAdmin}
									<a
										href="/admin"
										onclick={() => showUserModal = false}
										class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-amber-400 font-semibold transition"
									>
										<Shield class="w-3.5 h-3.5 text-amber-400" />
										Panel Administratora
									</a>
								{/if}
							</div>

							<div class="pt-2 border-t border-slate-800 flex justify-between items-center">
								<button
									onclick={handleLogout}
									class="text-rose-400 hover:text-rose-300 flex items-center gap-1 text-[11px] font-semibold transition"
								>
									<LogOut class="w-3.5 h-3.5" />
									Wyloguj się
								</button>
								<button
									onclick={() => showUserModal = false}
									class="text-slate-400 hover:text-slate-300 text-[11px]"
								>
									Zamknij
								</button>
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<button
					onclick={() => showUserModal = !showUserModal}
					class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 active:scale-95 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5"
				>
					Zaloguj się
				</button>

				{#if showUserModal}
					<div class="absolute right-4 top-16 w-84 p-4 rounded-3xl bg-slate-900/95 backdrop-blur-xl border border-slate-800 shadow-2xl z-50 text-xs text-slate-300 space-y-3">
						<div class="flex items-center justify-between pb-1 border-b border-slate-800">
							<h3 class="font-bold text-white text-sm">Logowanie przez Telegram</h3>
							<button onclick={() => showUserModal = false} class="text-slate-400 hover:text-white">✕</button>
						</div>

						<!-- Oficjalny Telegram Login Widget -->
						<TelegramLoginWidget {botName} />

						{#if enableDevLogin}
							<div class="pt-2 border-t border-slate-800/80">
								<a
									href="/login"
									class="w-full py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition mb-2"
								>
									<KeyRound class="w-3.5 h-3.5 text-amber-400" />
									<span>Otwórz pełną stronę logowania</span>
								</a>

								<span class="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1.5">
									Lokalny profil testowy (Dev):
								</span>
								<div class="grid grid-cols-2 gap-1.5">
									<button
										disabled={loggingInDev}
										onclick={() => handleDevLogin('', 'Admin')}
										class="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white font-medium text-center transition text-[11px]"
									>
										Admin
									</button>
									<button
										disabled={loggingInDev}
										onclick={() => handleDevLogin('999999999', 'Tester')}
										class="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white font-medium text-center transition text-[11px]"
									>
										Tester
									</button>
								</div>
							</div>
						{:else}
							<div class="pt-2 border-t border-slate-800/80">
								<a
									href="/login"
									class="w-full py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition"
								>
									<KeyRound class="w-3.5 h-3.5 text-amber-400" />
									<span>Otwórz pełną stronę logowania</span>
								</a>
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</header>
