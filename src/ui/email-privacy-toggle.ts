import { type ExtraButtonComponent, setIcon } from 'obsidian';
import { applyEmailPrivacyBlur } from './email-privacy-blur';

export interface EmailPrivacyHiddenState {
	hidden: boolean;
}

export interface FieldPrivacyLabels {
	show: string;
	hide: string;
}

export const FIELD_PRIVACY_EMAIL_LABELS: FieldPrivacyLabels = {
	show: 'Show email',
	hide: 'Hide email',
};

export const FIELD_PRIVACY_CODE_LABELS: FieldPrivacyLabels = {
	show: 'Show code',
	hide: 'Hide code',
};

export function syncEmailPrivacyTarget(
	emailEl: HTMLElement,
	hidden: boolean,
): void {
	applyEmailPrivacyBlur(emailEl, hidden);
}

function syncToggleButtonIcon(
	buttonEl: HTMLElement,
	hidden: boolean,
): void {
	buttonEl.empty();
	setIcon(buttonEl, hidden ? 'eye-off' : 'eye');
	buttonEl.setAttr('aria-label', hidden ? 'Show email' : 'Hide email');
	buttonEl.setAttr(
		'aria-pressed',
		hidden ? 'true' : 'false',
	);
}

function syncExtraButtonIcon(
	button: ExtraButtonComponent,
	hidden: boolean,
	labels: FieldPrivacyLabels,
): void {
	button.setIcon(hidden ? 'eye-off' : 'eye');
	button.setTooltip(hidden ? labels.show : labels.hide);
}

export function appendEmailPrivacyToggle(
	parent: HTMLElement,
	emailEl: HTMLElement,
	state: EmailPrivacyHiddenState,
	onHiddenChange?: (hidden: boolean) => void,
): HTMLButtonElement {
	const button = parent.createEl('button', {
		cls: 'santi-email-privacy-toggle',
		attr: { type: 'button' },
	});

	const sync = (): void => {
		syncEmailPrivacyTarget(emailEl, state.hidden);
		syncToggleButtonIcon(button, state.hidden);
	};

	button.addEventListener('click', () => {
		state.hidden = !state.hidden;
		onHiddenChange?.(state.hidden);
		sync();
	});

	sync();
	return button;
}

export function wireEmailPrivacyExtraButton(
	button: ExtraButtonComponent,
	targetEl: HTMLElement,
	state: EmailPrivacyHiddenState,
	onHiddenChange?: (hidden: boolean) => void,
	labels: FieldPrivacyLabels = FIELD_PRIVACY_EMAIL_LABELS,
): () => void {
	button.extraSettingsEl.addClass('santi-email-privacy-toggle');

	const sync = (): void => {
		syncEmailPrivacyTarget(targetEl, state.hidden);
		syncExtraButtonIcon(button, state.hidden, labels);
	};

	button.onClick(() => {
		state.hidden = !state.hidden;
		onHiddenChange?.(state.hidden);
		sync();
	});

	sync();
	return sync;
}
