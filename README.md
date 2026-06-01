# Santi Younger Tools

Install, update, and remove plugins from the [Santi Younger](https://platform.santiyounger.com) catalog directly inside Obsidian. Sign in with the same email and login code as the course platform to unlock paid plugins, install **Royal Lux**, and keep catalog plugins up to date in the **current vault**.

## Features

- **Plugins** — Browse the catalog, install, update, remove, and check for updates (GitHub releases or platform bundles).
- **Themes** — Install or remove the bundled **Royal Lux** theme; optional feedback unlock after purchase.
- **My account** — Magic-link login, refresh entitlements, log out.

## Network use

The plugin calls `https://platform.santiyounger.com` for login and private plugin assets, and **GitHub** for public release downloads. No telemetry. Session cookies are stored locally in the plugin data file for this vault.

There is **no GitHub token field** in this plugin’s settings, and **buyers must never add one**. Sign in under **My account** in the tools panel; that is how paid catalog plugins are unlocked. Install and update files come from your platform API after login.

**Do not embed a GitHub token in this plugin.** Anything shipped inside `main.js` can be extracted; that would expose your private repos to everyone.

## Policy and disclosure

This hub plugin is published in the community directory so purchasers can manage **Santi Younger catalog** plugins in one place. It is **not** a general marketplace for third-party authors.

| Topic | What this plugin does |
| --- | --- |
| **Commercial use** | Paid catalog items require the same email login as [platform.santiyounger.com](https://platform.santiyounger.com). Free catalog items may install without purchase when marked in the catalog. |
| **Third-party plugins** | Installs and updates **other** plugins into `.obsidian/plugins/` in the **current vault**. Those plugins are separate products; many are **not** listed in the official community directory and may be closed source. |
| **Updates** | On Obsidian reload (when signed in), installed catalog plugins are checked and pending updates are installed automatically. You can also use **Check for updates**, **Update**, or **Update all** in the tools panel, or the **Check catalog plugin updates** command. |
| **Self-update** | This hub plugin is updated only through normal community plugin releases, not from the Santi platform. |
| **Telemetry** | No analytics or usage tracking. |
| **Data** | Session and install metadata are stored locally in this plugin’s `data.json` for the vault. Network calls are limited to login, entitlements, and downloading assets you request. |

Catalog plugins you install remain subject to their own licenses and terms.

### Production: GitHub releases → platform server (for all buyers)

When you publish a GitHub release for a private catalog plugin, **your platform** (for example on Vercel) should:

1. Store a **server-only** secret such as `CATALOG_GITHUB_TOKEN` (never in this Obsidian plugin).
2. Implement `GET /api/plugins/:id/release-assets` so that, after it verifies the user’s session and entitlements, it fetches the **latest GitHub release** for that catalog entry’s repo and returns `version`, `manifestJson`, `mainJs`, and optional `stylesCss`.

Then every buyer only **logs in** in the tools panel; install and **Check for updates** stay in sync with your GitHub releases automatically.

Each release should attach `manifest.json`, `main.js`, and optional `styles.css` (tag should match the version in `manifest.json`).

This Obsidian plugin does **not** read a GitHub token from Keychain or settings — not for buyers and not for local dev. Use the platform API (or test against a deployed/staging platform with the server token configured).

## Development

```bash
npm install
npm run dev
```

Copy or symlink the plugin folder into `<Vault>/.obsidian/plugins/santi-younger-tools/`, enable it under **Settings → Community plugins**, then open **Santi Younger Tools** from the ribbon or command palette.

```bash
npm run build
npm run lint
```
