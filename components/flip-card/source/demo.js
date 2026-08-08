/**
 * Wires the demo output.
 *
 * The cards turn themselves, so this only drives the buttons the variants put beside them
 * and reports which way round each card is.
 */
export function initializeFlipCardDemo() {
  const output = document.querySelector('output');

  document.querySelectorAll('[data-demo-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const cards = [...document.querySelectorAll(button.dataset.demoTarget ?? 'ui-flip-card')];

      cards.forEach((card) => {
        const actions = {
          flip: () => card.flip(),
          front: () => card.show('front'),
          back: () => card.show('back'),
        };

        actions[button.dataset.demoAction]?.();
      });
    });
  });

  // A control on the back of a card is a real control: it works, and it does not turn the
  // card while it does.
  document.querySelectorAll('[data-demo-count]').forEach((button) => {
    let presses = 0;

    button.addEventListener('click', () => {
      presses += 1;
      button.textContent = `Pressed ${presses} time${presses === 1 ? '' : 's'}`;
    });
  });

  if (!output) {
    return;
  }

  const cards = [...document.querySelectorAll('ui-flip-card')];

  const report = () => {
    output.textContent = cards
      .map((card, index) => `card ${index + 1}: ${card.flipped ? 'back' : 'front'}`)
      .join('\n');
  };

  report();
  document.addEventListener('flip-card-change', report);

  // Links in a demo would leave the page; what is on show is the card.
  document.addEventListener('click', (event) => {
    if (event.target.closest('ui-flip-card a')) {
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
function applyFlipCardPreviewTheme(theme) {
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
      applyFlipCardPreviewTheme(event.data.theme);
    }
  });
}
