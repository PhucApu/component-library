import { pad } from './temporal-picker-core.js';

export function getCurrentDemoValue(mode, now = new Date()) {
  const year = pad(now.getFullYear(), 4);
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  const second = pad(now.getSeconds());

  switch (mode) {
    case 'year':
      return year;
    case 'month':
      return `${year}-${month}`;
    case 'date':
      return `${year}-${month}-${day}`;
    case 'time':
      return `${hour}:${minute}:${second}`;
    case 'datetime':
      return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    default:
      return '';
  }
}

export function initializeTemporalDemo({ useCurrentValue = false } = {}) {
  const picker = document.querySelector('temporal-picker');
  const output = document.querySelector('output');

  if (!picker || !output) {
    return;
  }

  if (useCurrentValue) {
    picker.value = getCurrentDemoValue(picker.mode);
  }

  output.textContent = picker.value || '""';
  picker.addEventListener('temporal-change', ({ detail }) => {
    picker.value = detail.value;
    output.textContent = detail.value || '""';
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
