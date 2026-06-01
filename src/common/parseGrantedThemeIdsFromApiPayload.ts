/**
 * Extract Obsidian Tools theme ids from platform JSON (GET /api/plugin-access `grantedThemeIds`).
 */

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function parseGrantedThemeIdStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) {
    return [];
  }
  return x
    .filter((i): i is string => typeof i === "string" && i.trim().length > 0)
    .map((s) => s.trim());
}

function parseMongoGrantedThemesArray(raw: unknown): string[] {
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
    const id = p["theme-id"] ?? p["plugin-id"] ?? p.id ?? p.themeId ?? p.theme_id;
    if (typeof id === "string" && id.trim()) {
      out.push(id.trim());
    }
  }
  return out;
}

function parseGrantedThemeIdsShallow(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const o = payload as Record<string, unknown>;
  if (o.success === false) {
    return [];
  }

  const fromIds = parseGrantedThemeIdStringArray(o.grantedThemeIds);
  if (fromIds.length > 0) {
    return dedupeIds(fromIds);
  }

  const fromSnake = parseGrantedThemeIdStringArray(o.granted_theme_ids);
  if (fromSnake.length > 0) {
    return dedupeIds(fromSnake);
  }

  const fromMongo = parseMongoGrantedThemesArray(o.grantedThemes);
  if (fromMongo.length > 0) {
    return dedupeIds(fromMongo);
  }

  const fromMongoSnake = parseMongoGrantedThemesArray(o.granted_themes);
  if (fromMongoSnake.length > 0) {
    return dedupeIds(fromMongoSnake);
  }

  const user = o.user && typeof o.user === "object" ? (o.user as Record<string, unknown>) : undefined;
  if (user) {
    const uIds = parseGrantedThemeIdStringArray(user.grantedThemeIds);
    if (uIds.length > 0) {
      return dedupeIds(uIds);
    }
    const uSnake = parseGrantedThemeIdStringArray(user.granted_theme_ids);
    if (uSnake.length > 0) {
      return dedupeIds(uSnake);
    }
    const uMongo = parseMongoGrantedThemesArray(user.grantedThemes);
    if (uMongo.length > 0) {
      return dedupeIds(uMongo);
    }
  }

  return [];
}

export function parseGrantedThemeIdsFromApiPayload(payload: unknown): string[] {
  const shallow = parseGrantedThemeIdsShallow(payload);
  if (shallow.length > 0) {
    return shallow;
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const o = payload as Record<string, unknown>;
  for (const nestKey of ["data", "result", "payload"] as const) {
    const inner = o[nestKey];
    if (inner && typeof inner === "object") {
      const nested = parseGrantedThemeIdsFromApiPayload(inner);
      if (nested.length > 0) {
        return nested;
      }
    }
  }
  return [];
}
