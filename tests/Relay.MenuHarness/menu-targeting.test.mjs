import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../../Relay/wwwroot/js/relay-menu.js', import.meta.url), 'utf8');

// Exercise the real module's event routing without a browser or Blazor latency.
function harness() {
    class Element {
        constructor(id, parentElement = null) {
            Object.assign(this, { id, parentElement, isConnected: true });
        }
        getAttribute() { return null; }
        addEventListener() {}
        closest() { return null; }
        contains(target) {
            for (; target; target = target.parentElement) if (target === this) return true;
            return false;
        }
    }
    const elements = new Map();
    const listeners = new Map();
    const document = {
        getElementById: id => elements.get(id),
        addEventListener: (name, callback) => listeners.set(name, callback)
    };
    class Observer { observe() {} unobserve() {} disconnect() {} }
    const context = {
        Element, document, AbortController, ResizeObserver: Observer, MutationObserver: Observer,
        window: { addEventListener() {} }, clearTimeout, clearInterval, cancelAnimationFrame() {},
        console
    };
    runInNewContext(source.replace('export function initialize', 'function initialize') +
        '\nglobalThis.initialize = initialize;', context);
    const calls = [];
    function menu(id, anchor) {
        const root = new Element(id);
        elements.set(id, root);
        const controller = context.initialize(id, {
            invokeMethodAsync: async (method, value) => { calls.push({ id, method, value }); }
        });
        controller.update(false, { anchor, context: true });
        return controller;
    }
    function rightClick(target) {
        let prevented = false;
        listeners.get('contextmenu')({
            target, clientX: 420, clientY: 250,
            preventDefault() { prevented = true; }, stopPropagation() {}
        });
        return prevented;
    }
    return { Element, elements, calls, menu, rightClick };
}

test('a removed card menu cannot intercept the replacement card before async disposal', () => {
    const h = harness();
    const stale = h.menu('old-menu', 'card-2');
    stale.root.isConnected = false;
    h.menu('current-menu', 'card-2');
    h.calls.length = 0;

    assert.equal(h.rightClick(new h.Element('card-2')), true);
    assert.deepEqual(h.calls, [{ id: 'current-menu', method: 'SetOpen', value: true }]);
});

test('a removed menu does not consume a right click when no replacement exists', () => {
    const h = harness();
    h.menu('old-menu', 'card-2').root.isConnected = false;
    h.calls.length = 0;

    assert.equal(h.rightClick(new h.Element('card-2')), false);
    assert.deepEqual(h.calls, []);
});

test('right-clicking card content opens its nearest live card menu', () => {
    const h = harness();
    h.menu('parent-menu', 'listing');
    h.menu('card-menu', 'card-2');
    h.calls.length = 0;
    const listing = new h.Element('listing');
    const card = new h.Element('card-2', listing);

    assert.equal(h.rightClick(new h.Element('', card)), true);
    assert.deepEqual(h.calls, [{ id: 'card-menu', method: 'SetOpen', value: true }]);
});
