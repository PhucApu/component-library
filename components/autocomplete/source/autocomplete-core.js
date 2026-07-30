export const AUTOCOMPLETE_MODES = Object.freeze(['single', 'multiple']);

// The combining range is invisible in an editor, so it is written by code point.
const COMBINING_MARKS = /[̀-ͯ]/g;

// NFD only separates combining marks. A stroke drawn through the glyph is part of the
// letter itself and survives, so these are mapped by hand. Listed by code point to keep
// this source unaccented and to make each entry reviewable.
const STROKED_LETTERS = new Map(
  [
    [0x0111, 'd'], // small d with stroke
    [0x0110, 'd'], // capital D with stroke
    [0x00f8, 'o'], // small o with stroke
    [0x00d8, 'o'], // capital O with stroke
    [0x0142, 'l'], // small l with stroke
    [0x0141, 'l'], // capital L with stroke
  ].map(([codePoint, replacement]) => [String.fromCodePoint(codePoint), replacement]),
);

export function normalizeMode(value) {
  return AUTOCOMPLETE_MODES.includes(value) ? value : 'single';
}

/**
 * Folds text to a comparable form: lower case, no diacritics.
 *
 * Latin scripts express most accents as combining marks, which NFD separates so they can
 * be dropped. A few letters carry a stroke through the glyph instead and survive that
 * pass, so they are mapped by hand. Without this an unaccented query would fail to find
 * an accented label.
 */
export function foldText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  let folded = '';
  for (const character of value) {
    folded += STROKED_LETTERS.get(character) ?? character;
  }

  return folded.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

export function matchesQuery(label, query) {
  const foldedQuery = foldText(query).trim();
  return foldedQuery.length === 0 || foldText(label).includes(foldedQuery);
}

/**
 * Splits a label into alternating plain and matched segments.
 *
 * The split runs over folded text but reports offsets into the original, so the caller
 * renders the author's own characters rather than the folded ones. Callers must escape
 * every segment before building markup; the match is data, not markup.
 */
export function highlightSegments(label, query) {
  const source = typeof label === 'string' ? label : '';
  const foldedQuery = foldText(query).trim();

  if (foldedQuery.length === 0) {
    return source.length ? [{ text: source, match: false }] : [];
  }

  // Folding is per character here, so folded and original offsets stay aligned even
  // when a character folds to a different letter.
  const foldedCharacters = [...source].map((character) => foldText(character));
  const characters = [...source];
  const segments = [];
  let cursor = 0;

  while (cursor < characters.length) {
    let matchLength = 0;
    let consumed = 0;

    for (let offset = cursor; offset < characters.length; offset += 1) {
      matchLength += foldedCharacters[offset].length;
      consumed += 1;

      if (matchLength >= foldedQuery.length) {
        break;
      }
    }

    const candidate = foldedCharacters.slice(cursor, cursor + consumed).join('');

    if (candidate === foldedQuery) {
      segments.push({
        text: characters.slice(cursor, cursor + consumed).join(''),
        match: true,
      });
      cursor += consumed;
      continue;
    }

    const previous = segments[segments.length - 1];
    if (previous && !previous.match) {
      previous.text += characters[cursor];
    } else {
      segments.push({ text: characters[cursor], match: false });
    }
    cursor += 1;
  }

  return segments;
}

export function normalizeOption(option, index) {
  if (!option || typeof option !== 'object') {
    return null;
  }

  const rawValue = option.value ?? option.label;
  if (rawValue === undefined || rawValue === null || String(rawValue).length === 0) {
    return null;
  }

  const value = String(rawValue);
  const label = String(option.label ?? value);
  const group = option.group === undefined || option.group === null ? '' : String(option.group);

  return {
    value,
    label,
    group,
    disabled: Boolean(option.disabled),
    index,
  };
}

/**
 * Builds the option model, dropping malformed entries and later duplicates of a value.
 */
export function buildOptionModel(options) {
  const model = [];
  const seen = new Set();

  (Array.isArray(options) ? options : []).forEach((option, index) => {
    const normalized = normalizeOption(option, model.length);

    if (!normalized || seen.has(normalized.value)) {
      return;
    }

    seen.add(normalized.value);
    model.push({ ...normalized, index: model.length, sourceIndex: index });
  });

  return model;
}

export function filterOptions(options, query) {
  return options.filter((option) => matchesQuery(option.label, query));
}

/**
 * Orders options so every group is contiguous, keeping first-seen group order and the
 * author's order inside each group. Ungrouped options stay ahead of every group.
 */
export function groupOptions(options) {
  const groups = new Map();

  for (const option of options) {
    if (!groups.has(option.group)) {
      groups.set(option.group, []);
    }
    groups.get(option.group).push(option);
  }

  const ungrouped = groups.get('') ?? [];
  groups.delete('');

  const sections = ungrouped.length ? [{ label: '', options: ungrouped }] : [];
  for (const [label, groupOptionList] of groups) {
    sections.push({ label, options: groupOptionList });
  }

  return sections;
}

export function parseValue(mode, rawValue) {
  const value = typeof rawValue === 'string' ? rawValue : '';

  if (normalizeMode(mode) === 'single') {
    return { valid: true, values: value.length ? [value] : [] };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { valid: true, values: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { valid: false, values: [] };
  }

  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) {
    return { valid: false, values: [] };
  }

  const unique = [];
  for (const entry of parsed) {
    if (entry.length && !unique.includes(entry)) {
      unique.push(entry);
    }
  }

  return { valid: true, values: unique };
}

export function serializeValue(mode, values) {
  const list = Array.isArray(values) ? values.filter((entry) => typeof entry === 'string') : [];

  if (normalizeMode(mode) === 'single') {
    return list[0] ?? '';
  }

  return JSON.stringify(list);
}

/**
 * Reports which selected values no options can explain. Free text turns any leftover
 * into an accepted value; otherwise the caller keeps them and marks the field invalid
 * rather than silently discarding what the consumer set.
 */
export function findUnknownValues(values, options, { freeText = false } = {}) {
  if (freeText) {
    return [];
  }

  const known = new Set(options.map((option) => option.value));
  return values.filter((value) => !known.has(value));
}

export function nextActiveIndex(options, currentIndex, direction) {
  const selectable = options.filter((option) => !option.disabled);

  if (!selectable.length) {
    return null;
  }

  if (direction === 'first') {
    return selectable[0].index;
  }

  if (direction === 'last') {
    return selectable[selectable.length - 1].index;
  }

  const position = selectable.findIndex((option) => option.index === currentIndex);

  if (position < 0) {
    return direction > 0 ? selectable[0].index : selectable[selectable.length - 1].index;
  }

  const target = Math.min(selectable.length - 1, Math.max(0, position + direction));
  return selectable[target].index;
}
