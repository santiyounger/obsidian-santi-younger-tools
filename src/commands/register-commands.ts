import { Notice } from 'obsidian';
import { openSantiToolsModal } from '../ui/tools-modal';
import type SantiObsidianToolsPlugin from '../main';

export function registerCommands(plugin: SantiObsidianToolsPlugin): void {
	plugin.addCommand({
		id: 'open-tools',
		name: 'Manage tools',
		callback: () => {
			openSantiToolsModal(plugin);
		},
	});

	plugin.addCommand({
		id: 'check-plugin-updates',
		name: 'Check for plugin updates',
		checkCallback: (checking) => {
			if (!plugin.hasInstalledCatalogPlugins) {
				return false;
			}
			if (!checking) {
				if (!plugin.data.platformSession) {
					new Notice('Sign in before checking for updates.');
					openSantiToolsModal(plugin);
					return true;
				}
				void plugin.syncPlatformAccess().then(async () => {
					const updates = await plugin.manager.checkUpdates();
					const count = updates.filter((u) => u.updateAvailable).length;
					new Notice(
						count > 0
							? `${count} plugin update(s) available. Run Manage tools to install.`
							: 'All catalog plugins are up to date.',
					);
					openSantiToolsModal(plugin);
				}).catch((error) => {
					const message =
						error instanceof Error ? error.message : String(error);
					new Notice(message, 8000);
					openSantiToolsModal(plugin);
				});
			}
			return true;
		},
	});

	plugin.addCommand({
		id: 'check-theme-updates',
		name: 'Check for theme updates',
		checkCallback: (checking) => {
			if (!plugin.hasInstalledCatalogThemes) {
				return false;
			}
			if (!checking) {
				if (!plugin.data.platformSession) {
					new Notice('Sign in before checking for updates.');
					openSantiToolsModal(plugin, { tab: 'themes' });
					return true;
				}
				void plugin.syncPlatformAccess().then(async () => {
					const updates = await plugin.themeManager.checkUpdates();
					const count = updates.filter((u) => u.updateAvailable).length;
					new Notice(
						count > 0
							? `${count} theme update(s) available. Run Manage tools to install.`
							: 'All catalog themes are up to date.',
					);
					openSantiToolsModal(plugin, { tab: 'themes' });
				}).catch((error) => {
					const message =
						error instanceof Error ? error.message : String(error);
					new Notice(message, 8000);
					openSantiToolsModal(plugin, { tab: 'themes' });
				});
			}
			return true;
		},
	});
}
