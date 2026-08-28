export const prerender = false;

function jsonResponse(status, body) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

async function sendSmtp(env, { nome, telefono, email, indirizzo, dataInizio, dataFine, messaggio }) {
	const { connect } = await import('cloudflare:sockets');

	const smtpHost = env.SMTP_HOST;
	const smtpPort = Number(env.SMTP_PORT || 587);
	const smtpUser = env.SMTP_USER;
	const smtpPass = env.SMTP_PASSWORD;
	const smtpFrom = env.SMTP_FROM || smtpUser;
	const smtpTo = env.SMTP_TO || 'info@cornolere.it';

	const secure = smtpPort === 465;
	const socket = connect({ hostname: smtpHost, port: smtpPort }, { secure });

	const reader = socket.readable.getReader();
	const writer = socket.writable.getWriter();

	let buf = '';
	const waitFor = async (code) => {
		while (true) {
			const { done, value } = await reader.read();
			if (done) throw new Error('Connessione chiusa');
			buf += new TextDecoder().decode(value);
			const lines = buf.split('\r\n');
			if (lines.length > 1) {
				const last = lines[lines.length - 2];
				if (last.startsWith(String(code))) {
					buf = lines[lines.length - 1];
					return last;
				}
				if (!last.startsWith(String(code))) {
					throw new Error(`SMTP expected ${code}, got: ${last}`);
				}
			}
		}
	};
	const send = (cmd) => writer.write(new TextEncoder().encode(cmd + '\r\n'));

	await waitFor(220);
	await send(`EHLO cornolere.it`);
	await waitFor(250);
	await send(`AUTH LOGIN`);
	await waitFor(334);
	await send(btoa(smtpUser));
	await waitFor(334);
	await send(btoa(smtpPass));
	await waitFor(235);
	await send(`MAIL FROM:<${smtpFrom}>`);
	await waitFor(250);
	await send(`RCPT TO:<${smtpTo}>`);
	await waitFor(250);
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
		`Subject: =?utf-8?B?${btoa('Nuova richiesta di contatto - Cornolere')}?=`,
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

	await send(rawEmail);
	await send('.');
	await waitFor(250);
	await send('QUIT');
	writer.close();
}

export async function POST({ request }) {
	const env = import.meta.env || process.env;

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
