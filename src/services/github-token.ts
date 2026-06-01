import type { App } from 'obsidian';

/**
 * Secret id in **Settings → Keychain** (Obsidian 1.11.4+).
 * Optional — only used when the platform has no release bundle and a private
 * GitHub repo must be read. End users with a normal platform login do not need this.
 */
export const GITHUB_PAT_SECRET_ID = 'santi-catalog-github';

/** Returns a GitHub PAT from Obsidian Keychain, if configured. */
export function getGithubPatFromKeychain(app: App): string | undefined {
	const storage = app.secretStorage;
	if (!storage?.getSecret) {
		return undefined;
	}
	const value = storage.getSecret(GITHUB_PAT_SECRET_ID);
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

/** True when a non-empty PAT is stored (install/update will prefer GitHub releases). */
export function hasGithubPatInKeychain(app: App): boolean {
	return Boolean(getGithubPatFromKeychain(app));
}
