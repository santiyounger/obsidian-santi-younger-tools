import { PluginSettingTab, Setting } from 'obsidian';
import { openSantiToolsModal } from './tools-modal';
import type SantiObsidianToolsPlugin from '../main';

/**
 * Settings entry that links to the Manage tools modal.
 *
 * Never close settings or open the modal from display(): Obsidian reopens the
 * last viewed tab when the settings button is clicked, so an automatic redirect
 * would hijack the settings button until reload.
 */
export class SantiToolsSettingTab extends PluginSettingTab {
	private readonly toolsPlugin: SantiObsidianToolsPlugin;

	constructor(plugin: SantiObsidianToolsPlugin) {
		super(plugin.app, plugin);
		this.toolsPlugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Manage tools')
			.setDesc('Everything is managed from the tools window.')
			.addButton((button) =>
				button
					.setButtonText('Open')
					.setCta()
					.onClick(() => {
						this.closeSettings();
						openSantiToolsModal(this.toolsPlugin);
					}),
			);
	}

	private closeSettings(): void {
		const appWithSetting = this.app as unknown as {
			setting?: { close: () => void };
		};
		appWithSetting.setting?.close();
	}
}
