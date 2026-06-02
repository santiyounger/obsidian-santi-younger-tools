export const SANTI_EMAIL_PRIVACY_BLUR_CLASS = 'santi-email-privacy-blur';

export function applyEmailPrivacyBlur(
	el: HTMLElement,
	enabled: boolean,
): void {
	if (enabled) {
		el.addClass(SANTI_EMAIL_PRIVACY_BLUR_CLASS);
	} else {
		el.removeClass(SANTI_EMAIL_PRIVACY_BLUR_CLASS);
	}
}
