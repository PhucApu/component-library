import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOptionModel,
  filterOptions,
  findUnknownValues,
  foldText,
  groupOptions,
  highlightSegments,
  matchesQuery,
  nextActiveIndex,
  normalizeMode,
  parseValue,
  serializeValue,
} from '../../components/autocomplete/source/autocomplete-core.js';

// Built from code points so this file stays unaccented like the rest of the repository.
const VIET = `Vi${String.fromCodePoint(0x1ec7)}t Nam`;
const DA_NANG = `${String.fromCodePoint(0x0110)}${String.fromCodePoint(
  0x00e0,
)} N${String.fromCodePoint(0x1eb5)}ng`;

test('folding removes combining marks and letters drawn with a stroke', () => {
  assert.equal(foldText(VIET), 'viet nam');
  assert.equal(foldText(DA_NANG), 'da nang');
  assert.equal(foldText('Osaka'), 'osaka');
  assert.equal(foldText(undefined), '');
});

test('matching ignores case and diacritics and an empty query matches everything', () => {
  assert.ok(matchesQuery(VIET, 'viet'));
  assert.ok(matchesQuery(DA_NANG, 'da n'));
  assert.ok(matchesQuery(DA_NANG, 'NANG'));
  assert.ok(matchesQuery('Anything', '   '));
  assert.equal(matchesQuery('Osaka', 'zz'), false);
});

test('segments report the original characters even though matching folds them', () => {
  const segments = highlightSegments(VIET, 'viet');

  assert.deepEqual(segments, [
    { text: `Vi${String.fromCodePoint(0x1ec7)}t`, match: true },
    { text: ' Nam', match: false },
  ]);

  // The accented characters survive, so the marked run renders what the author wrote.
  assert.equal(segments.map(({ text }) => text).join(''), VIET);
});

test('segments split a match that starts mid-label', () => {
  const segments = highlightSegments(DA_NANG, 'nang');

  assert.equal(segments.length, 2);
  assert.equal(segments[0].match, false);
  assert.equal(segments[1].match, true);
  assert.equal(segments.map(({ text }) => text).join(''), DA_NANG);
});

test('an empty query produces one unmatched segment', () => {
  assert.deepEqual(highlightSegments('Osaka', ''), [{ text: 'Osaka', match: false }]);
  assert.deepEqual(highlightSegments('', 'x'), []);
});

test('segments carry markup as text so the caller can escape it', () => {
  const segments = highlightSegments('a<script>b', 'script');

  // No segment may contain a complete tag: the caller escapes each one before
  // wrapping the match, which is what keeps a label from being parsed as markup.
  assert.deepEqual(segments, [
    { text: 'a<', match: false },
    { text: 'script', match: true },
    { text: '>b', match: false },
  ]);
});

test('the option model drops malformed entries and later duplicates', () => {
  const model = buildOptionModel([
    { value: 'vn', label: 'Viet Nam', group: 'Asia' },
    { value: 'jp', label: 'Japan', group: 'Asia', disabled: true },
    { value: 'vn', label: 'Duplicate' },
    { label: 'Label only' },
    { value: '' },
    null,
    'not an object',
  ]);

  assert.deepEqual(
    model.map(({ value }) => value),
    ['vn', 'jp', 'Label only'],
  );
  assert.equal(model[1].disabled, true);
  // An option with no value falls back to its label, matching how select behaves.
  assert.equal(model[2].label, 'Label only');
  assert.deepEqual(
    model.map(({ index }) => index),
    [0, 1, 2],
  );
});

test('grouping keeps ungrouped options first and preserves first-seen group order', () => {
  const model = buildOptionModel([
    { value: 'a', label: 'A', group: 'Second' },
    { value: 'b', label: 'B' },
    { value: 'c', label: 'C', group: 'First' },
    { value: 'd', label: 'D', group: 'Second' },
  ]);

  assert.deepEqual(
    groupOptions(model).map(({ label, options }) => [label, options.map((o) => o.value)]),
    [
      ['', ['b']],
      ['Second', ['a', 'd']],
      ['First', ['c']],
    ],
  );
});

test('filtering narrows the model without renumbering it', () => {
  const model = buildOptionModel([
    { value: 'hanoi', label: 'Ha Noi' },
    { value: 'osaka', label: 'Osaka' },
    { value: 'hcmc', label: 'Ho Chi Minh City' },
  ]);
  const filtered = filterOptions(model, 'h');

  assert.deepEqual(
    filtered.map(({ value }) => value),
    ['hanoi', 'hcmc'],
  );
  // Indexes still point into the full model, which is what aria-activedescendant needs.
  assert.deepEqual(
    filtered.map(({ index }) => index),
    [0, 2],
  );
});

test('navigation skips disabled options and wraps to the ends on Home and End', () => {
  const model = buildOptionModel([
    { value: 'a', label: 'A', disabled: true },
    { value: 'b', label: 'B' },
    { value: 'c', label: 'C', disabled: true },
    { value: 'd', label: 'D' },
  ]);

  assert.equal(nextActiveIndex(model, -1, 1), 1);
  assert.equal(nextActiveIndex(model, 1, 1), 3);
  assert.equal(nextActiveIndex(model, 3, -1), 1);
  assert.equal(nextActiveIndex(model, 3, 1), 3);
  assert.equal(nextActiveIndex(model, 0, 'first'), 1);
  assert.equal(nextActiveIndex(model, 0, 'last'), 3);
  assert.equal(nextActiveIndex([], 0, 1), null);
});

test('single mode carries a bare string and multiple mode carries a JSON array', () => {
  assert.deepEqual(parseValue('single', 'vn'), { valid: true, values: ['vn'] });
  assert.deepEqual(parseValue('single', ''), { valid: true, values: [] });
  assert.deepEqual(parseValue('multiple', '["a","b"]'), { valid: true, values: ['a', 'b'] });
  assert.deepEqual(parseValue('multiple', '  '), { valid: true, values: [] });

  assert.equal(serializeValue('single', ['a', 'b']), 'a');
  assert.equal(serializeValue('multiple', ['a', 'b']), '["a","b"]');
  assert.equal(serializeValue('multiple', []), '[]');
});

test('a JSON array survives a value containing a comma', () => {
  const round = parseValue('multiple', serializeValue('multiple', ['a,b', 'c']));

  // This is the reason the contract is JSON rather than a delimited string.
  assert.deepEqual(round.values, ['a,b', 'c']);
});

test('malformed or non-string multiple values are reported rather than guessed at', () => {
  assert.deepEqual(parseValue('multiple', '[oops'), { valid: false, values: [] });
  assert.deepEqual(parseValue('multiple', '{"a":1}'), { valid: false, values: [] });
  assert.deepEqual(parseValue('multiple', '[1,2]'), { valid: false, values: [] });
  assert.deepEqual(parseValue('multiple', '["a","a",""]'), { valid: true, values: ['a'] });
});

test('unknown values are reported unless free text accepts them', () => {
  const model = buildOptionModel([{ value: 'vn', label: 'Viet Nam' }]);

  assert.deepEqual(findUnknownValues(['vn', 'zz'], model), ['zz']);
  assert.deepEqual(findUnknownValues(['zz'], model, { freeText: true }), []);
});

test('an unrecognised mode falls back to single', () => {
  assert.equal(normalizeMode('multiple'), 'multiple');
  assert.equal(normalizeMode('nonsense'), 'single');
  assert.equal(normalizeMode(undefined), 'single');
});
