import { loadEnvFileIfNeeded } from './db';
import crypto from 'crypto';
import type { RequestEvent } from '@sveltejs/kit';

loadEnvFileIfNeeded();

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
	const token = BOT_TOKEN || process.env.BOT_TOKEN || '';
	if (!data.hash || !token) return false;

	const checkHash = String(data.hash).toLowerCase();
	const checkArr: string[] = [];

	for (const [key, value] of Object.entries(data)) {
		if (key !== 'hash' && value !== undefined && value !== null && value !== '') {
			checkArr.push(`${key}=${value}`);
		}
	}

	checkArr.sort();
	const checkString = checkArr.join('\n');

	const secretKey = crypto.createHash('sha256').update(token).digest();
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

		const parts = idToken.split('.');
		if (parts.length !== 3) {
			return { user: null, error: 'Nieprawidłowy format JWT (wymagane 3 części)' };
		}

		const [headerB64, payloadB64, signatureB64] = parts;
		const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
		const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

		if (payload.iss !== 'https://oauth.telegram.org') {
			return { user: null, error: `Nieprawidłowy issuer (iss): ${payload.iss}` };
		}

		const botId = BOT_ID || process.env.PUBLIC_BOT_ID || process.env.BOT_ID;
		if (botId && payload.aud && String(payload.aud) !== String(botId)) {
			console.warn(`Ostrzeżenie aud: token aud=${payload.aud}, nasz botId=${botId}`);
		}

		const now = Math.floor(Date.now() / 1000);
		if (payload.exp && payload.exp < now - 60) {
			return { user: null, error: 'Token JWT wygasł' };
		}

		const publicKey = await getTelegramPublicKey(header.kid);
		if (!publicKey) {
			return { user: null, error: 'Nie udało się pobrać klucza publicznego Telegrama' };
		}

		const verifier = crypto.createVerify('RSA-SHA256');
		verifier.update(`${headerB64}.${payloadB64}`);
		const isSigValid = verifier.verify(publicKey, signatureB64, 'base64url');

		if (!isSigValid) {
			return { user: null, error: 'Nieprawidłowy podpis kryptograficzny JWT Telegrama' };
		}

		const user: TelegramUser = {
			id: payload.sub,
			first_name: payload.name || payload.first_name || 'Użytkownik',
			last_name: payload.family_name || payload.last_name || undefined,
			username: payload.preferred_username || payload.username || undefined,
			photo_url: payload.picture || undefined,
			auth_date: payload.auth_time || payload.iat || now
		};

		return { user };
	} catch (err: any) {
		console.error('Błąd parsowania/weryfikacji tokena JWT Telegrama:', err);
		return { user: null, error: err.message || 'Błąd wewnętrzny weryfikacji tokena' };
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
