import {
	ButtonComponent,
	Menu,
	Modal,
	Notice,
	Setting,
	setIcon,
} from 'obsidian';
import {
	APP_DISPLAY_NAME,
	SANTI_CONTACT_URL,
	SANTI_TESTIMONIAL_URL,
} from '../constants';
import { ROYAL_LUX_ENTITLEMENT_ID } from '../common/entitlements';
import type SantiObsidianToolsPlugin from '../main';
import {
	getCatalogDescription,
	getCatalogEntries,
	getThemeCatalogEntries,
	isComingSoonCatalogPlugin,
} from '../services/catalog-data';
import { isCommunityPluginEnabled } from '../services/plugin-runtime';
import {
	getRoyalLuxThemeStatus,
	isCssThemeActive,
	removeRoyalLuxTheme,
} from '../services/theme-installer';
import type {
	InstallResult,
	PluginCatalogEntry,
	PluginUpdateInfo,
	ThemeCatalogEntry,
	ThemeInstallResult,
	ThemeStatusInfo,
	ThemeUpdateInfo,
} from '../types';
import { createEmailPrivacyRow } from './email-privacy-row';
import {
	FIELD_PRIVACY_CODE_LABELS,
	FIELD_PRIVACY_EMAIL_LABELS,
	wireEmailPrivacyExtraButton,
} from './email-privacy-toggle';
import {
	promptCatalogPluginUpdatesIfNeeded,
	promptCatalogThemeUpdatesIfNeeded,
} from './catalog-updates-prompt-modal';
import {
	InstallEnablePromptModal,
	ThemeInstallEnablePromptModal,
} from './install-enable-prompt-modal';
import { renderLoadingIndicator, renderLoadingOverlay } from './loading-indicator';

type ToolsTab = 'plugins' | 'themes' | 'account';

export interface OpenSantiToolsOptions {
	pluginId?: string;
	tab?: ToolsTab;
}

export class SantiToolsModal extends Modal {
	private activeTab: ToolsTab = 'account';
	private pendingPluginId?: string;
	private focusCardEl?: HTMLElement;
	private panelLoading = false;
	private busyKey: string | null = null;
	private emailInput = '';
	private codeInput = '';
	private hasSentLoginCode = false;
	private updates: PluginUpdateInfo[] = [];
	private themeUpdates: ThemeUpdateInfo[] = [];
	private signInEmailHidden = false;
	private signInCodeHidden = false;
	private accountWelcomeEmailHidden = false;
	private accountEmailLineHidden = false;

	constructor(
		private plugin: SantiObsidianToolsPlugin,
		options?: OpenSantiToolsOptions,
	) {
		super(plugin.app);
		if (options?.tab) {
			this.activeTab = options.tab;
		}
		if (options?.pluginId) {
			this.pendingPluginId = options.pluginId;
			this.activeTab = 'plugins';
		}
	}

	private getModalContainerEl(): HTMLElement {
		return this.modalEl.closest('.modal-container') ?? this.modalEl;
	}

	onOpen(): void {
		this.titleEl.setText(APP_DISPLAY_NAME);
		this.modalEl.addClass('santi-tools-modal');
		this.getModalContainerEl().addClass('santi-tools-modal-container');
		this.contentEl.empty();
		if (!this.pendingPluginId) {
			this.activeTab = this.isLoggedIn()
				? this.getDefaultCatalogTab()
				: 'account';
		} else if (!this.isLoggedIn()) {
			this.activeTab = 'account';
		}
		void this.refreshAndRender();
	}

	onClose(): void {
		this.getModalContainerEl().removeClass('santi-tools-modal-container');
		this.modalEl.removeClass('santi-tools-modal');
		this.contentEl.empty();
		void this.plugin.refreshInstallCommandVisibility();
	}

	private isLoggedIn(): boolean {
		return Boolean(this.plugin.data.platformSession);
	}

	private getDefaultCatalogTab(): ToolsTab {
		if (this.plugin.platform.hasAnyPluginCatalogAccess()) {
			return 'plugins';
		}
		if (getThemeCatalogEntries().length > 0) {
			return 'themes';
		}
		return 'account';
	}

	private async refreshUpdates(): Promise<void> {
		try {
			if (!this.isLoggedIn()) {
				this.updates = [];
				this.themeUpdates = [];
				return;
			}
			const installed = await this.plugin.manager.listInstalled();
			if (installed.length > 0) {
				this.updates = await this.syncAccessAndCheckPluginUpdates();
			} else {
				this.updates = this.plugin.data.pluginUpdates ?? [];
			}
		} catch {
			this.updates = this.plugin.data.pluginUpdates ?? [];
		}
		await this.refreshThemeUpdates();
	}

	private async refreshThemeUpdates(): Promise<void> {
		try {
			if (!this.isLoggedIn()) {
				this.themeUpdates = [];
				return;
			}
			const status = await getRoyalLuxThemeStatus(this.app);
			if (status.installedVersion) {
				this.themeUpdates = await this.syncAccessAndCheckThemeUpdates();
			} else {
				this.themeUpdates = [];
			}
		} catch {
			this.themeUpdates = [];
		}
	}

	private async syncAccessAndCheckPluginUpdates(): Promise<PluginUpdateInfo[]> {
		await this.plugin.syncPlatformAccess();
		return this.plugin.manager.checkUpdates();
	}

	private showPluginUpdatesCheckResult(): void {
		const prompted = promptCatalogPluginUpdatesIfNeeded(
			this.app,
			this.updates,
			{
				onUpdateAll: async () => {
					await this.plugin.manager.updateAllWithNotices();
					await this.refreshUpdates();
					await this.render();
				},
				onDecline: () => {
					this.showNotice(
						'Update plugins individually from each card when you are ready.',
					);
				},
			},
		);
		if (!prompted) {
			this.showNotice('All catalog plugins are up to date.');
		}
	}

	private async syncAccessAndCheckThemeUpdates(): Promise<ThemeUpdateInfo[]> {
		await this.plugin.syncPlatformAccess();
		return this.plugin.themeManager.checkUpdates();
	}

	private showThemeUpdatesCheckResult(): void {
		const prompted = promptCatalogThemeUpdatesIfNeeded(
			this.app,
			this.themeUpdates,
			{
				onUpdateAll: async () => {
					await this.plugin.themeManager.updateAllWithNotices();
					await this.refreshThemeUpdates();
					await this.render();
				},
				onDecline: () => {
					this.showNotice(
						'Update themes individually from each card when you are ready.',
					);
				},
			},
		);
		if (!prompted) {
			this.showNotice('All catalog themes are up to date.');
		}
	}

	private async refreshAndRender(): Promise<void> {
		const showLoader = this.isLoggedIn();
		if (showLoader) {
			this.panelLoading = true;
			await this.render();
		}
		try {
			await this.refreshUpdates();
			if (!this.isLoggedIn()) {
				this.activeTab = 'account';
			}
		} finally {
			this.panelLoading = false;
			await this.render();
		}
	}

	private showNotice(message: string, isError = false): void {
		if (!message) {
			return;
		}
		new Notice(message, isError ? 8000 : 5000);
	}

	private async handlePluginInstallResult(
		entry: PluginCatalogEntry,
		result: InstallResult,
	): Promise<void> {
		if (!result.success) {
			this.showNotice(result.message, true);
			return;
		}

		this.pendingPluginId = undefined;
		this.showNotice(result.message);
		await this.refreshUpdates();

		const enabled = await isCommunityPluginEnabled(
			this.app,
			result.pluginId,
		);
		if (enabled) {
			return;
		}

		new InstallEnablePromptModal(
			this.app,
			entry.name,
			result.pluginId,
		).open();
	}

	private async handleThemeInstallResult(
		theme: ThemeCatalogEntry,
		result: ThemeInstallResult,
	): Promise<void> {
		if (!result.success) {
			this.showNotice(result.message, true);
			return;
		}

		this.showNotice(result.message);
		await this.refreshThemeUpdates();
		void this.plugin.refreshInstallCommandVisibility();

		if (await isCssThemeActive(this.app, result.themeName)) {
			return;
		}

		new ThemeInstallEnablePromptModal(
			this.app,
			theme.name,
			result.themeName,
		).open();
	}

	private scrollToFocusedCard(): void {
		if (!this.focusCardEl) {
			return;
		}
		window.requestAnimationFrame(() => {
			this.focusCardEl?.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
			});
		});
	}

	private isBusy(key?: string): boolean {
		if (key === undefined) {
			return this.busyKey !== null;
		}
		return this.busyKey === key;
	}

	private async runBusy(
		key: string,
		task: () => Promise<void>,
	): Promise<void> {
		if (this.busyKey) {
			return;
		}
		this.busyKey = key;
		await this.render();
		try {
			await task();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			this.showNotice(message, true);
		} finally {
			this.busyKey = null;
			await this.render();
			void this.plugin.refreshInstallCommandVisibility();
		}
	}

	private createActionButton(
		parent: HTMLElement,
		options: {
			idleText: string;
			cls?: string;
			onClick: () => void | Promise<void>;
		},
	): HTMLButtonElement {
		const btn = parent.createEl('button', {
			cls: ['santi-tools-action-btn', options.cls ?? ''].filter(Boolean).join(' '),
			text: options.idleText,
		});
		btn.setAttribute('type', 'button');
		btn.disabled = this.isBusy();
		btn.addEventListener('click', () => {
			void options.onClick();
		});
		return btn;
	}

	private maybeRenderPanelBusyOverlay(
		parent: HTMLElement,
		text: string | null,
	): void {
		if (!text) {
			return;
		}
		renderLoadingOverlay(parent, text);
	}

	private renderPanelLoading(parent: HTMLElement): void {
		parent.addClass('santi-tools-loading-panel');
		const center = parent.createDiv({ cls: 'santi-tools-loading' });
		renderLoadingIndicator(center, 'Loading…');
	}

	private async render(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('santi-tools');

		if (this.panelLoading) {
			this.renderPanelLoading(contentEl);
			return;
		}

		if (!this.isLoggedIn()) {
			const signInPanel = contentEl.createDiv({
				cls: 'santi-tools-panel santi-tools-panel--form santi-tools-panel--sign-in',
			});
			this.renderSignInPanel(signInPanel);
			return;
		}

		const showPluginsTab = this.plugin.platform.hasAnyPluginCatalogAccess();
		const showThemesTab = getThemeCatalogEntries().length > 0;
		if (this.activeTab === 'themes' && !showThemesTab) {
			this.activeTab = showPluginsTab ? 'plugins' : 'account';
		}
		if (this.activeTab === 'plugins' && !showPluginsTab) {
			this.activeTab = showThemesTab ? 'themes' : 'account';
		}

		this.renderTabs(contentEl, showPluginsTab, showThemesTab);

		const panelClass =
			this.activeTab === 'account'
				? 'santi-tools-panel santi-tools-panel--form'
				: 'santi-tools-panel santi-tools-panel--catalog';
		const panel = contentEl.createDiv({ cls: panelClass });
		if (this.activeTab === 'plugins') {
			await this.renderPluginsPanel(panel);
			this.scrollToFocusedCard();
		} else if (this.activeTab === 'themes') {
			await this.renderThemesPanel(panel);
		} else {
			await this.renderAccountPanel(panel);
		}
	}

	private renderTabs(
		parent: HTMLElement,
		showPluginsTab: boolean,
		showThemesTab: boolean,
	): void {
		const tabs = parent.createDiv({
			cls: 'horizontal-tab-header santi-tools-tab-header',
			attr: { role: 'tablist' },
		});
		if (showPluginsTab) {
			this.renderTabButton(tabs, 'plugins', 'Plugins');
		}
		if (showThemesTab) {
			this.renderTabButton(tabs, 'themes', 'Themes');
		}
		this.renderTabButton(tabs, 'account', 'My account');
	}

	private renderTabButton(
		parent: HTMLElement,
		tab: ToolsTab,
		label: string,
	): void {
		const isActive = this.activeTab === tab;
		const item = parent.createDiv({
			cls: `horizontal-tab-nav-item${isActive ? ' is-active' : ''}`,
			text: label,
			attr: {
				role: 'tab',
				'aria-selected': isActive ? 'true' : 'false',
				tabindex: isActive ? '0' : '-1',
			},
		});
		item.addEventListener('click', () => {
			this.activeTab = tab;
			void this.render();
		});
		item.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' && event.key !== ' ') {
				return;
			}
			event.preventDefault();
			this.activeTab = tab;
			void this.render();
		});
	}

	private async renderPluginsPanel(parent: HTMLElement): Promise<void> {
		const pendingUpdates = this.updates.filter((u) => u.updateAvailable);
		const toolbar = parent.createDiv({ cls: 'santi-tools-toolbar' });
		const pendingEntry = this.pendingPluginId
			? getCatalogEntries().find((entry) => entry.id === this.pendingPluginId)
			: undefined;

		if (pendingEntry) {
			const hint = parent.createDiv({ cls: 'santi-tools-install-hint' });
			const icon = hint.createSpan({
				cls: 'santi-tools-install-hint-icon',
				attr: { 'aria-hidden': 'true' },
			});
			setIcon(icon, 'download');
			const text = hint.createSpan({ cls: 'santi-tools-install-hint-text' });
			text.setText(`Ready to add ${pendingEntry.name}. Select `);
			text.createEl('strong', { text: 'Install plugin' });
			text.appendText(' on the card below.');
		}

		if (pendingUpdates.length > 0) {
			this.createActionButton(toolbar, {
				cls: 'mod-cta',
				idleText: 'Update all',
				onClick: () =>
					this.runBusy('update-all', async () => {
						await this.plugin.manager.updateAllWithNotices();
						await this.refreshUpdates();
					}),
			});
		}

		this.createActionButton(toolbar, {
			idleText: 'Check for updates',
			onClick: () =>
				this.runBusy('check-updates', async () => {
					this.updates = await this.syncAccessAndCheckPluginUpdates();
					this.showPluginUpdatesCheckResult();
				}),
		});

		const grid = parent.createDiv({ cls: 'santi-catalog-grid' });
		const installed = await this.plugin.manager.listInstalled();
		const catalog = getCatalogEntries();
		let visibleCount = 0;
		this.focusCardEl = undefined;

		for (const entry of catalog) {
			if (!this.plugin.manager.shouldShowCatalogEntry(entry)) {
				continue;
			}
			const isComingSoon = isComingSoonCatalogPlugin(entry);
			const installedInfo = installed.find((p) => p.pluginId === entry.id);
			if (isComingSoon && !installedInfo) {
				continue;
			}
			visibleCount++;
			this.renderPluginCard(grid, entry, installed);
		}

		if (visibleCount === 0) {
			parent.createEl('p', {
				cls: 'santi-tools-empty',
				text: 'No plugins in your catalog yet. Refresh access on the my account tab.',
			});
		}

		this.maybeRenderPanelBusyOverlay(
			parent,
			this.isBusy('update-all')
				? 'Updating all…'
				: this.isBusy('check-updates')
					? 'Syncing access and checking for updates…'
					: null,
		);
	}

	private renderPluginCard(
		parent: HTMLElement,
		entry: PluginCatalogEntry,
		installed: Array<{ pluginId: string; installedVersion: string }>,
	): void {
		const installBusyKey = `install-plugin:${entry.id}`;
		const removeBusyKey = `remove-plugin:${entry.id}`;

		const card = parent.createDiv({ cls: 'santi-catalog-card' });
		if (entry.id === this.pendingPluginId) {
			card.addClass('santi-catalog-card--focus');
			this.focusCardEl = card;
		}

		if (entry.previewImageUrl) {
			const preview = card.createDiv({ cls: 'santi-catalog-preview' });
			preview.createEl('img', {
				attr: {
					src: entry.previewImageUrl,
					alt: `${entry.name} preview`,
					loading: 'lazy',
				},
			});
		}

		const body = card.createDiv({ cls: 'santi-catalog-body' });
		body.createEl('h3', { cls: 'santi-catalog-title', text: entry.name });

		const description = getCatalogDescription(entry);
		if (description) {
			body.createEl('p', { cls: 'santi-catalog-desc', text: description });
		}

		const installedInfo = installed.find((p) => p.pluginId === entry.id);
		const update = this.updates.find((u) => u.pluginId === entry.id);
		const isComingSoon = isComingSoonCatalogPlugin(entry);
		const isUpdateAvailable = Boolean(update?.updateAvailable);

		if (installedInfo?.installedVersion) {
			body.createEl('p', {
				cls: 'santi-catalog-meta',
				text: `Version ${installedInfo.installedVersion}`,
			});
		}

		const actions = body.createDiv({ cls: 'santi-catalog-actions' });

		if (installedInfo) {
			if (isUpdateAvailable) {
				this.createActionButton(actions, {
					cls: 'mod-cta',
					idleText: 'Update',
					onClick: () =>
						this.runBusy(installBusyKey, async () => {
							const result = await this.plugin.manager.installPlugin(entry.id);
							await this.handlePluginInstallResult(entry, result);
						}),
				});
			} else {
				const installedLabel = actions.createDiv({
					cls: 'santi-catalog-installed',
				});
				const checkIcon = installedLabel.createSpan({
					attr: { 'aria-hidden': 'true' },
				});
				setIcon(checkIcon, 'check');
				installedLabel.createSpan({ text: 'Installed' });

				const menuBtn = actions.createEl('button', {
					cls: 'clickable-icon',
					attr: { 'aria-label': `Actions for ${entry.name}` },
				});
				setIcon(menuBtn, 'more-vertical');
				menuBtn.addEventListener('click', (event) => {
					this.showPluginActionsMenu(event, entry);
				});
			}
		} else if (isComingSoon) {
			const soonBtn = actions.createEl('button', {
				text: 'Coming soon',
			});
			soonBtn.setAttribute('type', 'button');
			soonBtn.disabled = true;
		} else {
			this.createActionButton(actions, {
				cls: 'mod-cta',
				idleText: 'Install plugin',
				onClick: () =>
					this.runBusy(installBusyKey, async () => {
						const result = await this.plugin.manager.installPlugin(entry.id);
						await this.handlePluginInstallResult(entry, result);
					}),
			});
		}

		const cardBusyText = this.isBusy(installBusyKey)
			? isUpdateAvailable
				? 'Updating…'
				: 'Installing…'
			: this.isBusy(removeBusyKey)
				? 'Removing…'
				: null;
		if (cardBusyText) {
			card.addClass('santi-catalog-card--busy');
			renderLoadingOverlay(card, cardBusyText);
		}
	}

	private showPluginActionsMenu(
		event: MouseEvent,
		entry: PluginCatalogEntry,
	): void {
		const removeBusyKey = `remove-plugin:${entry.id}`;
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle('Check for updates').onClick(() => {
				void this.runBusy('check-updates', async () => {
					this.updates = await this.syncAccessAndCheckPluginUpdates();
					this.showPluginUpdatesCheckResult();
				});
			});
		});
		menu.addItem((item) => {
			item
				.setTitle('Remove')
				.setWarning(true)
				.onClick(() => {
					void this.runBusy(removeBusyKey, async () => {
						await this.plugin.manager.removeCatalogPlugin(entry.id);
						this.showNotice(`${entry.name} removed from this vault.`);
						await this.refreshUpdates();
					});
				});
		});
		menu.showAtMouseEvent(event);
	}

	private async renderThemesPanel(parent: HTMLElement): Promise<void> {
		const pendingUpdates = this.themeUpdates.filter((u) => u.updateAvailable);
		const toolbar = parent.createDiv({ cls: 'santi-tools-toolbar' });

		if (pendingUpdates.length > 0) {
			this.createActionButton(toolbar, {
				cls: 'mod-cta',
				idleText: 'Update all',
				onClick: () =>
					this.runBusy('update-all-themes', async () => {
						await this.plugin.themeManager.updateAllWithNotices();
						await this.refreshThemeUpdates();
					}),
			});
		}

		this.createActionButton(toolbar, {
			idleText: 'Check for updates',
			onClick: () =>
				this.runBusy('check-theme-updates', async () => {
					this.themeUpdates = await this.syncAccessAndCheckThemeUpdates();
					this.showThemeUpdatesCheckResult();
				}),
		});

		const grid = parent.createDiv({ cls: 'santi-catalog-grid' });

		for (const theme of getThemeCatalogEntries()) {
			if (theme.id !== ROYAL_LUX_ENTITLEMENT_ID) {
				continue;
			}
			const status = await getRoyalLuxThemeStatus(this.app);
			await this.renderRoyalLuxThemeCard(grid, theme, status);
		}

		this.maybeRenderPanelBusyOverlay(
			parent,
			this.isBusy('update-all-themes')
				? 'Updating all…'
				: this.isBusy('check-theme-updates')
					? 'Syncing access and checking for updates…'
					: null,
		);
	}

	private async renderRoyalLuxThemeCard(
		parent: HTMLElement,
		theme: ThemeCatalogEntry,
		status: ThemeStatusInfo,
	): Promise<void> {
		const installBusyKey = `install-theme:${theme.id}`;
		const removeBusyKey = `remove-theme:${theme.id}`;

		const themeCard = parent.createDiv({ cls: 'santi-catalog-card' });

		if (theme.previewImageUrl) {
			const preview = themeCard.createDiv({ cls: 'santi-catalog-preview' });
			preview.createEl('img', {
				attr: {
					src: theme.previewImageUrl,
					alt: `${theme.name} preview`,
					loading: 'lazy',
				},
			});
		}

		const body = themeCard.createDiv({ cls: 'santi-catalog-body' });
		body.createEl('h3', { cls: 'santi-catalog-title', text: theme.name });

		const description = getCatalogDescription(theme);
		if (description) {
			body.createEl('p', { cls: 'santi-catalog-desc', text: description });
		}

		const actions = body.createDiv({ cls: 'santi-catalog-actions' });
		const hasAccess = this.plugin.platform.hasThemeAccess(theme.id);
		const update = this.themeUpdates.find((u) => u.themeId === theme.id);
		const isUpdateAvailable = Boolean(update?.updateAvailable);

		if (status.installedVersion) {
			body.createEl('p', {
				cls: 'santi-catalog-meta',
				text: `Version ${status.installedVersion}`,
			});

			if (isUpdateAvailable) {
				this.createActionButton(actions, {
					cls: 'mod-cta',
					idleText: 'Update',
					onClick: () =>
						this.runBusy(installBusyKey, async () => {
							const result = await this.plugin.themeManager.installTheme(
								theme.id,
							);
							await this.handleThemeInstallResult(theme, result);
							await this.refreshThemeUpdates();
						}),
				});
			} else {
				const installedLabel = actions.createDiv({
					cls: 'santi-catalog-installed',
				});
				const checkIcon = installedLabel.createSpan({
					attr: { 'aria-hidden': 'true' },
				});
				setIcon(checkIcon, 'check');
				installedLabel.createSpan({ text: 'Installed' });

				const menuBtn = actions.createEl('button', {
					cls: 'clickable-icon',
					attr: { 'aria-label': `${theme.name} actions` },
				});
				setIcon(menuBtn, 'more-vertical');
				menuBtn.addEventListener('click', (event) => {
					this.showThemeActionsMenu(event, theme);
				});
			}
		} else if (!hasAccess) {
			body.createEl('p', {
				cls: 'santi-catalog-meta',
				text: 'Unlock this bonus and log it as a free bonus from your account.',
			});
			this.createActionButton(actions, {
				cls: 'mod-cta',
				idleText: 'Unlock this bonus',
				onClick: () => {
					window.open(
						SANTI_TESTIMONIAL_URL,
						'_blank',
						'noopener,noreferrer',
					);
				},
			});
		} else {
			this.createActionButton(actions, {
				cls: 'mod-cta',
				idleText: 'Install',
				onClick: () =>
					this.runBusy(installBusyKey, async () => {
						const result = await this.plugin.themeManager.installTheme(
							theme.id,
						);
						await this.handleThemeInstallResult(theme, result);
					}),
			});
		}

		const cardBusyText = this.isBusy(installBusyKey)
			? status.installedVersion
				? isUpdateAvailable
					? 'Updating…'
					: 'Reinstalling…'
				: 'Installing…'
			: this.isBusy(removeBusyKey)
				? 'Removing…'
				: null;
		if (cardBusyText) {
			themeCard.addClass('santi-catalog-card--busy');
			renderLoadingOverlay(themeCard, cardBusyText);
		}
	}

	private showThemeActionsMenu(
		event: MouseEvent,
		theme: ThemeCatalogEntry,
	): void {
		const themeId = theme.id;
		const installBusyKey = `install-theme:${themeId}`;
		const removeBusyKey = `remove-theme:${themeId}`;
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle('Check for updates').onClick(() => {
				void this.runBusy('check-theme-updates', async () => {
					this.themeUpdates = await this.syncAccessAndCheckThemeUpdates();
					this.showThemeUpdatesCheckResult();
				});
			});
		});
		menu.addItem((item) => {
			item.setTitle('Reinstall').onClick(() => {
				void this.runBusy(installBusyKey, async () => {
					const themeEntry = getThemeCatalogEntries().find(
						(entry) => entry.id === themeId,
					);
					if (!themeEntry) {
						return;
					}
					const result = await this.plugin.themeManager.installTheme(themeId);
					await this.handleThemeInstallResult(themeEntry, result);
				});
			});
		});
		menu.addItem((item) => {
			item
				.setTitle('Remove')
				.setWarning(true)
				.onClick(() => {
					void this.runBusy(removeBusyKey, async () => {
						await removeRoyalLuxTheme(this.app);
						this.showNotice(`${theme.name} removed from this vault.`);
						await this.refreshThemeUpdates();
					});
				});
		});
		menu.showAtMouseEvent(event);
	}

	private appendSignInContactLink(parent: HTMLElement): void {
		const help = parent.createDiv({ cls: 'santi-tools-sign-in-help' });
		help.appendText("You didn't receive the code. Please ");
		const contactLink = help.createEl('a', { href: SANTI_CONTACT_URL });
		contactLink.setText('Contact me');
		contactLink.setAttr('target', '_blank');
		contactLink.setAttr('rel', 'noopener noreferrer');
		help.appendText('.');
	}

	private async verifyLoginCode(): Promise<void> {
		const email = this.emailInput.trim();
		const code = this.codeInput.trim();
		if (!email || !/^\d{6}$/.test(code)) {
			return;
		}
		const result = await this.plugin.platform.verifyCode(email, code);
		if (result.success) {
			this.hasSentLoginCode = false;
			this.codeInput = '';
			this.activeTab = this.getDefaultCatalogTab();
			await this.refreshUpdates();
			this.showNotice(result.message);
		} else {
			this.showNotice(result.message, true);
		}
	}

	private renderSignInPanel(parent: HTMLElement): void {
		parent.createEl('p', {
			cls: 'santi-tools-intro',
			text: 'Sign in with the email you used for your purchase to install catalog plugins.',
		});

		if (!this.hasSentLoginCode) {
			const desc = parent.createDiv({ cls: 'santi-tools-sign-in-desc' });
			desc.appendText(
				'If the code never arrives, there may have been a typo in your order or an issue on our side. Visit ',
			);
			const contactLink = desc.createEl('a', { href: SANTI_CONTACT_URL });
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- display URL as link label
			contactLink.setText('santiyounger.com/contact');
			contactLink.setAttr('target', '_blank');
			contactLink.setAttr('rel', 'noopener noreferrer');
			desc.appendText(' for help.');
		}

		let sendLoginButton: ButtonComponent | undefined;

		const syncSendLoginButton = (): void => {
			if (!sendLoginButton) {
				return;
			}
			sendLoginButton
				.setButtonText('Send login code')
				.setDisabled(!this.emailInput.trim() || this.isBusy());
		};

		let syncSignInEmailPrivacy: (() => void) | undefined;
		const signInEmailPrivacyState = {
			hidden: this.signInEmailHidden,
		};

		const emailSetting = new Setting(parent)
			.setName('Email')
			.setDesc('Same address as your purchase.')
			.addText((text) => {
				text.inputEl.addClass('santi-tools-sign-in-input');
				text.setDisabled(this.isBusy());
				text
					.setPlaceholder('you@example.com')
					.setValue(this.emailInput)
					.onChange((value) => {
						const previousEmail = this.emailInput;
						if (
							value.trim().toLowerCase() !==
							previousEmail.trim().toLowerCase()
						) {
							this.hasSentLoginCode = false;
							this.codeInput = '';
						}
						this.emailInput = value;
						syncSignInEmailPrivacy?.();
						syncSendLoginButton();
					});
			});

		emailSetting.addExtraButton((button) => {
			const inputEl = emailSetting.controlEl.querySelector('input');
			if (!(inputEl instanceof HTMLInputElement)) {
				return;
			}
			syncSignInEmailPrivacy = wireEmailPrivacyExtraButton(
				button,
				inputEl,
				signInEmailPrivacyState,
				(hidden) => {
					this.signInEmailHidden = hidden;
				},
				FIELD_PRIVACY_EMAIL_LABELS,
			);
		});

		if (!this.hasSentLoginCode) {
			new Setting(parent).addButton((button) => {
				sendLoginButton = button;
				syncSendLoginButton();
				button.onClick(() => {
					const email = this.emailInput.trim();
					if (!email) {
						return;
					}
					void this.runBusy('sign-in-send', async () => {
						const result = await this.plugin.platform.sendMagicLink(email);
						this.hasSentLoginCode = true;
						this.showNotice(result.message, !result.success);
					});
				});
			});
		}

		if (this.hasSentLoginCode) {
			parent.createEl('p', {
				cls: 'santi-tools-sign-in-desc',
				text: 'Enter the 6-digit code from your email.',
				attr: { 'aria-live': 'polite' },
			});

			let syncSignInCodePrivacy: (() => void) | undefined;
			const signInCodePrivacyState = {
				hidden: this.signInCodeHidden,
			};

			const codeSetting = new Setting(parent)
				.setName('6-digit code')
				.addText((text) => {
					text.inputEl.addClass('santi-tools-sign-in-input');
					text.setDisabled(this.isBusy());
					text
						.setPlaceholder('123456')
						.setValue(this.codeInput)
						.onChange((value) => {
							this.codeInput = value;
							syncSignInCodePrivacy?.();
							if (/^\d{6}$/.test(value.trim())) {
								void this.runBusy('sign-in-verify', () =>
								this.verifyLoginCode(),
							);
							}
						});
				});

			codeSetting.addExtraButton((button) => {
				const inputEl = codeSetting.controlEl.querySelector('input');
				if (!(inputEl instanceof HTMLInputElement)) {
					return;
				}
				syncSignInCodePrivacy = wireEmailPrivacyExtraButton(
					button,
					inputEl,
					signInCodePrivacyState,
					(hidden) => {
						this.signInCodeHidden = hidden;
					},
					FIELD_PRIVACY_CODE_LABELS,
				);
			});

			this.appendSignInContactLink(parent);
		}

		this.maybeRenderPanelBusyOverlay(
			parent,
			this.isBusy('sign-in-send')
				? 'Sending code…'
				: this.isBusy('sign-in-verify')
					? 'Verifying code…'
					: null,
		);
	}

	private async renderAccountPanel(parent: HTMLElement): Promise<void> {
		const connection = await this.plugin.platform.buildConnectionState();

		if (!connection.connected) {
			return;
		}

		const welcome = connection.displayName || connection.email || 'there';

		if (connection.email && welcome === connection.email) {
			const welcomeEmailState = { hidden: this.accountWelcomeEmailHidden };
			createEmailPrivacyRow(parent, {
				rowClass: 'santi-email-privacy-row--account-heading',
				state: welcomeEmailState,
				onHiddenChange: (hidden) => {
					this.accountWelcomeEmailHidden = hidden;
				},
				renderEmail: (targetParent) => {
					const heading = targetParent.createEl('h2', {
						cls: 'santi-tools-account-heading',
					});
					heading.appendText('Welcome, ');
					const emailSpan = heading.createSpan({ text: connection.email });
					return emailSpan;
				},
			});
		} else {
			parent.createEl('h2', {
				cls: 'santi-tools-account-heading',
				text: `Welcome, ${welcome}`,
			});
		}

		if (connection.email) {
			const emailLineState = { hidden: this.accountEmailLineHidden };
			createEmailPrivacyRow(parent, {
				state: emailLineState,
				onHiddenChange: (hidden) => {
					this.accountEmailLineHidden = hidden;
				},
				renderEmail: (targetParent) =>
					targetParent.createEl('p', {
						cls: 'santi-tools-sign-in-desc',
						text: connection.email,
					}),
			});
		}
		if (connection.lastSyncedAt) {
			parent.createEl('p', {
				cls: 'santi-tools-sign-in-desc',
				text: `Last synced ${new Date(connection.lastSyncedAt).toLocaleString()}`,
			});
		}
		parent.createEl('p', {
			cls: 'santi-tools-sign-in-desc',
			text: `${connection.grantedPluginIds.length} plugin grant(s), ${connection.grantedThemeIds.length} theme grant(s).`,
		});

		new Setting(parent).addButton((button) => {
			button
				.setButtonText('Refresh access')
				.setCta()
				.setDisabled(this.isBusy())
				.onClick(() => {
					void this.runBusy('refresh-access', async () => {
						await this.plugin.syncPlatformAccess();
						this.showNotice('Access refreshed.');
					});
				});
		});

		new Setting(parent).addButton((button) => {
			button
				.setButtonText('Log out')
				.setDisabled(this.isBusy())
				.onClick(() => {
					void this.runBusy('logout', async () => {
						await this.plugin.platform.logout();
						this.hasSentLoginCode = false;
						this.codeInput = '';
						this.activeTab = 'account';
						this.showNotice('Logged out.');
					});
				});
		});

		this.maybeRenderPanelBusyOverlay(
			parent,
			this.isBusy('refresh-access')
				? 'Refreshing access…'
				: this.isBusy('logout')
					? 'Logging out…'
					: null,
		);
	}
}

export function openSantiToolsModal(
	plugin: SantiObsidianToolsPlugin,
	options?: OpenSantiToolsOptions,
): void {
	new SantiToolsModal(plugin, options).open();
}
