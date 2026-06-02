import type { App } from 'obsidian';
import { getRoyalLuxThemeStatus } from './theme-installer';
import type { PluginManager } from './plugin-manager';
import type { PlatformService } from './platform';

export interface InstallVisibilityFlags {
	/** Account has entitlement to at least one catalog plugin (not install state). */
	hasCatalogPluginAccess: boolean;
	/** Account has entitlement to at least one catalog theme (not install state). */
	hasCatalogThemeAccess: boolean;
	/** At least one catalog plugin is installed in this vault. */
	hasInstalledCatalogPlugins: boolean;
	/** At least one catalog theme is installed in this vault. */
	hasInstalledCatalogThemes: boolean;
}

export async function getInstallVisibilityFlags(
	app: App,
	manager: PluginManager,
	platform: PlatformService,
): Promise<InstallVisibilityFlags> {
	const installed = await manager.listInstalled();
	const themeStatus = await getRoyalLuxThemeStatus(app);
	return {
		hasCatalogPluginAccess: platform.hasAnyPluginCatalogAccess(),
		hasCatalogThemeAccess: platform.hasAnyThemeCatalogAccess(),
		hasInstalledCatalogPlugins: installed.length > 0,
		hasInstalledCatalogThemes: Boolean(themeStatus.installedVersion),
	};
}
