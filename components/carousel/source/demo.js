/**
 * Wires the demo output.
 *
 * The track scrolls without a script, so this only reports what the component decided and
 * drives the buttons the Drag and States variants put outside it.
 */
export function initializeCarouselDemo() {
  const output = document.querySelector('output');

  document.querySelectorAll('[data-demo-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const carousel = document.querySelector(button.dataset.demoTarget ?? 'ui-carousel');

      if (!carousel) {
        return;
      }

      const actions = {
        next: () => carousel.next(),
        previous: () => carousel.previous(),
        first: () => carousel.goTo(0),
        last: () => carousel.goTo(carousel.slides.length - 1),
        play: () => carousel.play(),
        pause: () => carousel.pause(),
      };

      actions[button.dataset.demoAction]?.();
    });
  });

  if (!output) {
    return;
  }

  const carousels = [...document.querySelectorAll('ui-carousel')];

  const describe = (carousel) => {
    const alt = carousel.slides[carousel.index]?.querySelector('img')?.alt ?? '';
    const effect = carousel.getAttribute('effect') ?? 'slide';
    return `${effect}: ${carousel.index + 1} of ${carousel.slides.length}${alt ? ` — ${alt}` : ''}`;
  };

  const report = () => {
    output.textContent = carousels.map(describe).join('\n');
  };

  report();
  document.addEventListener('carousel-change', report);
  document.addEventListener('carousel-play', report);
  document.addEventListener('carousel-pause', report);

  // Links in a demo would leave the page; what is on show is the carousel.
  document.addEventListener('click', (event) => {
    if (event.target.closest('ui-carousel a')) {
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
