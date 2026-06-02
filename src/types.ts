export interface PluginCatalogEntry {
	id: string;
	name: string;
	description?: string;
	previewImageUrl?: string;
	comingSoon?: boolean;
	repository: string;
	obsidianManifestId?: string;
	sourceType?: 'release' | 'repository';
	sourceSubdir?: string;
	sourceRef?: string;
	minAppVersion?: string;
	releaseChannel?: 'stable' | 'beta';
	requiresAuth?: boolean;
	requiredCourseIds?: string[];
}

export interface ThemeCatalogEntry {
	id: string;
	name: string;
	description?: string;
	previewImageUrl?: string;
}

export interface CatalogBundle {
	plugins: PluginCatalogEntry[];
	themes: ThemeCatalogEntry[];
}

export interface PluginInstallState {
	pluginId: string;
	installedVersion: string;
	updatedAt: string;
}

export interface PlatformSessionState {
	baseUrl: string;
	email: string;
	authCookie: string;
	purchasedCourses: string[];
	grantedPluginIds: string[];
	grantedThemeIds: string[];
	lastSyncedAt: string;
	displayName?: string;
}

export interface PlatformConnectionState {
	connected: boolean;
	baseUrl: string;
	email?: string;
	displayName?: string;
	purchasedCourses: string[];
	grantedPluginIds: string[];
	grantedThemeIds: string[];
	lastSyncedAt?: string;
}

export interface SendMagicLinkResult {
	success: boolean;
	message: string;
}

export interface VerifyCodeResult {
	success: boolean;
	message: string;
	connectionState?: PlatformConnectionState;
}

export interface PluginReleaseAssets {
	version: string;
	manifestJson: string;
	mainJs: string;
	stylesCss?: string;
	extraFiles?: Array<{
		relativePath: string;
		content: string;
	}>;
}

export interface InstallResult {
	pluginId: string;
	version: string;
	success: boolean;
	message: string;
}

export interface ThemeInstallResult {
	themeName: string;
	version: string;
	success: boolean;
	message: string;
}

export interface ThemeStatusInfo {
	themeName: string;
	availableVersion: string;
	installedVersion?: string;
}

export interface ThemeUpdateInfo {
	themeId: string;
	themeName: string;
	installedVersion: string;
	latestVersion: string;
	updateAvailable: boolean;
}

export interface PluginUpdateInfo {
	pluginId: string;
	installedVersion: string;
	latestVersion: string;
	updateAvailable: boolean;
}

export interface InstalledPluginInfo {
	pluginId: string;
	name: string;
	installedVersion: string;
}

export interface PluginDataState {
	installs: PluginInstallState[];
	lastCheckedAt?: string;
	pluginUpdates?: PluginUpdateInfo[];
	platformSession?: PlatformSessionState;
}
