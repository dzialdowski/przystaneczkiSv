<script lang="ts">
	import { onMount } from 'svelte';
	import { Info, AlertCircle } from 'lucide-svelte';
	import type { DisplayMessage } from '$lib/server/tristar';

	let messages = $state<DisplayMessage[]>([]);
	let currentIndex = $state(0);

	onMount(async () => {
		try {
			const res = await fetch('/api/messages');
			if (res.ok) {
				messages = await res.json();
			}
		} catch (e) {
			// cichy fallback
		}
	});
</script>

{#if messages.length > 0}
	{@const msg = messages[currentIndex]}
	<div class="w-full bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 rounded-2xl p-3 text-xs flex items-center gap-2.5 text-amber-200">
		<AlertCircle class="w-4 h-4 text-amber-400 shrink-0" />
		<div class="min-w-0 flex-1">
			<span class="font-bold text-amber-300 mr-1.5">{msg.displayName || 'Komunikat TRISTAR'}:</span>
			<span>{msg.messagePart1} {msg.messagePart2}</span>
		</div>
		{#if messages.length > 1}
			<button
				onclick={() => currentIndex = (currentIndex + 1) % messages.length}
				class="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-md hover:bg-amber-500/30 transition text-amber-300 shrink-0"
			>
				{currentIndex + 1}/{messages.length} Następny
			</button>
		{/if}
	</div>
{/if}
