import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_LABELS,
  PLACEMENTS,
  SIZES,
  errorMessage,
  fillTemplate,
  normalizePlacement,
  normalizeSize,
  pendingMessage,
  shouldBlockToggle,
} from '../../components/switch/source/switch-core.js';

describe('attribute normalisation', () => {
  it('keeps every documented size and placement', () => {
    for (const size of SIZES) {
      assert.equal(normalizeSize(size), size);
    }

    for (const placement of PLACEMENTS) {
      assert.equal(normalizePlacement(placement), placement);
    }
  });

  it('falls back rather than passing an unknown value through to a selector', () => {
    assert.equal(normalizeSize('large'), 'md');
    assert.equal(normalizeSize(null), 'md');
    assert.equal(normalizeSize(''), 'md');
    assert.equal(normalizePlacement('above'), 'end');
    assert.equal(normalizePlacement(undefined), 'end');
  });
});

describe('shouldBlockToggle', () => {
  it('drops a toggle while a request is in flight', () => {
    assert.equal(shouldBlockToggle({ pending: true, disabled: false }), true);
  });

  it('drops a toggle on an unavailable switch', () => {
    assert.equal(shouldBlockToggle({ pending: false, disabled: true }), true);
  });

  it('lets an ordinary toggle through', () => {
    assert.equal(shouldBlockToggle({ pending: false, disabled: false }), false);
  });

  it('treats a missing state as nothing to block', () => {
    assert.equal(shouldBlockToggle(), false);
    assert.equal(shouldBlockToggle({}), false);
  });
});

describe('fillTemplate', () => {
  it('puts the label into the sentence', () => {
    assert.equal(fillTemplate('Turning {label} on', 'Wi-Fi'), 'Turning Wi-Fi on');
  });

  it('closes the gap an unlabelled switch would leave mid-sentence', () => {
    assert.equal(fillTemplate('Turning {label} on', ''), 'Turning on');
    assert.equal(fillTemplate('Turning {label} on', undefined), 'Turning on');
  });

  it('survives a template that is not a string', () => {
    assert.equal(fillTemplate(null, 'Wi-Fi'), '');
  });
});

describe('status messages', () => {
  it('says which direction the request is going', () => {
    assert.equal(
      pendingMessage({ checked: true, label: 'Wi-Fi' }),
      'Turning Wi-Fi on',
    );
    assert.equal(
      pendingMessage({ checked: false, label: 'Wi-Fi' }),
      'Turning Wi-Fi off',
    );
  });

  it('names the state that was asked for, not the one restored after the failure', () => {
    // The person asked for "on" and has been put back to "off". The message is about the
    // request they made, so reporting "off" here would read as a success.
    assert.equal(
      errorMessage({ checked: true, label: 'Nightly backup' }),
      'Could not turn Nightly backup on',
    );
    assert.equal(
      errorMessage({ checked: false, label: 'Nightly backup' }),
      'Could not turn Nightly backup off',
    );
  });

  it('lets an author replace the wording', () => {
    const labels = { turningOn: 'Enabling {label}', failedOn: '{label} could not be enabled' };

    assert.equal(pendingMessage({ checked: true, label: 'Sync', labels }), 'Enabling Sync');
    assert.equal(errorMessage({ checked: true, label: 'Sync', labels }), 'Sync could not be enabled');
  });

  it('ignores a blank override instead of announcing nothing', () => {
    const labels = { turningOn: '   ' };

    assert.equal(
      pendingMessage({ checked: true, label: 'Sync', labels }),
      fillTemplate(DEFAULT_LABELS.turningOn, 'Sync'),
    );
  });
});
