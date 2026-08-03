/**
 * Wires the demo output. The group itself needs no script to work, so this only mirrors
 * the chosen value and, for the validation example, clears the error once a choice is
 * made.
 */
export function initializeRadioGroupDemo({ clearErrorOnChange = false } = {}) {
  const group = document.querySelector('ui-radio-group');
  const output = document.querySelector('output');

  if (!group || !output) {
    return;
  }

  const report = () => {
    output.textContent = group.value ? group.value : '""';
  };

  report();

  group.addEventListener('radio-group-change', ({ detail }) => {
    if (clearErrorOnChange) {
      group.removeAttribute('error');
    }

    report();
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
