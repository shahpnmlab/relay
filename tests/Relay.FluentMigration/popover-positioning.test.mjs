import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../../Refund/wwwroot/js/popover-position.js', import.meta.url), 'utf8');
const { getSidePosition, getPopoverPosition, initialize } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const size = { width: 110, height: 32 };
const viewport = { width: 800, height: 600 };

for (const [placement, left, top] of [
    ['BelowStart', 300, 232], ['Below', 340, 232], ['BelowEnd', 380, 232],
    ['AboveStart', 300, 140], ['Above', 340, 140], ['AboveEnd', 380, 140],
    ['BeforeTop', 180, 200], ['Before', 180, 186], ['BeforeBottom', 180, 172],
    ['AfterTop', 500, 200], ['After', 500, 186], ['AfterBottom', 500, 172],
    ['CenterCenter', 340, 186]
]) {
    test(`${placement} preserves both the requested side and alignment`, () => {
        const result = getPopoverPosition({ left: 300, right: 500, top: 200, bottom: 232 },
            { width: 120, height: 60 }, viewport, placement);
        assert.equal(result.left, left);
        assert.equal(result.top, top);
    });
}

test('dropdown anchors to the whole button and flips above near the bottom', () => {
    const result = getPopoverPosition({ left: 100, right: 300, top: 560, bottom: 592 },
        { width: 200, height: 100 }, viewport, 'BelowStart');
    assert.equal(result.left, 100);
    assert.equal(result.top, 460);
    assert.equal(result.side, 'top');
});

test('dropdown start alignment respects RTL', () => {
    const result = getPopoverPosition({ left: 300, right: 500, top: 200, bottom: 232 },
        { width: 120, height: 60 }, viewport, 'BelowStart', true);
    assert.equal(result.left, 380);
    assert.equal(result.top, 232);
});

test('bottom-left sign-out callout sits beside and vertically centered on its button', () => {
    const anchor = { left: 12, right: 44, top: 560, bottom: 592 };
    const result = getSidePosition(anchor, size, viewport);
    assert.equal(result.side, 'right');
    assert.equal(result.left, anchor.right + 12);
    assert.equal(result.top + size.height / 2, (anchor.top + anchor.bottom) / 2);
});

test('callout flips to the left when it cannot fit on the right', () => {
    const anchor = { left: 740, right: 772, top: 200, bottom: 232 };
    const result = getSidePosition(anchor, size, viewport);
    assert.equal(result.side, 'left');
    assert.equal(result.left + size.width + 12, anchor.left);
});

test('viewport clamping keeps the arrow aimed at the anchor', () => {
    const anchor = { left: 12, right: 44, top: 584, bottom: 600 };
    const result = getSidePosition(anchor, size, viewport);
    assert.equal(result.top + size.height, viewport.height - 8);
    assert.equal(result.top + result.arrowY, (anchor.top + anchor.bottom) / 2);
});

test('RTL prefers the left side', () => {
    const result = getSidePosition({ left: 400, right: 432, top: 200, bottom: 232 }, size, viewport, true);
    assert.equal(result.side, 'left');
    assert.equal(result.left + size.width + 12, 400);
});

test('ordinary confirmations prefer the left side even when both sides fit', () => {
    const anchor = { left: 400, right: 432, top: 200, bottom: 232 };
    const result = getSidePosition(anchor, size, viewport, false, 12, true);
    assert.equal(result.side, 'left');
    assert.equal(result.left + size.width + 12, anchor.left);
});

test('observing native layout writes converges and disposal disconnects observers', () => {
    const originals = Object.fromEntries(['document', 'window', 'getComputedStyle', 'MutationObserver', 'ResizeObserver']
        .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const observers = [];
    const values = new Map();
    let writes = 0;
    const dialog = { offsetWidth: 110, offsetHeight: 32, style: {
        getPropertyValue: key => values.get(key) ?? '',
        setProperty(key, value) { values.set(key, value); writes++; }
    } };
    const host = { isConnected: true, dataset: {}, getAttribute: () => 'true',
        shadowRoot: { querySelector: () => dialog } };
    const anchor = { getBoundingClientRect: () => ({ left: 12, right: 44, top: 560, bottom: 592 }) };
    class Observer {
        constructor(callback) { this.callback = callback; observers.push(this); }
        observe() { }
        disconnect() { this.disconnected = true; }
    }
    try {
        globalThis.document = { getElementById: id => id === 'popover' ? host : anchor };
        globalThis.window = { innerWidth: 800, innerHeight: 600 };
        globalThis.getComputedStyle = () => ({ direction: 'ltr' });
        globalThis.MutationObserver = Observer;
        globalThis.ResizeObserver = Observer;
        const controller = initialize('popover', 'anchor');
        const firstWrites = writes;
        observers.forEach(observer => observer.callback());
        assert.equal(writes, firstWrites, 'our own mutation notifications must not write again');
        values.set('top', '528px'); // v5's automatic placement runs afterward
        observers[0].callback();
        assert.equal(values.get('top'), '560px');
        controller.dispose();
        assert.ok(observers.every(observer => observer.disconnected));
    } finally {
        for (const [key, descriptor] of Object.entries(originals)) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
});
