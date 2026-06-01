import {
	ButtonComponent,
	Menu,
	Modal,
	Notice,
	Setting,
	setIcon,
} from 'obsidian';
import { APP_DISPLAY_NAME, SANTI_CONTACT_URL } from '../constants';
import type SantiObsidianToolsPlugin from '../main';
import type {
	PluginCatalogEntry,
	PluginUpdateInfo,
	ThemeCatalogEntry,
	ThemeStatusInfo,
} from '../types';
import {
	getCatalogDescription,
	getCatalogEntries,
	getThemeCatalogEntries,
	isComingSoonCatalogPlugin,
} from '../services/catalog-data';
import { ROYAL_LUX_ENTITLEMENT_ID } from '../common/entitlements';
import {
	getBundledRoyalLuxAssets,
	getRoyalLuxThemeStatus,
	installObsidianTheme,
	removeRoyalLuxTheme,
} from '../services/theme-installer';
import { isCommunityPluginEnabled } from '../services/plugin-runtime';
import type { InstallResult } from '../types';
import { InstallEnablePromptModal } from './install-enable-prompt-modal';
import { applyDevEmailBlur } from './dev-email-blur';
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
			this.activeTab = this.isLoggedIn() ? 'plugins' : 'account';
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

	private async refreshUpdates(): Promise<void> {
		try {
			if (!this.isLoggedIn()) {
				this.updates = [];
				return;
			}
			const installed = await this.plugin.manager.listInstalled();
			if (installed.length > 0) {
				this.updates = await this.plugin.manager.checkUpdates();
			} else {
				this.updates = this.plugin.data.pluginUpdates ?? [];
			}
		} catch {
			this.updates = this.plugin.data.pluginUpdates ?? [];
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

		const showThemesTab = await this.hasVisibleThemeCatalogEntries();
		if (this.activeTab === 'themes' && !showThemesTab) {
			this.activeTab = 'plugins';
		}

		contentEl.createEl('p', {
			cls: 'santi-tools-intro',
			text: showThemesTab
				? 'Install and update catalog plugins and themes for your account.'
				: 'Install and update catalog plugins for your account.',
		});

		this.renderTabs(contentEl, showThemesTab);

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

	private async hasVisibleThemeCatalogEntries(): Promise<boolean> {
		for (const theme of getThemeCatalogEntries()) {
			if (theme.id !== ROYAL_LUX_ENTITLEMENT_ID) {
				continue;
			}
			const status = await getRoyalLuxThemeStatus(this.app);
			const isInstalled = Boolean(status.installedVersion);
			if (
				this.plugin.platform.shouldShowThemeCatalogEntry(
					theme.id,
					isInstalled,
				)
			) {
				return true;
			}
		}
		return false;
	}

	private renderTabs(parent: HTMLElement, showThemesTab: boolean): void {
		const tabs = parent.createDiv({
			cls: 'horizontal-tab-header santi-tools-tab-header',
			attr: { role: 'tablist' },
		});
		this.renderTabButton(tabs, 'plugins', 'Plugins');
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
					this.updates = await this.plugin.manager.checkUpdates();
					const count = this.updates.filter((u) => u.updateAvailable).length;
					this.showNotice(
						count > 0
							? `${count} update(s) available.`
							: 'All catalog plugins are up to date.',
					);
				}),
		});

		const grid = parent.createDiv({ cls: 'santi-catalog-grid' });
		const installed = await this.plugin.manager.listInstalled();
		const installedIds = new Set(installed.map((p) => p.pluginId));
		const catalog = getCatalogEntries();
		let visibleCount = 0;
		this.focusCardEl = undefined;

		for (const entry of catalog) {
			if (!this.plugin.manager.shouldShowCatalogEntry(entry, installedIds)) {
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
					? 'Checking for updates…'
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
					this.updates = await this.plugin.manager.checkUpdates();
					this.showNotice('Update check finished.');
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
		const grid = parent.createDiv({ cls: 'santi-catalog-grid' });

		for (const theme of getThemeCatalogEntries()) {
			if (theme.id !== ROYAL_LUX_ENTITLEMENT_ID) {
				continue;
			}
			const status = await getRoyalLuxThemeStatus(this.app);
			const isInstalled = Boolean(status.installedVersion);
			if (
				!this.plugin.platform.shouldShowThemeCatalogEntry(
					theme.id,
					isInstalled,
				)
			) {
				continue;
			}
			await this.renderRoyalLuxThemeCard(grid, theme, status);
		}
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

		if (status.installedVersion) {
			body.createEl('p', {
				cls: 'santi-catalog-meta',
				text: `Version ${status.installedVersion}`,
			});

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
				this.showThemeActionsMenu(event, theme.name);
			});
		} else {
			this.createActionButton(actions, {
				cls: 'mod-cta',
				idleText: 'Install',
				onClick: () =>
					this.runBusy(installBusyKey, async () => {
						const assets = getBundledRoyalLuxAssets();
						const result = await installObsidianTheme(
							this.app,
							assets.manifestJson,
							assets.themeCss,
						);
						this.showNotice(result.message, !result.success);
					}),
			});
		}

		const cardBusyText = this.isBusy(installBusyKey)
			? status.installedVersion
				? 'Reinstalling…'
				: 'Installing…'
			: this.isBusy(removeBusyKey)
				? 'Removing…'
				: null;
		if (cardBusyText) {
			themeCard.addClass('santi-catalog-card--busy');
			renderLoadingOverlay(themeCard, cardBusyText);
		}
	}

	private showThemeActionsMenu(event: MouseEvent, themeName: string): void {
		const themeId = ROYAL_LUX_ENTITLEMENT_ID;
		const installBusyKey = `install-theme:${themeId}`;
		const removeBusyKey = `remove-theme:${themeId}`;
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle('Reinstall').onClick(() => {
				void this.runBusy(installBusyKey, async () => {
					const assets = getBundledRoyalLuxAssets();
					const result = await installObsidianTheme(
						this.app,
						assets.manifestJson,
						assets.themeCss,
					);
					this.showNotice(result.message, !result.success);
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
						this.showNotice(`${themeName} removed from this vault.`);
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
			this.activeTab = 'plugins';
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

		new Setting(parent)
			.setName('Email')
			.setDesc('Same address as your purchase.')
			.addText((text) => {
				text.inputEl.addClass('santi-tools-sign-in-input');
				text.setDisabled(this.isBusy());
				applyDevEmailBlur(text.inputEl);
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
						applyDevEmailBlur(text.inputEl);
						syncSendLoginButton();
					});
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

			new Setting(parent)
				.setName('6-digit code')
				.addText((text) => {
					text.inputEl.addClass('santi-tools-sign-in-input');
					text.setDisabled(this.isBusy());
					text
						.setPlaceholder('123456')
						.setValue(this.codeInput)
						.onChange((value) => {
							this.codeInput = value;
							if (/^\d{6}$/.test(value.trim())) {
								void this.runBusy('sign-in-verify', () =>
								this.verifyLoginCode(),
							);
							}
						});
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
		const heading = parent.createEl('h2', {
			cls: 'santi-tools-account-heading',
			text: `Welcome, ${welcome}`,
		});
		if (connection.email && welcome === connection.email) {
			applyDevEmailBlur(heading);
		}

		if (connection.email) {
			const emailLine = parent.createEl('p', {
				cls: 'santi-tools-sign-in-desc',
				text: connection.email,
			});
			applyDevEmailBlur(emailLine);
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
						await this.plugin.platform.refreshEntitlements();
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
