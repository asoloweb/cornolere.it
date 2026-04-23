const rawDirectusUrl =
	import.meta.env.PUBLIC_DIRECTUS_URL ||
	import.meta.env.DIRECTUS_URL ||
	'https://cornolere.asoloweb.it';

export const DIRECTUS_URL = rawDirectusUrl.replace(/\/+$/, '');
const DIRECTUS_TOKEN = import.meta.env.DIRECTUS_TOKEN || import.meta.env.PUBLIC_DIRECTUS_TOKEN || '';
const DIRECTUS_ASSET_TOKEN =
	import.meta.env.PUBLIC_DIRECTUS_ASSET_TOKEN || import.meta.env.PUBLIC_DIRECTUS_TOKEN || '';

export function directusFetch(input: any, init: any = {}) {
  const headers = new Headers(init.headers || undefined);
  if (DIRECTUS_TOKEN && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${DIRECTUS_TOKEN}`);
  }
  return fetch(input, {
    ...init,
    headers,
  });
}

export function directusItemsUrl(path: string) {
	const cleanedPath = path.replace(/^\/+/, '');
	return new URL(`/items/${cleanedPath}`, DIRECTUS_URL);
}

type DirectusAssetOptions = {
	width?: number;
	height?: number;
	quality?: number;
	format?: 'webp' | 'avif' | 'jpg' | 'jpeg' | 'png';
	fit?: 'cover' | 'contain' | 'inside' | 'outside';
};

export function directusAssetUrl(value: string | undefined, options: DirectusAssetOptions = {}) {
	if (!value) return '';

	const applyTransforms = (url: URL) => {
		if (options.width) url.searchParams.set('width', String(options.width));
		if (options.height) url.searchParams.set('height', String(options.height));
		if (options.quality) url.searchParams.set('quality', String(options.quality));
		if (options.format) url.searchParams.set('format', options.format);
		if (options.fit) url.searchParams.set('fit', options.fit);
		if (DIRECTUS_ASSET_TOKEN && !url.searchParams.has('access_token')) {
			url.searchParams.set('access_token', DIRECTUS_ASSET_TOKEN);
		}
		return url.toString();
	};

	if (value.startsWith('http://') || value.startsWith('https://')) {
		try {
			const url = new URL(value);
			if (url.origin !== DIRECTUS_URL || !url.pathname.startsWith('/assets/')) {
				return value;
			}
			return applyTransforms(url);
		} catch {
			return value;
		}
	}

	if (value.startsWith('/assets/')) {
		return applyTransforms(new URL(value, DIRECTUS_URL));
	}

	if (value.startsWith('/')) {
		return value;
	}

	return applyTransforms(new URL(`/assets/${value}`, DIRECTUS_URL));
}