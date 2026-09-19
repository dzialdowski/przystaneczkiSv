<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { pwa } from '$lib/pwa.svelte';
	import UpdateNotification from '$lib/components/UpdateNotification.svelte';

	let { children } = $props();

	onMount(() => {
		pwa.init();
		return () => {
			pwa.destroy();
		};
	});

	afterNavigate(() => {
		// Ensure Azure instance stays warm and check for updates upon client navigation
		pwa.pingServer();
	});
</script>

{@render children()}
<UpdateNotification />
