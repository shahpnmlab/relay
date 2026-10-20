// Uses a TCP proxy so latency applies to SignalR WebSockets as well as HTTP.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import { spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const server = spawn('dotnet', ['run', '--project', 'ComponentDev/ComponentDev.csproj',
    '--no-build', '--no-launch-profile', '--urls', 'http://127.0.0.1:5141'], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    env: { ...process.env, ASPNETCORE_ENVIRONMENT: 'Development', DOTNET_ENVIRONMENT: 'Development' }
});
let serverLog = '';
server.stdout.on('data', data => serverLog += data);
server.stderr.on('data', data => serverLog += data);
const sockets = new Set();
const proxy = createServer(client => {
    const upstream = connect(5141, '127.0.0.1');
    for (const socket of [client, upstream]) {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
        socket.on('error', () => {});
    }
    client.on('data', data => setTimeout(() => { if (!upstream.destroyed) upstream.write(data); }, 150));
    upstream.on('data', data => setTimeout(() => { if (!client.destroyed) client.write(data); }, 150));
    client.on('end', () => setTimeout(() => upstream.end(), 200));
    upstream.on('end', () => setTimeout(() => client.end(), 200));
});
let browser;
try {
    for (let i = 0; i < 150 && !serverLog.includes('Now listening'); i++)
        await new Promise(resolve => setTimeout(resolve, 100));
    assert.ok(serverLog.includes('Now listening'), serverLog);
    await new Promise(resolve => proxy.listen(5142, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true,
        ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5142/input-bindings');
    const text = page.locator('#binding-text input');
    await text.waitFor();
    await page.waitForTimeout(1500);

    // Start from null, cross several debounce windows, and keep editing during saves/renders.
    const expected = 'abcdefghijklmnopqrstuvwxyz';
    await text.pressSequentially(expected, { delay: 260 });
    await page.waitForTimeout(2200);
    assert.equal(await text.inputValue(), expected);
    assert.equal(await page.locator('#binding-text-value').innerText(), expected);
    await text.press('Home');
    await text.press('ArrowRight');
    await text.pressSequentially('XYZ', { delay: 90 });
    await page.waitForTimeout(2200);
    assert.equal(await text.inputValue(), 'aXYZbcdefghijklmnopqrstuvwxyz');
    console.log('PASS null-initialized text and cursor stability during delayed persistence');

    for (const selector of ['#binding-standalone-text input', '#binding-area textarea']) {
        const input = page.locator(selector);
        await input.pressSequentially('null text', { delay: 260 });
        await page.waitForTimeout(1200);
        assert.equal(await input.inputValue(), 'null text');
    }
    console.log('PASS standalone null-initialized text input and textarea');

    const pairInputs = page.locator('#binding-int2 input');
    await pairInputs.nth(0).focus();
    const pairUp = page.locator('#binding-int2 [button-step="up"]');
    for (let i = 0; i < 3; i++) await pairUp.nth(0).click({ delay: 30 });
    // Assert while still focused: blur must not be required to display a step.
    await page.waitForTimeout(2200);
    assert.equal(await pairInputs.nth(0).inputValue(), '13');
    assert.equal(await pairInputs.nth(0).evaluate(input =>
        input === input.getRootNode().activeElement && input.getRootNode().host === document.activeElement), true);
    await pairUp.nth(1).click();
    await page.waitForTimeout(1600);
    assert.equal(await page.locator('#binding-int2-value').innerText(), '13,21');
    console.log('PASS int2 stepping updates the focused input and preserves other coordinates');

    await pairInputs.nth(0).fill('42');
    await pairUp.nth(0).click();
    // The click edits the live text before a network round trip, even with a debounce pending.
    assert.equal(await pairInputs.nth(0).inputValue(), '43');
    await page.waitForTimeout(1800);
    assert.equal(await page.locator('#binding-int2-value').innerText(), '43,21');
    console.log('PASS typing followed immediately by stepping uses the browser draft');

    const tripleUp = page.locator('#binding-int3 [button-step="up"]');
    for (let i = 0; i < 3; i++) await tripleUp.nth(i).click();
    await page.waitForTimeout(2200);
    assert.equal(await page.locator('#binding-int3-value').innerText(), '11,21,31');
    const tripleValues = await page.locator('#binding-int3 input').evaluateAll(inputs => inputs.map(input => input.value));
    assert.deepEqual(tripleValues, ['11', '21', '31']);
    console.log('PASS rapid int3 edits preserve all coordinates');

    await text.fill('pending before reset');
    await page.waitForTimeout(250);
    await page.locator('#binding-reset').click();
    await page.waitForTimeout(2200);
    assert.equal(await text.inputValue(), 'reset');
    await page.locator('#binding-reject').click();
    await text.fill('rejected');
    await text.blur();
    await page.waitForTimeout(1800);
    assert.equal(await text.inputValue(), 'reset');
    assert.equal(await page.locator('#binding-text-value').innerText(), 'reset');
    console.log('PASS reset and rejected edits reconcile to the model');

    await page.locator('#binding-reject').click();
    await text.fill('pending');
    await page.waitForTimeout(250);
    await page.locator('#binding-switch').click();
    await page.waitForTimeout(1800);
    assert.equal(await text.inputValue(), 'other entity');
    assert.deepEqual(errors, []);
    console.log('PASS switching entity discards old editor state; no browser exceptions');
} finally {
    if (browser) await browser.close();
    for (const socket of sockets) socket.destroy();
    proxy.close();
    server.kill('SIGTERM');
}
