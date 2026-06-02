import { Notice, type App } from 'obsidian';
import { isUpdateAvailable } from '../common/versioning';
import type {
	PlatformSessionState,
	ThemeInstallResult,
	ThemeUpdateInfo,
} from '../types';
import { getThemeCatalogEntries } from './catalog-data';
import type { PlatformService } from './platform';
import {
	getBundledThemeAssets,
	getCatalogThemeStatus,
	installObsidianTheme,
} from './theme-installer';

export class ThemeManager {
	private catalogAutoUpdateInProgress = false;

	constructor(
		private app: App,
		private platform: PlatformService,
		private getSession: () => PlatformSessionState | undefined,
		private onInstallLayoutChange?: () => void,
	) {}

	private notifyInstallLayoutChange(): void {
		this.onInstallLayoutChange?.();
	}

	private requireLoggedIn(): void {
		if (!this.getSession()) {
			throw new Error(
				'Sign in on the my account tab before installing or updating themes.',
			);
		}
	}

	async checkUpdates(): Promise<ThemeUpdateInfo[]> {
		this.requireLoggedIn();
		const updates: ThemeUpdateInfo[] = [];

		for (const entry of getThemeCatalogEntries()) {
			if (!getBundledThemeAssets(entry.id)) {
				continue;
			}
			const status = await getCatalogThemeStatus(this.app, entry.id);
			if (!status?.installedVersion) {
				continue;
			}
			updates.push({
				themeId: entry.id,
				themeName: entry.name,
				installedVersion: status.installedVersion,
				latestVersion: status.availableVersion,
				updateAvailable: isUpdateAvailable(
					status.installedVersion,
					status.availableVersion,
				),
			});
		}

		return updates;
	}

	async installTheme(
		themeId: string,
		options?: { activate?: boolean },
	): Promise<ThemeInstallResult> {
		this.requireLoggedIn();
		const entry = getThemeCatalogEntries().find((item) => item.id === themeId);
		if (!entry) {
			throw new Error(`Theme ${themeId} was not found in catalog.`);
		}
		if (!this.platform.hasThemeAccess(themeId)) {
			throw new Error(`You do not have access to ${entry.name}.`);
		}
		const assets = getBundledThemeAssets(themeId);
		if (!assets) {
			throw new Error(`${entry.name} is not available to install yet.`);
		}
		const result = await installObsidianTheme(
			this.app,
			assets.manifestJson,
			assets.themeCss,
			options,
		);
		if (result.success) {
			this.notifyInstallLayoutChange();
		}
		return result;
	}

	async updateAllWithNotices(): Promise<void> {
		const updates = await this.checkUpdates();
		const pending = updates.filter((update) => update.updateAvailable);
		if (pending.length === 0) {
			new Notice('All catalog themes are up to date.');
			return;
		}
		let updated = 0;
		for (const update of pending) {
			const result = await this.installTheme(update.themeId);
			if (result.success) {
				updated++;
			}
		}
		new Notice(
			updated > 0
				? `Updated ${updated} theme(s). Reload Obsidian.`
				: 'No themes were updated.',
		);
	}

	/**
	 * On Obsidian reload: check installed catalog themes and install pending updates.
	 * Requires sign-in; skips themes the account cannot access.
	 */
	async applyPendingCatalogThemeUpdatesOnLoad(): Promise<void> {
		if (this.catalogAutoUpdateInProgress || !this.getSession()) {
			return;
		}
		this.catalogAutoUpdateInProgress = true;
		try {
			const updates = await this.checkUpdates();
			const pending = updates.filter((update) => update.updateAvailable);
			const updatedNames: string[] = [];

			for (const update of pending) {
				if (!this.platform.hasThemeAccess(update.themeId)) {
					continue;
				}
				try {
					const result = await this.installTheme(update.themeId);
					if (result.success) {
						updatedNames.push(update.themeName);
					}
				} catch {
					/* try remaining themes */
				}
			}

			if (updatedNames.length > 0) {
				const label =
					updatedNames.length === 1
						? updatedNames[0]
						: `${String(updatedNames.length)} catalog themes`;
				new Notice(`${label} updated. Reload Obsidian.`);
			}
		} catch {
			/* non-fatal on startup */
		} finally {
			this.catalogAutoUpdateInProgress = false;
		}
	}
}
