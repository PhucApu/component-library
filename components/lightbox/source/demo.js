/**
 * Reports what the viewer decided. Opening, moving, and zooming are the component's job;
 * this only writes down what happened.
 */
export function initializeLightboxDemo() {
  const output = document.querySelector('output');

  if (!output) {
    return;
  }

  const lines = [];
  const record = (line) => {
    lines.unshift(line);
    lines.splice(5);
    output.textContent = lines.join('\n');
  };

  record('waiting');

  document.addEventListener('lightbox-open', (event) => {
    record(`opened at image ${event.detail.index + 1}`);
  });

  document.addEventListener('lightbox-change', (event) => {
    record(`image ${event.detail.index + 1} of ${event.detail.total}`);
  });

  document.addEventListener('lightbox-close', (event) => {
    record(`closed via ${event.detail.reason}`);
  });
}
