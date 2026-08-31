export const EN_PAGE_FIELDS = [
	'*',
	'translations.*',
	'editor.item:hero_block.*',
	'editor.item:hero_block.translations.*',
	'editor.item:title_block.*',
	'editor.item:title_block.translations.*',
	'editor.item:cards_block.*',
	'editor.item:cards_block.translations.*',
	'editor.item:cards_block.card.single_card_id.*',
	'editor.item:cards_block.card.single_card_id.translations.*',
	'editor.item:cards_block.card.single_card_id.link.id',
	'editor.item:cards_block.card.single_card_id.link.slug',
	'editor.item:cards_block.card.single_card_id.link.translations.*',
	'editor.item:slider_block.*',
	'editor.item:slider_block.slider.*',
	'editor.item:slider_block.slider.slides.item.*',
	'editor.item:slider_block.slider.slides.item.translations.*',
	'editor.item:accordion_block.*',
	'editor.item:accordion_block.translations.*',
	'editor.item:accordion_block.accordion.single_accordion_id.*',
	'editor.item:accordion_block.accordion.single_accordion_id.translations.*',
].join(',');

export const PAGE_SLUG_TRANSLATION_FIELDS = 'translations.slug,translations.languages_code';

export function findTranslationSlug(
	translations: unknown,
	lang: 'it' | 'en' = 'en'
): string | undefined {
	if (!Array.isArray(translations)) return undefined;
	const code = lang === 'en' ? 'en-US' : 'it-IT';
	const row = translations.find(
		(entry: any) => entry?.languages_code === code || entry?.languages_code?.code === code
	);
	return row?.slug || undefined;
}
