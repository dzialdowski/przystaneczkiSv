import { browser } from '$app/environment';
import { updated } from '$app/state';

class PwaService {
	updateAvailable = $state(false);
	isOnline = $state(true);
	canInstall = $state(false);
	lastPing = $state<Date | null>(null);
	pingCount = $state(0);
	appVersion = $state<string | null>(null);
	isUpdating = $state(false);

	private deferredPrompt: any = null;
	private registration: ServiceWorkerRegistration | null = null;
	private intervalId: any = null;
	private isInitialized = false;

	init() {
		if (!browser || this.isInitialized) return;
		this.isInitialized = true;

		this.isOnline = navigator.onLine;

		window.addEventListener('online', () => {
			this.isOnline = true;
			this.pingServer();
		});

		window.addEventListener('offline', () => {
			this.isOnline = false;
		});

		// PWA install prompt handler
		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			this.deferredPrompt = e;
			this.canInstall = true;
		});

		window.addEventListener('appinstalled', () => {
			this.canInstall = false;
			this.deferredPrompt = null;
		});

		// Visibility change: ping immediately when tab becomes visible if > 60s elapsed
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') {
				const now = Date.now();
				const last = this.lastPing ? this.lastPing.getTime() : 0;
				if (now - last > 60_000) {
					this.pingServer();
				}
			}
		});

		// Setup Service Worker listeners
		this.setupServiceWorker();

		// Initial ping to record current version & wake up Azure if needed
		this.pingServer();

		// Periodic keep-alive & version poller:
		// Free-tier Azure App Service sleeps after 20 minutes of inactivity.
		// Pinging every 120 seconds (2 minutes) keeps Azure warm and responsive for all users,
		// and checks for any new application version.
		this.intervalId = setInterval(() => {
			this.pingServer();
		}, 120_000);
	}

	private async setupServiceWorker() {
		if (!('serviceWorker' in navigator)) return;

		try {
			const reg = await navigator.serviceWorker.ready;
			this.registration = reg;

			// If there is already a waiting service worker, update is ready
			if (reg.waiting) {
				this.updateAvailable = true;
			}

			// Listen for new service worker installation
			reg.addEventListener('updatefound', () => {
				const newWorker = reg.installing;
				if (!newWorker) return;

				newWorker.addEventListener('statechange', () => {
					if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
						this.updateAvailable = true;
					}
				});
			});

			navigator.serviceWorker.addEventListener('controllerchange', () => {
				if (this.isUpdating) {
					window.location.reload();
				}
			});
		} catch (err) {
			console.warn('[PWA] ServiceWorker setup notice:', err);
		}
	}

	async pingServer(): Promise<boolean> {
		if (!browser) return false;

		try {
			// Cache-busting URL parameter and no-cache headers to ensure
			// request bypasses any proxy/cache and directly reaches Azure App Service Node.js server.
			const res = await fetch(`/api/version?t=${Date.now()}`, {
				method: 'GET',
				cache: 'no-store',
				headers: {
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					Pragma: 'no-cache'
				}
			});

			this.lastPing = new Date();
			this.pingCount += 1;

			if (res.ok) {
				const data = await res.json();
				if (data && data.version) {
					if (this.appVersion === null) {
						this.appVersion = data.version;
					} else if (this.appVersion !== data.version) {
						// Server version changed!
						this.updateAvailable = true;
					}
				}
			}

			// Also trigger SvelteKit's native version check
			try {
				const hasNewVersion = await updated.check();
				if (hasNewVersion) {
					this.updateAvailable = true;
				}
			} catch {
				// Ignore transient network errors during updated.check()
			}

			// Also trigger Service Worker update check
			if (this.registration) {
				try {
					await this.registration.update();
				} catch {
					// Ignore transient network errors during registration.update()
				}
			}

			return true;
		} catch (err) {
			console.warn('[PWA] Keep-alive ping failed (likely offline):', err);
			return false;
		}
	}

	async applyUpdate() {
		if (!browser) return;
		this.isUpdating = true;

		try {
			if (this.registration?.waiting) {
				this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
			}
			// Fallback reload after small delay if controllerchange doesn't fire immediately
			setTimeout(() => {
				window.location.reload();
			}, 300);
		} catch {
			window.location.reload();
		}
	}

	async install() {
		if (!this.deferredPrompt) return false;
		try {
			this.deferredPrompt.prompt();
			const choice = await this.deferredPrompt.userChoice;
			if (choice.outcome === 'accepted') {
				this.canInstall = false;
				this.deferredPrompt = null;
				return true;
			}
			return false;
		} catch {
			return false;
		}
	}

	destroy() {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
		this.isInitialized = false;
	}
}

export const pwa = new PwaService();
