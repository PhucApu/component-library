function pad(value, length = 2) {
  return String(value).padStart(length, '0');
}

export function getCurrentDemoValue(mode, now = new Date()) {
  const year = pad(now.getFullYear(), 4);
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  const second = pad(now.getSeconds());

  switch (mode) {
    case 'year':
      return year;
    case 'month':
      return `${year}-${month}`;
    case 'date':
      return `${year}-${month}-${day}`;
    case 'time':
      return `${hour}:${minute}:${second}`;
    case 'datetime':
      return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    default:
      return '';
  }
}

export function initializeTemporalDemo({ useCurrentValue = false } = {}) {
  const picker = document.querySelector('temporal-picker');
  const output = document.querySelector('output');

  if (!picker || !output) {
    return;
  }

  if (useCurrentValue) {
    picker.value = getCurrentDemoValue(picker.mode);
  }

  output.textContent = picker.value || '""';
  picker.addEventListener('temporal-change', ({ detail }) => {
    picker.value = detail.value;
    output.textContent = detail.value || '""';
  });
}
