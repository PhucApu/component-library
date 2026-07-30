import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_DURATION,
  PLACEMENTS,
  SEVERITIES,
  composeAnnouncement,
  createQueue,
  normalizePlacement,
  normalizeSeverity,
  politenessFor,
  resolveDuration,
  shouldPreempt,
} from '../../components/snackbar/source/snackbar-core.js';

describe('attribute normalisation', () => {
  it('keeps every documented severity and placement', () => {
    for (const severity of SEVERITIES) {
      assert.equal(normalizeSeverity(severity), severity);
    }

    for (const placement of PLACEMENTS) {
      assert.equal(normalizePlacement(placement), placement);
    }
  });

  it('falls back rather than passing an unknown value through to a selector', () => {
    assert.equal(normalizeSeverity('fatal'), 'info');
    assert.equal(normalizeSeverity(null), 'info');
    assert.equal(normalizePlacement('bottom-left'), 'bottom-center');
    assert.equal(normalizePlacement(undefined), 'bottom-center');
  });
});

describe('politeness follows severity', () => {
  it('lets news wait and makes problems interrupt', () => {
    assert.equal(politenessFor('info'), 'polite');
    assert.equal(politenessFor('success'), 'polite');
    assert.equal(politenessFor('warning'), 'assertive');
    assert.equal(politenessFor('error'), 'assertive');
  });

  it('treats an unknown severity as ordinary news', () => {
    assert.equal(politenessFor('whatever'), 'polite');
  });
});

describe('resolveDuration', () => {
  it('never puts a clock on a message you can act on', () => {
    // A button that expires loses the race against anyone still reading the sentence.
    assert.equal(resolveDuration({ hasAction: true }), null);
    assert.equal(resolveDuration({ duration: 3000, hasAction: true }), null);
  });

  it('treats zero as "until dismissed"', () => {
    assert.equal(resolveDuration({ duration: 0 }), null);
  });

  it('keeps a usable duration', () => {
    assert.equal(resolveDuration({ duration: 2500 }), 2500);
  });

  it('falls back for anything that is not a usable length of time', () => {
    assert.equal(resolveDuration({ duration: -1 }), DEFAULT_DURATION);
    assert.equal(resolveDuration({ duration: Number.NaN }), DEFAULT_DURATION);
    assert.equal(resolveDuration({ duration: Number.POSITIVE_INFINITY }), DEFAULT_DURATION);
    assert.equal(resolveDuration({}), DEFAULT_DURATION);
    assert.equal(resolveDuration(), DEFAULT_DURATION);
  });
});

describe('composeAnnouncement', () => {
  it('reads the message on its own when there is nothing to do', () => {
    assert.equal(composeAnnouncement({ message: 'Draft saved' }), 'Draft saved');
  });

  it('names the action, because nothing else would say it is there', () => {
    assert.equal(
      composeAnnouncement({ message: 'Message moved to Trash', actionLabel: 'Undo' }),
      'Message moved to Trash, Undo available',
    );
  });

  it('says nothing at all for an empty message', () => {
    assert.equal(composeAnnouncement({ message: '   ' }), '');
    assert.equal(composeAnnouncement(), '');
  });

  it('lets an author replace the wording, and ignores a blank override', () => {
    assert.equal(
      composeAnnouncement({
        message: 'Deleted',
        actionLabel: 'Undo',
        labels: { withAction: '{message} — press {action} to reverse it' },
      }),
      'Deleted — press Undo to reverse it',
    );
    assert.equal(
      composeAnnouncement({ message: 'Deleted', actionLabel: 'Undo', labels: { withAction: ' ' } }),
      'Deleted, Undo available',
    );
  });
});

describe('shouldPreempt', () => {
  it('lets a problem displace ordinary news', () => {
    // Otherwise marking a failure assertive is a promise the queue quietly breaks.
    assert.equal(shouldPreempt({ incomingSeverity: 'error', currentSeverity: 'success' }), true);
    assert.equal(shouldPreempt({ incomingSeverity: 'warning', currentSeverity: 'info' }), true);
  });

  it('does not let news displace a problem', () => {
    assert.equal(shouldPreempt({ incomingSeverity: 'info', currentSeverity: 'error' }), false);
  });

  it('leaves one problem to finish before the next', () => {
    assert.equal(shouldPreempt({ incomingSeverity: 'error', currentSeverity: 'warning' }), false);
  });

  it('has nothing to displace when the screen is clear', () => {
    assert.equal(shouldPreempt({ incomingSeverity: 'error', currentSeverity: null }), false);
    assert.equal(shouldPreempt({ incomingSeverity: 'error' }), false);
  });
});

describe('createQueue', () => {
  it('hands messages back in the order they arrived', () => {
    const queue = createQueue();
    queue.push({ id: 'a' });
    queue.push({ id: 'b' });

    assert.equal(queue.size, 2);
    assert.equal(queue.peek().id, 'a');
    assert.equal(queue.shift().id, 'a');
    assert.equal(queue.shift().id, 'b');
    assert.equal(queue.shift(), null);
  });

  it('lets an urgent message go to the front', () => {
    const queue = createQueue();
    queue.push({ id: 'a' });
    queue.unshift({ id: 'urgent' });

    assert.equal(queue.shift().id, 'urgent');
  });

  it('removes a message that is still waiting', () => {
    const queue = createQueue();
    queue.push({ id: 'a' });
    queue.push({ id: 'b' });

    assert.equal(queue.remove('a'), true);
    assert.equal(queue.remove('missing'), false);
    assert.equal(queue.size, 1);
    assert.equal(queue.peek().id, 'b');
  });

  it('reports how much it dropped', () => {
    const queue = createQueue();
    queue.push({ id: 'a' });
    queue.push({ id: 'b' });

    assert.equal(queue.clear(), 2);
    assert.equal(queue.size, 0);
    assert.equal(queue.peek(), null);
  });
});
