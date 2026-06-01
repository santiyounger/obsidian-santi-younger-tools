import {
	mergeInstallerThemeGrants,
	ROYAL_LUX_ENTITLEMENT_ID,
	isPlatformOwnerEmail,
	userHasPluginEntitlement,
	userHasThemeEntitlement,
} from '../common/entitlements';
import { DEFAULT_PLATFORM_BASE_URL } from '../common/default-platform-url';
import { buildPlatformApiHeaders } from '../common/platform-fetch-headers';
import { parseAllPluginListIdsFromInstallerAccessPayload } from '../common/parseGrantedPluginIdsFromApiPayload';
import { parseGrantedPluginIdsFromApiPayload } from '../common/parseGrantedPluginIdsFromApiPayload';
import { parseGrantedThemeIdsFromApiPayload } from '../common/parseGrantedThemeIdsFromApiPayload';
import type {
	PlatformConnectionState,
	PlatformSessionState,
	PluginCatalogEntry,
	SendMagicLinkResult,
	VerifyCodeResult,
} from '../types';
import {
	buildCookieHeaderFromVerifyResponse,
	httpRequest,
	parseDisplayNameFromPayload,
	pickFirstTokenField,
} from './http';

export class PlatformService {
	constructor(
		private getBaseUrl: () => string,
		private getSession: () => PlatformSessionState | undefined,
		private setSession: (session: PlatformSessionState | undefined) => Promise<void>,
	) {}

	getPlatformBaseUrl(): string {
		const configured = this.getBaseUrl().trim();
		return configured || DEFAULT_PLATFORM_BASE_URL;
	}

	async buildConnectionState(): Promise<PlatformConnectionState> {
		const session = this.getSession();
		if (!session) {
			return {
				connected: false,
				baseUrl: this.getPlatformBaseUrl(),
				purchasedCourses: [],
				grantedPluginIds: [],
				grantedThemeIds: [],
			};
		}
		return {
			connected: true,
			baseUrl: this.getPlatformBaseUrl(),
			email: session.email,
			displayName: session.displayName,
			purchasedCourses: session.purchasedCourses,
			grantedPluginIds: session.grantedPluginIds,
			grantedThemeIds: session.grantedThemeIds,
			lastSyncedAt: session.lastSyncedAt,
		};
	}

	hasPluginAccess(entry: PluginCatalogEntry): boolean {
		const session = this.getSession();
		if (!session) {
			return false;
		}
		return userHasPluginEntitlement(entry, session.grantedPluginIds);
	}

	hasThemeAccess(themeId: string): boolean {
		const session = this.getSession();
		if (!session) {
			return false;
		}
		return userHasThemeEntitlement(themeId, session.grantedThemeIds);
	}

	shouldShowThemeCatalogEntry(themeId: string, isInstalled: boolean): boolean {
		if (isInstalled) {
			return true;
		}
		return this.hasThemeAccess(themeId);
	}

	private async platformRequest(
		route: string,
		options: {
			method?: 'GET' | 'POST';
			body?: unknown;
			authCookie?: string;
		} = {},
	) {
		const baseUrl = this.getPlatformBaseUrl().replace(/\/+$/u, '');
		const headerRecord = options.authCookie
			? buildPlatformApiHeaders(baseUrl, options.authCookie)
			: {
					'Content-Type': 'application/json',
					Referer: `${baseUrl}/`,
					Origin: baseUrl,
				};
		return httpRequest(`${baseUrl}${route}`, {
			method: options.method ?? 'GET',
			headers: headerRecord,
			body: options.body ? JSON.stringify(options.body) : undefined,
		});
	}

	async sendMagicLink(email: string): Promise<SendMagicLinkResult> {
		const normalized = email.trim().toLowerCase();
		if (!normalized) {
			throw new Error('Email is required.');
		}
		const response = await this.platformRequest('/api/auth/send-magic-link', {
			method: 'POST',
			body: { email: normalized },
		});
		const body = response.json as {
			success?: boolean;
			message?: string;
			isAdminLogin?: boolean;
		};
		if (!response.ok || !body.success) {
			throw new Error(body.message ?? 'Failed to send login code.');
		}
		if (body.isAdminLogin) {
			throw new Error(
				'This email still requires an admin password on the platform. Use the website login flow, then try again.',
			);
		}
		return {
			success: true,
			message: 'Login code sent. Check your email for your 6-digit code.',
		};
	}

	async verifyCode(email: string, code: string): Promise<VerifyCodeResult> {
		const normalizedEmail = email.trim().toLowerCase();
		const normalizedCode = code.replace(/\s+/gu, '');
		if (!normalizedEmail || !normalizedCode) {
			throw new Error('Email and code are required.');
		}
		const response = await this.platformRequest('/api/auth/verify-code', {
			method: 'POST',
			body: { email: normalizedEmail, code: normalizedCode },
		});
		const cookieFromHeaders = buildCookieHeaderFromVerifyResponse(
			response.headers,
		);
		const body = (response.json ?? {}) as Record<string, unknown> & {
			success?: boolean;
			message?: string;
		};
		if (!response.ok || !body.success) {
			throw new Error(
				(typeof body.message === 'string' && body.message) ||
					'Could not verify login code.',
			);
		}
		const tokenFromBody = pickFirstTokenField(body);
		const authCookie =
			cookieFromHeaders ??
			(tokenFromBody ? `auth-token=${tokenFromBody}` : null);
		if (!authCookie) {
			throw new Error(
				'Login succeeded but no session token was returned. Try signing in on the website, then refresh access here.',
			);
		}
		const baseUrl = this.getPlatformBaseUrl();
		const validatedAt = new Date().toISOString();
		const displayName = parseDisplayNameFromPayload(body);
		await this.setSession({
			baseUrl,
			email: normalizedEmail,
			authCookie,
			purchasedCourses: [],
			grantedPluginIds: [],
			grantedThemeIds: [],
			lastSyncedAt: validatedAt,
			...(displayName ? { displayName } : {}),
		});
		const connectionState = await this.refreshEntitlements();
		if (!this.getSession()) {
			throw new Error(
				'The platform rejected this session after login. Try again or refresh access from the account tab.',
			);
		}
		return {
			success: true,
			message:
				(typeof body.message === 'string' && body.message) ||
				'Connected successfully.',
			connectionState,
		};
	}

	async refreshEntitlements(): Promise<PlatformConnectionState> {
		const session = this.getSession();
		if (!session) {
			return this.buildConnectionState();
		}
		const cookieForThisRun = session.authCookie;

		const response = await this.platformRequest('/api/course-access', {
			authCookie: cookieForThisRun,
		});
		if (!response.ok) {
			if (response.status === 401) {
				const merged: PlatformSessionState = {
					...session,
					lastSyncedAt: new Date().toISOString(),
				};
				await this.setSession(merged);
				return this.buildConnectionState();
			}
			throw new Error(`Failed to sync course access (${response.status}).`);
		}
		const payload = response.json;
		const courseBody =
			payload && typeof payload === 'object'
				? (payload as { purchasedCourses?: unknown })
				: {};
		const purchasedCourses = Array.isArray(courseBody.purchasedCourses)
			? (courseBody.purchasedCourses as string[])
			: [];
		const displayNameFromCourseAccess = parseDisplayNameFromPayload(payload);

		const pluginResponse = await this.platformRequest('/api/plugin-access', {
			authCookie: cookieForThisRun,
		});
		let grantedPluginIds: string[] = session.grantedPluginIds ?? [];
		let grantedThemeIds: string[] = session.grantedThemeIds ?? [];
		if (!pluginResponse.ok) {
			if (pluginResponse.status === 401) {
				const merged: PlatformSessionState = {
					...session,
					purchasedCourses,
					grantedPluginIds,
					grantedThemeIds,
					lastSyncedAt: new Date().toISOString(),
					...(displayNameFromCourseAccess !== undefined
						? { displayName: displayNameFromCourseAccess }
						: {}),
				};
				await this.setSession(merged);
				return this.buildConnectionState();
			}
			if (pluginResponse.status !== 404) {
				throw new Error(
					`Failed to sync plugin access (${pluginResponse.status}).`,
				);
			}
		} else {
			const pluginPayload = pluginResponse.json;
			const rawPluginList =
				parseAllPluginListIdsFromInstallerAccessPayload(pluginPayload);
			grantedPluginIds =
				parseGrantedPluginIdsFromApiPayload(pluginPayload);
			grantedThemeIds = mergeInstallerThemeGrants(
				parseGrantedThemeIdsFromApiPayload(pluginPayload),
				rawPluginList,
			);
			if (isPlatformOwnerEmail(session.email)) {
				grantedThemeIds = mergeInstallerThemeGrants(grantedThemeIds, [
					ROYAL_LUX_ENTITLEMENT_ID,
				]);
			}
		}

		const merged: PlatformSessionState = {
			...session,
			purchasedCourses,
			grantedPluginIds,
			grantedThemeIds,
			lastSyncedAt: new Date().toISOString(),
			...(displayNameFromCourseAccess !== undefined
				? { displayName: displayNameFromCourseAccess }
				: {}),
		};
		await this.setSession(merged);
		return this.buildConnectionState();
	}

	async logout(): Promise<void> {
		await this.setSession(undefined);
	}
}
