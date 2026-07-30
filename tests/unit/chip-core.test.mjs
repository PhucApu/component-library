import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRemoveLabel,
  disableStrategyFor,
  isInteractiveTag,
  isRemovalKey,
  normalizeAppearance,
  normalizeIntent,
  normalizeSelected,
  normalizeSize,
  readLabelText,
} from '../../components/chip/source/chip-core.js';

test('unrecognised attribute values fall back instead of passing through', () => {
  assert.equal(normalizeAppearance('outlined'), 'outlined');
  assert.equal(normalizeAppearance('ghost'), 'filled');

  assert.equal(normalizeIntent('danger'), 'danger');
  assert.equal(normalizeIntent('secondary'), 'neutral');
  assert.equal(normalizeIntent(undefined), 'neutral');

  assert.equal(normalizeSize('sm'), 'sm');
  assert.equal(normalizeSize('xl'), 'md');
});

test('only form controls can be disabled natively', () => {
  assert.equal(disableStrategyFor('button'), 'native');
  assert.equal(disableStrategyFor('BUTTON'), 'native');
  assert.equal(disableStrategyFor('input'), 'native');

  // An anchor ignores the disabled attribute, so it has to be emulated or a link chip
  // that merely looked disabled would still navigate.
  assert.equal(disableStrategyFor('a'), 'emulated');

  assert.equal(disableStrategyFor('span'), 'none');
  assert.equal(disableStrategyFor(undefined), 'none');
});

test('interactive tags are recognised regardless of case', () => {
  assert.equal(isInteractiveTag('A'), true);
  assert.equal(isInteractiveTag('button'), true);
  assert.equal(isInteractiveTag('span'), false);
  assert.equal(isInteractiveTag(null), false);
});

test('the remove button is named after its own chip', () => {
  // A row of chips must not become a row of identical "Remove" buttons.
  assert.equal(buildRemoveLabel('Remove {label}', 'Ha Linh'), 'Remove Ha Linh');
  assert.equal(buildRemoveLabel('Bo {label}', 'Design'), 'Bo Design');
});

test('a nameless chip still yields a usable button name', () => {
  assert.equal(buildRemoveLabel('Remove {label}', '   '), 'Remove');
  assert.equal(buildRemoveLabel('Remove {label}', undefined), 'Remove');
});

test('a template missing the placeholder falls back rather than dropping the label', () => {
  assert.equal(buildRemoveLabel('Delete', 'Design'), 'Remove Design');
  assert.equal(buildRemoveLabel(undefined, 'Design'), 'Remove Design');
});

test('label text collapses whitespace so a wrapped label reads as one phrase', () => {
  assert.equal(readLabelText('  Ha   Linh \n team '), 'Ha Linh team');
  assert.equal(readLabelText(''), '');
  assert.equal(readLabelText(null), '');
});

test('the selected attribute reads as a boolean the way HTML does', () => {
  // An attribute present with an empty value is true, which is how <ui-chip selected> parses.
  assert.equal(normalizeSelected(''), true);
  assert.equal(normalizeSelected('true'), true);
  assert.equal(normalizeSelected(null), false);
  assert.equal(normalizeSelected('false'), false);
  assert.equal(normalizeSelected(true), true);
});

test('only Backspace and Delete request removal', () => {
  assert.equal(isRemovalKey('Backspace'), true);
  assert.equal(isRemovalKey('Delete'), true);
  assert.equal(isRemovalKey('Enter'), false);
  assert.equal(isRemovalKey('x'), false);
});
