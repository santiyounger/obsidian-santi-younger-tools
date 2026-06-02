import { type ExtraButtonComponent, setIcon } from 'obsidian';
import { applyEmailPrivacyBlur } from './email-privacy-blur';

export interface EmailPrivacyHiddenState {
	hidden: boolean;
}

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
): void {
	button.setIcon(hidden ? 'eye-off' : 'eye');
	button.setTooltip(hidden ? 'Show email' : 'Hide email');
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
	emailEl: HTMLElement,
	state: EmailPrivacyHiddenState,
	hasEmail: () => boolean,
	onHiddenChange?: (hidden: boolean) => void,
): () => void {
	button.extraSettingsEl.addClass('santi-email-privacy-toggle');

	const sync = (): void => {
		if (!hasEmail()) {
			button.extraSettingsEl.addClass('santi-email-privacy-toggle--inactive');
			if (state.hidden) {
				state.hidden = false;
				onHiddenChange?.(false);
			}
			syncEmailPrivacyTarget(emailEl, false);
			return;
		}
		button.extraSettingsEl.removeClass('santi-email-privacy-toggle--inactive');
		syncEmailPrivacyTarget(emailEl, state.hidden);
		syncExtraButtonIcon(button, state.hidden);
	};

	button.onClick(() => {
		if (!hasEmail()) {
			return;
		}
		state.hidden = !state.hidden;
		onHiddenChange?.(state.hidden);
		sync();
	});

	sync();
	return sync;
}
