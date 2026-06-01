import { normalizePath, type App } from 'obsidian';

export function getPluginsPath(app: App): string {
	return normalizePath(`${app.vault.configDir}/plugins`);
}

export function getCommunityPluginsPath(app: App): string {
	return normalizePath(`${app.vault.configDir}/community-plugins.json`);
}

export function getThemesPath(app: App): string {
	return normalizePath(`${app.vault.configDir}/themes`);
}

export function getAppearancePath(app: App): string {
	return normalizePath(`${app.vault.configDir}/appearance.json`);
}
