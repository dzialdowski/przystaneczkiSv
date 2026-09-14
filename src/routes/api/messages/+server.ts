import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDisplayMessages } from '$lib/server/tristar';

export const GET: RequestHandler = async () => {
	try {
		const messages = await getDisplayMessages();
		return json(messages);
	} catch (err: any) {
		return json({ error: err?.message || 'Błąd pobierania komunikatów' }, { status: 500 });
	}
};
