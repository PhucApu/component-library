/**
 * Wires the demo controls. Opening and closing is the component's job; this only reports
 * what happened and which way out was taken.
 */
export function initializeDrawerDemo() {
  const output = document.querySelector('output');
  const lines = [];

  const record = (line) => {
    lines.unshift(line);
    lines.splice(5);

    if (output) {
      output.textContent = lines.join('\n');
    }
  };

  // A drawer with a `trigger` already listens to that button. Wiring it a second time
  // here would toggle twice on one press, and the panel would look dead.
  const alreadyWired = new Set(
    [...document.querySelectorAll('ui-drawer[trigger]')].map((drawer) =>
      drawer.getAttribute('trigger'),
    ),
  );

  document.querySelectorAll('[data-drawer-open]').forEach((button) => {
    if (alreadyWired.has(button.id)) {
      return;
    }

    button.addEventListener('click', () => {
      document.getElementById(button.dataset.drawerOpen)?.show();
    });
  });

  document.querySelectorAll('[data-drawer-toggle]').forEach((button) => {
    if (alreadyWired.has(button.id)) {
      return;
    }

    button.addEventListener('click', () => {
      document.getElementById(button.dataset.drawerToggle)?.toggle();
    });
  });

  // Links inside a demo drawer would leave the page.
  document.addEventListener('click', (event) => {
    if (event.target.closest('.drawer__nav a')) {
      event.preventDefault();
    }
  });

  document.addEventListener('drawer-open', (event) => {
    record(`open: ${event.target.id || 'drawer'} (${event.target.dataset.mode})`);
  });

  document.addEventListener('drawer-close', (event) => {
    record(`close: ${event.target.id || 'drawer'} via ${event.detail.reason}`);
  });

  record('waiting');
}
