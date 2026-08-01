/**
 * Wires the demo output. The trail needs no script to navigate, so this only reports what
 * the component itself decided: how much is put away, and when it was opened.
 */
export function initializeBreadcrumbsDemo() {
  const output = document.querySelector('output');

  if (!output) {
    return;
  }

  const trails = [...document.querySelectorAll('ui-breadcrumbs')];

  const report = () => {
    output.textContent = trails
      .map((trail, index) => {
        const hidden = trail.querySelectorAll('ol > li[hidden]').length;
        const state = trail.hasAttribute('data-collapsed')
          ? `${hidden} level${hidden === 1 ? '' : 's'} hidden`
          : 'all levels shown';
        return `trail ${index + 1}: ${state}`;
      })
      .join('\n');
  };

  report();
  document.addEventListener('breadcrumbs-expand', report);

  // Links in a demo would leave the page; the trail itself is what is on show.
  document.addEventListener('click', (event) => {
    const link = event.target.closest('ui-breadcrumbs a');

    if (link) {
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

window.addEventListener('message', (event) => {
  // Only the embedder may pin the theme. An unframed page has itself as its parent, and
  // the worst a stray message can do is repaint the demo.
  if (event.source === window.parent && event.data?.type === 'ui-theme') {
    applyPreviewTheme(event.data.theme);
  }
});
