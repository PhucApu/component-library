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
