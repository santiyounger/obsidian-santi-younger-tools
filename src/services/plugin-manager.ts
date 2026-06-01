import { Notice, type App } from 'obsidian';
import { isUpdateAvailable } from '../common/versioning';
import { userHasPluginEntitlement } from '../common/entitlements';
import type {
	InstalledPluginInfo,
	InstallResult,
	PluginCatalogEntry,
	PluginDataState,
	PluginUpdateInfo,
	PlatformSessionState,
} from '../types';
import {
	getCatalogEntries,
	isComingSoonCatalogPlugin,
} from './catalog-data';
import { fetchPluginAssets } from './catalog-fetch';
import {
	enableInstalledCommunityPlugin,
	installOrUpdatePlugin,
	registerInstalledPluginWithObsidian,
	removePlugin,
	resolvePluginDirectoryForCatalogId,
} from './plugin-installer';
import type { PlatformService } from './platform';

export class PluginManager {
	private catalogAutoUpdateInProgress = false;

	constructor(
		private app: App,
		private platform: PlatformService,
		private getState: () => PluginDataState,
		private saveState: (state: PluginDataState) => Promise<void>,
		private getSession: () => PlatformSessionState | undefined,
		private onInstallLayoutChange?: () => void,
	) {}

	private notifyInstallLayoutChange(): void {
		this.onInstallLayoutChange?.();
	}

	private requireLoggedIn(): void {
		if (!this.getSession()) {
			throw new Error(
				'Sign in on the my account tab before installing or updating plugins.',
			);
		}
	}

	async listInstalled(): Promise<InstalledPluginInfo[]> {
		const catalog = getCatalogEntries();
		const state = this.getState();
		const installed: InstalledPluginInfo[] = [];

		for (const entry of catalog) {
			const pluginDir = await resolvePluginDirectoryForCatalogId(
				this.app,
				entry.id,
				entry.obsidianManifestId,
			);
			if (!pluginDir) {
				continue;
			}
			let installedVersion = 'unknown';
			try {
				const raw = await this.app.vault.adapter.read(
					`${pluginDir}/manifest.json`,
				);
				const manifest = JSON.parse(raw) as { version?: string };
				if (manifest.version) {
					installedVersion = manifest.version;
				}
			} catch {
				const stateMatch = state.installs.find(
					(item) => item.pluginId === entry.id,
				);
				if (stateMatch) {
					installedVersion = stateMatch.installedVersion;
				}
			}
			installed.push({
				pluginId: entry.id,
				name: entry.name,
				installedVersion,
			});
		}
		return installed;
	}

	getInstalledVersion(pluginId: string, installed: InstalledPluginInfo[]): string | undefined {
		return installed.find((p) => p.pluginId === pluginId)?.installedVersion;
	}

	shouldShowCatalogEntry(
		entry: PluginCatalogEntry,
		installedIds: Set<string>,
	): boolean {
		const session = this.getSession();
		if (installedIds.has(entry.id)) {
			return true;
		}
		if (!session) {
			return false;
		}
		return userHasPluginEntitlement(entry, session.grantedPluginIds);
	}

	async installPlugin(
		pluginId: string,
		options?: { enable?: boolean },
	): Promise<InstallResult> {
		this.requireLoggedIn();
		const catalog = getCatalogEntries();
		const entry = catalog.find((item) => item.id === pluginId);
		if (!entry) {
			throw new Error(`Plugin ${pluginId} was not found in catalog.`);
		}
		if (!this.platform.hasPluginAccess(entry)) {
			throw new Error(`You do not have access to ${entry.name}.`);
		}
		if (isComingSoonCatalogPlugin(entry)) {
			const exists = await resolvePluginDirectoryForCatalogId(
				this.app,
				pluginId,
				entry.obsidianManifestId,
			);
			if (!exists) {
				throw new Error(
					`${entry.name} is coming soon and cannot be installed yet.`,
				);
			}
		}
		const session = this.getSession();
		const release = await fetchPluginAssets(entry, {
			platformBaseUrl: this.platform.getPlatformBaseUrl(),
			authCookie: session?.authCookie,
		});
		let result = await installOrUpdatePlugin(this.app, release);
		if (result.success) {
			try {
				await registerInstalledPluginWithObsidian(
					this.app,
					result.pluginId,
				);
			} catch {
				/* files are on disk; registration can retry from the enable prompt */
			}
			if (options?.enable) {
				try {
					await enableInstalledCommunityPlugin(
						this.app,
						result.pluginId,
					);
				} catch {
					/* install succeeded; enable is optional */
				}
			}
			const state = this.getState();
			const nextInstalls = state.installs.filter(
				(i) => i.pluginId !== pluginId,
			);
			nextInstalls.push({
				pluginId,
				installedVersion: result.version,
				updatedAt: new Date().toISOString(),
			});
			await this.saveState({
				...state,
				installs: nextInstalls,
				lastCheckedAt: new Date().toISOString(),
			});
			this.notifyInstallLayoutChange();
		}
		return result;
	}

	async removeCatalogPlugin(pluginId: string): Promise<void> {
		const catalog = getCatalogEntries();
		const entry = catalog.find((item) => item.id === pluginId);
		await removePlugin(
			this.app,
			pluginId,
			entry?.obsidianManifestId,
		);
		const state = this.getState();
		await this.saveState({
			...state,
			installs: state.installs.filter((i) => i.pluginId !== pluginId),
		});
		this.notifyInstallLayoutChange();
	}

	async checkUpdates(): Promise<PluginUpdateInfo[]> {
		this.requireLoggedIn();
		const state = this.getState();
		const catalog = getCatalogEntries();
		const session = this.getSession();
		const updates: PluginUpdateInfo[] = [];
		const installed = await this.listInstalled();

		for (const live of installed) {
			const entry = catalog.find((item) => item.id === live.pluginId);
			if (!entry) {
				continue;
			}
			try {
				const latestRelease = await fetchPluginAssets(entry, {
					platformBaseUrl: this.platform.getPlatformBaseUrl(),
					authCookie: session?.authCookie,
				});
				updates.push({
					pluginId: live.pluginId,
					installedVersion: live.installedVersion,
					latestVersion: latestRelease.version,
					updateAvailable: isUpdateAvailable(
						live.installedVersion,
						latestRelease.version,
					),
				});
			} catch {
				/* skip plugins we cannot reach */
			}
		}

		await this.saveState({
			...state,
			pluginUpdates: updates,
			lastCheckedAt: new Date().toISOString(),
		});
		return updates;
	}

	async updateAllWithNotices(): Promise<void> {
		const updates = await this.checkUpdates();
		const pending = updates.filter((u) => u.updateAvailable);
		if (pending.length === 0) {
			new Notice('All catalog plugins are up to date.');
			return;
		}
		let updated = 0;
		for (const update of pending) {
			const result = await this.installPlugin(update.pluginId);
			if (result.success) {
				updated++;
			}
		}
		new Notice(
			updated > 0
				? `Updated ${updated} plugin(s). Reload Obsidian if prompted.`
				: 'No plugins were updated.',
		);
	}

	/**
	 * On Obsidian reload: check installed catalog plugins and install pending updates.
	 * Requires sign-in; skips plugins the account cannot access.
	 */
	async applyPendingCatalogUpdatesOnLoad(): Promise<void> {
		if (this.catalogAutoUpdateInProgress || !this.getSession()) {
			return;
		}
		this.catalogAutoUpdateInProgress = true;
		try {
			const catalog = getCatalogEntries();
			const updates = await this.checkUpdates();
			const pending = updates.filter((u) => u.updateAvailable);
			const updatedNames: string[] = [];

			for (const update of pending) {
				const entry = catalog.find((item) => item.id === update.pluginId);
				if (!entry || !this.platform.hasPluginAccess(entry)) {
					continue;
				}
				try {
					const result = await this.installPlugin(update.pluginId);
					if (result.success) {
						updatedNames.push(entry.name);
					}
				} catch {
					/* try remaining plugins */
				}
			}

			if (updatedNames.length > 0) {
				const label =
					updatedNames.length === 1
						? updatedNames[0]
						: `${String(updatedNames.length)} catalog plugins`;
				new Notice(
					`${label} updated. Reload Obsidian if prompted.`,
				);
			}
		} catch {
			/* non-fatal on startup */
		} finally {
			this.catalogAutoUpdateInProgress = false;
		}
	}
}
