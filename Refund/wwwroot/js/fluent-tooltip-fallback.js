// Fluent UI 5.0.1's showTooltip retries positioning through an unbounded chain
// of promises. Without CSS anchors (or after an anchor disappears), that can
// starve the browser's event loop. Keep this workaround until upstream fixes it.
(function () {
    if (CSS.supports('anchor-name: --a')) return;

    // The function-only polyfill is bundled locally and loaded before Blazor.
    // Fluent invokes it for each tooltip's generated positioning stylesheet.
    window.CSS_ANCHOR_POLYFILL = options => window.CssAnchorPositioning.default({
        ...options, excludeInlineStyles: true
    });

    customElements.whenDefined('fluent-tooltip').then(() => {
        const prototype = customElements.get('fluent-tooltip').prototype;
        const states = new WeakMap();
        const originalHide = prototype.hideTooltip;
        const originalDisconnect = prototype.disconnectedCallback;

        function stateFor(tooltip) {
            let state = states.get(tooltip);
            if (!state) {
                state = { generation: 0, timer: null, positioning: null };
                states.set(tooltip, state);
            }
            return state;
        }

        function cancel(tooltip) {
            const state = stateFor(tooltip);
            state.generation++;
            clearTimeout(state.timer);
        }

        prototype.showTooltip = function (delay = this.defaultDelay) {
            const anchor = this.anchorElement;
            if (!this.isConnected || !anchor?.isConnected) return;
            cancel(this);
            const state = stateFor(this);
            const generation = state.generation;

            // At most one positioning attempt at a time. Failure or a missing
            // readiness flag suppresses this tooltip, never retries in a loop.
            state.positioning ??= Promise.resolve().then(() => {
                if (!this.anchorPositioningReady) return this.setFallbackStyles();
            }).finally(() => { state.positioning = null; });

            state.positioning.then(() => {
                if (!this.anchorPositioningReady || generation !== state.generation) return;
                state.timer = setTimeout(() => {
                    if (generation !== state.generation || !this.isConnected ||
                        this.anchorElement !== anchor || !anchor.isConnected) return;
                    this.setAttribute('aria-hidden', 'false');
                    this.showPopover();
                }, delay);
            }).catch(error => console.warn('Unable to position Fluent tooltip', error));
        };

        prototype.hideTooltip = function (...args) {
            cancel(this);
            return originalHide.apply(this, args);
        };

        prototype.disconnectedCallback = function (...args) {
            cancel(this);
            return originalDisconnect.apply(this, args);
        };
    });
})();
