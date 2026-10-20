import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../../Relay/wwwroot/js/relay-menu.js', import.meta.url), 'utf8');
const context = { getComputedStyle: surface => surface.style };
runInNewContext(source.replace('export function initialize', 'function initialize') +
    '\nglobalThis.updateArrows = updateArrows;', context);

function menu(contentHeight, maxHeight) {
    const arrows = [{ hidden: true }, { hidden: true }];
    arrows.forEach(arrow => { arrow.matches = () => true; });
    const scroll = { scrollHeight: contentHeight, scrollTop: 0, clientHeight: 255 };
    const surface = {
        children: arrows,
        style: { maxHeight: `${maxHeight}px`, paddingTop: '3px', paddingBottom: '3px',
            borderTopWidth: '1px', borderBottomWidth: '1px' },
        querySelector: () => scroll,
        get clientHeight() { return 261 + (arrows[0].hidden ? 0 : 40); }
    };
    return { surface, scroll, arrows };
}

test('Firefox intrinsic overflow does not repeatedly add and remove 40px of arrows', () => {
    // Captured in Firefox: scrollHeight257/clientHeight255, surface261 without
    // strips or301 with them. Both layouts fit within the393px height limit.
    const { surface, arrows } = menu(257, 393);
    for (const initiallyHidden of [true, false]) {
        arrows.forEach(arrow => { arrow.hidden = initiallyHidden; });
        for (let frame = 0; frame < 12; frame++) {
            context.updateArrows(surface);
            assert.ok(arrows.every(arrow => arrow.hidden));
        }
    }
});

test('constrained menus retain both strips and respond to scrolling and resizing', () => {
    const { surface, scroll, arrows } = menu(600, 480);
    scroll.clientHeight = 432;
    for (let frame = 0; frame < 12; frame++) {
        context.updateArrows(surface);
        assert.ok(arrows.every(arrow => !arrow.hidden));
    }
    assert.equal(arrows[0].disabled, true);
    assert.equal(arrows[1].disabled, false);
    scroll.scrollTop = 168;
    context.updateArrows(surface);
    assert.equal(arrows[0].disabled, false);
    assert.equal(arrows[1].disabled, true);
    surface.style.maxHeight = '700px';
    context.updateArrows(surface);
    assert.ok(arrows.every(arrow => arrow.hidden));
});
