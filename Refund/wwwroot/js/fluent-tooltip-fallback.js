// Fluent UI 5.0.1 retries unsupported CSS anchor positioning indefinitely.
// Use Relay's existing viewport positioning policy in browsers without it.
(function () {
    if (CSS.supports('anchor-name: --a')) return;

    const positioning = import(new URL('popover-position.js', document.currentScript.src));
    // Handle a failed asset request even if no tooltip has been opened yet.
    positioning.catch(error => console.warn('Unable to load tooltip positioning', error));

    customElements.whenDefined('fluent-tooltip').then(() => {
        const prototype = customElements.get('fluent-tooltip').prototype;
        const states = new WeakMap();
        const originalHide = prototype.hideTooltip;

        function stateFor(tooltip) {
            let state = states.get(tooltip);
            if (!state) {
                state = { generation: 0, timer: null, dispose: null, update: null };
                states.set(tooltip, state);
            }
            return state;
        }

        function cancel(tooltip) {
            const state = stateFor(tooltip);
            state.generation++;
            clearTimeout(state.timer);
            state.dispose?.();
            state.dispose = state.update = null;
        }

        // Avoid Fluent's generated CSS selectors (which also fail for numeric
        // GUID ids). Position only while visible, using the actual DOM anchor.
        prototype.setFallbackStyles = function () {
            this.anchorPositioningReady = true;
            stateFor(this).update?.();
            return Promise.resolve();
        };

        prototype.showTooltip = function (delay = this.defaultDelay) {
            const anchor = this.anchorElement;
            if (!this.isConnected || !anchor?.isConnected) return;
            cancel(this);
            const state = stateFor(this);
            const generation = state.generation;
            const current = () => generation === state.generation && this.isConnected &&
                anchor.isConnected && this.anchorElement === anchor;

            state.timer = setTimeout(() => {
                positioning.then(({ getPopoverPosition }) => {
                    if (!current()) return;
                    Object.assign(this.style, { position: 'fixed', inset: 'auto',
                        left: '0px', top: '0px', right: 'auto', bottom: 'auto',
                        margin: '0', translate: 'none' });
                    this.setAttribute('aria-hidden', 'false');
                    this.showPopover();

                    const update = () => {
                        if (generation !== state.generation) return;
                        if (!current()) {
                            cancel(this);
                            if (this.isConnected) this.hidePopover();
                            return;
                        }
                        const viewport = window.visualViewport;
                        const position = getPopoverPosition(anchor.getBoundingClientRect(),
                            { width: this.offsetWidth, height: this.offsetHeight },
                            { width: viewport?.width ?? window.innerWidth,
                                height: viewport?.height ?? window.innerHeight },
                            this.positioning || 'above', getComputedStyle(anchor).direction === 'rtl');
                        const styles = {
                            left: `${position.left + (viewport?.offsetLeft ?? 0)}px`,
                            top: `${position.top + (viewport?.offsetTop ?? 0)}px`
                        };
                        for (const [name, value] of Object.entries(styles)) {
                            if (this.style[name] !== value) this.style[name] = value;
                        }
                    };
                    const onToggle = event => { if (event.newState === 'closed') cancel(this); };
                    const resize = new ResizeObserver(update);
                    resize.observe(anchor);
                    resize.observe(this);
                    // Custom-element lifecycle callbacks are captured at
                    // registration, so patching disconnectedCallback later
                    // cannot reliably clean up a removed tooltip or anchor.
                    const removals = new MutationObserver(() => { if (!current()) update(); });
                    removals.observe(document.body, { childList: true, subtree: true });
                    window.addEventListener('scroll', update, true);
                    window.addEventListener('resize', update);
                    window.visualViewport?.addEventListener('resize', update);
                    window.visualViewport?.addEventListener('scroll', update);
                    this.addEventListener('toggle', onToggle);
                    state.update = update;
                    state.dispose = () => {
                        resize.disconnect();
                        removals.disconnect();
                        window.removeEventListener('scroll', update, true);
                        window.removeEventListener('resize', update);
                        window.visualViewport?.removeEventListener('resize', update);
                        window.visualViewport?.removeEventListener('scroll', update);
                        this.removeEventListener('toggle', onToggle);
                    };
                    update();
                }).catch(error => console.warn('Unable to position Fluent tooltip', error));
            }, delay);
        };

        prototype.hideTooltip = function (...args) {
            cancel(this);
            return originalHide.apply(this, args);
        };
    });
})();
