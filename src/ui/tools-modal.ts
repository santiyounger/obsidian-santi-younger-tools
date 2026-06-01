import {
	ButtonComponent,
	Menu,
	Modal,
	Notice,
	Setting,
	setIcon,
} from 'obsidian';
import { APP_DISPLAY_NAME } from '../constants';
import type SantiObsidianToolsPlugin from '../main';
import type {
	PluginCatalogEntry,
	PluginUpdateInfo,
	ThemeCatalogEntry,
} from '../types';
import { RoyalLuxUnlockModal } from './royal-lux-unlock-modal';
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

type ToolsTab = 'plugins' | 'themes' | 'account';

export class SantiToolsModal extends Modal {
	private activeTab: ToolsTab = 'account';
	private statusMessage = '';
	private statusIsError = false;
	private busy = false;
	private emailInput = '';
	private codeInput = '';
	private hasSentLoginCode = false;
	private updates: PluginUpdateInfo[] = [];

	constructor(private plugin: SantiObsidianToolsPlugin) {
		super(plugin.app);
	}

	private getModalContainerEl(): HTMLElement {
		return this.modalEl.closest('.modal-container') ?? this.modalEl;
	}

	onOpen(): void {
		this.titleEl.setText(APP_DISPLAY_NAME);
		this.modalEl.addClass('santi-tools-modal');
		this.getModalContainerEl().addClass('santi-tools-modal-container');
		this.contentEl.empty();
		this.activeTab = this.isLoggedIn() ? 'plugins' : 'account';
		void this.refreshAndRender();
	}

	onClose(): void {
		this.getModalContainerEl().removeClass('santi-tools-modal-container');
		this.modalEl.removeClass('santi-tools-modal');
		this.contentEl.empty();
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
		await this.refreshUpdates();
		if (!this.isLoggedIn()) {
			this.activeTab = 'account';
		}
		await this.render();
	}

	private setStatus(message: string, isError = false): void {
		this.statusMessage = message;
		this.statusIsError = isError;
		if (message) {
			new Notice(message, isError ? 8000 : 5000);
		}
		void this.render();
	}

	private async runBusy(task: () => Promise<void>): Promise<void> {
		if (this.busy) {
			return;
		}
		this.busy = true;
		await this.render();
		try {
			await task();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			this.statusMessage = message;
			this.statusIsError = true;
			new Notice(message, 8000);
		} finally {
			this.busy = false;
			await this.render();
		}
	}

	private applySignInButtonLoading(
		button: ButtonComponent,
		loading: boolean,
		idleText: string,
		loadingText: string,
		canActivateWhenIdle: boolean,
	): void {
		const { buttonEl } = button;
		if (loading) {
			button.setButtonText(loadingText);
			button.setIcon('loader-circle');
			buttonEl.addClass('santi-tools-button-loading');
			button.setDisabled(true);
			return;
		}
		buttonEl.removeClass('santi-tools-button-loading');
		button.setButtonText(idleText);
		button.setDisabled(!canActivateWhenIdle);
	}

	private async render(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('santi-tools');

		if (this.statusMessage) {
			contentEl.createDiv({
				cls: `santi-tools-status${this.statusIsError ? ' is-error' : ''}`,
				text: this.statusMessage,
			});
		}

		if (!this.isLoggedIn()) {
			const signInPanel = contentEl.createDiv({
				cls: 'santi-tools-panel santi-tools-panel--form',
			});
			this.renderSignInPanel(signInPanel);
			return;
		}

		contentEl.createEl('p', {
			cls: 'santi-tools-intro',
			text: 'Install and update catalog plugins and themes for your account.',
		});

		this.renderTabs(contentEl);

		const panelClass =
			this.activeTab === 'account'
				? 'santi-tools-panel santi-tools-panel--form'
				: 'santi-tools-panel santi-tools-panel--catalog';
		const panel = contentEl.createDiv({ cls: panelClass });
		if (this.activeTab === 'plugins') {
			await this.renderPluginsPanel(panel);
		} else if (this.activeTab === 'themes') {
			await this.renderThemesPanel(panel);
		} else {
			await this.renderAccountPanel(panel);
		}

		if (this.busy) {
			contentEl.createEl('p', {
				cls: 'santi-tools-busy',
				text: 'Working…',
			});
		}
	}

	private renderTabs(parent: HTMLElement): void {
		const tabs = parent.createDiv({
			cls: 'horizontal-tab-header santi-tools-tab-header',
			attr: { role: 'tablist' },
		});
		this.renderTabButton(tabs, 'plugins', 'Plugins');
		this.renderTabButton(tabs, 'themes', 'Themes');
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
			this.statusMessage = '';
			this.statusIsError = false;
			void this.render();
		});
		item.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' && event.key !== ' ') {
				return;
			}
			event.preventDefault();
			this.activeTab = tab;
			this.statusMessage = '';
			this.statusIsError = false;
			void this.render();
		});
	}

	private async renderPluginsPanel(parent: HTMLElement): Promise<void> {
		const pendingUpdates = this.updates.filter((u) => u.updateAvailable);
		const toolbar = parent.createDiv({ cls: 'santi-tools-toolbar' });

		if (pendingUpdates.length > 0) {
			const updateAllBtn = toolbar.createEl('button', {
				cls: 'mod-cta',
				text: 'Update all',
			});
			updateAllBtn.setAttribute('type', 'button');
			updateAllBtn.disabled = this.busy;
			updateAllBtn.addEventListener('click', () => {
				void this.runBusy(async () => {
					await this.plugin.manager.updateAllWithNotices();
					await this.refreshUpdates();
				});
			});
		}

		const checkBtn = toolbar.createEl('button', { text: 'Check for updates' });
		checkBtn.setAttribute('type', 'button');
		checkBtn.disabled = this.busy;
		checkBtn.addEventListener('click', () => {
			void this.runBusy(async () => {
				this.updates = await this.plugin.manager.checkUpdates();
				const count = this.updates.filter((u) => u.updateAvailable).length;
				this.setStatus(
					count > 0
						? `${count} update(s) available.`
						: 'All catalog plugins are up to date.',
				);
			});
		});

		const grid = parent.createDiv({ cls: 'santi-catalog-grid' });
		const installed = await this.plugin.manager.listInstalled();
		const installedIds = new Set(installed.map((p) => p.pluginId));
		const catalog = getCatalogEntries();
		let visibleCount = 0;

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
	}

	private renderPluginCard(
		parent: HTMLElement,
		entry: PluginCatalogEntry,
		installed: Array<{ pluginId: string; installedVersion: string }>,
	): void {
		const card = parent.createDiv({ cls: 'santi-catalog-card' });

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
		const hasAccess = this.plugin.platform.hasPluginAccess(entry);
		const isComingSoon = isComingSoonCatalogPlugin(entry);

		if (installedInfo?.installedVersion) {
			body.createEl('p', {
				cls: 'santi-catalog-meta',
				text: `Version ${installedInfo.installedVersion}`,
			});
		}

		const actions = body.createDiv({ cls: 'santi-catalog-actions' });

		if (installedInfo) {
			const isUpdateAvailable = Boolean(update?.updateAvailable);
			if (isUpdateAvailable) {
				const updateBtn = actions.createEl('button', {
					cls: 'mod-cta',
					text: this.busy ? 'Updating…' : 'Update',
				});
				updateBtn.setAttribute('type', 'button');
				updateBtn.disabled = this.busy;
				updateBtn.addEventListener('click', () => {
					void this.runBusy(async () => {
						const result = await this.plugin.manager.installPlugin(entry.id);
						this.setStatus(result.message, !result.success);
						await this.refreshUpdates();
					});
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
		} else if (!hasAccess) {
			const learn =
				entry.learnMoreUrl ?? this.plugin.platform.getPlatformBaseUrl();
			const link = actions.createEl('a', { href: learn, text: 'Learn more' });
			link.setAttr('target', '_blank');
			link.setAttr('rel', 'noopener');
			const linkIcon = link.createSpan({ attr: { 'aria-hidden': 'true' } });
			setIcon(linkIcon, 'external-link');
		} else if (isComingSoon) {
			const soonBtn = actions.createEl('button', {
				text: 'Coming soon',
			});
			soonBtn.setAttribute('type', 'button');
			soonBtn.disabled = true;
		} else {
			const installBtn = actions.createEl('button', {
				cls: 'mod-cta',
				text: this.busy ? 'Installing…' : 'Install',
			});
			installBtn.setAttribute('type', 'button');
			installBtn.disabled = this.busy;
			installBtn.addEventListener('click', () => {
				void this.runBusy(async () => {
					const result = await this.plugin.manager.installPlugin(entry.id);
					this.setStatus(result.message, !result.success);
					await this.refreshUpdates();
				});
			});
		}
	}

	private showPluginActionsMenu(
		event: MouseEvent,
		entry: PluginCatalogEntry,
	): void {
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle('Check for updates').onClick(() => {
				void this.runBusy(async () => {
					this.updates = await this.plugin.manager.checkUpdates();
					this.setStatus('Update check finished.');
				});
			});
		});
		menu.addItem((item) => {
			item
				.setTitle('Remove')
				.setWarning(true)
				.onClick(() => {
					void this.runBusy(async () => {
						await this.plugin.manager.removeCatalogPlugin(entry.id);
						this.setStatus(`${entry.name} removed from this vault.`);
						await this.refreshUpdates();
					});
				});
		});
		menu.showAtMouseEvent(event);
	}

	private async renderThemesPanel(parent: HTMLElement): Promise<void> {
		const grid = parent.createDiv({ cls: 'santi-catalog-grid' });
		for (const theme of getThemeCatalogEntries()) {
			if (theme.id === ROYAL_LUX_ENTITLEMENT_ID) {
				await this.renderRoyalLuxThemeCard(grid, theme);
			}
		}
	}

	private async renderRoyalLuxThemeCard(
		parent: HTMLElement,
		theme: ThemeCatalogEntry,
	): Promise<void> {
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

		const status = await getRoyalLuxThemeStatus(this.app);
		const unlocked = await this.plugin.platform.royalLuxInstallUnlocked();
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
		} else if (unlocked) {
			const installBtn = actions.createEl('button', {
				cls: 'mod-cta',
				text: this.busy ? 'Installing…' : 'Install',
			});
			installBtn.setAttribute('type', 'button');
			installBtn.disabled = this.busy;
			installBtn.addEventListener('click', () => {
				void this.runBusy(async () => {
					const assets = getBundledRoyalLuxAssets();
					const result = await installObsidianTheme(
						this.app,
						assets.manifestJson,
						assets.themeCss,
					);
					this.setStatus(result.message, !result.success);
				});
			});
		} else {
			const unlockBtn = actions.createEl('button', {
				cls: 'mod-cta',
				text: 'Share feedback to unlock',
			});
			unlockBtn.setAttribute('type', 'button');
			unlockBtn.disabled = this.busy;
			unlockBtn.addEventListener('click', () => {
				new RoyalLuxUnlockModal(this.app, this.plugin, async () => {
					this.activeTab = 'themes';
					this.statusMessage = '';
					await this.render();
				}).open();
			});
			if (theme.unlockHint) {
				body.createEl('p', {
					cls: 'santi-catalog-meta',
					text: theme.unlockHint,
				});
			}
		}
	}

	private showThemeActionsMenu(event: MouseEvent, themeName: string): void {
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle('Reinstall').onClick(() => {
				void this.runBusy(async () => {
					const assets = getBundledRoyalLuxAssets();
					const result = await installObsidianTheme(
						this.app,
						assets.manifestJson,
						assets.themeCss,
					);
					this.setStatus(result.message, !result.success);
				});
			});
		});
		menu.addItem((item) => {
			item
				.setTitle('Remove')
				.setWarning(true)
				.onClick(() => {
					void this.runBusy(async () => {
						await removeRoyalLuxTheme(this.app);
						this.setStatus(`${themeName} removed from this vault.`);
					});
				});
		});
		menu.showAtMouseEvent(event);
	}

	private renderSignInPanel(parent: HTMLElement): void {
		parent.createEl('p', {
			cls: 'santi-tools-intro',
			text: 'Sign in with the email you used for your purchase to install catalog plugins.',
		});

		const desc = parent.createDiv({ cls: 'santi-tools-sign-in-desc' });
		desc.appendText(
			'If the code never arrives, there may have been a typo in your order or an issue on my side, so please ',
		);
		const contactLink = desc.createEl('a', {
			href: 'https://www.santiyounger.com/contact',
			text: 'Contact me',
		});
		contactLink.setAttr('target', '_blank');
		contactLink.setAttr('rel', 'noopener');
		desc.appendText('.');

		let sendLoginButton: ButtonComponent | undefined;
		let connectButton: ButtonComponent | undefined;

		const syncSendLoginButton = (): void => {
			if (!sendLoginButton) {
				return;
			}
			this.applySignInButtonLoading(
				sendLoginButton,
				this.busy,
				'Send login code',
				'Sending code…',
				Boolean(this.emailInput.trim()),
			);
		};
		const syncConnectButton = (): void => {
			if (!connectButton) {
				return;
			}
			this.applySignInButtonLoading(
				connectButton,
				this.busy,
				'Connect account',
				'Connecting…',
				Boolean(this.emailInput.trim() && this.codeInput.trim()),
			);
		};

		new Setting(parent)
			.setName('Email')
			.setDesc('Same address as your purchase.')
			.addText((text) => {
				text.setDisabled(this.busy);
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
						syncSendLoginButton();
						syncConnectButton();
					});
			});

		new Setting(parent).addButton((button) => {
			sendLoginButton = button;
			syncSendLoginButton();
			button.onClick(() => {
					const email = this.emailInput.trim();
					if (!email) {
						return;
					}
					void this.runBusy(async () => {
						const result = await this.plugin.platform.sendMagicLink(email);
						this.hasSentLoginCode = true;
						this.statusMessage = result.message;
						this.statusIsError = !result.success;
						new Notice(result.message, 5000);
					});
				});
		});

		if (this.hasSentLoginCode) {
			parent.createEl('p', {
				cls: 'santi-tools-sign-in-desc',
				text: 'Enter the 6-digit code from your email.',
				attr: { 'aria-live': 'polite' },
			});

			new Setting(parent)
				.setName('6-digit code')
				.addText((text) => {
					text.setDisabled(this.busy);
					text
						.setPlaceholder('123456')
						.setValue(this.codeInput)
						.onChange((value) => {
							this.codeInput = value;
							syncConnectButton();
						});
				});

			new Setting(parent).addButton((button) => {
				connectButton = button;
				button.setCta();
				syncConnectButton();
				button.onClick(() => {
						void this.runBusy(async () => {
							const result = await this.plugin.platform.verifyCode(
								this.emailInput.trim(),
								this.codeInput.trim(),
							);
							if (result.success) {
								this.hasSentLoginCode = false;
								this.codeInput = '';
								this.activeTab = 'plugins';
								await this.refreshUpdates();
								this.statusMessage = result.message;
								this.statusIsError = false;
								new Notice(result.message, 5000);
							} else {
								this.setStatus(result.message, true);
							}
						});
					});
			});
		}
	}

	private async renderAccountPanel(parent: HTMLElement): Promise<void> {
		const connection = await this.plugin.platform.buildConnectionState();

		if (!connection.connected) {
			return;
		}

		const welcome = connection.displayName || connection.email || 'there';
		parent.createEl('h2', {
			cls: 'santi-tools-account-heading',
			text: `Welcome, ${welcome}`,
		});

		if (connection.email) {
			parent.createEl('p', {
				cls: 'santi-tools-sign-in-desc',
				text: connection.email,
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
				.setDisabled(this.busy)
				.onClick(() => {
					void this.runBusy(async () => {
						await this.plugin.platform.refreshEntitlements();
						this.setStatus('Access refreshed.');
					});
				});
		});

		new Setting(parent).addButton((button) => {
			button.setButtonText('Log out').onClick(() => {
				void this.runBusy(async () => {
					await this.plugin.platform.logout();
					this.hasSentLoginCode = false;
					this.codeInput = '';
					this.activeTab = 'account';
					this.setStatus('Logged out.');
				});
			});
		});
	}
}

export function openSantiToolsModal(plugin: SantiObsidianToolsPlugin): void {
	new SantiToolsModal(plugin).open();
}
