import { Notice } from 'obsidian';
import type SantiObsidianToolsPlugin from '../main';
import { promptCatalogPluginUpdatesIfNeeded } from '../ui/catalog-updates-prompt-modal';
import { openSantiToolsModal } from '../ui/tools-modal';

export async function runCheckPluginUpdatesFlow(
	plugin: SantiObsidianToolsPlugin,
): Promise<void> {
	await plugin.syncPlatformAccess();
	const updates = await plugin.manager.checkUpdates();

	const prompted = promptCatalogPluginUpdatesIfNeeded(plugin.app, updates, {
		onUpdateAll: async () => {
			await plugin.manager.updateAllWithNotices();
			openSantiToolsModal(plugin);
		},
		onDecline: () => {
			new Notice(
				'Update plugins individually from each card when you are ready.',
				5000,
			);
			openSantiToolsModal(plugin);
		},
	});

	if (!prompted) {
		new Notice('All catalog plugins are up to date.');
		openSantiToolsModal(plugin);
	}
}
