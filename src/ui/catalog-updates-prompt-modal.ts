import { type App, Modal, setIcon } from 'obsidian';
import { getCatalogEntries, getThemeCatalogEntries } from '../services/catalog-data';
import type { PluginUpdateInfo, ThemeUpdateInfo } from '../types';
import { renderLoadingOverlay } from './loading-indicator';

type CatalogUpdatesKind = 'plugin' | 'theme';

const CATALOG_UPDATES_COPY: Record<
	CatalogUpdatesKind,
	{
		multiLead: string;
		hintMulti: string;
		hintSingle: string;
	}
> = {
	plugin: {
		multiLead: 'These catalog plugins have newer versions available:',
		hintMulti:
			'Choose not now to update each plugin individually from its card below. While signed in, catalog plugins also update automatically the next time you open Obsidian.',
		hintSingle:
			'Choose not now to update from its card below when you are ready. While signed in, catalog plugins also update automatically the next time you open Obsidian.',
	},
	theme: {
		multiLead: 'These catalog themes have newer versions available:',
		hintMulti:
			'Choose not now to update each theme individually from its card below. While signed in, catalog themes also update automatically the next time you open Obsidian.',
		hintSingle:
			'Choose not now to update from its card below when you are ready. While signed in, catalog themes also update automatically the next time you open Obsidian.',
	},
};

export function resolvePendingPluginUpdateNames(
	updates: PluginUpdateInfo[],
): string[] {
	const catalog = getCatalogEntries();
	return updates
		.filter((update) => update.updateAvailable)
		.map(
			(update) =>
				catalog.find((entry) => entry.id === update.pluginId)?.name ??
				update.pluginId,
		);
}

export function resolvePendingThemeUpdateNames(
	updates: ThemeUpdateInfo[],
): string[] {
	const catalog = getThemeCatalogEntries();
	return updates
		.filter((update) => update.updateAvailable)
		.map(
			(update) =>
				catalog.find((entry) => entry.id === update.themeId)?.name ??
				update.themeName,
		);
}

/**
 * Shows a confirmation modal when catalog plugins have pending updates.
 * Returns true if the modal was opened.
 */
export function promptCatalogPluginUpdatesIfNeeded(
	app: App,
	updates: PluginUpdateInfo[],
	handlers: {
		onUpdateAll: () => Promise<void>;
		onDecline?: () => void;
	},
): boolean {
	const names = resolvePendingPluginUpdateNames(updates);
	if (names.length === 0) {
		return false;
	}
	new CatalogUpdatesPromptModal(
		app,
		'plugin',
		names,
		handlers.onUpdateAll,
		handlers.onDecline,
	).open();
	return true;
}

/**
 * Shows a confirmation modal when catalog themes have pending updates.
 * Returns true if the modal was opened.
 */
export function promptCatalogThemeUpdatesIfNeeded(
	app: App,
	updates: ThemeUpdateInfo[],
	handlers: {
		onUpdateAll: () => Promise<void>;
		onDecline?: () => void;
	},
): boolean {
	const names = resolvePendingThemeUpdateNames(updates);
	if (names.length === 0) {
		return false;
	}
	new CatalogUpdatesPromptModal(
		app,
		'theme',
		names,
		handlers.onUpdateAll,
		handlers.onDecline,
	).open();
	return true;
}

export class CatalogUpdatesPromptModal extends Modal {
	private updating = false;

	constructor(
		app: App,
		private kind: CatalogUpdatesKind,
		private itemNames: string[],
		private onUpdateAll: () => Promise<void>,
		private onDecline?: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		const count = this.itemNames.length;
		const multiple = count > 1;
		const copy = CATALOG_UPDATES_COPY[this.kind];

		this.titleEl.setText('Updates available');
		this.modalEl.addClass('santi-enable-prompt-modal');
		this.contentEl.empty();
		this.contentEl.addClass('santi-enable-prompt-content');

		const iconWrap = this.contentEl.createDiv({
			cls: 'santi-enable-prompt-icon',
		});
		setIcon(iconWrap.createSpan({ attr: { 'aria-hidden': 'true' } }), 'download');

		if (multiple) {
			this.contentEl.createEl('p', {
				cls: 'santi-enable-prompt-lead',
				text: copy.multiLead,
			});
			const list = this.contentEl.createEl('ul', {
				cls: 'santi-updates-prompt-list',
			});
			for (const name of this.itemNames) {
				list.createEl('li', { text: name });
			}
		} else {
			this.contentEl.createEl('p', {
				cls: 'santi-enable-prompt-lead',
				text: `${this.itemNames[0]} has a newer version available.`,
			});
		}

		this.contentEl.createEl('p', {
			cls: 'santi-enable-prompt-question',
			text: multiple ? 'Update all now?' : 'Update now?',
		});

		this.contentEl.createEl('p', {
			cls: 'santi-enable-prompt-hint',
			text: multiple ? copy.hintMulti : copy.hintSingle,
		});

		const actions = this.contentEl.createDiv({
			cls: 'santi-enable-prompt-actions',
		});

		const notNowBtn = actions.createEl('button', { text: 'Not now' });
		notNowBtn.setAttribute('type', 'button');
		notNowBtn.addEventListener('click', () => {
			this.onDecline?.();
			this.close();
		});

		const updateBtn = actions.createEl('button', {
			cls: 'mod-cta',
			text: multiple ? 'Update all' : 'Update',
		});
		updateBtn.setAttribute('type', 'button');
		updateBtn.addEventListener('click', () => {
			void this.runUpdateAll(updateBtn, actions, notNowBtn);
		});
	}

	onClose(): void {
		this.modalEl.removeClass('santi-enable-prompt-modal');
		this.contentEl.empty();
	}

	private setUpdating(updating: boolean): void {
		this.updating = updating;
		this.contentEl
			.querySelector('.santi-tools-loading-overlay')
			?.remove();
		if (!updating) {
			return;
		}
		renderLoadingOverlay(this.contentEl, 'Updating…');
	}

	private async runUpdateAll(
		updateBtn: HTMLButtonElement,
		actions: HTMLElement,
		notNowBtn: HTMLButtonElement,
	): Promise<void> {
		if (this.updating) {
			return;
		}
		this.setUpdating(true);
		updateBtn.disabled = true;
		notNowBtn.disabled = true;
		try {
			await this.onUpdateAll();
			this.close();
		} catch {
			this.setUpdating(false);
			updateBtn.disabled = false;
			notNowBtn.disabled = false;
		}
	}
}
