/**
 * Wires the demo controls. Everything here is the application's side of the contract:
 * the snackbar itself is summoned, never written into the page.
 */
export function initializeSnackbarDemo() {
  const bar = document.querySelector('ui-snackbar');
  const output = document.querySelector('output');

  if (!bar) {
    return;
  }

  const lines = [];
  const record = (line) => {
    lines.unshift(line);
    lines.splice(6);

    if (output) {
      output.textContent = lines.join('\n');
    }
  };

  const configure = (dataset) => ({
    message: dataset.message,
    severity: dataset.severity,
    duration: dataset.duration === undefined ? undefined : Number(dataset.duration),
    action: dataset.action
      ? { label: dataset.action, onSelect: () => record(`chose "${dataset.action}"`) }
      : null,
  });

  document.querySelectorAll('[data-demo-show]').forEach((button) => {
    button.addEventListener('click', () => {
      bar.show(configure(button.dataset));
    });
  });

  document.querySelectorAll('[data-demo-placement]').forEach((button) => {
    button.addEventListener('click', () => {
      bar.setAttribute('placement', button.dataset.demoPlacement);
      bar.clear();
      bar.show({ message: `Anchored ${button.dataset.demoPlacement}` });
    });
  });

  document.querySelector('[data-demo-burst]')?.addEventListener('click', () => {
    // Fired together on purpose: they have to arrive one at a time, in order.
    ['First in', 'Second in', 'Third in', 'Fourth in'].forEach((message, index) => {
      bar.show({ message, severity: index === 3 ? 'success' : 'info', duration: 1600 });
    });
    record(`queued 4, ${bar.pending} waiting`);
  });

  document.querySelector('[data-demo-clear]')?.addEventListener('click', () => {
    bar.clear();
  });

  document.addEventListener('snackbar-show', (event) => {
    record(`show: ${event.detail.message}`);
  });

  document.addEventListener('snackbar-dismiss', (event) => {
    record(`dismiss: ${event.detail.reason}`);
  });
}
