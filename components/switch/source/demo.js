/**
 * Wires the demo output. The switches need no script to render or toggle, so this only
 * mirrors their state and, where a form is shown, reports what a submit would carry.
 */
export function initializeSwitchDemo({ reportForm = false } = {}) {
  const output = document.querySelector('output');

  if (!output) {
    return;
  }

  const switches = [...document.querySelectorAll('ui-switch')];

  const report = () => {
    if (reportForm) {
      const form = document.querySelector('form');
      const entries = [...new FormData(form).entries()].map(([key, value]) => `${key}=${value}`);
      output.textContent = entries.length ? entries.join('\n') : 'nothing would be submitted';
      return;
    }

    output.textContent = switches
      .map((element) => {
        const control = element.control;
        const name = control?.name || control?.id || 'switch';
        return `${name}: ${element.checked ? 'on' : 'off'}`;
      })
      .join('\n');
  };

  report();
  document.addEventListener('change', report);
  document.addEventListener('switch-pending', report);
  document.addEventListener('switch-error', report);
}

/**
 * Stands in for a server call. `failing` switches reject, which is how the demo shows a
 * switch returning to its previous state instead of lying about what was saved.
 */
export function attachDemoCommit({ delayMs = 900 } = {}) {
  const note = document.querySelector('[data-demo-note]');

  document.querySelectorAll('ui-switch[data-demo-commit]').forEach((element) => {
    const failing = element.dataset.demoCommit === 'failing';

    element.commit = () =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          if (failing) {
            reject(new Error('The network refused the change.'));
            return;
          }

          resolve();
        }, delayMs);
      });
  });

  if (!note) {
    return;
  }

  document.addEventListener('switch-error', (event) => {
    note.textContent = event.detail.reason.message;
  });

  document.addEventListener('switch-pending', (event) => {
    if (event.detail.pending) {
      note.textContent = '';
    }
  });
}
