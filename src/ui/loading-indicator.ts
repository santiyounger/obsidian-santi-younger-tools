import { setIcon } from 'obsidian';

export function renderLoadingIndicator(
	parent: HTMLElement,
	text: string,
): void {
	const indicator = parent.createDiv({
		cls: 'santi-tools-loading-indicator',
	});
	const icon = indicator.createSpan({
		cls: 'santi-tools-loading-icon',
		attr: { 'aria-hidden': 'true' },
	});
	setIcon(icon, 'loader-circle');
	indicator.createEl('p', {
		cls: 'santi-tools-loading-text',
		text,
	});
}

export function renderLoadingOverlay(
	parent: HTMLElement,
	text: string,
): void {
	parent.addClass('santi-tools-load-target');
	const overlay = parent.createDiv({ cls: 'santi-tools-loading-overlay' });
	overlay.setAttr('aria-live', 'polite');
	overlay.setAttr('aria-busy', 'true');
	renderLoadingIndicator(overlay, text);
}
