import { Notice } from 'obsidian';
import { runCheckPluginUpdatesFlow } from './check-plugin-updates';
import { runCheckThemeUpdatesFlow } from './check-theme-updates';
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
				void runCheckPluginUpdatesFlow(plugin).catch((error) => {
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
				void runCheckThemeUpdatesFlow(plugin).catch((error) => {
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
