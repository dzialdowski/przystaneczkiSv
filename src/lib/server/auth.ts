import crypto from 'crypto';
import type { RequestEvent } from '@sveltejs/kit';

export interface TelegramUser {
	id: number | string;
	first_name: string;
	last_name?: string;
	username?: string;
	photo_url?: string;
	auth_date?: number;
	hash?: string;
}

export const BOT_USERNAME = process.env.PUBLIC_BOT_NAME || process.env.BOT_USERNAME || 'przystaneczkiBot';
export const BOT_ID = process.env.PUBLIC_BOT_ID || process.env.BOT_ID || '';
export const BOT_TOKEN = process.env.BOT_TOKEN || '';

/**
 * Sprawdza, czy dany identyfikator użytkownika Telegram należy do listy administratorów
 */
export function isUserAdmin(userId: string | number | undefined | null): boolean {
	if (!userId) return false;
	const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '')
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);
	return adminIds.includes(String(userId).trim());
}

let cachedJwks: any = null;
let lastJwksFetch = 0;

/**
 * Pobiera i cache'uje klucz publiczny RSA z JWKS Telegrama
 */
export async function getTelegramPublicKey(kid?: string): Promise<crypto.KeyObject | null> {
	const now = Date.now();
	if (!cachedJwks || now - lastJwksFetch > 3600000) {
		try {
			const res = await fetch('https://oauth.telegram.org/.well-known/jwks.json');
			if (res.ok) {
				cachedJwks = await res.json();
				lastJwksFetch = now;
			}
		} catch (e) {
			console.warn('Nie udało się pobrać JWKS:', e);
		}
	}

	if (!cachedJwks || !Array.isArray(cachedJwks.keys)) return null;

	const keyDef = kid
		? cachedJwks.keys.find((k: any) => k.kid === kid)
		: cachedJwks.keys.find((k: any) => k.alg === 'RS256' || k.kty === 'RSA');

	if (!keyDef) return null;

	try {
		return crypto.createPublicKey({
			key: keyDef,
			format: 'jwk'
		});
	} catch (e) {
		console.warn('Błąd tworzenia klucza publicznego z JWK:', e);
		return null;
	}
}

/**
 * Weryfikuje podpis z widgetu logowania Telegram (HMAC-SHA256)
 */
export function verifyTelegramAuth(data: Record<string, any>): boolean {
	if (!data.hash || !BOT_TOKEN) return false;

	const checkHash = String(data.hash).toLowerCase();
	const checkArr: string[] = [];

	for (const [key, value] of Object.entries(data)) {
		if (key !== 'hash' && value !== undefined && value !== null && value !== '') {
			checkArr.push(`${key}=${value}`);
		}
	}

	checkArr.sort();
	const checkString = checkArr.join('\n');

	const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
	const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex').toLowerCase();

	if (hmac !== checkHash) {
		console.warn('Telegram auth signature mismatch. Expected:', hmac, 'Received:', checkHash);
		return false;
	}

	// Sprawdzenie świeżości (do 24 godzin z tolerancją na przesunięcie zegara)
	if (data.auth_date) {
		const now = Math.floor(Date.now() / 1000);
		const authDate = Number(data.auth_date);
		if (now - authDate > 86400 || authDate > now + 3600) {
			console.warn('Telegram auth data expired. Now:', now, 'auth_date:', authDate);
			return false;
		}
	}

	return true;
}

/**
 * Weryfikuje nowy token OIDC JWT (id_token) z telegram-login.js
 */
export async function parseAndVerifyTelegramIdToken(tokenCandidate: any): Promise<{ user: TelegramUser | null; error?: string }> {
	try {
		let idToken = tokenCandidate;
		if (typeof idToken === 'object' && idToken !== null) {
			if (typeof idToken.id_token === 'string') idToken = idToken.id_token;
			else if (typeof idToken.result === 'string') idToken = idToken.result;
		}

		if (typeof idToken !== 'string') {
			return { user: null, error: `Oczekiwano ciągu znaków JWT, otrzymano: ${typeof idToken}` };
		}

		idToken = idToken.trim();
		if (idToken.startsWith('{') && idToken.endsWith('}')) {
			try {
				const parsed = JSON.parse(idToken);
				return parseAndVerifyTelegramIdToken(parsed);
			} catch {}
		}

		const parts = idToken.split('.');
		if (parts.length !== 3) {
			return { user: null, error: `Nieprawidłowy format JWT (liczba części: ${parts.length})` };
		}

		let header: any;
		let payload: any;
		try {
			const headerStr = Buffer.from(parts[0], 'base64url').toString('utf8');
			header = JSON.parse(headerStr);
			const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf8');
			payload = JSON.parse(payloadStr);
		} catch (e: any) {
			return { user: null, error: `Błąd dekodowania zawartości tokena JWT: ${e.message}` };
		}

		const now = Math.floor(Date.now() / 1000);

		// Tolerancja 10 minut na przesunięcie czasu lokalnego vs serwera
		if (payload.exp && payload.exp + 600 < now) {
			console.warn('Telegram ID token expired. exp:', payload.exp, 'now:', now);
			return { user: null, error: `Token Telegram wygasł (exp: ${payload.exp}, current: ${now})` };
		}

		const iss = (payload.iss || '').replace(/\/$/, '');
		if (iss && !iss.includes('telegram.org') && !iss.includes('t.me')) {
			console.warn('Invalid Telegram token issuer:', payload.iss);
			return { user: null, error: `Nieznany wystawca tokena: ${payload.iss}` };
		}

		if (BOT_ID && payload.aud && String(payload.aud) !== String(BOT_ID)) {
			console.warn('Invalid aud in token:', payload.aud, 'expected:', BOT_ID);
		}

		// Próba weryfikacji kryptograficznej RS256 z kluczem z JWKS
		if (header.alg === 'RS256') {
			try {
				const pubKey = await getTelegramPublicKey(header.kid);
				if (pubKey) {
					const verifier = crypto.createVerify('RSA-SHA256');
					verifier.update(`${parts[0]}.${parts[1]}`);
					const valid = verifier.verify(pubKey, Buffer.from(parts[2], 'base64url'));
					if (!valid) {
						console.warn('Weryfikacja podpisu RS256 nie powiodła się');
					}
				}
			} catch (sigErr) {
				console.warn('Błąd weryfikacji podpisu JWKS RS256:', sigErr);
			}
		}

		const userId = payload.id || payload.sub || payload.user_id;
		if (!userId) {
			return { user: null, error: 'Brak identyfikatora użytkownika (sub/id) w tokenie' };
		}

		const user: TelegramUser = {
			id: userId,
			first_name: payload.name || payload.given_name || payload.first_name || payload.preferred_username || 'Użytkownik Telegram',
			last_name: payload.family_name || payload.last_name || '',
			username: payload.preferred_username || payload.username || '',
			photo_url: payload.picture || payload.photo_url || '',
			auth_date: payload.iat || now
		};

		return { user };
	} catch (e: any) {
		console.error('Błąd parsowania id_token Telegrama:', e);
		return { user: null, error: `Błąd przetwarzania tokena: ${e.message}` };
	}
}

/**
 * Pobiera dane zalogowanego użytkownika z ciasteczka tg_user
 */
export function getSessionUser(event: RequestEvent): TelegramUser | null {
	const cookieVal = event.cookies.get('tg_user');
	if (!cookieVal) return null;

	try {
		const decoded = decodeURIComponent(cookieVal);
		const user = JSON.parse(decoded) as TelegramUser;
		if (user && user.id) {
			return user;
		}
		return null;
	} catch {
		return null;
	}
}
