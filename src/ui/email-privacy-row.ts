import type { EmailPrivacyHiddenState } from './email-privacy-toggle';
import { appendEmailPrivacyToggle } from './email-privacy-toggle';

/** Inline row: email content + visibility toggle (icon is never blurred). */
export function createEmailPrivacyRow(
	parent: HTMLElement,
	options: {
		rowClass?: string;
		state: EmailPrivacyHiddenState;
		onHiddenChange?: (hidden: boolean) => void;
		renderEmail: (targetParent: HTMLElement) => HTMLElement;
	},
): HTMLElement {
	const row = parent.createDiv({
		cls: ['santi-email-privacy-row', options.rowClass ?? '']
			.filter(Boolean)
			.join(' '),
	});
	const targetWrap = row.createDiv({ cls: 'santi-email-privacy-target-wrap' });
	const emailEl = options.renderEmail(targetWrap);
	const toggleWrap = row.createDiv({ cls: 'santi-email-privacy-toggle-wrap' });
	appendEmailPrivacyToggle(
		toggleWrap,
		emailEl,
		options.state,
		options.onHiddenChange,
	);
	return row;
}
