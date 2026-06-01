import type { App } from 'obsidian';
import { getRoyalLuxThemeStatus } from './theme-installer';
import type { PluginManager } from './plugin-manager';

export interface InstallVisibilityFlags {
	hasInstalledCatalogPlugins: boolean;
	hasInstalledCatalogThemes: boolean;
}

export async function getInstallVisibilityFlags(
	app: App,
	manager: PluginManager,
): Promise<InstallVisibilityFlags> {
	const installed = await manager.listInstalled();
	const themeStatus = await getRoyalLuxThemeStatus(app);
	return {
		hasInstalledCatalogPlugins: installed.length > 0,
		hasInstalledCatalogThemes: Boolean(themeStatus.installedVersion),
	};
}
