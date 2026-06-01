import type { PluginCatalogEntry } from '../types';

/** Platform grant id for the bundled Royal Lux theme (admin theme access / `grantedThemeIds`). */
export const ROYAL_LUX_ENTITLEMENT_ID = "royal-lux";

/**
 * Dev-only fake plugin ids (Account admin / Plugins tab). Not real catalog releases.
 * `admin_sample` mode shows only these — no real catalog plugins.
 */
export const DEV_SAMPLE_PLUGIN_SLOT_IDS = [
  "dev-sample-a",
  "dev-sample-b",
  "dev-sample-c",
  "dev-sample-d"
] as const;

export type DevSamplePluginSlotId = (typeof DEV_SAMPLE_PLUGIN_SLOT_IDS)[number];

const DEV_SAMPLE_SLOT_ID_LOWER = new Set(
  DEV_SAMPLE_PLUGIN_SLOT_IDS.map((id) => id.toLowerCase())
);

export function isDevSampleSlotPluginId(pluginId: string): boolean {
  return DEV_SAMPLE_SLOT_ID_LOWER.has(pluginId.trim().toLowerCase());
}

/** Theme slugs the installer never treats as community plugins (also listed under API `grantedThemeIds`). */
export const OBSIDIAN_INSTALLER_THEME_SLUGS: readonly string[] = [ROYAL_LUX_ENTITLEMENT_ID];

export function isObsidianInstallerThemeSlug(id: string): boolean {
  const n = id.trim().toLowerCase();
  return OBSIDIAN_INSTALLER_THEME_SLUGS.some((t) => t.toLowerCase() === n);
}

/** Merge API theme grants with legacy theme ids still returned only under `grantedPluginIds`. */
export function mergeInstallerThemeGrants(grantedThemeIds: string[], grantedPluginIds: string[]): string[] {
  const set = new Set<string>();
  for (const t of grantedThemeIds) {
    const s = t.trim();
    if (s) {
      set.add(s);
    }
  }
  for (const p of grantedPluginIds) {
    if (isObsidianInstallerThemeSlug(p)) {
      set.add(p.trim());
    }
  }
  return [...set];
}

/**
 * Whether an entitlement slug is present (case-insensitive).
 */
export function userHasCatalogIdEntitlement(catalogId: string, grantedIds: string[]): boolean {
  const pid = catalogId.trim().toLowerCase();
  return grantedIds.some((g) => g.trim().toLowerCase() === pid);
}

/**
 * Whether the user may install this plugin. Uses `grantedPluginIds` from `GET /api/plugin-access`
 * unless `requiresAuth === false` (open catalog row for any signed-in user).
 */
export function userHasPluginEntitlement(entry: PluginCatalogEntry, grantedPluginIds: string[]): boolean {
  if (entry.requiresAuth === false) {
    return true;
  }
  return userHasCatalogIdEntitlement(entry.id, grantedPluginIds);
}

/** Bundled Obsidian theme install (e.g. Royal Lux). Uses merged theme grants from the platform API. */
export function userHasThemeEntitlement(themeId: string, effectiveThemeIds: string[]): boolean {
  return userHasCatalogIdEntitlement(themeId, effectiveThemeIds);
}

/** Matches platform `ADMIN_EMAIL` — receives Royal Lux in grants when syncing access. */
export const PLATFORM_OWNER_EMAIL_NORMALIZED = "santi@santiyounger.com";

export function isPlatformOwnerEmail(email: string | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  return Boolean(normalized && normalized === PLATFORM_OWNER_EMAIL_NORMALIZED);
}
