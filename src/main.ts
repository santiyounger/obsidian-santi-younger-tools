import { Notice, Plugin } from 'obsidian';
import { DEFAULT_PLATFORM_BASE_URL } from './common/default-platform-url';
import { PlatformService } from './services/platform';
import { PluginManager } from './services/plugin-manager';
import type { PluginDataState } from './types';
import { openSantiToolsModal } from './ui/tools-modal';

export default class SantiObsidianToolsPlugin extends Plugin {
	data!: PluginDataState;
	platform!: PlatformService;
	manager!: PluginManager;

	async onload(): Promise<void> {
		await this.loadPluginData();

		this.platform = new PlatformService(
			() => DEFAULT_PLATFORM_BASE_URL,
			() => this.data.platformSession,
			async (session) => {
				if (session) {
					this.data.platformSession = session;
				} else {
					delete this.data.platformSession;
				}
				await this.savePluginData();
			},
			(themeId) => this.data.themeBonusUnlocks?.[themeId],
			async (themeId, record) => {
				this.data.themeBonusUnlocks = {
					...(this.data.themeBonusUnlocks ?? {}),
					[themeId]: record,
				};
				await this.savePluginData();
			},
		);

		this.manager = new PluginManager(
			this.app,
			this.platform,
			() => this.data,
			async (state) => {
				this.data = state;
				await this.savePluginData();
			},
			() => this.data.platformSession,
		);

		this.addRibbonIcon('package', 'Open tools', () => {
			openSantiToolsModal(this);
		});

		this.addCommand({
			id: 'open-tools',
			name: 'Open tools',
			callback: () => {
				openSantiToolsModal(this);
			},
		});

		this.addCommand({
			id: 'check-plugin-updates',
			name: 'Check catalog plugin updates',
			callback: () => {
				if (!this.data.platformSession) {
					new Notice('Sign in via open tools before checking for updates.');
					openSantiToolsModal(this);
					return;
				}
				void this.manager.checkUpdates().then((updates) => {
					const count = updates.filter((u) => u.updateAvailable).length;
					new Notice(
						count > 0
							? `${count} catalog plugin update(s) available. Open tools to install.`
							: 'All catalog plugins are up to date.',
					);
					openSantiToolsModal(this);
				});
			},
		});

		if (this.data.platformSession) {
			void this.scheduleCatalogAutoUpdateOnLoad();
		}
	}

	/** After reload, refresh entitlements then install pending catalog plugin updates. */
	private scheduleCatalogAutoUpdateOnLoad(): void {
		const timer = window.setTimeout(() => {
			void (async () => {
				try {
					await this.platform.refreshEntitlements();
				} catch {
					/* keep last known grants */
				}
				await this.manager.applyPendingCatalogUpdatesOnLoad();
			})();
		}, 3000);
		this.register(() => window.clearTimeout(timer));
	}

	onunload(): void {}

	private defaultData(): PluginDataState {
		return {
			installs: [],
			themeBonusUnlocks: {},
		};
	}

	async loadPluginData(): Promise<void> {
		const stored = (await this.loadData()) as Partial<PluginDataState> | null;
		this.data = {
			...this.defaultData(),
			installs: stored?.installs ?? [],
			lastCheckedAt: stored?.lastCheckedAt,
			pluginUpdates: stored?.pluginUpdates,
			platformSession: stored?.platformSession,
			themeBonusUnlocks: stored?.themeBonusUnlocks ?? {},
		};
	}

	async savePluginData(): Promise<void> {
		await this.saveData(this.data);
	}
}
