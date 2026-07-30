export const APPEARANCES = Object.freeze(['filled', 'outlined']);
export const INTENTS = Object.freeze(['neutral', 'accent', 'success', 'warning', 'danger']);
export const SIZES = Object.freeze(['md', 'sm']);

/** Elements that carry a working `disabled` attribute of their own. */
const NATIVELY_DISABLABLE = Object.freeze(['button', 'input', 'select', 'textarea', 'fieldset']);

function normalizeFrom(allowed, value, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function normalizeAppearance(value) {
  return normalizeFrom(APPEARANCES, value, 'filled');
}

export function normalizeIntent(value) {
  return normalizeFrom(INTENTS, value, 'neutral');
}

export function normalizeSize(value) {
  return normalizeFrom(SIZES, value, 'md');
}

/**
 * Decides how a given element can be disabled.
 *
 * Only form controls honour the `disabled` attribute. An anchor ignores it completely,
 * so a link chip that looks disabled would still navigate. Those need the attribute
 * removed and activation blocked instead, which is what "emulated" means here.
 */
export function disableStrategyFor(tagName) {
  const tag = typeof tagName === 'string' ? tagName.toLowerCase() : '';

  if (NATIVELY_DISABLABLE.includes(tag)) {
    return 'native';
  }

  return tag === 'a' ? 'emulated' : 'none';
}

export function isInteractiveTag(tagName) {
  const tag = typeof tagName === 'string' ? tagName.toLowerCase() : '';
  return tag === 'button' || tag === 'a' || NATIVELY_DISABLABLE.includes(tag);
}

/**
 * Builds the remove button's accessible name.
 *
 * A bare "Remove" repeated down a list tells a screen reader user nothing about which
 * chip they are on, so the label is always folded into the name.
 */
export function buildRemoveLabel(template, label) {
  const text = typeof label === 'string' ? label.trim() : '';
  const pattern = typeof template === 'string' && template.includes('{label}')
    ? template
    : 'Remove {label}';

  return text.length ? pattern.replace('{label}', text) : 'Remove';
}

/**
 * Collapses whitespace so a label spanning several source lines still reads as one
 * phrase inside the remove button's name.
 */
export function readLabelText(rawText) {
  return typeof rawText === 'string' ? rawText.replace(/\s+/g, ' ').trim() : '';
}

export function normalizeSelected(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  return value === '' || value === 'true';
}

export function isRemovalKey(key) {
  return key === 'Backspace' || key === 'Delete';
}
