/**
 * Wires the demo output.
 *
 * A card is links and buttons, so there is nothing here to drive it: this only reports what
 * a press would have done and keeps the demo on the page.
 */
export function initializeCardDemo() {
  const output = document.querySelector('output');

  document.addEventListener('click', (event) => {
    const link = event.target.closest('ui-card a');

    // Links in a demo would leave the page; what is on show is the card.
    if (link) {
      event.preventDefault();
    }

    if (!output) {
      return;
    }

    const action = event.target.closest('ui-card button');
    const card = event.target.closest('ui-card');

    if (!card || (!link && !action)) {
      return;
    }

    const title = card.querySelector('.card__title')?.textContent.trim() ?? 'a card';
    const what = action ? `${action.textContent.trim()} pressed` : 'followed the whole-card link';

    output.textContent = `${title}: ${what}`;
  });

  if (output) {
    output.textContent = 'Press a card, or tab to one and press Enter.';
  }
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

window.addEventListener('message', (event) => {
  // Only the embedder may pin the theme. An unframed page has itself as its parent, and
  // the worst a stray message can do is repaint the demo.
  if (event.source === window.parent && event.data?.type === 'ui-theme') {
    applyPreviewTheme(event.data.theme);
  }
});
