export type SiteLang = 'it' | 'en';

export const DIRECTUS_LANG: Record<SiteLang, string> = {
	it: 'it-IT',
	en: 'en-US',
};

export function langFromPath(pathname: string): SiteLang {
	return /^\/en(\/|$)/.test(pathname || '') ? 'en' : 'it';
}

type TranslationRow = {
	languages_code?: string | { code?: string } | null;
} & Record<string, unknown>;

export function pickTranslationRow(
	item: Record<string, unknown> | null | undefined,
	lang: SiteLang
): TranslationRow | null {
	if (!item || typeof item !== 'object') return null;
	const rows = Array.isArray(item.translations) ? (item.translations as TranslationRow[]) : [];
	return (
		rows.find((row) => {
			const code =
				typeof row?.languages_code === 'object'
					? (row.languages_code as { code?: string })?.code
					: row?.languages_code;
			return code === DIRECTUS_LANG[lang];
		}) ?? null
	);
}

export function applyTranslation<T extends Record<string, any>>(
	item: T | null | undefined,
	lang: SiteLang
): T {
	if (!item || typeof item !== 'object' || lang === 'it') return item as T;
	const row = pickTranslationRow(item, lang);
	if (!row) return item as T;
	const merged: Record<string, unknown> = { ...item };
	for (const [key, value] of Object.entries(row)) {
		if (key === 'id' || key === 'languages_code' || key.endsWith('_id')) continue;
		if (value !== null && value !== undefined && value !== '') merged[key] = value;
	}
	return merged as T;
}

type UiStrings = {
	menuAria: string;
	hamburgerAria: string;
	switchLangLabel: string;
	notFoundTitle: string;
	notFoundMessage: string;
	footerMenuAria: string;
};

const UI: Record<SiteLang, UiStrings> = {
	it: {
		menuAria: 'Menu principale',
		hamburgerAria: 'Menu',
		switchLangLabel: 'EN',
		notFoundTitle: 'Pagina non trovata',
		notFoundMessage: 'La pagina richiesta non esiste.',
		footerMenuAria: 'Menu footer',
	},
	en: {
		menuAria: 'Main menu',
		hamburgerAria: 'Menu',
		switchLangLabel: 'IT',
		notFoundTitle: 'Page not found',
		notFoundMessage: 'The requested page does not exist.',
		footerMenuAria: 'Footer menu',
	},
};

export function ui(lang: SiteLang): UiStrings {
	return UI[lang] ?? UI.it;
}
