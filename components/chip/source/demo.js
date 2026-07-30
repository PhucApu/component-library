/**
 * Wires the demo output. Removing a chip is the consumer's decision, not the
 * component's, so the chip reports the request and this page takes it out of the DOM.
 */
export function initializeChipDemo() {
  const output = document.querySelector('output');

  if (!output) {
    return;
  }

  const report = (message) => {
    output.textContent = message;
  };

  document.addEventListener('chip-remove', (event) => {
    const chip = event.target.closest('ui-chip');
    report(`removed: ${event.detail.label}`);
    chip?.remove();
  });

  document.addEventListener('chip-toggle', (event) => {
    const selected = [...document.querySelectorAll('ui-chip[data-selected]')].map((chip) =>
      chip.textContent.replace(/\s+/g, ' ').trim(),
    );
    report(selected.length ? `selected: ${selected.join(', ')}` : 'selected: none');
  });
}
