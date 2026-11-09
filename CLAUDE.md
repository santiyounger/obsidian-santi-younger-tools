# Santi Younger Tools - instructions for Claude

General plugin conventions are in `AGENTS.md`. The rules below come from Santi and override anything else.

## Ship every finished change

When a code change is complete and builds cleanly, publish it in the same session. Do not stop at "it's ready" or ask whether to release.

1. Raise the version by one patch step (1.0.25 -> 1.0.26) in `manifest.json`, `package.json` and `versions.json` (new key = version, value = `minAppVersion`). Keep all three in step.
2. Run `npm run build` and make sure it passes.
3. Commit on `dev`, push `dev`, fast-forward `main` to `dev`, push `main`, switch back to `dev`.
4. Pushing `main` runs `.github/workflows/release.yml`, which tags, builds and publishes the GitHub release (never a draft). Wait for that run to finish and confirm the newest release has `main.js`, `manifest.json` and `styles.css`.
5. Tell Santi the new version number. Obsidian's "Check for new releases" button (community.obsidian.md, plugin dashboard) then has a new version to scan.

Safety net: if code reaches `main` without a version bump, the release workflow raises the patch version itself. Do not rely on it. Bump by hand as above.

Docs-only or workflow-only changes (`*.md`, `docs/`, `.github/`) do not need a new version.

## When Santi asks for something to be done

If Santi says "do it", "push it" or "release it", do it straight away. Don't explain why it isn't needed, and don't ask again.

## Obsidian "check release" messages

- "Your manifest points at version X. A scan has already been run" = no newer version exists than the one already scanned. Fix by shipping a new version (above), not by clicking again.
- "This entry was refreshed in the last few minutes" = a cooldown. Wait a few minutes.
