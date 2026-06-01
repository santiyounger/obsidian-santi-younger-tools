import { App, ButtonComponent, Modal, Notice, Setting } from 'obsidian';
import type SantiObsidianToolsPlugin from '../main';
import type { RoyalLuxTestimonialAnswers } from '../types';

export class RoyalLuxUnlockModal extends Modal {
	private busy = false;
	private statusMessage = '';
	private statusIsError = false;
	private submitButton: ButtonComponent | undefined;
	private readonly values: RoyalLuxTestimonialAnswers = {
		purchasedOrUsing: '',
		workedWell: '',
		improve: '',
		publicQuote: '',
		creditAs: '',
	};

	constructor(
		app: App,
		private readonly plugin: SantiObsidianToolsPlugin,
		private readonly onUnlocked: () => void | Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText('Unlock royal lux');
		this.modalEl.addClass('santi-royal-lux-unlock-modal');
		contentEl.empty();
		contentEl.addClass('santi-royal-lux-unlock');

		contentEl.createEl('p', {
			cls: 'santi-royal-lux-unlock-intro',
			text: 'Share a quick testimonial after your purchase. Install unlocks as soon as you submit.',
		});

		this.addField(
			contentEl,
			'purchasedOrUsing',
			'What did you purchase or what are you using?',
			true,
		);
		this.addField(
			contentEl,
			'workedWell',
			'What has worked well for you so far?',
			true,
		);
		this.addField(contentEl, 'improve', 'What could improve?', true);
		this.addField(contentEl, 'publicQuote', 'Public quote', false);
		this.addField(contentEl, 'creditAs', 'Credit as', false, 'Name or Anonymous');

		const footer = contentEl.createDiv({ cls: 'santi-royal-lux-unlock-footer' });
		new Setting(footer).addButton((button) => {
			button.setButtonText('Cancel').onClick(() => this.close());
		});
		new Setting(footer).addButton((button) => {
			this.submitButton = button;
			button
				.setButtonText('Submit and unlock')
				.setCta()
				.onClick(() => {
					void this.submit();
				});
			this.syncSubmitButton();
		});

		this.renderStatus();
	}

	onClose(): void {
		this.modalEl.removeClass('santi-royal-lux-unlock-modal');
		this.contentEl.empty();
	}

	private addField(
		parent: HTMLElement,
		key: keyof RoyalLuxTestimonialAnswers,
		label: string,
		required: boolean,
		placeholder?: string,
	): void {
		const setting = new Setting(parent)
			.setName(label)
			.setDesc(required ? 'Required' : 'Optional')
			.addTextArea((area) => {
				area.inputEl.rows = 3;
				if (placeholder) {
					area.setPlaceholder(placeholder);
				}
				area.onChange((value) => {
					this.values[key] = value;
				});
			});
		setting.settingEl.addClass('santi-royal-lux-unlock-field');
	}

	private renderStatus(): void {
		const existing = this.contentEl.querySelector('.santi-royal-lux-unlock-status');
		existing?.remove();
		if (!this.statusMessage) {
			return;
		}
		const footer = this.contentEl.querySelector('.santi-royal-lux-unlock-footer');
		const status = this.contentEl.createDiv({
			cls: `santi-royal-lux-unlock-status${this.statusIsError ? ' is-error' : ''}`,
			text: this.statusMessage,
		});
		if (footer) {
			this.contentEl.insertBefore(status, footer);
		}
	}

	private syncSubmitButton(): void {
		if (!this.submitButton) {
			return;
		}
		const { buttonEl } = this.submitButton;
		if (this.busy) {
			this.submitButton.setButtonText('Submitting…');
			this.submitButton.setIcon('loader-circle');
			buttonEl.addClass('santi-tools-button-loading');
			this.submitButton.setDisabled(true);
			return;
		}
		buttonEl.removeClass('santi-tools-button-loading');
		this.submitButton.setButtonText('Submit and unlock');
		this.submitButton.setDisabled(false);
	}

	private async submit(): Promise<void> {
		if (this.busy) {
			return;
		}
		this.busy = true;
		this.statusMessage = '';
		this.statusIsError = false;
		this.syncSubmitButton();
		this.renderStatus();

		try {
			const result =
				await this.plugin.platform.submitRoyalLuxTestimonial(this.values);
			if (result.success) {
				new Notice(result.message, 5000);
				this.close();
				await this.onUnlocked();
				return;
			}
			this.statusMessage = result.message;
			this.statusIsError = true;
			new Notice(result.message, 8000);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			this.statusMessage = message;
			this.statusIsError = true;
			new Notice(message, 8000);
		} finally {
			this.busy = false;
			this.syncSubmitButton();
			this.renderStatus();
		}
	}
}
