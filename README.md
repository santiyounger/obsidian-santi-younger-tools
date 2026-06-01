# Santi Younger Tools

Manage [Santi Younger](https://santiyounger.com) catalog plugins and themes inside your vault. Sign in with the same email and login code you use on [platform.santiyounger.com](https://platform.santiyounger.com) to unlock purchases, install catalog plugins, and install the **Royal Lux** theme.

This repository is the official hub for the Santi Younger product catalog. It is **not** a general plugin marketplace for other authors.

## Who this is for

- Customers who bought Santi Younger courses or catalog plugins and want one place to install and update them in a vault.
- Anyone installing a **free** catalog item marked as available without purchase in the catalog.

## Features

- **Plugins** — Browse the Santi Younger catalog, install, update, remove, and check for updates for the **current vault**.
- **Themes** — Install or remove the bundled **Royal Lux** theme (purchase or unlock rules apply on the platform).
- **My account** — Email login with a one-time code, refresh entitlements, log out.

## Requirements

- Obsidian **1.11.4** or newer (`minAppVersion` in `manifest.json`).
- Internet access when signing in or installing catalog items.
- A Santi Younger platform account for **paid** catalog plugins and gated themes.

## Installation

### From the community directory (recommended)

1. Open **Settings → Community plugins**.
2. Turn off **Restricted mode** if it is on (or allow this plugin in your restriction settings).
3. Select **Browse**, search for **Santi Younger Tools**, and select **Install**.
4. Enable the plugin.
5. Reload when prompted.

### Manual install (testing or BRAT)

Use this path only if you are testing a build or installing through [BRAT](https://github.com/TfTHacker/obsidian42-brat).

1. Clone or download this repository.
2. Run `npm install` and `npm run build` so `main.js` exists at the plugin root.
3. Copy the plugin folder into `<Vault>/.obsidian/plugins/santi-younger-tools/` (folder name must match the plugin id).
4. Enable **Santi Younger Tools** under **Settings → Community plugins**.
5. Reload Obsidian.

**BRAT:** Add `santiyounger/obsidian-santi-younger-tools` (or your fork) and choose the branch or release you want to track.

## How to use

1. Select the **package** ribbon icon or run **Open tools** from the command palette.
2. Open the **My account** tab and sign in with your platform email and code.
3. Open the **Plugins** or **Themes** tab.
4. Select **Install** on an item you own (or a free catalog item).
5. Reload Obsidian when asked so a newly installed community plugin can load.

Installed catalog plugins live in `.obsidian/plugins/` in the **active vault**, the same as any other community plugin.

## Updates

| What | Behavior |
| --- | --- |
| **Catalog plugins** (for example Branch writing) | When you are signed in, this hub checks for updates shortly after Obsidian loads and **installs pending updates automatically**. You can also use **Check for updates**, **Update**, or **Update all** in the tools panel, or the **Check catalog plugin updates** command. |
| **This hub plugin** | Updated only through normal community plugin releases (or your BRAT tracking branch), not through the Santi platform. |

Catalog updates require a valid session and platform access to each product. Files are downloaded from `platform.santiyounger.com` after authentication.

## Privacy and network use

| Topic | Detail |
| --- | --- |
| **Hosts** | `https://platform.santiyounger.com` for sign-in, entitlements, and catalog install files. Public GitHub release URLs may be used only for **free** catalog entries that do not require platform bundles. |
| **Telemetry** | None. No analytics or usage tracking. |
| **Stored locally** | Session and install metadata in this plugin’s `data.json` for the vault. No GitHub tokens are stored in the plugin. |
| **Vault access** | Writes plugin and theme files under `.obsidian/` when you install or update catalog items. Reads installed `manifest.json` files to show versions. |

## Commercial relationship and third-party installs

| Topic | Detail |
| --- | --- |
| **Commercial use** | Paid catalog items require the same account as [platform.santiyounger.com](https://platform.santiyounger.com). Free catalog items may install without purchase when marked in the catalog. |
| **Scope** | This hub installs and updates **Santi Younger catalog** products only. |
| **Other plugins** | Catalog plugins are separate products installed into your vault. Many are **not** in the official community directory and may be closed source. Each catalog product remains subject to its own license and terms from Santi Younger. |
| **Payments** | Purchases and refunds are handled on the platform and website, not inside this plugin. |

## Free and paid catalog items

- **Paid** — Shown when your signed-in account has access (course or product entitlements synced from the platform).
- **Free** — Marked in the bundled catalog; may install without purchase when `showWithoutAccess` applies.

If install fails with an access error, sign in again or confirm your purchase on the platform, then use **Refresh access** on the **My account** tab.

## Support

- Platform and purchases: [platform.santiyounger.com](https://platform.santiyounger.com)
- Website: [santiyounger.com](https://santiyounger.com)
- Bugs and feature requests for **this hub plugin**: [GitHub issues](https://github.com/santiyounger/obsidian-santi-younger-tools/issues)

## License

Source is released under the license in [LICENSE](LICENSE). Catalog plugins you install through this hub are governed by their own terms.

## Development

```bash
npm install
npm run dev
```

Copy or symlink this folder to `<Vault>/.obsidian/plugins/santi-younger-tools/`, enable it under **Settings → Community plugins**, then open **Santi Younger Tools** from the ribbon or command palette.

```bash
npm run build
npm run lint
```

Release tags must match `version` in `manifest.json`. Attach `main.js`, `manifest.json`, and `styles.css` (if present) to GitHub releases for community distribution.

Maintainers: private catalog binaries must be served from the platform API (`GET /api/plugins/:id/release-assets`) using a **server-side** GitHub token. This client never ships repository credentials.
