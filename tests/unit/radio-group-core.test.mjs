import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGroupName,
  buildOptionModel,
  checkedValue,
  isSelectable,
  normalizeAppearance,
  normalizeLayout,
  normalizeSize,
  resolveSelection,
} from '../../components/radio-group/source/radio-group-core.js';

test('unrecognised attribute values fall back instead of passing through', () => {
  assert.equal(normalizeLayout('row'), 'row');
  assert.equal(normalizeLayout('sideways'), 'stack');
  assert.equal(normalizeLayout(undefined), 'stack');

  assert.equal(normalizeAppearance('card'), 'card');
  assert.equal(normalizeAppearance('fancy'), 'control');

  assert.equal(normalizeSize('sm'), 'sm');
  assert.equal(normalizeSize('xl'), 'md');
});

test('the option model drops inputs that cannot be told apart', () => {
  const model = buildOptionModel([
    { value: 'free', label: 'Free' },
    // An input with no value submits "on", so several of them are indistinguishable.
    { value: '', label: 'No value' },
    { value: 'pro', label: 'Pro', disabled: true },
    { value: 'free', label: 'Duplicate' },
    null,
    'not an object',
  ]);

  assert.deepEqual(
    model.map(({ value }) => value),
    ['free', 'pro'],
  );
  assert.equal(model[1].disabled, true);
  assert.deepEqual(
    model.map(({ index }) => index),
    [0, 1],
  );
});

test('a label falls back to the value when none is given', () => {
  const [option] = buildOptionModel([{ value: 'free' }]);
  assert.equal(option.label, 'free');
});

test('an empty selection is a valid resting state', () => {
  const model = buildOptionModel([{ value: 'free' }]);

  assert.deepEqual(resolveSelection(model, ''), { value: '', valid: true, known: false });
  assert.deepEqual(resolveSelection(model, undefined), {
    value: '',
    valid: true,
    known: false,
  });
});

test('a value matching no option is kept and reported invalid', () => {
  const model = buildOptionModel([{ value: 'free' }, { value: 'pro' }]);

  assert.deepEqual(resolveSelection(model, 'pro'), { value: 'pro', valid: true, known: true });
  // Preserved rather than blanked, so the consumer's mistake stays visible.
  assert.deepEqual(resolveSelection(model, 'team'), {
    value: 'team',
    valid: false,
    known: false,
  });
});

test('a disabled option is not selectable', () => {
  const model = buildOptionModel([
    { value: 'free' },
    { value: 'pro', disabled: true },
  ]);

  assert.equal(isSelectable(model, 'free'), true);
  assert.equal(isSelectable(model, 'pro'), false);
  assert.equal(isSelectable(model, 'missing'), false);
});

test('the checked value follows option order, not the order checks are reported', () => {
  const model = buildOptionModel([
    { value: 'free' },
    { value: 'pro' },
    { value: 'team' },
  ]);

  assert.equal(checkedValue(model, ['team']), 'team');
  assert.equal(checkedValue(model, []), '');
  assert.equal(checkedValue(model, ['missing']), '');
});

test('a group without an author name still gets a unique one', () => {
  assert.equal(buildGroupName('ui-radio-group-3', 'plan'), 'plan');
  assert.equal(buildGroupName('ui-radio-group-3', '   '), 'ui-radio-group-3-name');
  assert.equal(buildGroupName('ui-radio-group-3', undefined), 'ui-radio-group-3-name');
  // Two groups must not collide, otherwise choosing in one would clear the other.
  assert.notEqual(
    buildGroupName('ui-radio-group-1', ''),
    buildGroupName('ui-radio-group-2', ''),
  );
});
