/**
 * Wires the demo output.
 *
 * The book turns itself, so this only drives the buttons the variants put beside it and
 * reports where each book has been left open.
 */
export function initializeFlipDemo() {
  const output = document.querySelector('output');

  document.querySelectorAll('[data-demo-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const book = document.querySelector(button.dataset.demoTarget ?? 'ui-flip-book');

      if (!book) {
        return;
      }

      const actions = {
        next: () => book.next(),
        previous: () => book.previous(),
        first: () => book.goTo(1),
        last: () => book.goTo(book.pages),
        middle: () => book.goTo(Math.ceil(book.pages / 2)),
      };

      actions[button.dataset.demoAction]?.();
    });
  });

  if (!output) {
    return;
  }

  const books = [...document.querySelectorAll('ui-flip-book')];

  const report = () => {
    output.textContent = books
      .map((book, index) => `book ${index + 1}: page ${book.page} of ${book.pages}`)
      .join('\n');
  };

  report();
  document.addEventListener('flip-change', report);

  // Links in a demo would leave the page; what is on show is the book.
  document.addEventListener('click', (event) => {
    if (event.target.closest('ui-flip-book a')) {
      event.preventDefault();
    }
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
function applyFlipPreviewTheme(theme) {
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
      applyFlipPreviewTheme(event.data.theme);
    }
  });
}
