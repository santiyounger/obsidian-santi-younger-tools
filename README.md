# Santi Younger Tools

Install, update, and remove plugins from the [Santi Younger](https://platform.santiyounger.com) catalog directly inside Obsidian. Sign in with the same email and login code as the course platform to unlock paid plugins, install **Royal Lux**, and keep catalog plugins up to date in the **current vault**.

This plugin is the in-app version of the [Santi Obsidian Tools](https://github.com/santiyounger/santi-obsidian-tools) desktop installer.

## Features

- **Plugins** — Browse the catalog, install, update, remove, and check for updates (GitHub releases or platform bundles).
- **Themes** — Install or remove the bundled **Royal Lux** theme; optional feedback unlock after purchase.
- **My account** — Magic-link login, refresh entitlements, log out.

## Network use

The plugin calls `https://platform.santiyounger.com` for login and private plugin assets, and **GitHub** for public release downloads. No telemetry. Session cookies are stored locally in the plugin data file for this vault.

There is **no GitHub token field** in this plugin’s settings. Sign in under **My account** in the tools panel; that is how paid catalog plugins are unlocked.

## Policy and disclosure

This hub plugin is published in the community directory so purchasers can manage **Santi Younger catalog** plugins in one place. It is **not** a general marketplace for third-party authors.

| Topic | What this plugin does |
| --- | --- |
| **Commercial use** | Paid catalog items require the same email login as [platform.santiyounger.com](https://platform.santiyounger.com). Free catalog items may install without purchase when marked in the catalog. |
| **Third-party plugins** | Installs and updates **other** plugins into `.obsidian/plugins/` in the **current vault**. Those plugins are separate products; many are **not** listed in the official community directory and may be closed source. |
| **Updates** | Catalog plugin updates run only when **you** choose **Check for updates**, **Update**, or **Update all** in the tools panel, or the **Check catalog plugin updates** command. This plugin does **not** silently update catalog plugins in the background. |
| **Self-update** | This hub plugin is updated only through normal community plugin releases, not from the Santi platform. |
| **Telemetry** | No analytics or usage tracking. |
| **Data** | Session and install metadata are stored locally in this plugin’s `data.json` for the vault. Network calls are limited to login, entitlements, and downloading assets you request. |

Catalog plugins you install remain subject to their own licenses and terms.

### GitHub token (optional, developers only)

You only need this if you are **developing** catalog entries and the platform does not yet serve `release-assets` for a private repo.

1. Create a [GitHub personal access token](https://github.com/settings/tokens) with **repo** access (classic token) or equivalent read access to your private plugin repositories.
2. In Obsidian, open **Settings → Keychain** and add a secret:
   - **Name (id):** `santi-catalog-github` (must match exactly)
   - **Value:** paste the token once (`ghp_…` or fine-grained token)

One token covers **all repositories** your GitHub account (or org) can read—you do not add a separate token per repo. The plugin sends it only to `api.github.com` when downloading release files as a fallback.

Requires Obsidian **1.11.4+** (Keychain / `SecretStorage` API).

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
