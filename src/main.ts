import { Notice, Plugin } from 'obsidian';
import { registerCommands } from './commands/register-commands';
import { DEFAULT_PLATFORM_BASE_URL } from './common/default-platform-url';
import { getCatalogEntries } from './services/catalog-data';
import { getInstallVisibilityFlags } from './services/install-visibility';
import { PlatformService } from './services/platform';
import { PluginManager } from './services/plugin-manager';
import { ThemeManager } from './services/theme-manager';
import type { PluginDataState } from './types';
import { openSantiToolsModal } from './ui/tools-modal';

export default class SantiObsidianToolsPlugin extends Plugin {
	data!: PluginDataState;
	platform!: PlatformService;
	manager!: PluginManager;
	themeManager!: ThemeManager;
	hasCatalogPluginAccess = false;
	hasCatalogThemeAccess = false;
	hasInstalledCatalogPlugins = false;
	hasInstalledCatalogThemes = false;

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
				void this.refreshInstallCommandVisibility();
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
			() => {
				void this.refreshInstallCommandVisibility();
			},
		);

		this.themeManager = new ThemeManager(
			this.app,
			this.platform,
			() => this.data.platformSession,
			() => {
				void this.refreshInstallCommandVisibility();
			},
		);

		registerCommands(this);

		this.addRibbonIcon('package', 'Manage tools', () => {
			openSantiToolsModal(this);
		});

		void this.refreshInstallCommandVisibility();

		this.registerObsidianProtocolHandler('santi-younger-tools', (params) => {
			const raw = params.plugin ?? params.pluginId ?? params.id;
			const pluginId = typeof raw === 'string' ? raw.trim() : '';
			if (!pluginId) {
				new Notice('Choose a plugin on the platform, then select install again.');
				openSantiToolsModal(this);
				return;
			}
			if (!getCatalogEntries().some((entry) => entry.id === pluginId)) {
				new Notice('That plugin is not in the catalog yet.');
				openSantiToolsModal(this);
				return;
			}
			openSantiToolsModal(this, { pluginId, tab: 'plugins' });
		});

		if (this.data.platformSession) {
			void this.scheduleCatalogAutoUpdateOnLoad();
		}
	}

	async refreshInstallCommandVisibility(): Promise<void> {
		const flags = await getInstallVisibilityFlags(
			this.app,
			this.manager,
			this.platform,
		);
		this.hasCatalogPluginAccess = flags.hasCatalogPluginAccess;
		this.hasCatalogThemeAccess = flags.hasCatalogThemeAccess;
		this.hasInstalledCatalogPlugins = flags.hasInstalledCatalogPlugins;
		this.hasInstalledCatalogThemes = flags.hasInstalledCatalogThemes;
	}

	/** After reload, refresh entitlements then install pending catalog updates. */
	private scheduleCatalogAutoUpdateOnLoad(): void {
		const timer = window.setTimeout(() => {
			void (async () => {
				try {
					await this.platform.refreshEntitlements();
				} catch {
					/* keep last known grants */
				}
				await this.manager.applyPendingCatalogUpdatesOnLoad();
				await this.themeManager.applyPendingCatalogThemeUpdatesOnLoad();
				await this.refreshInstallCommandVisibility();
			})();
		}, 3000);
		this.register(() => window.clearTimeout(timer));
	}

	onunload(): void {}

	private defaultData(): PluginDataState {
		return {
			installs: [],
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
		};
	}

	async savePluginData(): Promise<void> {
		await this.saveData(this.data);
	}
}
