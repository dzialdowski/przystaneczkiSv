<script lang="ts">
	import { page } from '$app/state';
	import { onMount, onDestroy } from 'svelte';
	import { Shield, AlertCircle, CheckCircle2, ArrowRight, ExternalLink } from 'lucide-svelte';

	interface Props {
		botId?: number | string;
		botName?: string;
		onSuccess?: (user: any) => void;
	}

	let { botId, botName, onSuccess }: Props = $props();

	const activeBotId = $derived(botId ?? page.data.botId ?? '');
	const activeBotName = $derived(botName ?? page.data.botName ?? 'przystaneczkiBot');

	let isLocalhost = $state(false);
	let loginStatus = $state<'idle' | 'logging_in' | 'success' | 'error'>('idle');
	let statusMessage = $state<string | null>(null);

	let messageListener: ((e: MessageEvent) => void) | null = null;
	let popupCheckTimer: any = null;

	onMount(() => {
		isLocalhost = window.location.hostname === 'localhost';
	});

	onDestroy(() => {
		cleanUpListeners();
	});

	function cleanUpListeners() {
		if (messageListener) {
			window.removeEventListener('message', messageListener);
			messageListener = null;
		}
		if (popupCheckTimer) {
			clearInterval(popupCheckTimer);
			popupCheckTimer = null;
		}
	}

	function handleTelegramLogin() {
		cleanUpListeners();

		if (!activeBotId) {
			loginStatus = 'error';
			statusMessage = 'Brak skonfigurowanego identyfikatora logowania Telegram.';
			return;
		}

		loginStatus = 'logging_in';
		statusMessage = 'Oczekiwanie na autoryzację w oknie Telegram...';

		const width = 550;
		const height = 650;
		const left = Math.max(0, (window.screen.width - width) / 2) + (window.screenX || 0);
		const top = Math.max(0, (window.screen.height - height) / 2) + (window.screenY || 0);

		// Zgodnie z wymogami oauth.telegram.org parametr origin jest obowiązkowy
		const origin = window.location.origin;
		const redirectUri = window.location.origin + window.location.pathname;

		const authUrl = `https://oauth.telegram.org/auth?response_type=post_message&client_id=${activeBotId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20profile&origin=${encodeURIComponent(origin)}`;

		const popup = window.open(
			authUrl,
			'telegram_oidc_login',
			`width=${width},height=${height},left=${left},top=${top},status=0,location=0,menubar=0,toolbar=0`
		);

		if (!popup) {
			loginStatus = 'error';
			statusMessage = 'Przeglądarka zablokowała wyskakujące okienko (popup). Zezwól na wyskakujące okienka dla tej strony.';
			return;
		}

		popup.focus();

		messageListener = async (event: MessageEvent) => {
			if (event.origin !== 'https://oauth.telegram.org') return;

			let data: any;
			try {
				data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
			} catch {
				return;
			}

			if (data && data.event === 'auth_result') {
				cleanUpListeners();

				if (data.result !== undefined || data.auth_data || data.user) {
					statusMessage = 'Logowanie do profilu...';
					try {
						const payloadToSend: any = {
							raw: data
						};
						if (typeof data.result === 'string') {
							payloadToSend.id_token = data.result;
						} else if (typeof data.result === 'object' && data.result !== null) {
							payloadToSend.authData = data.result;
						}
						if (data.auth_data) payloadToSend.authData = data.auth_data;
						if (data.user) payloadToSend.user = data.user;

						const res = await fetch('/api/auth', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(payloadToSend)
						});

						const resData = await res.json();
						if (res.ok && resData.success) {
							loginStatus = 'success';
							statusMessage = `Zalogowano pomyślnie jako ${resData.user.first_name}!`;
							if (onSuccess) onSuccess(resData.user);
							setTimeout(() => {
								window.location.reload();
							}, 600);
						} else {
							loginStatus = 'error';
							statusMessage = resData.error || 'Nie udało się zweryfikować konta.';
						}
					} catch (e: any) {
						loginStatus = 'error';
						statusMessage = 'Wystąpił błąd podczas logowania: ' + e.message;
					}
				} else if (data.error) {
					loginStatus = 'error';
					statusMessage = `Błąd autoryzacji Telegram: ${data.error}`;
				}
			}
		};

		window.addEventListener('message', messageListener);

		// Sprawdzaj czy popup nie został zamknięty przez użytkownika
		popupCheckTimer = setInterval(() => {
			if (!popup || popup.closed) {
				cleanUpListeners();
				if (loginStatus === 'logging_in') {
					loginStatus = 'idle';
					statusMessage = null;
				}
			}
		}, 800);
	}

	function redirectTo127() {
		const port = window.location.port ? `:${window.location.port}` : '';
		window.location.href = `${window.location.protocol}//127.0.0.1${port}${window.location.pathname}${window.location.search}`;
	}
</script>

<div class="space-y-4">
	<!-- Ostrzeżenie dla localhost -->
	{#if isLocalhost}
		<div class="p-3.5 bg-amber-500/15 border border-amber-500/40 rounded-2xl text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-lg">
			<div class="flex items-center gap-2">
				<AlertCircle class="w-4 h-4 text-amber-400 shrink-0" />
				<span>Otwarto przez <strong>localhost</strong>. W środowisku lokalnym logowanie Telegram wymaga adresu <strong>127.0.0.1</strong>.</span>
			</div>
			<button
				onclick={redirectTo127}
				class="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 hover:bg-amber-400 transition self-end sm:self-auto shrink-0 shadow-md shadow-amber-500/20"
			>
				<span>Przejdź na 127.0.0.1</span>
				<ArrowRight class="w-3.5 h-3.5" />
			</button>
		</div>
	{/if}

	<!-- Przycisk Logowania Telegram (Natywny Popup z poprawnym parametrem origin) -->
	<div class="flex flex-col items-center justify-center p-6 bg-slate-900/70 border border-slate-800 rounded-3xl text-center space-y-4">
		<div class="w-12 h-12 rounded-2xl bg-[#2AABEE]/15 border border-[#2AABEE]/30 text-[#2AABEE] flex items-center justify-center font-bold">
			<svg class="w-6 h-6 fill-current" viewBox="0 0 24 24">
				<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/>
			</svg>
		</div>

		<div>
			<h4 class="text-sm font-bold text-white">Logowanie kontem Telegram</h4>
			<p class="text-xs text-slate-400 mt-1 max-w-xs">
				Autoryzacja przez bota <strong class="text-amber-400">@{activeBotName}</strong> pozwala na synchronizację Twoich ulubionych przystanków.
			</p>
		</div>

		<!-- Przycisk logowania -->
		<button
			onclick={handleTelegramLogin}
			disabled={loginStatus === 'logging_in'}
			class="w-full max-w-xs py-3 px-5 rounded-2xl bg-[#2AABEE] hover:bg-[#229ED9] text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-[#2AABEE]/25 hover:shadow-[#2AABEE]/40 active:scale-95 transition disabled:opacity-50 cursor-pointer"
		>
			<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
				<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/>
			</svg>
			<span>{loginStatus === 'logging_in' ? 'Otwarto okno Telegram...' : 'Zaloguj się przez Telegram'}</span>
		</button>

		<!-- Komunikaty stanu -->
		{#if loginStatus === 'logging_in'}
			<div class="inline-flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
				<div class="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
				<span>{statusMessage}</span>
			</div>
		{:else if loginStatus === 'success'}
			<div class="inline-flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
				<CheckCircle2 class="w-4 h-4" />
				<span>{statusMessage}</span>
			</div>
		{:else if loginStatus === 'error'}
			<div class="inline-flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/20">
				<AlertCircle class="w-4 h-4" />
				<span>{statusMessage}</span>
			</div>
		{/if}
	</div>
</div>
