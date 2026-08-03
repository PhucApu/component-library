/**
 * Wires the demo output. Removing a chip is the consumer's decision, not the
 * component's, so the chip reports the request and this page takes it out of the DOM.
 */
export function initializeChipDemo() {
  const output = document.querySelector('output');

  if (!output) {
    return;
  }

  const report = (message) => {
    output.textContent = message;
  };

  document.addEventListener('chip-remove', (event) => {
    const chip = event.target.closest('ui-chip');
    report(`removed: ${event.detail.label}`);
    chip?.remove();
  });

  document.addEventListener('chip-toggle', (event) => {
    const selected = [...document.querySelectorAll('ui-chip[data-selected]')].map((chip) =>
      chip.textContent.replace(/\s+/g, ' ').trim(),
    );
    report(selected.length ? `selected: ${selected.join(', ')}` : 'selected: none');
  });
}

/**
 * Lets an embedding page pin the demo to one theme.
 *
 * The stylesheet resolves every colour through `light-dark()`, so a page that says
 * nothing keeps following the operating system. A host that shows this file in a frame
 * posts the theme it is displaying, and narrowing `color-scheme` to a single keyword
 * repoints every pair at once. The message names no host and carries nothing but a theme
 * keyword, so answering it adds no dependency on whoever sent it.
 */
function applyPreviewTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.style.colorScheme = theme;
  }
}

// Guarded because these demo modules are also imported by unit tests, which run in Node
// where there is no window to listen on.
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    // Only the embedder may pin the theme. An unframed page has itself as its parent, and
    // the worst a stray message can do is repaint the demo.
    if (event.source === window.parent && event.data?.type === 'ui-theme') {
      applyPreviewTheme(event.data.theme);
    }
  });
}
