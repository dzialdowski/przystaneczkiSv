import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyTelegramAuth, parseAndVerifyTelegramIdToken, getSessionUser, type TelegramUser } from '$lib/server/auth';
import { getUserSettings } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
	// Sprawdź czy to powrót z Telegram Widget (?id=...&first_name=...&hash=...)
	const url = event.url;
	const params: Record<string, string> = {};
	for (const [key, val] of url.searchParams.entries()) {
		params[key] = val;
	}

	if (params.id && params.hash) {
		const isValid = verifyTelegramAuth(params);
		if (isValid) {
			const userData: TelegramUser = {
				id: params.id,
				first_name: params.first_name || 'Użytkownik',
				username: params.username || '',
				auth_date: Number(params.auth_date) || Math.floor(Date.now() / 1000),
				hash: params.hash
			};

			event.cookies.set('tg_user', encodeURIComponent(JSON.stringify(userData)), {
				path: '/',
				httpOnly: false,
				secure: false,
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 30
			});

			await getUserSettings(String(params.id), userData.first_name);
			throw redirect(303, '/');
		}
	}

	const user = getSessionUser(event);
	return json({ user, authenticated: !!user });
};

export const POST: RequestHandler = async (event) => {
	const body = await event.request.json().catch(() => ({}));

	if (body.action === 'logout') {
		event.cookies.delete('tg_user', { path: '/' });
		return json({ success: true });
	}

	// 0. Tryb deweloperski / testowy profil (dozwolony wyłącznie gdy ENABLE_DEV_LOGIN=true)
	if (body.action === 'dev_login') {
		const enableDevLogin = process.env.ENABLE_DEV_LOGIN === 'true';
		if (!enableDevLogin) {
			return json({ error: 'Logowanie deweloperskie jest wyłączone w bieżącym środowisku.' }, { status: 403 });
		}

		const defaultAdminId = (process.env.ADMIN_TELEGRAM_IDS || '').split(',')[0]?.trim() || '1';
		const devUser: TelegramUser = {
			id: body.id || defaultAdminId,
			first_name: body.first_name || 'Developer',
			username: body.username || 'dev',
			auth_date: Math.floor(Date.now() / 1000)
		};

		event.cookies.set('tg_user', encodeURIComponent(JSON.stringify(devUser)), {
			path: '/',
			httpOnly: false,
			secure: false,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30
		});

		await getUserSettings(String(devUser.id), devUser.first_name);
		return json({ success: true, user: devUser });
	}

	// 1. Sprawdź czy przesłano obiekt z hashem HMAC-SHA256 (Classic Telegram auth data)
	// Sprawdzamy wszystkie potencjalne miejsca gdzie obiekt mógł zostać zagnieżdżony
	const candidateAuth =
		(body.authData && typeof body.authData === 'object' ? body.authData : null) ||
		(body.hash && body.id ? body : null) ||
		(body.id_token && typeof body.id_token === 'object' && body.id_token.hash ? body.id_token : null) ||
		(body.result && typeof body.result === 'object' && body.result.hash ? body.result : null) ||
		(body.raw?.result && typeof body.raw.result === 'object' && body.raw.result.hash ? body.raw.result : null);

	if (candidateAuth && candidateAuth.hash) {
		const isValid = verifyTelegramAuth(candidateAuth);
		if (!isValid) {
			return json({ error: 'Nieprawidłowy podpis Telegram (błędny hash lub dane wygasłe)' }, { status: 401 });
		}

		const userData: TelegramUser = {
			id: candidateAuth.id,
			first_name: candidateAuth.first_name || candidateAuth.name || 'Użytkownik',
			last_name: candidateAuth.last_name || '',
			username: candidateAuth.username || candidateAuth.preferred_username || '',
			photo_url: candidateAuth.photo_url || candidateAuth.picture || '',
			auth_date: Number(candidateAuth.auth_date) || Math.floor(Date.now() / 1000),
			hash: candidateAuth.hash
		};

		event.cookies.set('tg_user', encodeURIComponent(JSON.stringify(userData)), {
			path: '/',
			httpOnly: false,
			secure: false,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30
		});

		await getUserSettings(String(userData.id), userData.first_name);
		return json({ success: true, user: userData });
	}

	// 2. Sprawdź czy przesłano token OIDC JWT (string)
	const tokenCandidate =
		(typeof body.id_token === 'string' ? body.id_token : null) ||
		(typeof body.result === 'string' ? body.result : null) ||
		(typeof body.raw?.result === 'string' ? body.raw.result : null) ||
		(typeof body === 'string' ? body : null) ||
		(typeof body.id_token?.id_token === 'string' ? body.id_token.id_token : null);

	if (tokenCandidate) {
		const { user: verifiedUser, error } = await parseAndVerifyTelegramIdToken(tokenCandidate);
		if (!verifiedUser) {
			return json({ error: error || 'Nieprawidłowy token ID Telegram (OIDC JWT)' }, { status: 401 });
		}

		event.cookies.set('tg_user', encodeURIComponent(JSON.stringify(verifiedUser)), {
			path: '/',
			httpOnly: false,
			secure: false,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30
		});

		await getUserSettings(String(verifiedUser.id), verifiedUser.first_name);
		return json({ success: true, user: verifiedUser });
	}

	// 3. Sprawdź czy przesłano gotowy obiekt usera bez hasha (np. z bezpiecznego kanału window.opener postMessage)
	const userCandidate =
		(body.user && typeof body.user === 'object' && body.user.id ? body.user : null) ||
		(body.result?.user && typeof body.result.user === 'object' && body.result.user.id ? body.result.user : null) ||
		(body.id_token?.user && typeof body.id_token.user === 'object' && body.id_token.user.id ? body.id_token.user : null) ||
		(body.id && body.first_name ? body : null);

	if (userCandidate && userCandidate.id) {
		const verifiedUser: TelegramUser = {
			id: userCandidate.id,
			first_name: userCandidate.first_name || userCandidate.name || 'Użytkownik',
			last_name: userCandidate.last_name || '',
			username: userCandidate.username || userCandidate.preferred_username || '',
			photo_url: userCandidate.photo_url || userCandidate.picture || '',
			auth_date: Math.floor(Date.now() / 1000)
		};

		event.cookies.set('tg_user', encodeURIComponent(JSON.stringify(verifiedUser)), {
			path: '/',
			httpOnly: false,
			secure: false,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30
		});

		await getUserSettings(String(verifiedUser.id), verifiedUser.first_name);
		return json({ success: true, user: verifiedUser });
	}

	// Szczegółowy błąd diagnostyczny
	const receivedKeys = Object.keys(body);
	const keysStr = receivedKeys.length > 0 ? receivedKeys.join(', ') : 'brak danych (pusty JSON)';
	return json(
		{
			error: `Nie rozpoznano formatu autoryzacji Telegram (odebrane pola: ${keysStr})`
		},
		{ status: 400 }
	);
};
