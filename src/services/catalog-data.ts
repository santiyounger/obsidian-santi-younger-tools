import type { PluginCatalogEntry, PluginDisplayById } from '../types';
import bundledCatalog from '../data/catalog/plugins.json';
import bundledDisplay from '../data/catalog/plugin-display.json';

export function getCatalogEntries(): PluginCatalogEntry[] {
	return bundledCatalog as PluginCatalogEntry[];
}

export function getPluginDisplayOverrides(): PluginDisplayById {
	return bundledDisplay;
}

export function isComingSoonCatalogPlugin(
	display: PluginDisplayById,
	pluginId: string,
): boolean {
	return display[pluginId]?.comingSoon === true;
}
