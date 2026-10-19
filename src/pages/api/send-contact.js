export const prerender = false;

function jsonResponse(status, body) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

async function openSocket(hostname, port, secure) {
	const ua = typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '';

	if (ua.includes('Cloudflare-Workers')) {
		const spec = 'cloudflare:sockets';
		const { connect } = await import(/* @vite-ignore */ spec);
		const socket = connect(
			{ hostname, port },
			{ secureTransport: secure ? 'on' : 'starttls' }
		);
		return {
			stream: socket,
			startTls: secure ? null : () => socket.startTls(),
		};
	}

	const tls = await import('node:tls');
	const net = await import('node:net');
	const nodeSocket = secure
		? await new Promise((resolve, reject) => {
				const s = tls.connect({ host: hostname, port, rejectUnauthorized: false }, () => resolve(s));
				s.once('error', reject);
			})
		: await new Promise((resolve, reject) => {
				const s = net.connect({ host: hostname, port }, () => resolve(s));
				s.once('error', reject);
			});

	const { Duplex } = await import('node:stream');
	return {
		stream: Duplex.toWeb(nodeSocket),
		startTls: secure
			? null
			: async () => {
					const tlsSocket = await new Promise((resolve, reject) => {
						const socket = tls.connect(
							{ socket: nodeSocket, servername: hostname, rejectUnauthorized: false },
							() => resolve(socket)
						);
						socket.once('error', reject);
					});
					return Duplex.toWeb(tlsSocket);
				},
	};
}

async function sendSmtp(env, { nome, telefono, email, indirizzo, dataInizio, dataFine, messaggio }) {
	const smtpHost = env.SMTP_HOST;
	const smtpPort = Number(env.SMTP_PORT || 465);
	const smtpUser = env.SMTP_USER;
	const smtpPass = env.SMTP_PASSWORD;
	const smtpFrom = env.SMTP_FROM || smtpUser;
	const smtpTo = env.SMTP_TO || 'alessiaforner76@gmail.com';

	const secure = smtpPort === 465;
	let step = 'apertura socket';

	const fail = (error) => {
		const message = error?.message || String(error);
		if (message.startsWith('[')) return error;
		const wrapped = new Error(`[${step}] ${message}`);
		wrapped.cause = error;
		return wrapped;
	};

	let connection;
	let socket;
	let reader;
	let writer;
	let buf = '';

	try {
		connection = await openSocket(smtpHost, smtpPort, secure);
		if (typeof connection.stream.opened?.then === 'function') {
			// Superficce subito errori di connessione/TLS (es. certificato scaduto).
			await connection.stream.opened;
		}
		socket = connection.stream;
		reader = socket.readable.getReader();
		writer = socket.writable.getWriter();

		const waitFor = async (code) => {
			while (true) {
				const { done, value } = await reader.read();
				if (done) throw new Error(`connessione chiusa durante attesa ${code}`);
				buf += new TextDecoder().decode(value);
				const lines = buf.split('\r\n');
				if (lines.length > 1) {
					const last = lines[lines.length - 2];
					// Le righe intermedie EHLO sono "250-xxx": la risposta finale e' "250 xxx".
					if (last.startsWith(`${code} `) || last === String(code)) {
						buf = lines[lines.length - 1];
						return last;
					}
					if (!last.startsWith(`${code}-`)) {
						throw new Error(`atteso ${code}, ricevuto: ${last}`);
					}
				}
			}
		};
		const send = (cmd) => writer.write(new TextEncoder().encode(cmd + '\r\n'));
		// startTls() richiede che reader/writer siano rilasciati prima dell'upgrade.
		const upgradeTls = async () => {
			reader.releaseLock();
			writer.releaseLock();
			socket = await connection.startTls();
			reader = socket.readable.getReader();
			writer = socket.writable.getWriter();
			buf = '';
		};

		step = 'lettura banner';
		await waitFor(220);

		step = 'EHLO';
		await send(`EHLO cornolere.it`);
		await waitFor(250);

		if (smtpPort === 587) {
			if (!connection.startTls) throw new Error('STARTTLS non disponibile');
			step = 'STARTTLS';
			await send('STARTTLS');
			await waitFor(220);
			await upgradeTls();
			step = 'EHLO dopo STARTTLS';
			await send(`EHLO cornolere.it`);
			await waitFor(250);
		}

		step = 'AUTH LOGIN';
		await send(`AUTH LOGIN`);
		await waitFor(334);
		await send(btoa(smtpUser));
		await waitFor(334);
		await send(btoa(smtpPass));
		await waitFor(235);

		step = 'MAIL FROM';
		await send(`MAIL FROM:<${smtpFrom}>`);
		await waitFor(250);

		step = 'RCPT TO';
		await send(`RCPT TO:<${smtpTo}>`);
		await waitFor(250);

		step = 'DATA';
		await send(`DATA`);
		await waitFor(354);

		const emailBody = [
			'Nuova richiesta di contatto dal sito Cornolere',
			'',
			`Nome e cognome: ${nome}`,
			`Telefono: ${telefono || '-'}`,
			`Email: ${email}`,
			`Indirizzo: ${indirizzo || '-'}`,
			`Data inizio: ${dataInizio || '-'}`,
			`Data fine: ${dataFine || '-'}`,
			'',
			'Messaggio:',
			messaggio,
		].join('\r\n');

		const boundary = '----=_Boundary_' + Math.random().toString(36).slice(2);
		const rawEmail = [
			`From: ${smtpFrom}`,
			`To: ${smtpTo}`,
			`Reply-To: ${email}`,
			`Subject: =?utf-8?B?${btoa('Richiesta informazioni Cornolere')}?=`,
			`MIME-Version: 1.0`,
			`Content-Type: multipart/alternative; boundary="${boundary}"`,
			'',
			`--${boundary}`,
			`Content-Type: text/plain; charset=utf-8`,
			`Content-Transfer-Encoding: 8bit`,
			'',
			emailBody,
			'',
			`--${boundary}--`,
			'',
		].join('\r\n');

		step = 'invio corpo email';
		await send(rawEmail);
		await send('.');
		await waitFor(250);

		step = 'QUIT';
		await send('QUIT');
		await writer.close();
	} catch (error) {
		throw fail(error);
	}
}

export async function POST({ request, locals }) {
	const env = locals?.runtime?.env || import.meta.env || process.env;

	try {
		const body = await request.json().catch(() => ({}));

		const nome = String(body?.nome || '').trim();
		const telefono = String(body?.telefono || '').trim();
		const email = String(body?.email || '').trim();
		const indirizzo = String(body?.indirizzo || '').trim();
		const dataInizio = String(body?.data_inizio || '').trim();
		const dataFine = String(body?.data_fine || '').trim();
		const messaggio = String(body?.messaggio || '').trim();

		if (!nome || !email || !messaggio) {
			return jsonResponse(400, { error: 'Campi obbligatori mancanti' });
		}

		if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
			return jsonResponse(500, { error: 'SMTP non configurato' });
		}

		await sendSmtp(env, { nome, telefono, email, indirizzo, dataInizio, dataFine, messaggio });

		return jsonResponse(200, { success: true });
	} catch (error) {
		return jsonResponse(500, {
			error: 'Errore invio email: ' + (error?.message || 'unknown'),
		});
	}
}
