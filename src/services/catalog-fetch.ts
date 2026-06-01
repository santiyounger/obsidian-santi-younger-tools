import { buildPlatformApiHeaders } from '../common/platform-fetch-headers';
import type { PluginCatalogEntry, PluginReleaseAssets } from '../types';
import { httpRequest } from './http';

const USER_AGENT = 'santi-younger-tools-plugin';

interface PlatformPrivatePluginRequestContext {
	authCookie: string;
}

class PrivatePluginPlatformError extends Error {
	constructor(
		message: string,
		readonly kind: 'unauthorized' | 'not_found' | 'bad_status',
	) {
		super(message);
		this.name = 'PrivatePluginPlatformError';
	}
}

function parseRepositoryOwnerAndName(repository: string): {
	owner: string;
	repo: string;
} {
	const cleaned = repository
		.replace('https://github.com/', '')
		.replace(/\/+$/u, '');
	const parts = cleaned.split('/');
	if (parts.length < 2 || !parts[0] || !parts[1]) {
		throw new Error(`Invalid repository value: ${repository}`);
	}
	return { owner: parts[0], repo: parts[1] };
}

function buildGitHubHeaders(githubToken?: string): Record<string, string> {
	return {
		'User-Agent': USER_AGENT,
		Accept: 'application/vnd.github+json',
		...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
	};
}

async function fetchFromGitHub(
	url: string,
	githubToken?: string,
	accept?: string,
): Promise<{ ok: boolean; status: number; text: string; json: unknown }> {
	const headers: Record<string, string> = {
		...buildGitHubHeaders(githubToken),
		...(accept ? { Accept: accept } : {}),
	};
	let response = await httpRequest(url, { headers });
	if (response.status === 401 && githubToken) {
		response = await httpRequest(url, {
			headers: {
				...buildGitHubHeaders(undefined),
				...(accept ? { Accept: accept } : {}),
			},
		});
	}
	return response;
}

async function fetchGitHubJson(
	url: string,
	githubToken?: string,
): Promise<unknown> {
	const response = await fetchFromGitHub(url, githubToken);
	if (!response.ok) {
		throw new Error(`GitHub API request failed for ${url}: ${response.status}`);
	}
	return response.json;
}

async function downloadTextFile(
	url: string,
	githubToken?: string,
): Promise<string> {
	const response = await fetchFromGitHub(url, githubToken);
	if (!response.ok) {
		throw new Error(`Failed to download ${url}: ${response.status}`);
	}
	return response.text;
}

async function downloadReleaseAssetText(
	assetApiUrl: string,
	githubToken?: string,
): Promise<string> {
	const response = await fetchFromGitHub(
		assetApiUrl,
		githubToken,
		'application/octet-stream',
	);
	if (!response.ok) {
		throw new Error(`Failed to download release asset: ${response.status}`);
	}
	return response.text;
}

async function fetchPrivatePluginAssetsFromPlatform(
	entry: PluginCatalogEntry,
	baseUrl: string,
	context: PlatformPrivatePluginRequestContext,
): Promise<PluginReleaseAssets> {
	const base = baseUrl.trim().replace(/\/+$/u, '');
	const response = await httpRequest(
		`${base}/api/plugins/${encodeURIComponent(entry.id)}/release-assets`,
		{
			headers: buildPlatformApiHeaders(base, context.authCookie),
		},
	);
	if (!response.ok) {
		if (response.status === 401 || response.status === 403) {
			throw new PrivatePluginPlatformError(
				`You do not have access to ${entry.name} yet. Please sign in again.`,
				'unauthorized',
			);
		}
		if (response.status === 404) {
			throw new PrivatePluginPlatformError(
				`No install package from the platform for ${entry.id} yet.`,
				'not_found',
			);
		}
		throw new PrivatePluginPlatformError(
			`Could not fetch release assets for ${entry.id}: ${response.status}`,
			'bad_status',
		);
	}
	const payload = response.json as Record<string, unknown>;
	const version =
		typeof payload.version === 'string' ? payload.version : '';
	const manifestJson =
		typeof payload.manifestJson === 'string' ? payload.manifestJson : '';
	const mainJs = typeof payload.mainJs === 'string' ? payload.mainJs : '';
	if (!version || !manifestJson || !mainJs) {
		throw new Error(`Invalid release assets payload for ${entry.id}.`);
	}
	return {
		version,
		manifestJson,
		mainJs,
		...(typeof payload.stylesCss === 'string'
			? { stylesCss: payload.stylesCss }
			: {}),
		...(Array.isArray(payload.extraFiles)
			? {
					extraFiles: payload.extraFiles.filter(
						(f): f is { relativePath: string; content: string } =>
							!!f &&
							typeof f === 'object' &&
							typeof (f as { relativePath?: unknown }).relativePath ===
								'string' &&
							typeof (f as { content?: unknown }).content === 'string',
					),
				}
			: {}),
	};
}

async function getRepositoryRef(
	owner: string,
	repo: string,
	preferredRef: string | undefined,
	githubToken?: string,
): Promise<string> {
	if (preferredRef?.trim()) {
		return preferredRef.trim();
	}
	const repoRaw = await fetchGitHubJson(
		`https://api.github.com/repos/${owner}/${repo}`,
		githubToken,
	);
	const defaultBranch = (repoRaw as { default_branch?: string })
		.default_branch;
	if (!defaultBranch) {
		throw new Error(`Could not resolve default branch for ${owner}/${repo}.`);
	}
	return defaultBranch;
}

interface GitHubContentItem {
	type: 'file' | 'dir';
	path: string;
	url: string;
}

async function collectRepositoryFiles(
	directoryApiUrl: string,
	githubToken: string | undefined,
	files: Array<{ path: string; apiUrl: string }>,
): Promise<void> {
	const directoryRaw = await fetchGitHubJson(directoryApiUrl, githubToken);
	if (!Array.isArray(directoryRaw)) {
		throw new Error('Unexpected GitHub directory listing.');
	}
	for (const item of directoryRaw as GitHubContentItem[]) {
		if (item.type === 'file') {
			files.push({ path: item.path, apiUrl: item.url });
			continue;
		}
		if (item.type === 'dir') {
			await collectRepositoryFiles(item.url, githubToken, files);
		}
	}
}

const BASE64_ALPHABET =
	'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64Utf8(content: string): string {
	const normalized = content.replace(/\n/gu, '');
	const lookup = new Uint8Array(128);
	for (let i = 0; i < 64; i++) {
		lookup[BASE64_ALPHABET.charCodeAt(i)] = i;
	}
	const padding =
		normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
	const bytes = new Uint8Array(
		Math.floor((normalized.length * 3) / 4) - padding,
	);
	let byteIndex = 0;
	for (let i = 0; i < normalized.length; i += 4) {
		const a = lookup[normalized.charCodeAt(i)] ?? 0;
		const b = lookup[normalized.charCodeAt(i + 1)] ?? 0;
		const cChar = normalized[i + 2] ?? '=';
		const dChar = normalized[i + 3] ?? '=';
		const c = cChar === '=' ? 0 : (lookup[cChar.charCodeAt(0)] ?? 0);
		const d = dChar === '=' ? 0 : (lookup[dChar.charCodeAt(0)] ?? 0);
		bytes[byteIndex++] = (a << 2) | (b >> 4);
		if (cChar !== '=') {
			bytes[byteIndex++] = ((b & 15) << 4) | (c >> 2);
		}
		if (dChar !== '=') {
			bytes[byteIndex++] = ((c & 3) << 6) | d;
		}
	}
	return new TextDecoder().decode(bytes);
}

async function fetchRepositoryAssets(
	entry: PluginCatalogEntry,
	githubToken?: string,
): Promise<PluginReleaseAssets> {
	const { owner, repo } = parseRepositoryOwnerAndName(entry.repository);
	const sourceRef = await getRepositoryRef(
		owner,
		repo,
		entry.sourceRef,
		githubToken,
	);
	const sourceSubdir = (entry.sourceSubdir ?? '').replace(/^\/+|\/+$/gu, '');
	const encodedSubdir = sourceSubdir
		.split('/')
		.filter(Boolean)
		.map((segment) => encodeURIComponent(segment))
		.join('/');
	const contentsPathSuffix = encodedSubdir ? `/${encodedSubdir}` : '';
	const rootContentsApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents${contentsPathSuffix}?ref=${encodeURIComponent(sourceRef)}`;

	const files: Array<{ path: string; apiUrl: string }> = [];
	await collectRepositoryFiles(rootContentsApiUrl, githubToken, files);
	const sourcePrefix = sourceSubdir ? `${sourceSubdir}/` : '';
	const fileMap = new Map<string, string>();
	for (const file of files) {
		const rawFile = await fetchGitHubJson(file.apiUrl, githubToken);
		const parsed = rawFile as {
			type?: string;
			path?: string;
			encoding?: string;
			content?: string;
		};
		if (
			parsed.type !== 'file' ||
			parsed.encoding !== 'base64' ||
			!parsed.path ||
			!parsed.content
		) {
			continue;
		}
		const rawContent = decodeBase64Utf8(parsed.content);
		const relativePath = sourcePrefix
			? parsed.path.replace(sourcePrefix, '')
			: parsed.path;
		fileMap.set(relativePath, rawContent);
	}

	let pluginRoot = '';
	const hasRootManifest = fileMap.has('manifest.json');
	const hasRootMainJs = fileMap.has('main.js');
	if (!hasRootManifest || !hasRootMainJs) {
		const candidateRoots = [...fileMap.keys()]
			.filter((relativePath) => relativePath.endsWith('/manifest.json'))
			.map((relativePath) =>
				relativePath.slice(0, -'manifest.json'.length),
			)
			.filter((candidateRoot) => fileMap.has(`${candidateRoot}main.js`));
		if (candidateRoots.length === 0) {
			throw new Error(
				`Repository source for ${entry.id} must include manifest.json and main.js.`,
			);
		}
		const normalizedEntryId = entry.id.trim().toLowerCase();
		candidateRoots.sort((a, b) => {
			const manifestA = fileMap.get(`${a}manifest.json`);
			let scoreA = 0;
			if (manifestA) {
				try {
					const id = (JSON.parse(manifestA) as { id?: string }).id
						?.trim()
						.toLowerCase();
					if (id === normalizedEntryId) {
						scoreA = 100;
					}
				} catch {
					/* ignore */
				}
			}
			const manifestB = fileMap.get(`${b}manifest.json`);
			let scoreB = 0;
			if (manifestB) {
				try {
					const id = (JSON.parse(manifestB) as { id?: string }).id
						?.trim()
						.toLowerCase();
					if (id === normalizedEntryId) {
						scoreB = 100;
					}
				} catch {
					/* ignore */
				}
			}
			const depthA = a.split('/').filter(Boolean).length;
			const depthB = b.split('/').filter(Boolean).length;
			const byScore = scoreB - scoreA;
			if (byScore !== 0) return byScore;
			return depthA - depthB;
		});
		pluginRoot = candidateRoots[0] ?? '';
	}

	const resolvePluginPath = (fileName: string): string =>
		`${pluginRoot}${fileName}`;
	const manifestJson = fileMap.get(resolvePluginPath('manifest.json'));
	const mainJs = fileMap.get(resolvePluginPath('main.js'));
	if (!manifestJson || !mainJs) {
		throw new Error(
			`Repository source for ${entry.id} is missing manifest.json or main.js.`,
		);
	}
	const manifestVersion = (
		JSON.parse(manifestJson) as { version?: string }
	).version;
	if (!manifestVersion) {
		throw new Error(`manifest.json for ${entry.id} is missing version.`);
	}
	const stylesCss = fileMap.get(resolvePluginPath('styles.css'));
	const pluginRootPrefix = pluginRoot;
	const extraFiles = [...fileMap.entries()]
		.filter(([relativePath]) => relativePath.startsWith(pluginRootPrefix))
		.map(([relativePath, content]) => ({
			relativePath: relativePath.slice(pluginRootPrefix.length),
			content,
		}))
		.filter(
			({ relativePath }) =>
				!['manifest.json', 'main.js', 'styles.css'].includes(relativePath),
		);

	return {
		version: manifestVersion,
		manifestJson,
		mainJs,
		...(stylesCss ? { stylesCss } : {}),
		...(extraFiles.length > 0 ? { extraFiles } : {}),
	};
}

async function fetchLatestReleaseAssets(
	entry: PluginCatalogEntry,
	githubToken?: string,
): Promise<PluginReleaseAssets> {
	const { owner, repo } = parseRepositoryOwnerAndName(entry.repository);
	const releaseUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
	let releaseResponse = await fetchFromGitHub(releaseUrl, githubToken);
	let release: {
		tag_name: string;
		draft?: boolean;
		prerelease?: boolean;
		assets: Array<{
			name: string;
			browser_download_url: string;
			url: string;
		}>;
	};

	if (!releaseResponse.ok) {
		if (releaseResponse.status === 404) {
			const releasesUrl = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=20`;
			const releasesResponse = await fetchFromGitHub(releasesUrl, githubToken);
			if (!releasesResponse.ok) {
				throw new Error(
					`Cannot fetch releases for ${entry.id}: ${releasesResponse.status}`,
				);
			}
			const releases = releasesResponse.json as Array<{
				tag_name: string;
				draft?: boolean;
				prerelease?: boolean;
				assets: Array<{
					name: string;
					browser_download_url: string;
					url: string;
				}>;
			}>;
			const includePrereleases = entry.releaseChannel === 'beta';
			const selected = releases.find((candidate) => {
				const isDraft = candidate.draft === true;
				const isPrerelease = candidate.prerelease === true;
				return !isDraft && (includePrereleases || !isPrerelease);
			});
			if (!selected) {
				throw new Error(`No published release found for ${entry.id}.`);
			}
			release = selected;
		} else {
			throw new Error(
				`Cannot fetch latest release for ${entry.id}: ${releaseResponse.status}`,
			);
		}
	} else {
		release = releaseResponse.json as typeof release;
	}

	const assetMap = new Map(release.assets.map((asset) => [asset.name, asset]));
	const manifestAsset = assetMap.get('manifest.json');
	const mainJsAsset = assetMap.get('main.js');
	if (!manifestAsset || !mainJsAsset) {
		throw new Error(
			`Release for ${entry.id} must include manifest.json and main.js assets.`,
		);
	}

	const downloadManifest = entry.requiresAuth
		? downloadReleaseAssetText(manifestAsset.url, githubToken)
		: downloadTextFile(manifestAsset.browser_download_url, githubToken);
	const downloadMainJs = entry.requiresAuth
		? downloadReleaseAssetText(mainJsAsset.url, githubToken)
		: downloadTextFile(mainJsAsset.browser_download_url, githubToken);
	const stylesAsset = assetMap.get('styles.css');
	const stylesCss = stylesAsset
		? entry.requiresAuth
			? await downloadReleaseAssetText(stylesAsset.url, githubToken)
			: await downloadTextFile(stylesAsset.browser_download_url, githubToken)
		: undefined;
	const manifestJson = await downloadManifest;
	const mainJs = await downloadMainJs;

	return {
		version: release.tag_name.replace(/^v/iu, ''),
		manifestJson,
		mainJs,
		...(stylesCss ? { stylesCss } : {}),
	};
}

export async function fetchPluginAssets(
	entry: PluginCatalogEntry,
	options: {
		githubToken?: string;
		platformBaseUrl: string;
		authCookie?: string;
	},
): Promise<PluginReleaseAssets> {
	const privateContext = options.authCookie
		? { authCookie: options.authCookie }
		: undefined;
	if (entry.requiresAuth && privateContext) {
		try {
			return await fetchPrivatePluginAssetsFromPlatform(
				entry,
				options.platformBaseUrl,
				privateContext,
			);
		} catch (error) {
			const isNoBundle =
				error instanceof PrivatePluginPlatformError &&
				error.kind === 'not_found' &&
				!options.githubToken;
			if (isNoBundle) {
				throw new Error(
					`No install package from the platform for ${entry.id}. Sign in on the website or contact support.`,
				);
			}
			if (
				error instanceof PrivatePluginPlatformError &&
				error.kind === 'not_found' &&
				options.githubToken
			) {
				if (entry.sourceType === 'repository') {
					return fetchRepositoryAssets(entry, options.githubToken);
				}
				return fetchLatestReleaseAssets(entry, options.githubToken);
			}
			throw error;
		}
	}
	if (entry.sourceType === 'repository') {
		return fetchRepositoryAssets(entry, options.githubToken);
	}
	return fetchLatestReleaseAssets(entry, options.githubToken);
}
