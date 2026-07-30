export const LAYOUTS = Object.freeze(['stack', 'row']);
export const APPEARANCES = Object.freeze(['control', 'card']);
export const SIZES = Object.freeze(['md', 'sm']);

function normalizeFrom(allowed, value, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function normalizeLayout(value) {
  return normalizeFrom(LAYOUTS, value, 'stack');
}

export function normalizeAppearance(value) {
  return normalizeFrom(APPEARANCES, value, 'control');
}

export function normalizeSize(value) {
  return normalizeFrom(SIZES, value, 'md');
}

/**
 * Builds the option model from plain descriptors read off the radio inputs.
 *
 * An input with no value attribute submits the string "on", which would make several
 * options indistinguishable, so those are dropped rather than silently collapsed.
 * Later duplicates of a value are dropped for the same reason.
 */
export function buildOptionModel(options) {
  const model = [];
  const seen = new Set();

  (Array.isArray(options) ? options : []).forEach((option) => {
    if (!option || typeof option !== 'object') {
      return;
    }

    const value = typeof option.value === 'string' ? option.value : '';

    if (value.length === 0 || seen.has(value)) {
      return;
    }

    seen.add(value);
    model.push({
      value,
      label: typeof option.label === 'string' ? option.label : value,
      disabled: Boolean(option.disabled),
      index: model.length,
    });
  });

  return model;
}

/**
 * Resolves the value a group should present.
 *
 * An empty value is a legitimate state: a group with nothing chosen yet. A value that
 * matches no option is reported invalid but returned unchanged, so a consumer's mistake
 * stays visible instead of being quietly rewritten to blank.
 */
export function resolveSelection(options, value) {
  const requested = typeof value === 'string' ? value : '';

  if (requested.length === 0) {
    return { value: '', valid: true, known: false };
  }

  const match = options.find((option) => option.value === requested);

  return { value: requested, valid: Boolean(match), known: Boolean(match) };
}

export function isSelectable(options, value) {
  const match = options.find((option) => option.value === value);
  return Boolean(match) && !match.disabled;
}

export function checkedValue(options, checkedValues) {
  const checked = new Set(Array.isArray(checkedValues) ? checkedValues : []);
  return options.find((option) => checked.has(option.value))?.value ?? '';
}

/**
 * A stable name for grouping. Radio inputs only behave as one group when they share a
 * name, so a group without an author-supplied name still needs a unique one.
 */
export function buildGroupName(instanceId, provided) {
  const trimmed = typeof provided === 'string' ? provided.trim() : '';
  return trimmed.length ? trimmed : `${instanceId}-name`;
}
