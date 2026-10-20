# Fluent UI v5 migration

Relay, Refund, ComponentDev, Emoji, and the standalone menu harness now reference
Fluent UI 5.0.1. Emoji explicitly references core 5.0.1 because the Emoji 5.0.1
package still declares core 4.14.5 as its minimum dependency.

The migration follows the [upstream guide](https://www.fluentui-blazor.net/MigrationV5)
and the released 5.0.1 source where the guide differs from the current API.

## Application changes

- Text fields, number inputs, spinners, tabs, selection controls, badges,
  accordions, navigation, and the component-development layout use the v5 APIs.
- Dialogs use `DialogOptions`, `IDialogInstance`, and the returned `DialogResult`.
  Existing form validation and application-owned buttons are retained.
- Notifications use `INotificationService`. Its toast tasks complete on dismissal,
  so showing a toast intentionally does not block an application operation.
  Upload progress uses a custom toast body with subscribed progress updates.
- Root providers use `FluentProviders`. Theme switching uses `IThemeService`;
  shared styles and JavaScript color reads use v5 design tokens.
- `RobustFluentNumberField` adapts string bounds from job metadata to v5's typed
  numeric parameters, including nullable types. V5 renders disabled numbers
  directly; the old alternate-text-field workaround is gone.
- Value-based component keys are removed from editable fields. Entity-based
  keys remain where changing the edited job should create a new component.

## Popovers and selection

V5 popovers choose their placement automatically. The old placement parameters
and fixed-direction confirmation arrows have been removed. Closed menu and emoji
selector content is explicitly lazy, preserving the previous rendering cost.

`RelayPopover` first renders the underlying v5 component closed, then applies an
initial open request after mounting. Without this ordering, a conditionally
created open popover can try to enter the browser top layer before it is attached
to the document. This adapter also covers conditionally rendered job previews.

Shared listbox wrappers explicitly handle pointer activation of their rendered
entries and suppress duplicate notifications; native keyboard selection remains
wired to the v5 listbox callback. Popup open state is propagated through both
levels of the shared listbox/combo-button wrappers.

V5 reports tab-selection changes when old tabs are disposed. The M refinement
view associates its callback with the rendered job so disposal of a previous
job's tabs cannot overwrite the new job's initial selection.

## Verification and limits

Run `dotnet build Relay.sln`, `dotnet test Refund.Tests/Refund.Tests.csproj`, and
the [browser checks](../tests/Relay.FluentMigration/README.md). The standalone menu
harness builds separately; its JavaScript checks use Node's built-in test runner.

Browser checks use a real delayed TCP connection (300 ms round trip), with
frequent parent renders. They pass ordinary text editing with the v5 default
200 ms debounce, plus the tested interactions documented in the harness.

A zero-delay text input still loses characters under this stress. The browser
harness includes an opt-in reproduction. Migration alone is therefore not a
complete fix for the original latency problem; arbitrary external model echoes,
slider drags, submission before a debounce finishes, and composite-value edits
still need focused follow-up validation.

## Visual compatibility repairs

The v5 reboot shifts HTML headings up one size, buttons use inherited icon color,
and input classes/styles move to the surrounding `fluent-field`. Relay keeps its
previous heading scale, uses transparent button appearances rather than transparent
text, explicitly sizes icon-only actions, and targets the new field structure.

Relay and ComponentDev opt out of v5's additional default page stylesheet with
`no-fuib-style`, retaining the explicitly linked reboot and application styles.
This avoids a second, later stylesheet adding global table cell padding and
changing application-owned layouts.

Raised surfaces use `colorNeutralBackground1`, separately from the surrounding
`colorNeutralBackground2` canvas. Brand-colored text uses `colorBrandForeground1`;
text and icons over brand backgrounds use `colorNeutralForegroundOnBrand`.
Legacy shadow/fill/error tokens and removed shadow-part selectors are corrected.
Tab layouts target v5's `div[role="tabpanel"]` and size them with flex layout.

These repairs were checked against the released component source and built/tested.
They have not received a complete visual review of every screen in both themes.

Plain badges explicitly default to neutral colors and rounded corners, retaining
v4's normal text weight and narrow padding. Explicit status badge colors still
override those defaults. `RelayPopover.Position` selects the preferred placement
for the sign-out confirmation, including viewport clamping and side flipping;
the native v5 popover continues to manage dismissal and its browser top layer.

All application-owned dialogs now render through `FluentDialogBody`: in v5 the
configured header, close action, and footer actions are emitted by that component,
not by `FluentDialog` itself. Browse-only file dialogs retain their header close
button; selection modes retain the file browser's Select/Save and Cancel buttons.

`ConfirmationPopover` shares side placement, viewport-aware arrows, borderless
confirmation buttons, and v4's constant `#BC2F32` error background across sign-out,
`ConfirmButton`, and action-panel confirmations. Generic confirmations prefer the
left side; sign-out prefers the right. Badge vertical alignment and filtered
listbox padding are explicitly restored, as is the accent fill for default button
icons while explicit icon/button colors and primary/disabled states are preserved.

## Complete popover placement audit

Every application `RelayPopover` now uses the same explicit positioning module,
including main-axis flipping, cross-axis alignment, viewport clamping, RTL, and
repositioning when the anchor or popup changes size. Owner placement changes also
reconfigure the adapter. Only the wrapper renders the native v5 `FluentPopover`.

| Surface | Preferred placement |
| --- | --- |
| Breadcrumb and ordinary combo/listbox menus | Below, aligned with the full button group's start |
| Job editor Run queue selector | Above, aligned with the button group's start |
| Property/job-editor emoji selectors | Before the icon, vertically centered |
| Create project/space/view emoji selectors | Below the icon, horizontally centered |
| Add-member dropdown | Below, aligned with the anchor's end |
| Job previews | Owner's requested position; After when unspecified |
| General confirmations / sign-out | Before / After, with 12px arrow space |
| File browser rename/create/delete editors | Below, aligned with the anchor's start |

File browser toolbar IDs are now unique per component instance so nested browsers
cannot open popovers against an underlying dialog's button. Fluent tooltips keep
their explicit v5 positioning, and Relay's custom menus retain their own existing
positioning engine.

V5's default `FluentFieldClass` adds 12px above and below labeled inputs. Both app
hosts disable that extra class because existing forms already set their own gaps.
Author badges have an explicit 4px starting margin rather than depending on Razor
whitespace around inline components.

V5 dropdowns have a hard 160px minimum inside their shadow DOM. Fixed-width sort,
role, and access-level selectors now reserve that width; the view toolbar also
prevents its controls from shrinking into one another. Inactive sidebar/home
navigation uses Subtle appearance instead of a default outlined button with a
transparent background. Shared button text uses normal weight, and disabled
buttons fade their normal surface rather than using v5's separate dark fill;
forced-color mode retains the native accessibility styling.

## Visual baseline audit (20 October 2026)

The migration preserves Relay's v4 appearance; the v5 default theme is not the
reference. `Refund/wwwroot/css/fluent-v4-compat.css`, linked by both app hosts,
centralizes palette and button geometry. Tokens are overridden on `html`, so
root computed-style reads in canvas/diagram code agree with native controls.
V5 removes `data-theme` in light mode; the selectors handle that absence as
well as explicit light/dark and system-light/system-dark attributes. Native forced-color
rules and keyboard-focus behavior are retained.

Production screenshot colors were converted from the embedded display ICC profile
to sRGB before sampling. Raw screenshot RGB values are not CSS color values.

| Confirmed difference | V4 reference | V5 default/local before repair | Repair |
| --- | --- | --- | --- |
| Dark canvas | #1a1a1a | #1f1f1f | Root neutral background token |
| Dark panels/cards | #333333 | #292929 | Root raised-surface token |
| Dark blue fill | approximately #5fc8fc (gradient varies) | #0f5ea3 | Shared accent fill |
| Dark accent foreground | #61c9fc | darker v5 brand foreground | Shared accent foreground |
| Text over dark-theme accent | Black | White | On-brand foreground, plus local mark tokens for checkbox/radio/switch |
| Dark resting card outline | approximately #505050 | #666666 | Shared neutral stroke |
| Default text button side padding | 10px at density 0 (v4 source) | 12px | Medium/default text button padding |
| Button icon/text gap | 11px (v4 source) | 8px (v5 Blazor override) | Start/end slot margin |
| Body/control font family | Segoe UI Variable, Segoe UI, sans-serif | Different v5 base stack | Shared base font family |
| Ordinary author badge | Subtle neutral surface | Black in dark theme | Informative filled badge surface |
| Error text | v4 `--error` | Undefined CSS variable | Explicit shared error alias |
| Iteration unavailable spinner | 32px, green after logs advance | Malformed migrated attributes | Typed size and local spinner color token |

The light accent uses v4's default `accent-base-color` (#0078d4). Dark resting
colors are grounded in the supplied production screenshot. Hover/pressed colors
and badge surfaces are explicit Relay choices based on that baseline; they do
not reproduce all of FAST v4's contextual palette recipes. Those interaction
states still need side-by-side visual review, especially in light mode.

### Coverage and remaining visual review

The source inventory covers every Fluent component family used in Relay/Refund:
buttons; text/number/textarea inputs; select/combobox/listbox; badges/counter badges;
checkbox/radio/switch/slider; tabs/accordions; dialogs/popovers/tooltips;
spinner/message bar; grid/labels/dividers/stack; icons/emoji and input-file.
The following is a review matrix, not a claim that every cell is visually verified.

| Area | Source audit / shared repair | Visual review still required |
| --- | --- | --- |
| Theme | Resting surfaces, brand/compound-brand states, selected foreground contrast, error aliases | Hover/pressed/focus, light palette, disabled input contrast |
| Buttons | Regular weight, 10px padding, 11px icon gap, SVG aspect ratio, icon-only sizing, disabled fading | All appearances at both zoom 100% and narrow widths |
| Inputs and forms | FluentField wrapper selectors; removed extra default field margins; number bounds | Validation, multiline height, readonly/disabled, job editor dense layouts |
| Select/listbox | 160px native dropdown minimum reserved; compact list options restored | Long options, keyboard selection, sort toolbar and breadcrumb widths |
| Badges | Neutral default, font/padding/alignment and author margin restored | Counter/status badge sizes and wrapping alongside text |
| Toggle/slider/tab | Compound accent tokens and mark contrast included; panel flex layout repaired | Slider thumb/rail geometry, checked/disabled, vertical tabs, overflow tabs |
| Dialogs | DialogBody headers/close/buttons restored | Browse/select/save, nested browsers, long forms, viewport scrolling |
| Popovers | Every application instance uses the shared explicit placement adapter | All preferred sides near viewport edges; see placement inventory above |
| Notifications/grid/accordion | V5 APIs and known removed selectors reviewed | Long text, sorting, expansion, disabled rows, toast dismissal |

ComponentDev's `/fluent-migration` page now includes a stationary visual reference
section for button appearances and disabled states, icon buttons, inline author
badge, checked/unchecked controls, spinner, text/disabled/multiline inputs, and a
dropdown. Existing interactive checks above it cover slider, tabs, confirmations,
dialogs, menus and theme switching. It is a repeatable review surface, not an
automated screenshot comparison. Full visual parity remains unverified until
these cases have been compared in a browser against v4 at matching zoom/viewport.

### Queue configuration follow-up

Comparison with the production queue screenshot identified clickable badges that
had been migrated to ordinary 32px buttons. All eight variable/module insertion
sites now use a shared compact button class (20px height, 3px side padding,
16px line height, neutral surface, no visible border). They retain native button
keyboard activation. Queue deletion and overlay close actions use Transparent
appearance rather than only a transparent fill, which left v5's outline visible.
Queue fields and toolbar buttons use a quieter resting frame.

Horizontal tabs restore v4's source-defined 32px height and centered 20x3px
indicator. Both the v5 anchor-positioned indicator and its per-tab fallback are
covered. Explicit small/large tab header sizes retain their native padding.
The top bar's standalone user icon explicitly uses the accent foreground; the
shared button icon rule does not apply to standalone FluentIcon components.
These follow-up changes are source/screenshot based; browser visual verification
is still pending.

## Refactoring after visual review

All shared Fluent v4 compatibility selectors now live in `fluent-v4-compat.css`;
`refund.css` retains application/component styling. This separates the version
adapter from ordinary UI styles without changing the accepted declarations.
`InsertionChip` owns the shared behavior/markup for queue variable and module
insertion, replacing eight copies of button configuration.

`ConfirmButton` explicitly declares the FluentButton properties it exposes,
including icons, disabled state, appearance and ID. Only remaining attributes such
as ARIA/data attributes use the unmatched bag. Its button and popover now use the
same caller-supplied ID (or the same generated default), avoiding mismatched
anchors. Rendering tests cover enum forwarding and custom-ID confirmation anchors.

The placement adapter and confirmation callout remain shared; their v5 shadow-DOM
integration is intentional. The default-icon selector still depends on Fluent's
inline fill/style serialization to preserve explicitly colored icons and buttons;
that vendor coupling is confined to the compatibility stylesheet. A broader icon
or button abstraction would be more invasive than this migration cleanup.

Horizontal slider fields explicitly fill their container: v5's inline-grid field
wrapper otherwise shrink-wraps an unsized slider to its native minimum width,
leaving full-width application labels misaligned. Explicit field widths and
vertical sliders are preserved. The exported track part suppresses v5's automatic
per-step tick marks without removing Step or changing snapping/keyboard behavior.
This shared rule covers both tilt viewers and the M logo parameter slider.

`ViewerToolbar` replaces the removed v4 toolbar surface for micrograph and legacy
tomogram controls, sharing explicit layout, neutral background, border and text
colors. Their particle/brush/coordinate fields use theme surfaces rather than
hard-coded white backgrounds.
