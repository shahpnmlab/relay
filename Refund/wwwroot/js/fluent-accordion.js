// Fluent 5.0.1 toggles an accordion item for every click retargeted to its
// host, including the content gutter. Limit job parameter toggles to headers.
// This must run in native capture: Blazor's stopPropagation runs after Fluent.
document.addEventListener('click', event => {
    const item = event.target;
    if (!(item instanceof HTMLElement) ||
        !item.matches('.job-parameter-display fluent-accordion-item')) {
        return;
    }

    const heading = item.shadowRoot?.querySelector('[part~="heading"]');
    if (heading && !event.composedPath().includes(heading)) {
        // Keep the browser's normal blur/default behavior. Clicks on fields
        // and their actions have their own targets and never enter this branch.
        event.stopPropagation();
    }
}, true);
