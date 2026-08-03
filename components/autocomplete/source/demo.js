export const DEMO_REMOTE_OPTIONS = Object.freeze([
  { value: 'hanoi', label: 'Ha Noi', group: 'Viet Nam' },
  { value: 'danang', label: 'Da Nang', group: 'Viet Nam' },
  { value: 'hcmc', label: 'Ho Chi Minh City', group: 'Viet Nam' },
  { value: 'osaka', label: 'Osaka', group: 'Japan' },
  { value: 'kyoto', label: 'Kyoto', group: 'Japan' },
  { value: 'sapporo', label: 'Sapporo', group: 'Japan', disabled: true },
]);

/**
 * Stands in for a network call. The catalog ships no backend, so the delay and the
 * failure path are simulated locally while still exercising the real loading, error,
 * and empty states.
 */
export function loadDemoOptions({ delayMs = 700, shouldFail = false } = {}) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) {
        reject(new Error('The suggestion service is unavailable.'));
        return;
      }

      resolve([...DEMO_REMOTE_OPTIONS]);
    }, delayMs);
  });
}

export function initializeAutocompleteDemo({ remote = false, failFirstLoad = false } = {}) {
  const field = document.querySelector('ui-autocomplete');
  const output = document.querySelector('output');

  if (!field || !output) {
    return;
  }

  const report = () => {
    output.textContent = field.value && field.value !== '[]' ? field.value : '""';
  };

  report();
  field.addEventListener('autocomplete-change', ({ detail }) => {
    field.value = detail.value;
    report();
  });

  if (!remote) {
    return;
  }

  let loaded = false;
  let failNext = failFirstLoad;

  const load = async () => {
    if (loaded || field.loading) {
      return;
    }

    field.removeAttribute('error');
    field.loading = true;

    try {
      field.options = await loadDemoOptions({ shouldFail: failNext });
      loaded = true;
    } catch (error) {
      field.setAttribute('error', error.message);
      // A retry on the next open is what a consumer would expect after a failure.
      failNext = false;
    } finally {
      field.loading = false;
    }
  };

  field.addEventListener('focusin', load);
  field.addEventListener('pointerdown', load);
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
