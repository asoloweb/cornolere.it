const DIRECTUS_URL = (env) =>
	(env.PUBLIC_DIRECTUS_URL || env.DIRECTUS_URL || 'https://cornolere.asoloweb.it').replace(
		/\/+$/,
		''
	);

function jsonResponse(status, body) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

async function directusRequest(env, path, options = {}) {
	const url = `${DIRECTUS_URL(env)}${path}`;
	const headers = {
		Authorization: `Bearer ${env.DIRECTUS_TOKEN}`,
		'Content-Type': 'application/json',
		...(options.headers || {}),
	};
	return fetch(url, { ...options, headers });
}

async function getClienteRoleId(env) {
	const response = await directusRequest(
		env,
		`/roles?filter[name][_eq]=cliente&limit=1&fields=id`
	);
	if (!response.ok) return null;
	const payload = await response.json();
	return payload?.data?.[0]?.id || null;
}

async function findUserByEmail(env, email) {
	const response = await directusRequest(
		env,
		`/users?filter[email][_eq]=${encodeURIComponent(email)}&limit=1&fields=id,role`
	);
	if (!response.ok) return null;
	const payload = await response.json();
	return payload?.data?.[0] || null;
}

async function createUser(env, { email, password, nomeCognome, roleId }) {
	const body = {
		email,
		password,
		status: 'active',
	};
	if (nomeCognome) {
		const parts = nomeCognome.split(' ');
		body.first_name = parts[0];
		if (parts.length > 1) {
			body.last_name = parts.slice(1).join(' ');
		}
	}
	if (roleId) body.role = roleId;

	const response = await directusRequest(env, '/users', {
		method: 'POST',
		body: JSON.stringify(body),
	});
	if (!response.ok) return null;
	const payload = await response.json();
	return payload?.data || null;
}

function generatePraticaId() {
	const raw = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
	return `PRAT-${raw}`;
}

export async function onRequestPost({ request, env }) {
	if (!env.DIRECTUS_TOKEN) {
		return jsonResponse(500, { error: 'Missing DIRECTUS_TOKEN' });
	}

	const body = await request.json().catch(() => ({}));
	const email = String(body?.email || '').trim().toLowerCase();
	const password = String(body?.password || '').trim();
	if (!email || !password) {
		return jsonResponse(400, { error: 'Missing email or password' });
	}

	const nomeCognome = String(body?.nome_cognome || '').trim();
	const contatto = String(body?.contatto || '').trim();
	const statoPratica = 'in_attesa';
	const idPratica = generatePraticaId();

	const roleId = await getClienteRoleId(env);
	let user = await findUserByEmail(env, email);

	if (!user) {
		user = await createUser(env, { email, password, nomeCognome, roleId });
		if (!user?.id) {
			return jsonResponse(500, { error: 'User creation failed' });
		}
	} else if (roleId && user.role !== roleId) {
		await directusRequest(env, `/users/${user.id}`, {
			method: 'PATCH',
			body: JSON.stringify({ role: roleId }),
		});
	}

	const praticaPayload = {
		contatto,
		id_pratica: idPratica,
		stato_pratica: statoPratica,
		cliente: user.id,
		status: 'published',
	};

	const praticaResponse = await directusRequest(env, '/items/pratiche', {
		method: 'POST',
		body: JSON.stringify(praticaPayload),
	});

	if (!praticaResponse.ok) {
		const err = await praticaResponse.text();
		return jsonResponse(500, { error: 'Pratica creation failed', detail: err });
	}

	const praticaData = await praticaResponse.json();

	return jsonResponse(200, {
		pratica_id: praticaData?.data?.id,
		id_pratica: idPratica,
		user_id: user.id,
	});
}
