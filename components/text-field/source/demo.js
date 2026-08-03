/**
 * Wires the demo output. The fields need no script to accept text, so this only mirrors
 * the current values and, where a form is shown, reports what a submit would carry.
 */
export function initializeTextFieldDemo({ reportForm = false } = {}) {
  const output = document.querySelector('output');

  if (!output) {
    return;
  }

  const fields = [...document.querySelectorAll('ui-text-field')];

  const report = () => {
    const entries = fields.map((field) => {
      const control = field.control;
      return `${control?.name || control?.id || 'field'}: ${JSON.stringify(field.value)}`;
    });
    output.textContent = entries.join('\n');
  };

  report();
  document.addEventListener('input', report);
  document.addEventListener('text-field-validity', report);

  if (!reportForm) {
    return;
  }

  const form = document.querySelector('form');
  const submit = document.querySelector('[data-demo-submit]');

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    // FormData is the honest answer to "what would actually be sent".
    const data = [...new FormData(form).entries()].map(([key, value]) => `${key}=${value}`);
    output.textContent = data.length ? data.join('\n') : 'nothing would be submitted';
  });

  submit?.addEventListener('click', () => {
    fields.forEach((field) => field.validate());
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
