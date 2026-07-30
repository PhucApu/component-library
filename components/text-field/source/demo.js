/**
 * Wires the demo output. The fields need no script to accept text, so this only mirrors
 * the current values and, where a form is shown, reports what a submit would carry.
 */
export function initializeTextFieldDemo({ reportForm = false } = {}) {
  const output = document.querySelector('output');

  if (!output) {
    return;
  }

  const fields = [...document.querySelectorAll('ui-text-field')];

  const report = () => {
    const entries = fields.map((field) => {
      const control = field.control;
      return `${control?.name || control?.id || 'field'}: ${JSON.stringify(field.value)}`;
    });
    output.textContent = entries.join('\n');
  };

  report();
  document.addEventListener('input', report);
  document.addEventListener('text-field-validity', report);

  if (!reportForm) {
    return;
  }

  const form = document.querySelector('form');
  const submit = document.querySelector('[data-demo-submit]');

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    // FormData is the honest answer to "what would actually be sent".
    const data = [...new FormData(form).entries()].map(([key, value]) => `${key}=${value}`);
    output.textContent = data.length ? data.join('\n') : 'nothing would be submitted';
  });

  submit?.addEventListener('click', () => {
    fields.forEach((field) => field.validate());
  });
}
