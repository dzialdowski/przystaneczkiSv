import { browser } from '$app/environment';

function checkIsInstalled(): boolean {
	if (!browser) return false;
	return (
		window.matchMedia('(display-mode: standalone)').matches ||
		// @ts-expect-error - iOS Safari specific check
		Boolean(window.navigator?.standalone) ||
		document.referrer.includes('android-app://')
	);
}

function checkIsIos(): boolean {
	if (!browser) return false;
	return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

class PwaService {
	updateAvailable = $state(false);
	isOnline = $state(true);
	canInstall = $state(false);
	isInstalled = $state(false);
	isIos = $state(false);
	lastPing = $state<Date | null>(null);
	pingCount = $state(0);
	appVersion = $state<string | null>(null);
	isUpdating = $state(false);

	private deferredPrompt: any = null;
	private registration: ServiceWorkerRegistration | null = null;
	private intervalId: any = null;
	private isInitialized = false;
	private hadControllerOnLoad = false;

	init() {
		if (!browser || this.isInitialized) return;
		this.isInitialized = true;

		this.isOnline = navigator.onLine;
		this.isInstalled = checkIsInstalled();
		this.isIos = checkIsIos();

		// Record whether a Service Worker was ALREADY controlling the page when it loaded.
		// If false, this is the first visit on this device, so initial SW install is NOT an update!
		this.hadControllerOnLoad = Boolean(navigator.serviceWorker?.controller);

		window.addEventListener('online', () => {
			this.isOnline = true;
			this.pingServer();
		});

		window.addEventListener('offline', () => {
			this.isOnline = false;
		});

		// PWA install prompt handler (Chrome / Edge / Android)
		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			this.deferredPrompt = e;
			if (!this.isInstalled) {
				this.canInstall = true;
			}
		});

		window.addEventListener('appinstalled', () => {
			this.canInstall = false;
			this.isInstalled = true;
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

			// If there is already a waiting service worker AND the page already had a controller on load,
			// an update was waiting before this page opened.
			if (reg.waiting && this.hadControllerOnLoad) {
				this.updateAvailable = true;
			}

			// Listen for new service worker installation
			reg.addEventListener('updatefound', () => {
				const newWorker = reg.installing;
				if (!newWorker) return;

				newWorker.addEventListener('statechange', () => {
					// Only trigger update if the page had a controller when it loaded!
					// Prevents initial installation on first visit from triggering a false update notice.
					if (newWorker.state === 'installed' && this.hadControllerOnLoad) {
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
						// Record initial baseline version for this session
						this.appVersion = data.version;
					} else if (this.appVersion !== data.version) {
						// Server version changed on Azure!
						console.log('[PWA] New server version detected:', data.version, 'current:', this.appVersion);
						this.updateAvailable = true;
					}
				}
			}

			// Periodically check if a service worker update is ready
			if (this.registration && this.hadControllerOnLoad) {
				try {
					await this.registration.update();
				} catch {
					// Ignore transient network errors
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

	async install(): Promise<boolean> {
		if (!this.deferredPrompt) return false;
		try {
			this.deferredPrompt.prompt();
			const choice = await this.deferredPrompt.userChoice;
			if (choice.outcome === 'accepted') {
				this.canInstall = false;
				this.isInstalled = true;
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
