import { requestUrl, type RequestUrlResponse } from 'obsidian';

export type HttpHeaderValue = string | string[];

export interface HttpResponse {
	ok: boolean;
	status: number;
	headers: Record<string, HttpHeaderValue>;
	text: string;
	json: unknown;
}

/** Normalize Set-Cookie header value(s) into individual cookie strings. */
export function normalizeSetCookieHeaders(
	raw: HttpHeaderValue | undefined,
): string[] {
	if (raw == null || raw === '') {
		return [];
	}
	if (Array.isArray(raw)) {
		return raw.map((entry) => String(entry).trim()).filter(Boolean);
	}
	return String(raw)
		.split(/,(?=[^;]+?=)/u)
		.map((chunk) => chunk.trim())
		.filter(Boolean);
}

export async function httpRequest(
	url: string,
	options: {
		method?: string;
		headers?: Record<string, string>;
		body?: string;
	} = {},
): Promise<HttpResponse> {
	let response: RequestUrlResponse;
	try {
		response = await requestUrl({
			url,
			method: options.method ?? 'GET',
			headers: options.headers,
			body: options.body,
			throw: false,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : String(error);
		throw new Error(
			`Network request failed. Check your connection and try again. ${message}`,
		);
	}
	const text = response.text;
	let json: unknown = null;
	try {
		json = response.json;
	} catch {
		try {
			json = JSON.parse(text);
		} catch {
			json = null;
		}
	}
	return {
		ok: response.status >= 200 && response.status < 300,
		status: response.status,
		headers: response.headers ?? {},
		text,
		json,
	};
}

export function buildCookieHeaderFromVerifyResponse(
	headers: Record<string, HttpHeaderValue>,
): string | null {
	const setCookie =
		headers['set-cookie'] ?? headers['Set-Cookie'] ?? headers['SET-COOKIE'];
	const cookieStrings = normalizeSetCookieHeaders(setCookie);
	if (cookieStrings.length === 0) {
		return null;
	}
	const pairs: string[] = [];
	for (const chunk of cookieStrings) {
		const first = chunk.split(';')[0]?.trim();
		if (first?.includes('=')) {
			pairs.push(first);
		}
	}
	if (pairs.length > 0) {
		return pairs.join('; ');
	}
	const combined = cookieStrings.join(', ');
	const match = /\bauth-token=([^;]+)/u.exec(combined);
	if (match?.[1]) {
		return `auth-token=${match[1].trim()}`;
	}
	return null;
}

export function pickFirstTokenField(
	body: Record<string, unknown>,
	depth = 0,
): string | null {
	if (depth > 2) {
		return null;
	}
	const keys = [
		'token',
		'accessToken',
		'authToken',
		'sessionToken',
		'auth_token',
		'jwt',
	];
	for (const key of keys) {
		const v = body[key];
		if (typeof v === 'string' && v.trim()) {
			return v.trim();
		}
	}
	for (const key of ['session', 'data', 'user']) {
		const v = body[key];
		if (v && typeof v === 'object' && !Array.isArray(v)) {
			const nested = pickFirstTokenField(
				v as Record<string, unknown>,
				depth + 1,
			);
			if (nested) {
				return nested;
			}
		}
	}
	return null;
}

export function parseDisplayNameFromPayload(payload: unknown): string | undefined {
	if (!payload || typeof payload !== 'object') {
		return undefined;
	}
	const o = payload as Record<string, unknown>;
	const keys = ['displayName', 'display_name', 'name', 'fullName', 'full_name'];
	for (const key of keys) {
		const v = o[key];
		if (typeof v === 'string' && v.trim()) {
			return v.trim();
		}
	}
	const user = o.user;
	if (user && typeof user === 'object') {
		return parseDisplayNameFromPayload(user);
	}
	return undefined;
}
