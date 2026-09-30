export interface GoogleReview {
	author_name?: string;
	author_url?: string;
	profile_photo_url?: string;
	rating?: number;
	text?: string;
	relative_time_description?: string;
	time?: number;
}

export interface GooglePlaceDetails {
	name?: string;
	rating?: number;
	user_ratings_total?: number;
	reviews?: GoogleReview[];
	url?: string;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
let placeIdCache: { placeId: string; expiresAt: number } | null = null;
let detailsCache: { placeDetails: GooglePlaceDetails | null; expiresAt: number } | null = null;

function getApiKey(): string | undefined {
	return (
		import.meta.env.GOOGLE_MAPS_API_KEY ||
		import.meta.env.GOOGLE_PLACES_API_KEY as string | undefined
	);
}

function getPlaceIdOverride(): string {
	return (import.meta.env.GOOGLE_MYBUSINESS_PLACE_ID || '') as string;
}

function getPlaceQuery(): string {
	return (import.meta.env.GOOGLE_BUSINESS_QUERY || "Ca'Cornolere") as string;
}

async function fetchJson(url: string) {
	const response = await fetch(url, {
		headers: { Accept: 'application/json' },
	});
	if (!response.ok) throw new Error(`Google API ${response.status}`);
	return response.json();
}

async function resolvePlaceId(input: string): Promise<string> {
	if (!input) return '';
	if (placeIdCache && placeIdCache.expiresAt > Date.now()) return placeIdCache.placeId;

	const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
	url.searchParams.set('input', input);
	url.searchParams.set('inputtype', 'textquery');
	url.searchParams.set('fields', 'place_id');
	url.searchParams.set('language', 'it');
	url.searchParams.set('key', getApiKey() || '');

	const data = await fetchJson(url.toString());
	if (data?.status !== 'OK') return '';
	const found = data?.candidates?.[0]?.place_id || '';
	if (found) placeIdCache = { placeId: found, expiresAt: Date.now() + CACHE_TTL_MS };
	return found;
}

async function fetchPlaceDetails(inputPlaceId: string): Promise<GooglePlaceDetails | null> {
	if (!inputPlaceId) return null;
	const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
	url.searchParams.set('place_id', inputPlaceId);
	url.searchParams.set('fields', 'name,rating,user_ratings_total,reviews,url');
	url.searchParams.set('reviews_sort', 'newest');
	url.searchParams.set('language', 'it');
	url.searchParams.set('key', getApiKey() || '');

	const data = await fetchJson(url.toString());
	if (data?.status !== 'OK' || !data?.result) return null;
	return data.result as GooglePlaceDetails;
}

export async function getGooglePlaceDetails(): Promise<GooglePlaceDetails | null> {
	const apiKey = getApiKey();
	if (!apiKey) return null;

	if (detailsCache && detailsCache.expiresAt > Date.now()) return detailsCache.placeDetails;

	try {
		let placeId = getPlaceIdOverride();
		if (!placeId) placeId = await resolvePlaceId(getPlaceQuery());
		if (!placeId) return null;

		const details = await fetchPlaceDetails(placeId);
		detailsCache = { placeDetails: details, expiresAt: Date.now() + CACHE_TTL_MS };
		return details;
	} catch {
		return null;
	}
}

export async function getGoogleReviews(maxReviews = 6): Promise<GoogleReview[]> {
	const details = await getGooglePlaceDetails();
	if (!details?.reviews) return [];
	return [...details.reviews].sort((a, b) => (b.time || 0) - (a.time || 0)).slice(0, maxReviews);
}
