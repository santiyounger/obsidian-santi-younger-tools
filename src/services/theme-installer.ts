import { normalizePath, type App } from 'obsidian';
import { isUpdateAvailable } from '../common/versioning';
import type { ThemeInstallResult, ThemeStatusInfo } from '../types';
import royalLuxManifest from '../data/themes/royal-lux/manifest.json';
import royalLuxThemeCss from '../data/themes/royal-lux/theme.css';
import { getAppearancePath, getThemesPath } from './vault-paths';

interface ThemeManifest {
	name: string;
	version: string;
}

const bundledRoyalLux: ThemeManifest = royalLuxManifest;
const bundledRoyalLuxCss = royalLuxThemeCss;

async function adapterExists(app: App, targetPath: string): Promise<boolean> {
	return app.vault.adapter.exists(normalizePath(targetPath));
}

async function readTextFile(app: App, targetPath: string): Promise<string> {
	return app.vault.adapter.read(normalizePath(targetPath));
}

async function writeTextFile(
	app: App,
	targetPath: string,
	content: string,
): Promise<void> {
	const path = normalizePath(targetPath);
	const parent = path.split('/').slice(0, -1).join('/');
	if (parent) {
		await app.vault.adapter.mkdir(parent);
	}
	await app.vault.adapter.write(path, content);
}

async function removePath(app: App, targetPath: string): Promise<void> {
	const path = normalizePath(targetPath);
	if (await adapterExists(app, path)) {
		await app.vault.adapter.rmdir(path, true);
	}
}

async function renamePath(
	app: App,
	fromPath: string,
	toPath: string,
): Promise<void> {
	await app.vault.adapter.rename(
		normalizePath(fromPath),
		normalizePath(toPath),
	);
}

async function readThemeManifest(
	app: App,
	manifestPath: string,
): Promise<ThemeManifest> {
	const raw = await readTextFile(app, manifestPath);
	const parsed = JSON.parse(raw) as ThemeManifest;
	if (!parsed.name || !parsed.version) {
		throw new Error('Invalid theme manifest.');
	}
	return parsed;
}

async function writeAppearanceTheme(
	app: App,
	themeName: string,
): Promise<void> {
	const appearancePath = getAppearancePath(app);
	let next: Record<string, unknown> = {};
	if (await adapterExists(app, appearancePath)) {
		const raw = (await readTextFile(app, appearancePath)).trim();
		if (raw) {
			next = JSON.parse(raw) as Record<string, unknown>;
		}
	}
	next.cssTheme = themeName;
	await writeTextFile(
		app,
		appearancePath,
		`${JSON.stringify(next, null, 2)}\n`,
	);
}

export function getBundledRoyalLuxManifest(): ThemeManifest {
	return bundledRoyalLux;
}

export function getBundledRoyalLuxAssets(): {
	manifestJson: string;
	themeCss: string;
} {
	return {
		manifestJson: JSON.stringify(bundledRoyalLux, null, 2),
		themeCss: bundledRoyalLuxCss,
	};
}

export async function getRoyalLuxThemeStatus(
	app: App,
): Promise<ThemeStatusInfo> {
	const themesRoot = getThemesPath(app);
	const installedManifestPath = normalizePath(
		`${themesRoot}/${bundledRoyalLux.name}/manifest.json`,
	);
	let installedVersion: string | undefined;
	try {
		const installed = await readThemeManifest(app, installedManifestPath);
		installedVersion = installed.version;
	} catch {
		installedVersion = undefined;
	}
	return {
		themeName: bundledRoyalLux.name,
		availableVersion: bundledRoyalLux.version,
		...(installedVersion ? { installedVersion } : {}),
	};
}

/** Count of installed catalog themes with a newer bundled version available. */
export async function countCatalogThemeUpdatesAvailable(app: App): Promise<number> {
	const status = await getRoyalLuxThemeStatus(app);
	if (!status.installedVersion) {
		return 0;
	}
	return isUpdateAvailable(status.installedVersion, status.availableVersion)
		? 1
		: 0;
}

export async function installObsidianTheme(
	app: App,
	manifestJson: string,
	themeCss: string,
): Promise<ThemeInstallResult> {
	const manifest = JSON.parse(manifestJson) as ThemeManifest;
	const themesRoot = getThemesPath(app);
	const themeDir = normalizePath(`${themesRoot}/${manifest.name}`);
	const tempDir = normalizePath(`${themeDir}.tmp`);
	const backupDir = normalizePath(`${themeDir}.backup-${Date.now()}`);
	const hadExistingInstall = await adapterExists(app, themeDir);

	await app.vault.adapter.mkdir(themesRoot);
	await removePath(app, tempDir);
	await app.vault.adapter.mkdir(tempDir);
	await writeTextFile(app, `${tempDir}/manifest.json`, manifestJson);
	await writeTextFile(app, `${tempDir}/theme.css`, themeCss);

	try {
		if (hadExistingInstall) {
			await renamePath(app, themeDir, backupDir);
		}
		await renamePath(app, tempDir, themeDir);
		if (hadExistingInstall) {
			await removePath(app, backupDir);
		}
		await writeAppearanceTheme(app, manifest.name);
		return {
			themeName: manifest.name,
			version: manifest.version,
			success: true,
			message: hadExistingInstall
				? 'Theme updated successfully.'
				: 'Theme installed successfully.',
		};
	} catch (error) {
		await removePath(app, themeDir);
		if (hadExistingInstall) {
			try {
				await renamePath(app, backupDir, themeDir);
			} catch {
				/* best effort */
			}
		}
		await removePath(app, tempDir);
		const message =
			error instanceof Error ? error.message : 'Unknown theme install failure.';
		return {
			themeName: manifest.name,
			version: manifest.version,
			success: false,
			message: `Theme install failed: ${message}`,
		};
	}
}

export async function removeRoyalLuxTheme(app: App): Promise<void> {
	const themesRoot = getThemesPath(app);
	const themeDir = normalizePath(`${themesRoot}/${bundledRoyalLux.name}`);
	await removePath(app, themeDir);

	const appearancePath = getAppearancePath(app);
	try {
		const raw = (await readTextFile(app, appearancePath)).trim();
		if (!raw) {
			return;
		}
		const appearance = JSON.parse(raw) as { cssTheme?: string };
		if (appearance.cssTheme === bundledRoyalLux.name) {
			delete appearance.cssTheme;
			await writeTextFile(
				app,
				appearancePath,
				`${JSON.stringify(appearance, null, 2)}\n`,
			);
		}
	} catch {
		/* ignore */
	}
}
