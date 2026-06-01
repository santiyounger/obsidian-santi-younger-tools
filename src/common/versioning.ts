/** Compare dotted version strings; returns true when latest is newer than installed. */
export function isUpdateAvailable(
	installedVersion: string,
	latestVersion: string,
): boolean {
	const normalize = (v: string): number[] => {
		const core = v.trim().replace(/^v/i, '').split(/[-+]/)[0] ?? '';
		const parts = core.split('.').map((p) => {
			const n = parseInt(p.replace(/[^\d]/gu, ''), 10);
			return Number.isFinite(n) ? n : 0;
		});
		while (parts.length > 0 && parts[parts.length - 1] === 0) {
			parts.pop();
		}
		return parts.length > 0 ? parts : [0];
	};
	const installed = normalize(installedVersion);
	const latest = normalize(latestVersion);
	const len = Math.max(installed.length, latest.length);
	for (let i = 0; i < len; i++) {
		const a = installed[i] ?? 0;
		const b = latest[i] ?? 0;
		if (b > a) {
			return true;
		}
		if (b < a) {
			return false;
		}
	}
	return false;
}
