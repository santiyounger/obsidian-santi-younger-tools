# Catalog data (plugins & themes)

All catalog cards in **Manage tools** are driven by one file:

`src/data/catalog/catalog.json`

After editing, run `npm run build` (or `npm run dev`) and reload Obsidian. Users receive updates when you ship a new release of this hub plugin.

## Structure

```json
{
  "plugins": [ /* installable plugins */ ],
  "themes": [ /* installable themes (UI + metadata) */ ]
}
```

## Plugin entry fields

| Field | Required | Purpose |
| --- | --- | --- |
| `id` | yes | Catalog id; must match platform `grantedPluginIds` for paid items. Do not rename after release. |
| `name` | yes | Card title. Must match the product manifest `name` exactly (preserve capitalization). Do not sentence-case product names. |
| `description` | no | Card blurb. |
| `previewImageUrl` | no | Card image (HTTPS URL, e.g. CDN). Omit for text-only cards. |
| `repository` | yes | GitHub repo URL for release downloads. |
| `releaseChannel` | no | `stable` or `beta` (default: stable). |
| `requiresAuth` | no | `true` (default): needs platform grant. `false`: any signed-in user can install. |
| `comingSoon` | no | Hidden from the catalog until installed. |
| `obsidianManifestId` | no | Vault folder / manifest `id` if different from catalog `id`. |

Users only see a plugin card if they have a matching platform grant (or already installed it). There is no “learn more” teaser for locked items.

Install files (`main.js`, `manifest.json`) come from GitHub or platform releases—not from this JSON.

## Theme entry fields

| Field | Required | Purpose |
| --- | --- | --- |
| `id` | yes | Must match platform theme grant id (e.g. `royal-lux`). |
| `name` | yes | Card title. Must match the product manifest `name` exactly (preserve capitalization). Do not sentence-case product names. |
| `description` | no | Card blurb. |
| `previewImageUrl` | no | Card image URL. |

Users only see a theme card if they have a matching platform theme grant (or already installed it).

Bundled theme assets (CSS, manifest) still live under `src/data/themes/<id>/`.

## Checklist: new catalog plugin

1. Publish GitHub releases for the product repo.
2. Add an object to `catalog.json` → `plugins`.
3. Grant the same `id` on platform.santiyounger.com.
4. Bump hub plugin version, build, and release.
