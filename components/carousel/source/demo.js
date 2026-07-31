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
