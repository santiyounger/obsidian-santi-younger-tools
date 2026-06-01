# Santi Younger Tools

Install and update [Santi Younger](https://santiyounger.com) catalog plugins and themes in the active vault. Sign in with the same email and code as [platform.santiyounger.com](https://platform.santiyounger.com). Catalog hub only—not a marketplace for other authors.

**Requires Obsidian 1.11.4+.** Paid items need a platform account.

## Install

**Community:** **Settings → Community plugins → Browse** → search **Santi Younger Tools** → **Install** → enable → reload.

**Manual / BRAT:** Build with `npm install && npm run build`, copy to `<Vault>/.obsidian/plugins/santi-younger-tools/`, enable, reload. BRAT repo: `santiyounger/obsidian-santi-younger-tools`.

## Use

1. Ribbon **package** icon or command **Open tools**.
2. **My account** → sign in.
3. **Plugins** or **Themes** → **Install** (reload if prompted).

When signed in, catalog plugins auto-update shortly after Obsidian loads; use **Check for updates** in the panel anytime. This hub plugin updates via community releases only.

## Disclosure

| Topic | Detail |
| --- | --- |
| Network | `platform.santiyounger.com` (login, entitlements, install files). Free catalog entries may use public GitHub releases. Preview images from `santiyounger.b-cdn.net`. No telemetry. |
| Data | Session and install metadata in plugin `data.json`. Writes `.obsidian/plugins/` and themes on install. |
| Commercial | Paid items require platform access. Purchases on the website, not in-plugin. |
| Other plugins | Installs separate Santi catalog products into the vault; many are not in the community directory and have their own terms. |

## Support

[platform.santiyounger.com](https://platform.santiyounger.com) · [Issues](https://github.com/santiyounger/obsidian-santi-younger-tools/issues) · [LICENSE](LICENSE)

## Development

```bash
npm install && npm run dev   # or: npm run build && npm run lint
```

**Catalog content** (plugin/theme cards, preview images, copy): edit [`src/data/catalog/catalog.json`](src/data/catalog/catalog.json). See [docs/catalog.md](docs/catalog.md).

Release tag = `manifest.json` version; attach `main.js`, `manifest.json`, and `styles.css` if used.
