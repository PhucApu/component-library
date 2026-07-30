import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COUNTER_ANNOUNCE_THRESHOLD,
  counterAnnouncement,
  counterState,
  describedBy,
  normalizeAppearance,
  normalizeSize,
  resolveErrorMessage,
  revealLabel,
  shouldShowError,
} from '../../components/text-field/source/text-field-core.js';

test('unrecognised attribute values fall back instead of passing through', () => {
  assert.equal(normalizeAppearance('filled'), 'filled');
  assert.equal(normalizeAppearance('standard'), 'outlined');
  assert.equal(normalizeSize('sm'), 'sm');
  assert.equal(normalizeSize('huge'), 'md');
});

test('an author message wins over the browser message', () => {
  // Only the author knows the domain rule behind a pattern.
  assert.equal(
    resolveErrorMessage({
      valid: false,
      customMessage: 'Use four to sixteen lowercase letters.',
      validationMessage: 'Please match the requested format.',
    }),
    'Use four to sixteen lowercase letters.',
  );
});

test('the browser message is the default because it is already translated', () => {
  assert.equal(
    resolveErrorMessage({ valid: false, validationMessage: 'Please fill in this field.' }),
    'Please fill in this field.',
  );
  assert.equal(
    resolveErrorMessage({ valid: false, customMessage: '   ', validationMessage: 'Required.' }),
    'Required.',
  );
});

test('a valid field reports no message at all', () => {
  assert.equal(
    resolveErrorMessage({ valid: true, customMessage: 'Ignored', validationMessage: 'Ignored' }),
    '',
  );
});

test('an error waits until the person has interacted', () => {
  // An empty required field is invalid on render, so validity alone would paint a whole
  // form red before anyone typed.
  assert.equal(shouldShowError({ touched: false, valid: false }), false);
  assert.equal(shouldShowError({ touched: true, valid: false }), true);
  assert.equal(shouldShowError({ touched: true, valid: true }), false);
  assert.equal(shouldShowError({}), false);
});

test('the counter stays silent when there is no limit', () => {
  assert.deepEqual(counterState(12, null), {
    text: '',
    remaining: null,
    nearLimit: false,
    atLimit: false,
  });
  assert.deepEqual(counterState(12, 0), {
    text: '',
    remaining: null,
    nearLimit: false,
    atLimit: false,
  });
});

test('the counter reports what is used against the limit', () => {
  assert.deepEqual(counterState(12, 160), {
    text: '12 / 160',
    remaining: 148,
    nearLimit: false,
    atLimit: false,
  });
  assert.equal(counterState(0, 160).text, '0 / 160');
  assert.equal(counterState(160, 160).atLimit, true);
});

test('the counter only becomes near the limit inside the threshold', () => {
  const limit = 100;
  assert.equal(counterState(limit - COUNTER_ANNOUNCE_THRESHOLD - 1, limit).nearLimit, false);
  assert.equal(counterState(limit - COUNTER_ANNOUNCE_THRESHOLD, limit).nearLimit, true);
});

test('nothing is announced until the limit is close', () => {
  // A counter that speaks on every keystroke buries the content being written.
  assert.equal(counterAnnouncement(counterState(10, 160)), '');
  assert.equal(counterAnnouncement(null), '');
  assert.equal(counterAnnouncement(counterState(145, 160)), '15 characters left');
  assert.equal(counterAnnouncement(counterState(160, 160)), 'Character limit reached');
});

test('announcements honour supplied labels', () => {
  assert.equal(
    counterAnnouncement(counterState(155, 160), { charactersLeft: 'Con {count} ky tu' }),
    'Con 5 ky tu',
  );
});

test('described-by drops the ids that are not present', () => {
  assert.equal(describedBy('hint', 'error'), 'hint error');
  assert.equal(describedBy('hint', ''), 'hint');
  assert.equal(describedBy('', null, undefined), '');
});

test('the reveal button is named for the action it will perform', () => {
  assert.equal(revealLabel({}, false), 'Show password');
  assert.equal(revealLabel({}, true), 'Hide password');
  assert.equal(revealLabel({ showPassword: 'Hien mat khau' }, false), 'Hien mat khau');
});
