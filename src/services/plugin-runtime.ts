import { normalizePath, type App } from 'obsidian';
import { getCommunityPluginsPath, getPluginsPath } from './vault-paths';

export interface EnableInstalledPluginResult {
	enabled: boolean;
	requiresReload: boolean;
}

interface ObsidianPluginManager {
	enablePlugin(id: string): Promise<void>;
	disablePlugin(id: string): Promise<void>;
	enablePluginAndSave?(id: string): Promise<void>;
	disablePluginAndSave?(id: string): Promise<void>;
	loadManifest?(pluginDir: string): Promise<void>;
	loadManifests?(): Promise<void>;
	getPluginFolder?(): string;
	enabledPlugins: Set<string>;
	plugins: Record<string, unknown>;
	manifests: Record<string, { id: string; dir: string }>;
}

function getObsidianPluginManager(app: App): ObsidianPluginManager | null {
	const manager = (app as App & { plugins?: ObsidianPluginManager }).plugins;
	if (
		!manager ||
		typeof manager.enablePlugin !== 'function' ||
		!manager.enabledPlugins
	) {
		return null;
	}
	return manager;
}

function getInstalledPluginDirectory(app: App, pluginId: string): string {
	const manager = getObsidianPluginManager(app);
	const pluginsFolder = manager?.getPluginFolder?.() ?? getPluginsPath(app);
	return normalizePath(`${pluginsFolder}/${pluginId}`);
}

async function adapterExists(app: App, targetPath: string): Promise<boolean> {
	return app.vault.adapter.exists(normalizePath(targetPath));
}

async function readTextFile(app: App, targetPath: string): Promise<string> {
	return app.vault.adapter.read(normalizePath(targetPath));
}

function dirname(filePath: string): string {
	const parts = normalizePath(filePath).split('/');
	parts.pop();
	return parts.join('/');
}

async function writeTextFile(
	app: App,
	targetPath: string,
	content: string,
): Promise<void> {
	const path = normalizePath(targetPath);
	const parent = dirname(path);
	if (parent) {
		await app.vault.adapter.mkdir(parent);
	}
	await app.vault.adapter.write(path, content);
}

async function readEnabledPluginIdsFromConfig(app: App): Promise<string[]> {
	const filePath = getCommunityPluginsPath(app);
	if (!(await adapterExists(app, filePath))) {
		return [];
	}
	try {
		const raw = (await readTextFile(app, filePath)).trim();
		if (!raw) {
			return [];
		}
		const parsed = JSON.parse(raw) as unknown;
		if (
			!Array.isArray(parsed) ||
			!parsed.every((item): item is string => typeof item === 'string')
		) {
			return [];
		}
		return parsed;
	} catch {
		return [];
	}
}

async function persistEnabledPluginIdToConfig(
	app: App,
	pluginId: string,
): Promise<void> {
	const filePath = getCommunityPluginsPath(app);
	const list = await readEnabledPluginIdsFromConfig(app);
	if (list.includes(pluginId)) {
		return;
	}
	list.push(pluginId);
	await writeTextFile(app, filePath, `${JSON.stringify(list, null, 2)}\n`);
	const verified = await readEnabledPluginIdsFromConfig(app);
	if (!verified.includes(pluginId)) {
		throw new Error(
			'Could not save the enabled plugin list for this vault.',
		);
	}
}

async function reloadAllPluginManifests(
	manager: ObsidianPluginManager,
): Promise<void> {
	if (typeof manager.loadManifests === 'function') {
		await manager.loadManifests();
	}
}

/**
 * Tell Obsidian about a plugin folder that was just written to disk so it
 * appears under settings → community plugins without restarting the app.
 */
export async function registerInstalledPluginWithObsidian(
	app: App,
	pluginId: string,
): Promise<void> {
	const manager = getObsidianPluginManager(app);
	if (!manager) {
		throw new Error('Obsidian plugin manager is not available.');
	}

	const pluginDir = getInstalledPluginDirectory(app, pluginId);
	if (!(await adapterExists(app, pluginDir))) {
		throw new Error(
			`Installed plugin folder was not found at ${pluginDir}.`,
		);
	}

	if (typeof manager.loadManifest === 'function') {
		await manager.loadManifest(pluginDir);
	}

	await reloadAllPluginManifests(manager);
}

function isPluginKnownToObsidian(
	manager: ObsidianPluginManager,
	pluginId: string,
): boolean {
	return Boolean(manager.manifests[pluginId] || manager.plugins[pluginId]);
}

async function disableAndPersistPlugin(
	manager: ObsidianPluginManager,
	app: App,
	pluginId: string,
): Promise<void> {
	if (typeof manager.disablePluginAndSave === 'function') {
		await manager.disablePluginAndSave(pluginId);
		return;
	}

	if (manager.enabledPlugins.has(pluginId)) {
		await manager.disablePlugin(pluginId);
	}

	const filePath = getCommunityPluginsPath(app);
	if (!(await adapterExists(app, filePath))) {
		return;
	}
	const list = await readEnabledPluginIdsFromConfig(app);
	if (!list.includes(pluginId)) {
		return;
	}
	const next = list.filter((id) => id !== pluginId);
	await writeTextFile(app, filePath, `${JSON.stringify(next, null, 2)}\n`);
}

/**
 * Unloads a plugin from Obsidian's runtime and enabled list before deleting its
 * folder so a fresh install can prompt to enable again.
 */
export async function disableCommunityPluginsForIds(
	app: App,
	pluginIds: Iterable<string>,
): Promise<void> {
	const manager = getObsidianPluginManager(app);
	const ids = [...new Set(pluginIds)].filter((id) => id.length > 0);
	if (ids.length === 0) {
		return;
	}

	for (const pluginId of ids) {
		if (!manager) {
			break;
		}
		try {
			if (
				manager.enabledPlugins.has(pluginId) ||
				isPluginKnownToObsidian(manager, pluginId)
			) {
				await disableAndPersistPlugin(manager, app, pluginId);
			}
		} catch {
			/* folder may already be gone; still clear in-memory state below */
		}
		manager.enabledPlugins.delete(pluginId);
		delete manager.plugins[pluginId];
		delete manager.manifests[pluginId];
	}

	if (manager) {
		await reloadAllPluginManifests(manager);
	}
}

async function enableAndPersistPlugin(
	manager: ObsidianPluginManager,
	app: App,
	pluginId: string,
): Promise<void> {
	if (typeof manager.enablePluginAndSave === 'function') {
		await manager.enablePluginAndSave(pluginId);
		return;
	}

	await manager.enablePlugin(pluginId);
	await persistEnabledPluginIdToConfig(app, pluginId);
}

export async function refreshInstalledPluginManifests(
	app: App,
	pluginId?: string,
): Promise<void> {
	const manager = getObsidianPluginManager(app);
	if (!manager) {
		return;
	}

	if (pluginId && typeof manager.loadManifest === 'function') {
		const pluginDir = getInstalledPluginDirectory(app, pluginId);
		if (await adapterExists(app, pluginDir)) {
			await manager.loadManifest(pluginDir);
		}
	}

	await reloadAllPluginManifests(manager);
}

export async function enableInstalledCommunityPlugin(
	app: App,
	pluginId: string,
): Promise<EnableInstalledPluginResult> {
	const manager = getObsidianPluginManager(app);
	if (!manager) {
		throw new Error('Obsidian plugin manager is not available.');
	}

	await registerInstalledPluginWithObsidian(app, pluginId);

	if (manager.enabledPlugins.has(pluginId)) {
		return { enabled: true, requiresReload: false };
	}

	if (!isPluginKnownToObsidian(manager, pluginId)) {
		throw new Error(
			`${pluginId} was installed but Obsidian has not registered it yet. Reload Obsidian, then enable it under settings → community plugins.`,
		);
	}

	await enableAndPersistPlugin(manager, app, pluginId);
	await reloadAllPluginManifests(manager);

	if (manager.enabledPlugins.has(pluginId)) {
		return { enabled: true, requiresReload: false };
	}

	const savedInConfig = (await readEnabledPluginIdsFromConfig(app)).includes(
		pluginId,
	);
	if (savedInConfig) {
		return { enabled: false, requiresReload: true };
	}

	throw new Error(
		'Obsidian did not enable the plugin. Try again under settings → community plugins.',
	);
}

export async function isCommunityPluginEnabled(
	app: App,
	pluginId: string,
): Promise<boolean> {
	const pluginDir = getInstalledPluginDirectory(app, pluginId);
	if (!(await adapterExists(app, pluginDir))) {
		return false;
	}

	const manager = getObsidianPluginManager(app);
	if (manager?.enabledPlugins.has(pluginId)) {
		return true;
	}
	const fromConfig = await readEnabledPluginIdsFromConfig(app);
	return fromConfig.includes(pluginId);
}
