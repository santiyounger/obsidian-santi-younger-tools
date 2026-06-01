import type {
	CatalogBundle,
	PluginCatalogEntry,
	ThemeCatalogEntry,
} from '../types';
import bundledCatalog from '../data/catalog/catalog.json';

const catalog = bundledCatalog as CatalogBundle;

export function getCatalogEntries(): PluginCatalogEntry[] {
	return catalog.plugins;
}

export function getThemeCatalogEntries(): ThemeCatalogEntry[] {
	return catalog.themes;
}

export function isComingSoonCatalogPlugin(entry: PluginCatalogEntry): boolean {
	return entry.comingSoon === true;
}

export function getCatalogDescription(entry: {
	description?: string;
}): string {
	return entry.description?.trim() ?? '';
}
