/**
 * Wires the demo output.
 *
 * The glow needs no wiring at all — it is a stylesheet and two numbers — so this only
 * reports which region is lit, and proves that a control under the light still works.
 */
export function initializeGlowDemo() {
  document.querySelectorAll('[data-demo-count]').forEach((button) => {
    let presses = 0;

    button.addEventListener('click', () => {
      presses += 1;
      button.textContent = `Pressed ${presses} time${presses === 1 ? '' : 's'}, under the light`;
    });
  });

  const output = document.querySelector('output');

  if (!output) {
    return;
  }

  const regions = [...document.querySelectorAll('ui-cursor-glow')];

  const report = () => {
    const lit = regions.filter((region) => region.active).length;
    output.textContent = `${lit} of ${regions.length} lit`;
  };

  report();
  // No event to listen for: the region says what it is doing with an attribute, and an
  // observer is what reads an attribute without the component having to announce it.
  const observer = new MutationObserver(report);
  regions.forEach((region) => {
    observer.observe(region, { attributes: true, attributeFilter: ['data-active'] });
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
function applyGlowPreviewTheme(theme) {
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
      applyGlowPreviewTheme(event.data.theme);
    }
  });
}
