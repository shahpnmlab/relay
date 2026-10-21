import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const scriptUrl = new URL('../../Refund/wwwroot/js/fluent-tooltip-fallback.js', import.meta.url);
const source = await readFile(scriptUrl, 'utf8');
await import(new URL('popover-position.js', scriptUrl));

async function flush() { await new Promise(setImmediate); await new Promise(setImmediate); }

async function fixture({ native = false, failLoading = false } = {}) {
    const timers = new Map();
    const warnings = [];
    const observers = [];
    let id = 0;
    class Target {
        listeners = new Map();
        addEventListener(name, callback) {
            const callbacks = this.listeners.get(name) ?? new Set();
            callbacks.add(callback);
            this.listeners.set(name, callbacks);
        }
        removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
        emit(name, event = {}) { for (const callback of this.listeners.get(name) ?? []) callback(event); }
        get listenerCount() { return [...this.listeners.values()].reduce((n, callbacks) => n + callbacks.size, 0); }
    }
    const anchor = { id: '4dcf9080-b84c', isConnected: true,
        getBoundingClientRect: () => ({ left: 700, right: 900, top: 500, bottom: 540 }) };
    class Tooltip extends Target {
        isConnected = true;
        anchorElement = anchor;
        anchorPositioningReady = false;
        defaultDelay = 250;
        positioning = 'before';
        offsetWidth = 150;
        offsetHeight = 50;
        style = {};
        shown = 0;
        hidden = 0;
        disconnected = 0;
        setFallbackStyles() { throw new Error('Upstream CSS fallback must not run'); }
        showTooltip() { throw new Error('Unbounded upstream show must not run'); }
        hideTooltip() { this.hidden++; }
        disconnectedCallback() { this.disconnected++; }
        setAttribute(name, value) { this[name] = value; }
        showPopover() { this.shown++; }
        hidePopover() { this.hidden++; }
    }
    const originalShow = Tooltip.prototype.showTooltip;
    const window = Object.assign(new Target(), { innerWidth: 1200, innerHeight: 900 });
    const context = {
        CSS: { supports: () => native }, window, URL,
        document: { body: {}, currentScript: { src: failLoading ? 'file:///missing/fluent-tooltip-fallback.js' : scriptUrl.href } },
        customElements: { whenDefined: async () => {}, get: () => Tooltip },
        getComputedStyle: () => ({ direction: 'ltr' }),
        ResizeObserver: class {
            constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
            observe() {}
            disconnect() { this.disconnected = true; }
        },
        MutationObserver: class {
            constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
            observe() {}
            disconnect() { this.disconnected = true; }
        },
        setTimeout: callback => { timers.set(++id, callback); return id; },
        clearTimeout: key => timers.delete(key),
        console: { warn: (...args) => warnings.push(args) }
    };
    vm.runInNewContext(source, context, { importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER });
    await flush();
    return { tooltip: new Tooltip(), timers, warnings, originalShow, window, observers,
        runTimers() { for (const [key, callback] of timers) { timers.delete(key); callback(); } } };
}

test('unsupported CSS anchors bypass the upstream retry loop and show beside a numeric GUID anchor', async () => {
    const f = await fixture();
    await f.tooltip.setFallbackStyles();
    assert.equal(f.tooltip.anchorPositioningReady, true);
    f.tooltip.showTooltip();
    f.runTimers();
    await flush();
    assert.equal(f.tooltip.shown, 1);
    assert.equal(f.tooltip['aria-hidden'], 'false');
    assert.equal(f.tooltip.style.left, '550px');
    assert.equal(f.tooltip.style.top, '495px');
    assert.equal(f.warnings.length, 0);
});

test('rapid hover requests share a timer and track scrolling only while visible', async () => {
    const f = await fixture();
    f.tooltip.showTooltip();
    f.tooltip.showTooltip();
    assert.equal(f.timers.size, 1);
    f.runTimers();
    await flush();
    assert.equal(f.tooltip.shown, 1);
    f.tooltip.anchorElement.getBoundingClientRect = () => ({ left: 800, right: 1000, top: 600, bottom: 640 });
    f.window.emit('scroll');
    assert.equal(f.tooltip.style.left, '650px');
    assert.equal(f.tooltip.style.top, '595px');
    f.tooltip.hideTooltip();
    assert.equal(f.window.listenerCount, 0);
    assert.equal(f.tooltip.listenerCount, 0);
    assert.ok(f.observers.every(observer => observer.disconnected));
});

test('a failed positioning asset is handled without retrying or showing a misplaced tooltip', async () => {
    const f = await fixture({ failLoading: true });
    f.tooltip.showTooltip();
    f.runTimers();
    await flush();
    assert.equal(f.tooltip.shown, 0);
    assert.equal(f.timers.size, 0);
    assert.ok(f.warnings.length > 0);
});

test('hide, removal, and a replaced anchor cancel a delayed show', async () => {
    for (const cancel of ['hide', 'disconnect', 'anchor', 'replacement']) {
        const f = await fixture();
        f.tooltip.showTooltip();
        if (cancel === 'hide') f.tooltip.hideTooltip();
        if (cancel === 'disconnect') { f.tooltip.isConnected = false; f.tooltip.disconnectedCallback(); }
        if (cancel === 'anchor') f.tooltip.anchorElement.isConnected = false;
        if (cancel === 'replacement') f.tooltip.anchorElement = { ...f.tooltip.anchorElement };
        f.runTimers();
        await flush();
        assert.equal(f.tooltip.shown, 0, cancel);
        assert.equal(f.window.listenerCount, 0, cancel);
    }
});

test('hiding while the positioning module is awaited cancels the show', async () => {
    const f = await fixture();
    f.tooltip.showTooltip();
    f.runTimers();
    f.tooltip.hideTooltip();
    await flush();
    assert.equal(f.tooltip.shown, 0);
});

test('native dismissal and disconnection dispose positioning observers', async () => {
    for (const cancel of ['toggle', 'disconnect', 'anchor']) {
        const f = await fixture();
        f.tooltip.showTooltip(); f.runTimers(); await flush();
        if (cancel === 'toggle') f.tooltip.emit('toggle', { newState: 'closed' });
        if (cancel === 'disconnect') {
            f.tooltip.isConnected = false;
            f.tooltip.disconnectedCallback();
            f.observers.forEach(observer => observer.callback());
        }
        if (cancel === 'anchor') { f.tooltip.anchorElement.isConnected = false; f.window.emit('scroll'); }
        assert.equal(f.window.listenerCount, 0, cancel);
        assert.equal(f.tooltip.listenerCount, 0, cancel);
        assert.ok(f.observers.every(observer => observer.disconnected), cancel);
    }
});

test('queued callbacks from a previous show cannot dismiss a newer tooltip', async () => {
    const f = await fixture();
    f.tooltip.showTooltip(); f.runTimers(); await flush();
    const oldObservers = [...f.observers];
    f.tooltip.showTooltip(); f.runTimers(); await flush();
    const listeners = f.window.listenerCount;
    oldObservers.forEach(observer => observer.callback());
    assert.equal(f.tooltip.hidden, 0);
    assert.equal(f.window.listenerCount, listeners);
    assert.equal(f.tooltip.shown, 2);
});

test('missing anchors do nothing and native CSS anchors retain upstream behavior', async () => {
    const f = await fixture();
    f.tooltip.anchorElement = null;
    f.tooltip.showTooltip();
    assert.equal(f.timers.size, 0);
    const native = await fixture({ native: true });
    assert.equal(native.tooltip.showTooltip, native.originalShow);
});
