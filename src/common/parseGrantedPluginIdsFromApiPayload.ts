/**
 * Extract catalog plugin ids from platform JSON (GET /api/plugin-access and similar shapes on /api/course-access).
 * Theme slugs are listed separately as `grantedThemeIds` — strip them here when present.
 */

import { isObsidianInstallerThemeSlug } from "./entitlements";

function dedupePluginIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function parseGrantedPluginIdStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) {
    return [];
  }
  return x
    .filter((i): i is string => typeof i === "string" && i.trim().length > 0)
    .map((s) => s.trim());
}

function parseMongoGrantedPluginsArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: string[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const p = item as Record<string, unknown>;
    if (p.revoked === true) {
      continue;
    }
    const id = p["plugin-id"] ?? p.id ?? p.pluginId ?? p.plugin_id;
    if (typeof id === "string" && id.trim()) {
      out.push(id.trim());
    }
  }
  return out;
}

function parseMixedPluginEntryArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      out.push(item.trim());
      continue;
    }
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      if (rec.revoked === true) {
        continue;
      }
      const id = rec["plugin-id"] ?? rec.id ?? rec.pluginId ?? rec.plugin_id ?? rec.slug ?? rec.key;
      if (typeof id === "string" && id.trim()) {
        out.push(id.trim());
      }
    }
  }
  return out;
}

function parseGrantedPluginIdsShallow(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const o = payload as Record<string, unknown>;
  if (o.success === false) {
    return [];
  }

  const fromIds = parseGrantedPluginIdStringArray(o.grantedPluginIds);
  if (fromIds.length > 0) {
    return dedupePluginIds(fromIds);
  }

  const fromSnakeIds = parseGrantedPluginIdStringArray(o.granted_plugin_ids);
  if (fromSnakeIds.length > 0) {
    return dedupePluginIds(fromSnakeIds);
  }

  const fromMongo = parseMongoGrantedPluginsArray(o.grantedPlugins);
  if (fromMongo.length > 0) {
    return dedupePluginIds(fromMongo);
  }

  const fromMongoSnake = parseMongoGrantedPluginsArray(o.granted_plugins);
  if (fromMongoSnake.length > 0) {
    return dedupePluginIds(fromMongoSnake);
  }

  const user = o.user && typeof o.user === "object" ? (o.user as Record<string, unknown>) : undefined;
  if (user) {
    const uIds = parseGrantedPluginIdStringArray(user.grantedPluginIds);
    if (uIds.length > 0) {
      return dedupePluginIds(uIds);
    }
    const uSnake = parseGrantedPluginIdStringArray(user.granted_plugin_ids);
    if (uSnake.length > 0) {
      return dedupePluginIds(uSnake);
    }
    const uMongo = parseMongoGrantedPluginsArray(user.grantedPlugins);
    if (uMongo.length > 0) {
      return dedupePluginIds(uMongo);
    }
    const uMongoSnake = parseMongoGrantedPluginsArray(user.granted_plugins);
    if (uMongoSnake.length > 0) {
      return dedupePluginIds(uMongoSnake);
    }
  }

  for (const key of [o.plugins, o.grants, o.pluginIds]) {
    const mixed = parseMixedPluginEntryArray(key);
    if (mixed.length > 0) {
      return dedupePluginIds(mixed);
    }
  }

  return [];
}

/**
 * Normalize platform JSON: top-level fields, optional `user`, then nested `data` / `result` / `payload`.
 */
function stripInstallerThemeSlugs(ids: string[]): string[] {
  return ids.filter((id) => !isObsidianInstallerThemeSlug(id));
}

/**
 * Unfiltered plugin-list ids from the payload (may include theme slugs if the platform only sent `grantedPluginIds`).
 * Use with `parseGrantedThemeIdsFromApiPayload` + `mergeInstallerThemeGrants` for theme entitlements.
 */
export function parseAllPluginListIdsFromInstallerAccessPayload(payload: unknown): string[] {
  const shallow = parseGrantedPluginIdsShallow(payload);
  if (shallow.length > 0) {
    return dedupePluginIds(shallow);
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const o = payload as Record<string, unknown>;
  for (const nestKey of ["data", "result", "payload"] as const) {
    const inner = o[nestKey];
    if (inner && typeof inner === "object") {
      const nested = parseAllPluginListIdsFromInstallerAccessPayload(inner);
      if (nested.length > 0) {
        return nested;
      }
    }
  }
  return [];
}

export function parseGrantedPluginIdsFromApiPayload(payload: unknown): string[] {
  return stripInstallerThemeSlugs(parseAllPluginListIdsFromInstallerAccessPayload(payload));
}
