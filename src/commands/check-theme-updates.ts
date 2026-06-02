import { Notice } from 'obsidian';
import type SantiObsidianToolsPlugin from '../main';
import { promptCatalogThemeUpdatesIfNeeded } from '../ui/catalog-updates-prompt-modal';
import { openSantiToolsModal } from '../ui/tools-modal';

export async function runCheckThemeUpdatesFlow(
	plugin: SantiObsidianToolsPlugin,
): Promise<void> {
	await plugin.syncPlatformAccess();
	const updates = await plugin.themeManager.checkUpdates();

	const prompted = promptCatalogThemeUpdatesIfNeeded(plugin.app, updates, {
		onUpdateAll: async () => {
			await plugin.themeManager.updateAllWithNotices();
			openSantiToolsModal(plugin, { tab: 'themes' });
		},
		onDecline: () => {
			new Notice(
				'Update themes individually from each card when you are ready.',
				5000,
			);
			openSantiToolsModal(plugin, { tab: 'themes' });
		},
	});

	if (!prompted) {
		new Notice('All catalog themes are up to date.');
		openSantiToolsModal(plugin, { tab: 'themes' });
	}
}
