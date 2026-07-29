export const TEMPORAL_MODES = Object.freeze([
  'year',
  'month',
  'date',
  'time',
  'datetime',
]);

const MODE_PATTERNS = Object.freeze({
  year: /^(\d{4})$/,
  month: /^(\d{4})-(\d{2})$/,
  date: /^(\d{4})-(\d{2})-(\d{2})$/,
  time: /^(\d{2}):(\d{2}):(\d{2})$/,
  datetime: /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/,
});

const COMPARISON_KEYS = Object.freeze({
  year: ['year'],
  month: ['year', 'month'],
  date: ['year', 'month', 'day'],
  time: ['hour', 'minute', 'second'],
  datetime: ['year', 'month', 'day', 'hour', 'minute', 'second'],
});

export function normalizeMode(mode) {
  return TEMPORAL_MODES.includes(mode) ? mode : 'date';
}

export function isLeapYear(year) {
  return Number.isInteger(year) && year >= 1 && year <= 9999
    ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    : false;
}

export function daysInMonth(year, month) {
  if (
    !Number.isInteger(year) ||
    year < 1 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return 0;
  }

  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isValidDateParts({ year, month, day } = {}) {
  return (
    Number.isInteger(year) &&
    year >= 1 &&
    year <= 9999 &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    Number.isInteger(day) &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

export function isValidTimeParts({ hour, minute, second } = {}) {
  return (
    Number.isInteger(hour) &&
    hour >= 0 &&
    hour <= 23 &&
    Number.isInteger(minute) &&
    minute >= 0 &&
    minute <= 59 &&
    Number.isInteger(second) &&
    second >= 0 &&
    second <= 59
  );
}

export function isValidTemporalParts(mode, parts) {
  switch (normalizeMode(mode)) {
    case 'year':
      return Number.isInteger(parts?.year) && parts.year >= 1 && parts.year <= 9999;
    case 'month':
      return (
        Number.isInteger(parts?.year) &&
        parts.year >= 1 &&
        parts.year <= 9999 &&
        Number.isInteger(parts?.month) &&
        parts.month >= 1 &&
        parts.month <= 12
      );
    case 'date':
      return isValidDateParts(parts);
    case 'time':
      return isValidTimeParts(parts);
    case 'datetime':
      return isValidDateParts(parts) && isValidTimeParts(parts);
    default:
      return false;
  }
}

export function parseTemporalValue(mode, value) {
  const normalizedMode = normalizeMode(mode);

  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  const match = MODE_PATTERNS[normalizedMode].exec(value);
  if (!match) {
    return null;
  }

  const numbers = match.slice(1).map(Number);
  let parts;

  switch (normalizedMode) {
    case 'year':
      parts = { year: numbers[0] };
      break;
    case 'month':
      parts = { year: numbers[0], month: numbers[1] };
      break;
    case 'date':
      parts = { year: numbers[0], month: numbers[1], day: numbers[2] };
      break;
    case 'time':
      parts = { hour: numbers[0], minute: numbers[1], second: numbers[2] };
      break;
    case 'datetime':
      parts = {
        year: numbers[0],
        month: numbers[1],
        day: numbers[2],
        hour: numbers[3],
        minute: numbers[4],
        second: numbers[5],
      };
      break;
    default:
      return null;
  }

  return isValidTemporalParts(normalizedMode, parts) ? parts : null;
}

export function pad(value, width = 2) {
  return String(value).padStart(width, '0');
}

export function serializeTemporalValue(mode, parts) {
  const normalizedMode = normalizeMode(mode);

  if (!isValidTemporalParts(normalizedMode, parts)) {
    return null;
  }

  switch (normalizedMode) {
    case 'year':
      return pad(parts.year, 4);
    case 'month':
      return `${pad(parts.year, 4)}-${pad(parts.month)}`;
    case 'date':
      return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
    case 'time':
      return `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
    case 'datetime':
      return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}T${pad(
        parts.hour,
      )}:${pad(parts.minute)}:${pad(parts.second)}`;
    default:
      return null;
  }
}

export function compareTemporalParts(mode, left, right) {
  const normalizedMode = normalizeMode(mode);
  const keys = COMPARISON_KEYS[normalizedMode];

  for (const key of keys) {
    if (left[key] < right[key]) {
      return -1;
    }
    if (left[key] > right[key]) {
      return 1;
    }
  }

  return 0;
}

export function isWithinRange(mode, parts, minParts = null, maxParts = null) {
  if (!isValidTemporalParts(mode, parts)) {
    return false;
  }

  if (minParts && compareTemporalParts(mode, parts, minParts) < 0) {
    return false;
  }

  return !(maxParts && compareTemporalParts(mode, parts, maxParts) > 0);
}

export function validateTemporalContract(
  mode,
  { value = '', min = '', max = '' } = {},
) {
  const normalizedMode = normalizeMode(mode);
  const minParts = min ? parseTemporalValue(normalizedMode, min) : null;
  const maxParts = max ? parseTemporalValue(normalizedMode, max) : null;
  const valueParts = value ? parseTemporalValue(normalizedMode, value) : null;
  const errors = [];

  if (min && !minParts) {
    errors.push('invalid-min');
  }
  if (max && !maxParts) {
    errors.push('invalid-max');
  }
  if (
    minParts &&
    maxParts &&
    compareTemporalParts(normalizedMode, minParts, maxParts) > 0
  ) {
    errors.push('inverted-range');
  }

  const configValid = errors.length === 0;
  let valueValid = value.length === 0;

  if (value && valueParts) {
    valueValid =
      configValid && isWithinRange(normalizedMode, valueParts, minParts, maxParts);
  }

  if (value && !valueParts) {
    errors.push('invalid-value');
  } else if (value && !valueValid && configValid) {
    errors.push('value-out-of-range');
  }

  return {
    configValid,
    errors,
    maxParts,
    minParts,
    valueParts,
    valueValid,
  };
}

export function dayOfWeek(year, month, day) {
  if (!isValidDateParts({ year, month, day })) {
    return null;
  }

  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const adjustedYear = month < 3 ? year - 1 : year;

  return (
    adjustedYear +
    Math.floor(adjustedYear / 4) -
    Math.floor(adjustedYear / 100) +
    Math.floor(adjustedYear / 400) +
    offsets[month - 1] +
    day
  ) % 7;
}

export function addDays(parts, amount) {
  if (!isValidDateParts(parts) || !Number.isInteger(amount)) {
    return null;
  }

  let year = parts.year;
  let month = parts.month;
  let day = parts.day;
  let remaining = amount;

  while (remaining !== 0) {
    if (remaining > 0) {
      const daysRemainingInMonth = daysInMonth(year, month) - day;
      if (remaining <= daysRemainingInMonth) {
        day += remaining;
        remaining = 0;
      } else if (year === 9999 && month === 12) {
        return { year: 9999, month: 12, day: 31 };
      } else {
        remaining -= daysRemainingInMonth + 1;
        day = 1;
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
      }
    } else if (day + remaining >= 1) {
      day += remaining;
      remaining = 0;
    } else if (year === 1 && month === 1) {
      return { year: 1, month: 1, day: 1 };
    } else {
      remaining += day;
      month -= 1;
      if (month < 1) {
        month = 12;
        year -= 1;
      }
      day = daysInMonth(year, month);
    }
  }

  return { year, month, day };
}

export function addMonths(parts, amount) {
  if (!isValidDateParts(parts) || !Number.isInteger(amount)) {
    return null;
  }

  const currentMonthIndex = (parts.year - 1) * 12 + (parts.month - 1);
  const targetMonthIndex = Math.min(9999 * 12 - 1, Math.max(0, currentMonthIndex + amount));
  const year = Math.floor(targetMonthIndex / 12) + 1;
  const month = (targetMonthIndex % 12) + 1;

  return {
    year,
    month,
    day: Math.min(parts.day, daysInMonth(year, month)),
  };
}

export function addYears(parts, amount) {
  if (!isValidDateParts(parts) || !Number.isInteger(amount)) {
    return null;
  }

  const year = Math.min(9999, Math.max(1, parts.year + amount));
  return {
    year,
    month: parts.month,
    day: Math.min(parts.day, daysInMonth(year, parts.month)),
  };
}

export function buildCalendarGrid(year, month, weekStartsOn = 0) {
  if (!daysInMonth(year, month)) {
    return [];
  }

  const normalizedWeekStart =
    Number.isInteger(weekStartsOn) && weekStartsOn >= 0 && weekStartsOn <= 6
      ? weekStartsOn
      : 0;
  const firstDay = { year, month, day: 1 };
  const offset = (dayOfWeek(year, month, 1) - normalizedWeekStart + 7) % 7;
  const gridStart = addDays(firstDay, -offset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    return {
      ...date,
      inCurrentMonth: date.year === year && date.month === month,
    };
  });
}

export function normalizeMinuteStep(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1;
  }

  return Math.min(60, Math.max(1, Math.trunc(numeric)));
}

export function buildMinuteOptions(step = 1, controlledMinute = null) {
  const normalizedStep = normalizeMinuteStep(step);
  const minutes = [];

  for (let minute = 0; minute < 60; minute += normalizedStep) {
    minutes.push(minute);
  }

  if (
    Number.isInteger(controlledMinute) &&
    controlledMinute >= 0 &&
    controlledMinute <= 59 &&
    !minutes.includes(controlledMinute)
  ) {
    minutes.push(controlledMinute);
    minutes.sort((left, right) => left - right);
  }

  return minutes;
}
