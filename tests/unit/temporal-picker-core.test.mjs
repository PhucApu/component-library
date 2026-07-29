import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import AdmZip from 'adm-zip';
import { generateComponentIndex } from '../../scripts/generate-component-index.mjs';
import { packageComponent } from '../../scripts/package-component.mjs';
import { getCurrentDemoValue } from '../../components/temporal-picker/source/demo.js';
import {
  addDays,
  addMonths,
  buildCalendarGrid,
  buildMinuteOptions,
  dayOfWeek,
  daysInMonth,
  isLeapYear,
  normalizeMinuteStep,
  parseTemporalValue,
  serializeTemporalValue,
  validateTemporalContract,
} from '../../components/temporal-picker/source/temporal-picker-core.js';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..');
const COMPONENTS_DIRECTORY = path.join(PROJECT_ROOT, 'components');

test('current demo values use local civil formats without timezone output', () => {
  const now = new Date(0);
  now.setFullYear(2027, 8, 18);
  now.setHours(8, 45, 30, 0);

  assert.equal(getCurrentDemoValue('year', now), '2027');
  assert.equal(getCurrentDemoValue('month', now), '2027-09');
  assert.equal(getCurrentDemoValue('date', now), '2027-09-18');
  assert.equal(getCurrentDemoValue('time', now), '08:45:30');
  assert.equal(getCurrentDemoValue('datetime', now), '2027-09-18T08:45:30');
  assert.equal(getCurrentDemoValue('unknown', now), '');
});

async function createTemporaryDirectory(t, prefix) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test('parse and serialize preserve all five strict civil value contracts', () => {
  const cases = [
    ['year', '0001', { year: 1 }],
    ['year', '0099', { year: 99 }],
    ['year', '9999', { year: 9999 }],
    ['month', '2027-09', { year: 2027, month: 9 }],
    ['date', '2028-02-29', { year: 2028, month: 2, day: 29 }],
    ['time', '00:00:00', { hour: 0, minute: 0, second: 0 }],
    ['time', '23:59:59', { hour: 23, minute: 59, second: 59 }],
    ['time', '08:45:30', { hour: 8, minute: 45, second: 30 }],
    [
      'datetime',
      '2027-09-18T08:45:30',
      { year: 2027, month: 9, day: 18, hour: 8, minute: 45, second: 30 },
    ],
  ];

  for (const [mode, value, parts] of cases) {
    assert.deepEqual(parseTemporalValue(mode, value), parts);
    assert.equal(serializeTemporalValue(mode, parts), value);
  }
});

test('invalid civil values are rejected without Date normalization', () => {
  const invalidValues = [
    ['year', '0000'],
    ['year', '10000'],
    ['month', '2027-13'],
    ['date', '2027-02-29'],
    ['date', '2028-04-31'],
    ['time', '24:00:00'],
    ['time', '10:60:00'],
    ['time', '10:30:60'],
    ['time', '08:45'],
    ['datetime', '2027-02-29T08:45:30'],
    ['datetime', '2027-09-18T08:45'],
    ['datetime', '2027-09-18Z08:45:30'],
  ];

  for (const [mode, value] of invalidValues) {
    assert.equal(parseTemporalValue(mode, value), null);
  }
});

test('Gregorian helpers handle leap years, weekday and year 00-99 safely', () => {
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(1900), false);
  assert.equal(isLeapYear(2028), true);
  assert.equal(daysInMonth(99, 2), 28);
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(dayOfWeek(2024, 2, 29), 4);
  assert.deepEqual(addDays({ year: 99, month: 12, day: 31 }, 1), {
    year: 100,
    month: 1,
    day: 1,
  });
  assert.deepEqual(addMonths({ year: 2028, month: 1, day: 31 }, 1), {
    year: 2028,
    month: 2,
    day: 29,
  });
});

test('calendar grid always contains 42 ordered dates with configurable week start', () => {
  const mondayGrid = buildCalendarGrid(2027, 9, 1);
  const sundayGrid = buildCalendarGrid(2027, 9, 0);

  assert.equal(mondayGrid.length, 42);
  assert.deepEqual(mondayGrid[0], {
    year: 2027,
    month: 8,
    day: 30,
    inCurrentMonth: false,
  });
  assert.deepEqual(mondayGrid[41], {
    year: 2027,
    month: 10,
    day: 10,
    inCurrentMonth: false,
  });
  assert.deepEqual(sundayGrid[0], {
    year: 2027,
    month: 8,
    day: 29,
    inCurrentMonth: false,
  });
  assert.equal(mondayGrid.filter(({ inCurrentMonth }) => inCurrentMonth).length, 30);
});

test('inclusive min/max and invalid bounds produce explicit contract states', () => {
  const atMinimum = validateTemporalContract('date', {
    value: '2027-09-10',
    min: '2027-09-10',
    max: '2027-09-20',
  });
  const atMaximum = validateTemporalContract('date', {
    value: '2027-09-20',
    min: '2027-09-10',
    max: '2027-09-20',
  });
  const outside = validateTemporalContract('date', {
    value: '2027-09-21',
    min: '2027-09-10',
    max: '2027-09-20',
  });
  const inverted = validateTemporalContract('time', {
    min: '18:00:00',
    max: '08:00:00',
  });
  const invalid = validateTemporalContract('datetime', {
    min: 'not-a-value',
  });

  assert.equal(atMinimum.valueValid, true);
  assert.equal(atMaximum.valueValid, true);
  assert.equal(outside.valueValid, false);
  assert.deepEqual(outside.errors, ['value-out-of-range']);
  assert.equal(inverted.configValid, false);
  assert.ok(inverted.errors.includes('inverted-range'));
  assert.equal(invalid.configValid, false);
  assert.ok(invalid.errors.includes('invalid-min'));
});

test('time and datetime bounds are inclusive to the second', () => {
  const timeMinimum = validateTemporalContract('time', {
    value: '07:00:00',
    min: '07:00:00',
    max: '18:00:00',
  });
  const timeMaximum = validateTemporalContract('time', {
    value: '18:00:00',
    min: '07:00:00',
    max: '18:00:00',
  });
  const oneSecondOutside = validateTemporalContract('time', {
    value: '18:00:01',
    min: '07:00:00',
    max: '18:00:00',
  });
  const datetimeMaximum = validateTemporalContract('datetime', {
    value: '2027-09-24T18:00:00',
    min: '2027-09-10T07:00:00',
    max: '2027-09-24T18:00:00',
  });

  assert.equal(timeMinimum.valueValid, true);
  assert.equal(timeMaximum.valueValid, true);
  assert.equal(oneSecondOutside.valueValid, false);
  assert.equal(datetimeMaximum.valueValid, true);
});

test('minute step is clamped and preserves an off-step controlled minute', () => {
  assert.equal(normalizeMinuteStep(0), 1);
  assert.equal(normalizeMinuteStep(15.9), 15);
  assert.equal(normalizeMinuteStep(100), 60);
  assert.deepEqual(buildMinuteOptions(15), [0, 15, 30, 45]);
  assert.deepEqual(buildMinuteOptions(15, 7), [0, 7, 15, 30, 45]);
  assert.equal(buildMinuteOptions(1).length, 60);
  assert.deepEqual(
    buildMinuteOptions(1),
    Array.from({ length: 60 }, (_, minute) => minute),
  );
});

test('serialized output never introduces timezone data', () => {
  const value = serializeTemporalValue('datetime', {
    year: 2027,
    month: 9,
    day: 18,
    hour: 8,
    minute: 45,
    second: 30,
  });

  assert.equal(value, '2027-09-18T08:45:30');
  assert.equal(value.includes('Z'), false);
  assert.equal(/[+-]\d{2}:\d{2}$/.test(value), false);
});

test('registry and ZIP expose the real temporal-picker distribution contract', async (t) => {
  const temporaryDirectory = await createTemporaryDirectory(t, 'temporal-picker-package-');
  const registryFile = path.join(temporaryDirectory, 'components-index.json');
  const downloadsDirectory = path.join(temporaryDirectory, 'downloads');
  const registry = await generateComponentIndex({
    componentsDirectory: COMPONENTS_DIRECTORY,
    outputFile: registryFile,
  });
  const entry = registry.find(({ id }) => id === 'temporal-picker');

  assert.ok(entry);
  assert.equal(entry.schemaVersion, 2);
  assert.equal(entry.version, '0.3.0');
  assert.equal(entry.group, 'inputs');
  assert.equal(entry.docs.prompt, 'components/temporal-picker/PROMPT.md');
  assert.equal(entry.preview.variant, 'datetime');
  assert.equal(
    entry.preview.thumbnail,
    'components/temporal-picker/preview/thumbnail.svg',
  );
  assert.equal(entry.variants.length, 6);
  assert.ok(entry.variants.every((variant) => variant.description.length > 0));
  assert.ok(
    entry.source.files.some(
      (sourceFile) => sourceFile.path === 'source/variants/datetime/index.html',
    ),
  );
  assert.ok(
    entry.source.files.some(
      (sourceFile) =>
        sourceFile.path === 'source/variants/bounded-datetime/index.html',
    ),
  );

  const outputFile = await packageComponent('temporal-picker', {
    componentsDirectory: COMPONENTS_DIRECTORY,
    outputDirectory: downloadsDirectory,
    bundlesDirectory: path.join(temporaryDirectory, 'bundles'),
  });
  const zip = new AdmZip(outputFile);
  const names = zip
    .getEntries()
    .filter((zipEntry) => !zipEntry.isDirectory)
    .map((zipEntry) => zipEntry.entryName)
    .sort();

  // The archive is what a consumer drops into their project: the three files plus the
  // integration notes, and nothing else.
  assert.deepEqual(names, [
    'README.md',
    'temporal-picker.css',
    'temporal-picker.html',
    'temporal-picker.js',
  ]);

  // The source tree would repeat the same code the bundle already carries.
  assert.ok(!names.some((name) => name.startsWith('source/')));

  const bundledScript = zip.readAsText('temporal-picker.js');
  assert.ok(bundledScript.includes('class TemporalPicker'));
  assert.ok(bundledScript.includes('export function validateTemporalContract'));
  assert.ok(!bundledScript.includes("from './temporal-picker-core.js'"));
});
