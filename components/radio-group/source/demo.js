/**
 * Wires the demo output. The group itself needs no script to work, so this only mirrors
 * the chosen value and, for the validation example, clears the error once a choice is
 * made.
 */
export function initializeRadioGroupDemo({ clearErrorOnChange = false } = {}) {
  const group = document.querySelector('ui-radio-group');
  const output = document.querySelector('output');

  if (!group || !output) {
    return;
  }

  const report = () => {
    output.textContent = group.value ? group.value : '""';
  };

  report();

  group.addEventListener('radio-group-change', ({ detail }) => {
    if (clearErrorOnChange) {
      group.removeAttribute('error');
    }

    report();
  });
}
