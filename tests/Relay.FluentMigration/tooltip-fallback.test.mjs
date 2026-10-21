import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = await readFile(new URL('../../Refund/wwwroot/js/fluent-tooltip-fallback.js', import.meta.url), 'utf8');

async function fixture({ native = false, position } = {}) {
    const timers = new Map();
    const warnings = [];
    let id = 0;
    class Tooltip {
        isConnected = true;
        anchorElement = { isConnected: true };
        anchorPositioningReady = false;
        defaultDelay = 250;
        attempts = 0;
        shown = 0;
        hidden = 0;
        disconnected = 0;
        async setFallbackStyles() {
            this.attempts++;
            if (position) await position(this);
        }
        showTooltip() { throw new Error('Unbounded upstream show must not run'); }
        hideTooltip() { this.hidden++; }
        disconnectedCallback() { this.disconnected++; }
        setAttribute(name, value) { this[name] = value; }
        showPopover() { this.shown++; }
    }
    const originalShow = Tooltip.prototype.showTooltip;
    const context = {
        CSS: { supports: () => native, escape: id => `escaped-${id}` },
        window: { CssAnchorPositioning: { default: options => options } },
        customElements: { whenDefined: async () => {}, get: () => Tooltip },
        setTimeout: callback => { timers.set(++id, callback); return id; },
        clearTimeout: key => timers.delete(key),
        console: { warn: (...args) => warnings.push(args) }
    };
    vm.runInNewContext(source, context);
    await flush();
    return { tooltip: new Tooltip(), timers, warnings, originalShow, context,
        runTimers() { for (const [key, callback] of timers) { timers.delete(key); callback(); } } };
}

async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

test('polyfill receives escaped anchor selectors and only scans its generated stylesheets', async () => {
    const f = await fixture();
    const sheet = { textContent: '#4dcf9080-b84c { anchor-name: --a; }\n#tooltip-1 { left: anchor(left); }' };
    const options = f.context.window.CSS_ANCHOR_POLYFILL({ elements: [sheet] });
    assert.equal(sheet.textContent, '#escaped-4dcf9080-b84c { anchor-name: --a; }\n#escaped-tooltip-1 { left: anchor(left); }');
    assert.equal(options.excludeInlineStyles, true);
    assert.equal(options.elements[0], sheet);
});

test('missing positioning readiness ends after one attempt and leaves the event loop usable', async () => {
    const f = await fixture();
    f.tooltip.showTooltip();
    await flush();
    assert.equal(f.tooltip.attempts, 1);
    assert.equal(f.timers.size, 0);
    assert.equal(f.tooltip.shown, 0);
});

test('successful fallback shows the tooltip and rapid requests share a positioning attempt', async () => {
    let finish;
    const f = await fixture({ position: tooltip => new Promise(resolve => {
        finish = () => { tooltip.anchorPositioningReady = true; resolve(); };
    }) });
    f.tooltip.showTooltip();
    f.tooltip.showTooltip();
    await flush();
    assert.equal(f.tooltip.attempts, 1);
    finish();
    await flush();
    assert.equal(f.timers.size, 1);
    f.runTimers();
    assert.equal(f.tooltip.shown, 1);
    assert.equal(f.tooltip['aria-hidden'], 'false');
});

test('positioning rejection is handled without retries', async () => {
    const f = await fixture({ position: () => { throw new Error('bad stylesheet'); } });
    f.tooltip.showTooltip();
    await flush();
    assert.equal(f.tooltip.attempts, 1);
    assert.equal(f.warnings.length, 1);
    assert.equal(f.tooltip.shown, 0);
});

test('hiding while positioning is pending prevents a late show', async () => {
    let finish;
    const f = await fixture({ position: tooltip => new Promise(resolve => {
        finish = () => { tooltip.anchorPositioningReady = true; resolve(); };
    }) });
    f.tooltip.showTooltip();
    await flush();
    f.tooltip.hideTooltip();
    finish();
    await flush();
    assert.equal(f.timers.size, 0);
});

test('hide and removal cancel a pending show, including an anchor removed during the delay', async () => {
    for (const cancel of ['hide', 'disconnect', 'anchor']) {
        const f = await fixture({ position: tooltip => { tooltip.anchorPositioningReady = true; } });
        f.tooltip.showTooltip();
        await flush();
        if (cancel === 'hide') f.tooltip.hideTooltip();
        if (cancel === 'disconnect') { f.tooltip.isConnected = false; f.tooltip.disconnectedCallback(); }
        if (cancel === 'anchor') f.tooltip.anchorElement.isConnected = false;
        f.runTimers();
        assert.equal(f.tooltip.shown, 0, cancel);
    }
});

test('missing anchor never starts positioning and native CSS anchors retain upstream behavior', async () => {
    const f = await fixture();
    f.tooltip.anchorElement = null;
    f.tooltip.showTooltip();
    await flush();
    assert.equal(f.tooltip.attempts, 0);
    const native = await fixture({ native: true });
    assert.equal(native.tooltip.showTooltip, native.originalShow);
    assert.equal(native.context.window.CSS_ANCHOR_POLYFILL, undefined);
});
