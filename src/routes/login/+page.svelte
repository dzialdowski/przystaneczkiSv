<script lang="ts">
	import { page } from '$app/state';
	import { ArrowLeft, Shield, Star, CheckCircle2 } from 'lucide-svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import TelegramLoginWidget from '$lib/components/TelegramLoginWidget.svelte';

	let user = $derived(page.data.user);
	let legacyMode = $derived(page.data.legacyMode || false);
	let isAdmin = $derived(page.data.isAdmin || false);
</script>

<div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">
	<Navbar {user} {legacyMode} {isAdmin} />

	<main class="flex-1 max-w-xl w-full mx-auto px-4 py-12 flex flex-col justify-center space-y-6">
		<a
			href="/"
			class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold self-start transition"
		>
			<ArrowLeft class="w-4 h-4" />
			Strona główna
		</a>

		{#if user}
			<div class="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
				<div class="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center font-bold">
					<CheckCircle2 class="w-8 h-8" />
				</div>
				<h1 class="text-2xl font-black text-white">Jesteś już zalogowany!</h1>
				<p class="text-sm text-slate-300">
					Witaj, <strong>{user.first_name}</strong> ({user.username ? `@${user.username}` : `ID: ${user.id}`})
				</p>
				<div class="pt-4 flex items-center justify-center gap-3">
					<a
						href="/moje"
						class="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition"
					>
						Moje ulubione przystanki
					</a>
					<a
						href="/"
						class="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-semibold text-xs hover:text-white transition"
					>
						Tablica odjazdów
					</a>
				</div>
			</div>
		{:else}
			<div class="space-y-4">
				<div class="text-center space-y-2">
					<h1 class="text-3xl font-black text-white">Logowanie do Przystaneczków</h1>
					<p class="text-xs text-slate-400 max-w-sm mx-auto">
						Połącz konto Telegram, aby zsynchronizować listę swoich ulubionych przystanków.
					</p>
				</div>

				<TelegramLoginWidget botName={page.data.botName} botId={page.data.botId} />

				<div class="p-4 bg-slate-900/40 rounded-2xl border border-slate-800 text-xs text-slate-400 space-y-2">
					<div class="font-bold text-slate-300 flex items-center gap-1.5">
						<Shield class="w-4 h-4 text-amber-400" />
						Jak to działa?
					</div>
					<ul class="list-disc pl-4 space-y-1 text-[11px]">
						<li>Logowanie odbywa się bezpośrednio i bezpiecznie przez oficjalną usługę Telegram.</li>
						<li>Twoje ulubione przystanki oraz preferencje stylizacji tablicy są synchronizowane i zapamiętywane na każdym Twoim urządzeniu.</li>
						<li>Aplikacja odczytuje wyłącznie Twoje publiczne imię i identyfikator konta – nie ma dostępu do Twoich wiadomości ani haseł.</li>
					</ul>
				</div>
			</div>
		{/if}
	</main>
</div>
