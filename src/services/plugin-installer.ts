import { normalizePath, type App } from 'obsidian';
import type { InstallResult, PluginReleaseAssets } from '../types';
import {
	getCommunityPluginsPath,
	getPluginsPath,
} from './vault-paths';

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

async function sleep(ms: number): Promise<void> {
	await new Promise<void>((resolve) => {
		window.setTimeout(() => resolve(), ms);
	});
}

async function renameWithRetry(
	app: App,
	fromPath: string,
	toPath: string,
): Promise<void> {
	const delaysMs = [0, 120, 300, 700];
	let lastError: unknown;
	for (const delayMs of delaysMs) {
		if (delayMs > 0) {
			await sleep(delayMs);
		}
		try {
			await renamePath(app, fromPath, toPath);
			return;
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError;
}

async function readManifestPluginId(
	app: App,
	pluginDir: string,
): Promise<string | undefined> {
	try {
		const raw = await readTextFile(
			app,
			`${pluginDir}/manifest.json`,
		);
		const parsed = JSON.parse(raw) as { id?: string };
		return typeof parsed.id === 'string' ? parsed.id : undefined;
	} catch {
		return undefined;
	}
}

function manifestMatchesCatalogPluginId(
	manifestId: string,
	catalogPluginId: string,
	alternateManifestId?: string,
): boolean {
	const m = manifestId.trim().toLowerCase();
	const c = catalogPluginId.trim().toLowerCase();
	if (m === c) {
		return true;
	}
	if (alternateManifestId && m === alternateManifestId.trim().toLowerCase()) {
		return true;
	}
	return false;
}

export async function resolvePluginDirectoryForCatalogId(
	app: App,
	catalogPluginId: string,
	alternateManifestId?: string,
): Promise<string | null> {
	const pluginsPath = getPluginsPath(app);
	const directPath = normalizePath(`${pluginsPath}/${catalogPluginId}`);
	const directIsDir = await adapterExists(app, directPath);

	if (directIsDir) {
		const manifestId = await readManifestPluginId(app, directPath);
		if (
			manifestId === undefined ||
			manifestMatchesCatalogPluginId(
				manifestId,
				catalogPluginId,
				alternateManifestId,
			)
		) {
			return directPath;
		}
	}

	let folders: string[];
	try {
		const listed = await app.vault.adapter.list(pluginsPath);
		folders = listed.folders;
	} catch {
		return directIsDir ? directPath : null;
	}

	for (const folder of folders) {
		const dir = normalizePath(`${pluginsPath}/${folder}`);
		if (dir === directPath) {
			continue;
		}
		const manifestId = await readManifestPluginId(app, dir);
		if (
			manifestId !== undefined &&
			manifestMatchesCatalogPluginId(
				manifestId,
				catalogPluginId,
				alternateManifestId,
			)
		) {
			return dir;
		}
	}

	return directIsDir ? directPath : null;
}

export async function enableCommunityPlugin(
	app: App,
	pluginId: string,
): Promise<void> {
	const filePath = getCommunityPluginsPath(app);
	let list: string[] = [];
	if (await adapterExists(app, filePath)) {
		const raw = (await readTextFile(app, filePath)).trim();
		if (raw.length > 0) {
			const parsed = JSON.parse(raw) as unknown;
			if (
				!Array.isArray(parsed) ||
				!parsed.every((item): item is string => typeof item === 'string')
			) {
				throw new Error(
					'Invalid community-plugins.json: expected a JSON array of plugin id strings.',
				);
			}
			list = [...parsed];
		}
	}
	if (list.includes(pluginId)) {
		return;
	}
	list.push(pluginId);
	await writeTextFile(app, filePath, `${JSON.stringify(list, null, 2)}\n`);
}

export async function installOrUpdatePlugin(
	app: App,
	release: PluginReleaseAssets,
): Promise<InstallResult> {
	const manifest = JSON.parse(release.manifestJson) as {
		id: string;
		version: string;
	};
	if (!manifest.id || !manifest.version) {
		throw new Error('Invalid plugin manifest.');
	}

	const pluginsPath = getPluginsPath(app);
	const pluginDir = normalizePath(`${pluginsPath}/${manifest.id}`);
	const tempDir = normalizePath(`${pluginDir}.tmp`);
	const backupDir = normalizePath(`${pluginDir}.backup-${Date.now()}`);

	await app.vault.adapter.mkdir(pluginsPath);
	await removePath(app, tempDir);
	await app.vault.adapter.mkdir(tempDir);
	await writeTextFile(
		app,
		`${tempDir}/manifest.json`,
		release.manifestJson,
	);
	await writeTextFile(app, `${tempDir}/main.js`, release.mainJs);
	if (release.stylesCss) {
		await writeTextFile(app, `${tempDir}/styles.css`, release.stylesCss);
	}
	if (release.extraFiles) {
		for (const file of release.extraFiles) {
			const destinationPath = normalizePath(
				`${tempDir}/${file.relativePath}`,
			);
			const parent = destinationPath.split('/').slice(0, -1).join('/');
			if (parent) {
				await app.vault.adapter.mkdir(parent);
			}
			await writeTextFile(app, destinationPath, file.content);
		}
	}

	const hadExistingInstall = await adapterExists(app, pluginDir);
	try {
		if (hadExistingInstall) {
			await renameWithRetry(app, pluginDir, backupDir);
		}
		await renameWithRetry(app, tempDir, pluginDir);
		if (hadExistingInstall) {
			await removePath(app, backupDir);
		}
		return {
			pluginId: manifest.id,
			version: manifest.version,
			success: true,
			message: hadExistingInstall
				? 'Plugin updated successfully.'
				: 'Plugin installed successfully.',
		};
	} catch (error) {
		await removePath(app, pluginDir);
		if (hadExistingInstall) {
			try {
				await renameWithRetry(app, backupDir, pluginDir);
			} catch {
				/* best effort rollback */
			}
		}
		await removePath(app, tempDir);
		const message =
			error instanceof Error ? error.message : 'Unknown install failure.';
		return {
			pluginId: manifest.id,
			version: manifest.version,
			success: false,
			message: `Install failed and rollback was attempted: ${message}`,
		};
	}
}

export async function removePlugin(
	app: App,
	catalogPluginId: string,
	alternateManifestId?: string,
): Promise<void> {
	const resolvedDir = await resolvePluginDirectoryForCatalogId(
		app,
		catalogPluginId,
		alternateManifestId,
	);
	const pluginsPath = getPluginsPath(app);
	const pluginDir =
		resolvedDir ?? normalizePath(`${pluginsPath}/${catalogPluginId}`);
	const manifestId = resolvedDir
		? await readManifestPluginId(app, resolvedDir)
		: undefined;
	await removePath(app, pluginDir);

	const filePath = getCommunityPluginsPath(app);
	if (!(await adapterExists(app, filePath))) {
		return;
	}
	try {
		const raw = (await readTextFile(app, filePath)).trim();
		if (!raw) {
			return;
		}
		const parsed = JSON.parse(raw) as unknown;
		if (
			!Array.isArray(parsed) ||
			!parsed.every((item): item is string => typeof item === 'string')
		) {
			return;
		}
		const idsToDrop = new Set<string>([catalogPluginId]);
		if (manifestId) {
			idsToDrop.add(manifestId);
		}
		const next = parsed.filter((id) => !idsToDrop.has(id));
		if (next.length === parsed.length) {
			return;
		}
		await writeTextFile(app, filePath, `${JSON.stringify(next, null, 2)}\n`);
	} catch {
		/* skip invalid community-plugins.json */
	}
}
