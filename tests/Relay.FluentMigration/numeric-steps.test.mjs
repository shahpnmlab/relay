import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = await readFile(new URL('../../Refund/Components/RobustFluentNumberField.razor.js', import.meta.url), 'utf8');
const { steppedValue } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('decimal steps preserve precision and trailing integer zeroes', () => {
    assert.equal(steppedValue('0.2', '0', '2', '0.1', 1), '0.3');
    assert.equal(steppedValue('9.9', '0', '20', '0.1', 1), '10');
    assert.equal(steppedValue('0', '-1', '1', '0.0000000000000000000000000001', 1), '0.0000000000000000000000000001');
});

test('integer steps retain digits above the JS safe integer limit', () => {
    assert.equal(steppedValue('9007199254740992', '0', '9223372036854775807', '1', 1), '9007199254740993');
});

test('steps clamp to bounds and handle partial or empty drafts', () => {
    assert.equal(steppedValue('10', '-10', '10', '1', 1), '10');
    assert.equal(steppedValue('-10', '-10', '10', '1', -1), '-10');
    assert.equal(steppedValue('-', '-10', '10', '1', -1), '-1');
    assert.equal(steppedValue('', '5', '10', '1', 1), '5');
    assert.equal(steppedValue('3', '0', '10', '0', 1), '3');
});

test('scientific notation and localized text are supported', () => {
    assert.equal(steppedValue('1e-3', '-1', '1', '1e-3', 1), '0.002');
    assert.equal(steppedValue('1.234,5', '-10000', '10000', '0.1', 1, ',', '.'), '1234,6');
});
