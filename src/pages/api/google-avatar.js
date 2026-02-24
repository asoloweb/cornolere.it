const ALLOWED_HOSTS = new Set(['lh3.googleusercontent.com', 'lh4.googleusercontent.com', 'lh5.googleusercontent.com', 'lh6.googleusercontent.com']);

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET({ url }) {
  const raw = url.searchParams.get('u');
  if (!raw) return json(400, { error: 'missing_u' });

  let target;
  try {
    target = new URL(raw);
  } catch {
    return json(400, { error: 'invalid_url' });
  }

  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    return json(400, { error: 'invalid_host' });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    if (!upstream.ok) {
      return json(upstream.status, { error: 'upstream_error' });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const cacheControl = upstream.headers.get('cache-control') || 'public, max-age=86400';
    const body = await upstream.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
      },
    });
  } catch (error) {
    console.error('Errore proxy avatar Google:', error);
    return json(502, { error: 'fetch_failed' });
  }
}
