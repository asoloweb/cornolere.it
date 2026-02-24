export async function onRequestPost({ request, env }) {
	try {
		if (!env.STRIPE_SECRET_KEY) {
			return new Response(JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const body = await request.json().catch(() => ({}));
		const priceFromEnv = Number(env.PARTECIPA_PRICE_CENTS || 0);
		const priceFromPublic = Number(env.PUBLIC_PARTECIPA_PRICE || 99);
		const amount = Number.isFinite(priceFromEnv) && priceFromEnv > 0
			? Math.round(priceFromEnv)
			: Math.round(priceFromPublic * 100);
		const currency = env.PARTECIPA_CURRENCY || 'eur';

		const params = new URLSearchParams();
		params.set('amount', String(amount));
		params.set('currency', currency);
		params.append('payment_method_types[]', 'card');
		params.set('description', 'Partecipa');

		if (body?.email) params.set('receipt_email', String(body.email));
		if (body?.nome_cognome) params.set('metadata[nome_cognome]', String(body.nome_cognome));
		if (body?.indirizzo) params.set('metadata[indirizzo]', String(body.indirizzo));
		if (body?.telefono) params.set('metadata[telefono]', String(body.telefono));
		if (body?.privacy) params.set('metadata[privacy]', String(body.privacy));
		if (body?.condizioni_uso)
			params.set('metadata[condizioni_uso]', String(body.condizioni_uso));
		if (body?.email) params.set('metadata[email]', String(body.email));
		params.set('metadata[prezzo]', String(amount));
		params.set('metadata[valuta]', String(currency));

		if (body?.nome_cognome) params.set('shipping[name]', String(body.nome_cognome));
		if (body?.indirizzo) params.set('shipping[address][line1]', String(body.indirizzo));

		const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: params.toString(),
		});

		const payload = await stripeResponse.json();
		if (!stripeResponse.ok) {
			return new Response(JSON.stringify({ error: payload?.error?.message || 'Stripe error' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		return new Response(JSON.stringify({ clientSecret: payload.client_secret }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Server error' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}
