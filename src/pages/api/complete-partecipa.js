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
	if (!response.ok) {
		const detail = await response.text();
		return { error: 'User creation failed', status: response.status, detail };
	}
	const text = await response.text();
	if (!text) return null;
	let payload = null;
	try {
		payload = JSON.parse(text);
	} catch {
		return { error: 'User creation failed', status: response.status, detail: text };
	}
	return payload?.data || null;
}

function generatePraticaId() {
	const raw = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
	return `PRAT-${raw}`;
}

function parseRawBody(rawText, contentType) {
	if (!rawText) return {};
	const lowerType = (contentType || '').toLowerCase();
	if (lowerType.includes('application/json')) {
		try {
			return JSON.parse(rawText);
		} catch {
			return {};
		}
	}
	if (lowerType.includes('application/x-www-form-urlencoded')) {
		const params = new URLSearchParams(rawText);
		const result = {};
		for (const [key, value] of params.entries()) result[key] = value;
		return result;
	}
	try {
		return JSON.parse(rawText);
	} catch {
		const params = new URLSearchParams(rawText);
		const result = {};
		for (const [key, value] of params.entries()) result[key] = value;
		return result;
	}
}

export const prerender = false;

async function handleRequest(request, env) {
	if (!env.DIRECTUS_TOKEN) {
		return jsonResponse(500, { error: 'Missing DIRECTUS_TOKEN' });
	}

	const contentType = request.headers.get('content-type') || '';
	const rawText = await request.text();
	const body = parseRawBody(rawText, contentType);
	const requestUrl = request.url || '';
	const urlParams = (() => {
		try {
			return new URL(requestUrl).searchParams;
		} catch {
			return new URLSearchParams('');
		}
	})();

	if (Object.keys(body || {}).length === 0 && urlParams.toString()) {
		for (const [key, value] of urlParams.entries()) {
			if (body[key] === undefined) body[key] = value;
		}
	}

	let email = String(body?.email || '').trim().toLowerCase();
	let password = String(body?.password || '').trim();

	if (!email || !password) {
		return jsonResponse(400, {
			error: 'Missing email or password',
			received: {
				content_type: contentType,
				content_length: request.headers.get('content-length') || '',
				body_length: rawText.length,
				has_email: !!body?.email,
				has_password: !!body?.password,
				request_url: requestUrl,
				query: urlParams.toString(),
			},
		});
	}

	const nomeCognome = String(body?.nome_cognome || '').trim();
	const contatto = String(body?.contatto || '').trim();
	const statoPratica = 'in_attesa';
	const idPratica = generatePraticaId();

	const roleId = await getClienteRoleId(env);
	let user = await findUserByEmail(env, email);

	if (!user) {
		const created = await createUser(env, { email, password, nomeCognome, roleId });
		if (created?.id) {
			user = created;
		} else {
			return jsonResponse(500, created || { error: 'User creation failed' });
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

export async function POST({ request }) {
	const env = import.meta.env || process.env;
	return handleRequest(request, env);
}

export async function GET({ request }) {
	const env = import.meta.env || process.env;
	return handleRequest(request, env);
}
