import { type App, Modal, Notice, setIcon } from 'obsidian';
import { enableInstalledCommunityPlugin } from '../services/plugin-runtime';
import { renderLoadingOverlay } from './loading-indicator';

export class InstallEnablePromptModal extends Modal {
	private enabling = false;

	constructor(
		app: App,
		private pluginName: string,
		private obsidianPluginId: string,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText('Enable plugin?');
		this.modalEl.addClass('santi-enable-prompt-modal');
		this.contentEl.empty();
		this.contentEl.addClass('santi-enable-prompt-content');

		const iconWrap = this.contentEl.createDiv({
			cls: 'santi-enable-prompt-icon',
		});
		setIcon(iconWrap.createSpan({ attr: { 'aria-hidden': 'true' } }), 'power');

		this.contentEl.createEl('p', {
			cls: 'santi-enable-prompt-lead',
			text: `${this.pluginName} is installed in this vault.`,
		});
		this.contentEl.createEl('p', {
			cls: 'santi-enable-prompt-question',
			text: 'Do you also want to enable it now?',
		});
		this.contentEl.createEl('p', {
			cls: 'santi-enable-prompt-hint',
			text: 'It should appear under settings → community plugins. You can turn it on later from there.',
		});

		const actions = this.contentEl.createDiv({
			cls: 'santi-enable-prompt-actions',
		});

		const notNowBtn = actions.createEl('button', { text: 'Not now' });
		notNowBtn.setAttribute('type', 'button');
		notNowBtn.addEventListener('click', () => {
			this.close();
		});

		const enableBtn = actions.createEl('button', {
			cls: 'mod-cta',
			text: 'Enable plugin',
		});
		enableBtn.setAttribute('type', 'button');
		enableBtn.addEventListener('click', () => {
			void this.enablePlugin(enableBtn, actions);
		});
	}

	onClose(): void {
		this.modalEl.removeClass('santi-enable-prompt-modal');
		this.contentEl.empty();
	}

	private setEnablingState(enabling: boolean): void {
		this.enabling = enabling;
		this.contentEl
			.querySelector('.santi-tools-loading-overlay')
			?.remove();
		if (!enabling) {
			return;
		}
		renderLoadingOverlay(this.contentEl, 'Enabling…');
	}

	private async enablePlugin(
		enableBtn: HTMLButtonElement,
		actions: HTMLElement,
	): Promise<void> {
		if (this.enabling) {
			return;
		}
		this.setEnablingState(true);
		enableBtn.disabled = true;
		actions.querySelectorAll('button').forEach((button) => {
			button.disabled = true;
		});
		try {
			const result = await enableInstalledCommunityPlugin(
				this.app,
				this.obsidianPluginId,
			);

			if (result.enabled) {
				new Notice(
					`${this.pluginName} is enabled. Check settings → community plugins if you do not see it yet.`,
				);
				this.close();
				return;
			}

			if (result.requiresReload) {
				new Notice(
					`${this.pluginName} is saved as enabled. Reload Obsidian to finish turning it on.`,
				);
				this.setEnablingState(false);
				this.showReloadAction(actions);
				return;
			}

			throw new Error('Obsidian did not enable the plugin.');
		} catch (error) {
			const detail =
				error instanceof Error ? error.message : String(error);
			new Notice(
				`Could not enable ${this.pluginName}: ${detail}`,
				8000,
			);
			this.setEnablingState(false);
			enableBtn.disabled = false;
			actions.querySelectorAll('button').forEach((button) => {
				button.disabled = false;
			});
		}
	}

	private showReloadAction(actions: HTMLElement): void {
		actions.empty();
		const reloadBtn = actions.createEl('button', {
			cls: 'mod-cta',
			text: 'Reload Obsidian',
		});
		reloadBtn.setAttribute('type', 'button');
		reloadBtn.addEventListener('click', () => {
			window.location.reload();
		});
		const laterBtn = actions.createEl('button', { text: 'Later' });
		laterBtn.setAttribute('type', 'button');
		laterBtn.addEventListener('click', () => {
			this.close();
		});
	}
}
