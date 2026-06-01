export const APP_DISPLAY_NAME = 'Santi Younger Tools';

export const PLUGIN_PREVIEW_IMAGES: Partial<Record<string, string>> = {
	backtrack:
		'https://santiyounger.b-cdn.net/sales-pages/backtrack-26-04-30_17-59_01.png',
	'branch-writing':
		'https://santiyounger.b-cdn.net/SY-platform/2026-02-11-20-05-25.png?width=640&format=webp&quality=78',
	'nested-notes':
		'https://santiyounger.b-cdn.net/SY-platform/2026-04-02-22-19-12.png?width=640&format=webp&quality=78',
};

export const ROYAL_LUX_PREVIEW_IMAGE_URL =
	'https://santiyounger.b-cdn.net/sales-pages/2026-04-30%2009-20-28.png';

export const FALLBACK_PLUGIN_DESCRIPTIONS: Record<string, string> = {
	'branch-writing':
		'Write your ideas in pieces and organize them in a tree. Edit side-by-side with keyboard shortcuts.',
	backtrack:
		'Keeps older versions of your notes so you can rewrite freely. Save once and look back anytime.',
	'nested-notes':
		'An improved method to organize notes that does not rely on folders but has all the benefits that folders offer without their downsides.',
};

export const ROYAL_LUX_DESCRIPTION =
	'Dark mode theme with a dark purple style.';

export function getPluginPreviewUrl(pluginId: string): string | undefined {
	return PLUGIN_PREVIEW_IMAGES[pluginId];
}

export function getPluginDescription(
	pluginId: string,
	catalogDescription?: string,
): string {
	return (
		catalogDescription?.trim() ||
		FALLBACK_PLUGIN_DESCRIPTIONS[pluginId] ||
		''
	);
}
