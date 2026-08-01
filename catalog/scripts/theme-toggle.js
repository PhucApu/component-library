/**
 * Catalog theme control.
 *
 * The inline bootstrap in each page head resolves and applies the theme before first
 * paint, because a theme applied from a module would repaint the page after the browser
 * has already drawn the default surface. This module owns everything after that: the
 * toggle, the stored preference, and the change notification other catalog scripts
 * subscribe to. The bootstrap and this module share the storage key and the attribute
 * name, so a change to either has to land in both places.
 */

const STORAGE_KEY = 'component-ui-theme';
const THEME_EVENT = 'catalog:themechange';

function readStoredTheme() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    // Blocked storage throws on access rather than returning null. The catalog still
    // themes itself from the operating system; it only loses the manual choice.
    return null;
  }
}

function storeTheme(theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // An unremembered preference beats a toggle that throws mid-click.
  }
}

export function getActiveTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function onThemeChange(listener) {
  document.addEventListener(THEME_EVENT, (event) => listener(event.detail.theme));
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme } }));
}

/** The label names the theme the click applies, not the theme already on screen. */
function describeAction(theme) {
  return theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
}

export function initializeThemeToggle() {
  const button = document.querySelector('[data-theme-toggle]');

  if (!button) {
    return;
  }

  function syncLabel() {
    const label = describeAction(getActiveTheme());
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  button.addEventListener('click', () => {
    const nextTheme = getActiveTheme() === 'light' ? 'dark' : 'light';
    storeTheme(nextTheme);
    applyTheme(nextTheme);
    syncLabel();
  });

  // An explicit choice outranks the operating system until the user clears it, so the
  // catalog only keeps following the system while nothing is stored.
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (event) => {
    if (readStoredTheme()) {
      return;
    }

    applyTheme(event.matches ? 'light' : 'dark');
    syncLabel();
  });

  syncLabel();
}
