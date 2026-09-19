import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

declare const __APP_VERSION__: string;

export const GET: RequestHandler = async ({ setHeaders }) => {
	// Disable caching entirely so Azure App Service free tier receives every ping
	// and keeps the instance active and warm.
	setHeaders({
		'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
		Pragma: 'no-cache',
		Expires: '0',
		'Surrogate-Control': 'no-store'
	});

	const version =
		typeof __APP_VERSION__ !== 'undefined'
			? __APP_VERSION__
			: process.env.APP_VERSION || process.env.PUBLIC_APP_VERSION || '1.0.0';

	return json({
		ok: true,
		version,
		timestamp: Date.now(),
		uptime: Math.floor(process.uptime())
	});
};

export const HEAD: RequestHandler = async ({ setHeaders }) => {
	setHeaders({
		'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
		Pragma: 'no-cache',
		Expires: '0',
		'Surrogate-Control': 'no-store'
	});

	return new Response(null, { status: 200 });
};
