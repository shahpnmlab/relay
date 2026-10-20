# Fluent UI v5 browser checks

Build the solution, then run the opt-in browser checks:

```sh
dotnet build Relay.sln
cd tests/Relay.FluentMigration
npm install
npx playwright install chromium
npm test
```

Side-callout positioning tests run without a browser:

```sh
node --test tests/Relay.FluentMigration/popover-positioning.test.mjs
```

The harness starts ComponentDev on port 5131 and a TCP proxy on port 5132. The
proxy delays traffic by 150 ms in each direction, including WebSocket traffic.
The verification page re-renders its parent every 25 ms while inputs are edited.
The server, proxy, and isolated browser are stopped when the test finishes.
Screenshots and server logs are saved under the system temporary directory in
`relay-fluent-migration` (override with `FLUENT_TEST_ARTIFACTS`).

The checks cover immediate text entry and caret editing, the job string wrapper,
slider keyboard updates, disabled fractional numbers, shared listbox selection,
confirmation popovers, dialog results, notifications, theme switching, and tabs.
They also reject browser exceptions. They do not cover every application screen
or prove that slider dragging and concurrent external updates are race-free.

Use `CHROMIUM_EXECUTABLE` to select an already installed Chrome/Chromium instead
of the Playwright browser download. `PLAYWRIGHT_MODULE` optionally selects an
existing Playwright module installation.

## Input binding regression checks

After building, run `npm run test:bindings` from this directory. This uses ports
5141/5142, the same 300 ms network round trip, a parent render every 25 ms, and
400 ms asynchronous model updates. It covers initially null text, cursor editing,
standalone text inputs and textareas, int2/int3 step buttons while focused,
preserving sibling coordinates, rejected updates, resets, and switching entities.
Numeric arithmetic tests also cover decimal precision, large integers, bounds,
partial input, scientific notation, and localized number formats.

The job views await binding callbacks and retain a whole local draft while a
commit is pending. Superseded queued assignments are skipped. Field keys follow
job/property identity. The shared text adapters normalize null to empty text so
Fluent's focused-value snapshot has a stable initial value. Numeric step buttons
edit the live browser text and send native input/change events through Fluent's
mask, binding, and validation, avoiding its focused display freeze for server-side
step buttons.

## Remaining upstream input issue

The default checks use v5's 200 ms browser debounce. Short or zero delays can
still corrupt text under this stress. Reproduce the zero-delay case with:

```sh
FLUENT_TEST_DELAY=0 npm test
```

That diagnostic is expected to fail the text assertion with Fluent UI 5.0.1;
it is not part of the default passing checks. The migration improves ordinary
editing but does not establish an acknowledgement protocol for all browser and
server value updates. Related upstream reports:

- https://github.com/microsoft/fluentui-blazor/issues/5137
- https://github.com/microsoft/fluentui-blazor/issues/5250
