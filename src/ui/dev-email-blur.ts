export const SANTI_DEV_EMAIL_BLUR_CLASS = 'santi-dev-email-blur';

/** Blurs email in the UI during local dev builds only (stripped from production). */
export function applyDevEmailBlur(el: HTMLElement): void {
	if (!__SANTI_DEV__) {
		return;
	}
	el.addClass(SANTI_DEV_EMAIL_BLUR_CLASS);
}
