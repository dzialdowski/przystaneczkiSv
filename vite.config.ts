import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	// Załaduj wszystkie zmienne z .env do process.env (dla środowiska deweloperskiego Vite i SSR)
	const env = loadEnv(mode, process.cwd(), '');
	for (const [key, val] of Object.entries(env)) {
		if (process.env[key] === undefined) {
			process.env[key] = val;
		}
	}

	const buildVersion =
		process.env.APP_VERSION ||
		process.env.PUBLIC_APP_VERSION ||
		(mode === 'development' ? 'dev' : `1.0.${Date.now()}`);
	process.env.PUBLIC_APP_VERSION = buildVersion;
	process.env.APP_VERSION = buildVersion;

	return {
		define: {
			__APP_VERSION__: JSON.stringify(buildVersion)
		},
		plugins: [
			tailwindcss(),
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\\\]/).includes('node_modules') ? undefined : true
				},
				adapter: adapter(),
				version: {
					pollInterval: 0, // Handled by our unified Azure keep-alive & version poller
					name: buildVersion
				}
			})
		],
		server: {
			host: '0.0.0.0',
			port: 5173
		},
		test: {
			expect: { requireAssertions: true },
			projects: [
				{
					extends: './vite.config.ts',
					test: {
						name: 'client',
						browser: {
							enabled: true,
							provider: playwright(),
							instances: [{ browser: 'chromium', headless: true }]
						},
						include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
						exclude: ['src/lib/server/**']
					}
				},
				{
					extends: './vite.config.ts',
					test: {
						name: 'server',
						environment: 'node',
						include: ['src/**/*.{test,spec}.{js,ts}'],
						exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
					}
				}
			]
		}
	};
});
