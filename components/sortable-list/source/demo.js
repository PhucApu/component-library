/**
 * Wires the demo output and the buttons the variants put beside the list.
 */
export function initializeSortableListDemo() {
  const output = document.querySelector('output');
  const list = document.querySelector('ui-sortable-list');

  document.querySelectorAll('[data-demo-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.demoTarget
        ? document.getElementById(button.dataset.demoTarget)
        : list;

      if (!target) {
        return;
      }

      const actions = {
        drag: () => {
          target.setAttribute('drag', button.dataset.demoDrag ?? 'handle');
          mark(button, 'drag');
        },
        disabled: () => {
          target.toggleAttribute('disabled');
          target.refresh();
          button.toggleAttribute('data-current', target.hasAttribute('disabled'));
        },
        error: () => {
          if (target.hasAttribute('error')) {
            target.removeAttribute('error');
          } else {
            target.setAttribute('error', 'That order could not be loaded');
          }

          button.toggleAttribute('data-current', target.hasAttribute('error'));
        },
        // Two commits that behave differently, so the rollback can be seen rather than
        // described. The failing one is the interesting half.
        commit: () => {
          const shouldFail = button.dataset.demoCommit === 'fail';

          target.commit = () =>
            new Promise((resolve, reject) => {
              setTimeout(() => (shouldFail ? reject(new Error('rejected')) : resolve()), 900);
            });

          mark(button, 'commit');
          note = shouldFail
            ? 'The next reorder will be refused and the list will go back.'
            : 'The next reorder will be accepted.';
          report();
        },
        move: () => {
          const from = Number.parseInt(button.dataset.demoFrom ?? '0', 10);
          const to = Number.parseInt(button.dataset.demoTo ?? '0', 10);
          const moved = target.move(from, to);
          note = moved ? `Moved row ${from + 1} to position ${to + 1}.` : 'That move was refused.';
          report();
        },
      };

      actions[button.dataset.demoAction]?.();
      report();
    });
  });

  function mark(pressed, group) {
    document
      .querySelectorAll(`[data-demo-action="${group}"]`)
      .forEach((other) => other.toggleAttribute('data-current', other === pressed));
  }

  let note = 'Drag a handle, or tab to one and press space.';

  function report() {
    if (!output || !list) {
      return;
    }

    output.textContent = [note, `order: ${list.order.join(' → ')}`].join('\n');
  }

  document.addEventListener('reorder', (event) => {
    note = `Moved "${event.detail.name}" from ${event.detail.from + 1} to ${event.detail.to + 1}.`;
    report();
  });

  document.addEventListener('reorder-failed', (event) => {
    note = `Refused. "${event.detail.from + 1}" went back where it was.`;
    report();
  });

  report();
}
