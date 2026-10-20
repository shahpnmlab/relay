const instances = new WeakMap();

// Use scaled integers so decimal steps and large integer values do not lose precision in JS.
function decimal(value) {
    const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(value.trim());
    if (!match || !(match[2] || match[3])) return null;
    return { integer: BigInt((match[1] === '-' ? '-' : '') + (match[2] || '0') + (match[3] || '')),
        scale: (match[3] || '').length - Number(match[4] || 0) };
}

export function steppedValue(text, min, max, step, direction, radix = '.', group = ',') {
    const normalized = text.split(group || '\0').join('').replace(radix, '.');
    const values = [decimal(normalized) ?? decimal('0'), decimal(min), decimal(max), decimal(step)];
    const scale = Math.max(0, ...values.map(value => value.scale));
    const [current, lower, upper, increment] = values.map(value => value.integer * 10n ** BigInt(scale - value.scale));
    let result = current + BigInt(direction) * increment;
    result = result < lower ? lower : result > upper ? upper : result;
    const negative = result < 0n;
    let digits = (negative ? -result : result).toString().padStart(scale + 1, '0');
    if (scale) digits = (digits.slice(0, -scale) + '.' + digits.slice(-scale)).replace(/\.?0+$/, '');
    return (negative ? '-' : '') + digits.replace('.', radix);
}

export function configure(element, min, max, step, radix, group) {
    if (!element?.isConnected) return;
    cleanup(element);
    const buttonFor = event => event.composedPath().find(node => node instanceof HTMLButtonElement && node.hasAttribute('button-step'));
    const mousedown = event => { if (buttonFor(event)) event.preventDefault(); };
    const click = event => {
        const button = buttonFor(event);
        if (!button || element.disabled || element.readOnly) return;
        const control = element.control ?? element.shadowRoot.querySelector('input');
        const value = steppedValue(control.value, min, max, step, button.getAttribute('button-step') === 'up' ? 1 : -1, radix, group);
        // Step the live text immediately, retaining focus and replacing any pending typed-value
        // timer. Native events keep Fluent's number mask, binding and validation in the loop.
        element.value = value;
        control.value = value;
        control.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    };
    element.addEventListener('mousedown', mousedown);
    element.addEventListener('click', click);
    instances.set(element, { mousedown, click });
}

export function cleanup(element) {
    const instance = instances.get(element);
    if (!instance) return;
    element.removeEventListener('mousedown', instance.mousedown);
    element.removeEventListener('click', instance.click);
    instances.delete(element);
}
