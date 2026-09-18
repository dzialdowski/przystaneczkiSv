import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';

// Synchronizuj zmienne środowiskowe ze SvelteKit do process.env (np. dla biblioteki mssql)
for (const [key, value] of Object.entries(env)) {
	if (value !== undefined && process.env[key] === undefined) {
		process.env[key] = value;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	// Zezwól na komunikację window.postMessage z oknem popup Telegram Login
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
	return response;
};
