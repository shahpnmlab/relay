// One placement policy for every Relay popover. Native v5 still owns its top
// layer and dismissal; this module restores explicit anchor-side preferences.
export function getPopoverPosition(anchor, size, viewport, placement = 'BelowStart', rtl = false, gap = 0) {
    const margin = 8;
    const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)));
    const name = placement.toLowerCase().replaceAll('-', '');
    let side = name.startsWith('before') ? (rtl ? 'right' : 'left')
        : name.startsWith('after') ? (rtl ? 'left' : 'right')
        : name.startsWith('above') ? 'top' : name === 'centercenter' ? 'center' : 'bottom';
    const space = { left: anchor.left, right: viewport.width - anchor.right,
        top: anchor.top, bottom: viewport.height - anchor.bottom };
    const opposite = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
    const horizontal = side === 'left' || side === 'right';
    const required = (horizontal ? size.width : size.height) + gap + margin;
    if (side !== 'center' && space[side] < required && space[opposite[side]] > space[side]) side = opposite[side];
    let left = (anchor.left + anchor.right - size.width) / 2;
    let top = (anchor.top + anchor.bottom - size.height) / 2;
    if (horizontal) {
        left = side === 'right' ? anchor.right + gap : anchor.left - size.width - gap;
        if (name.endsWith('top')) top = anchor.top;
        else if (name.endsWith('bottom')) top = anchor.bottom - size.height;
    } else if (side !== 'center') {
        top = side === 'bottom' ? anchor.bottom + gap : anchor.top - size.height - gap;
        if (name.endsWith('start')) left = rtl ? anchor.right - size.width : anchor.left;
        else if (name.endsWith('end')) left = rtl ? anchor.left : anchor.right - size.width;
    }
    left = clamp(left, margin, viewport.width - size.width - margin);
    top = clamp(top, margin, viewport.height - size.height - margin);
    return { left, top, side, arrowY: (anchor.top + anchor.bottom) / 2 - top };
}

export function getSidePosition(anchor, size, viewport, rtl = false, gap = 12, preferBefore = false) {
    return getPopoverPosition(anchor, size, viewport, preferBefore ? 'Before' : 'After', rtl, gap);
}

export function initialize(id, anchorId, placement = 'After', gap = 12) {
    const host = document.getElementById(id);
    const dialog = host?.shadowRoot?.querySelector('[part="dialog"]');
    const anchor = document.getElementById(anchorId);
    if (!dialog || !anchor) return null;

    function update() {
        if (!host.isConnected || host.getAttribute('opened') !== 'true') return;
        const viewport = window.visualViewport;
        const position = getPopoverPosition(anchor.getBoundingClientRect(),
            { width: dialog.offsetWidth, height: dialog.offsetHeight },
            { width: viewport?.width ?? window.innerWidth, height: viewport?.height ?? window.innerHeight },
            placement, getComputedStyle(anchor).direction === 'rtl', gap);
        const styles = {
            left: `${position.left + (viewport?.offsetLeft ?? 0)}px`,
            top: `${position.top + (viewport?.offsetTop ?? 0)}px`,
            right: 'auto', bottom: 'auto', '--relay-arrow-y': `${position.arrowY}px`
        };
        // Native layout also updates these styles when the anchor moves. Only
        // write differences so observing our own changes cannot create a loop.
        for (const [name, value] of Object.entries(styles)) {
            if (dialog.style.getPropertyValue(name) !== value) dialog.style.setProperty(name, value);
        }
        host.dataset.relaySide = position.side;
    }

    const mutations = new MutationObserver(update);
    mutations.observe(host, { attributes: true, attributeFilter: ['opened'] });
    mutations.observe(dialog, { attributes: true, attributeFilter: ['style'] });
    const resize = new ResizeObserver(update);
    resize.observe(dialog);
    resize.observe(anchor);
    update();
    return { dispose() { mutations.disconnect(); resize.disconnect(); } };
}
