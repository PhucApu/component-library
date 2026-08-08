import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_LABELS,
  QUOTE_LIMIT,
  aspectRatio,
  fillLabel,
  formatDuration,
  formatSize,
  formatTime,
  messageIntro,
  minutesBetween,
  normalizeDirection,
  normalizeStatus,
  normalizeType,
  sameRun,
  speakerFor,
  truncateQuote,
} from '../../components/chat-message/source/chat-message-core.js';

describe('attribute normalisation', () => {
  it('keeps every documented type and falls back rather than passing nonsense through', () => {
    assert.equal(normalizeType('image'), 'image');
    assert.equal(normalizeType('VOICE'), 'voice');
    assert.equal(normalizeType('sticker'), 'text');
    assert.equal(normalizeType(undefined), 'text');
  });

  it('defaults an unknown direction to the other person, never to you', () => {
    // Guessing "me" would put somebody else's words on your side of the thread and attribute
    // them to you, which is a worse mistake than the other way round.
    assert.equal(normalizeDirection('me'), 'me');
    assert.equal(normalizeDirection('outgoing'), 'them');
    assert.equal(normalizeDirection(null), 'them');
  });

  it('reports no status at all rather than inventing one', () => {
    // Most messages in a thread have no delivery state to show. Defaulting to "sent" would
    // claim something the page never said.
    assert.equal(normalizeStatus('read'), 'read');
    assert.equal(normalizeStatus(''), null);
    assert.equal(normalizeStatus('pending'), null);
  });
});

describe('speakerFor', () => {
  it('names you on your own side', () => {
    assert.equal(speakerFor({ direction: 'me', author: 'Mai' }), 'You');
  });

  it('names the author on the other side', () => {
    assert.equal(speakerFor({ direction: 'them', author: 'Mai' }), 'Mai');
  });

  it('still says something when nobody was named', () => {
    // Silence here would leave a bubble with no speaker at all, which is the failure this
    // function exists to prevent.
    assert.equal(speakerFor({ direction: 'them', author: '   ' }), 'Them');
    assert.equal(speakerFor({ direction: 'them' }), 'Them');
  });
});

describe('messageIntro', () => {
  it('puts the speaker in front of the message, with the time', () => {
    assert.equal(
      messageIntro({ direction: 'them', author: 'Mai', time: '2026-08-07T09:12', hour12: false }),
      'Mai, 09:12',
    );
  });

  it('speaks the time in the same clock the bubble prints it in', () => {
    // A bubble that reads 9:12 AM while announcing 09:12 is telling two stories.
    const spoken = messageIntro({ author: 'Mai', time: '2026-08-07T09:12', hour12: true });

    assert.equal(spoken, `Mai, ${formatTime('2026-08-07T09:12', { hour12: true })}`);
    assert.match(spoken, /AM/i);
  });

  it('says who even when there is no time to say', () => {
    // A run of messages shows one timestamp at the end of it. The three bubbles above still
    // have to say who is talking.
    assert.equal(messageIntro({ direction: 'me', author: 'Mai' }), 'You');
  });

  it('leaves no dangling comma when the time cannot be read', () => {
    assert.equal(messageIntro({ direction: 'them', author: 'Mai', time: 'not a date' }), 'Mai');
  });
});

describe('formatTime', () => {
  it('reads the wall-clock time out of a datetime attribute', () => {
    assert.equal(formatTime('2026-08-07T09:12', { hour12: false }), '09:12');
    assert.equal(formatTime('2026-08-07T21:05', { hour12: false }), '21:05');
  });

  it('never moves a message through a timezone', () => {
    // A conversation whose messages round-trip through UTC ends up with replies that arrive
    // before the thing they replied to.
    assert.equal(formatTime('2026-01-01T00:30', { hour12: false }), '00:30');
    assert.equal(formatTime('2026-06-15T23:59', { hour12: false }), '23:59');
  });

  it('has nothing to say about a date with no time on it', () => {
    assert.equal(formatTime('2026-08-07'), '');
    assert.equal(formatTime(''), '');
    assert.equal(formatTime(null), '');
  });

  it('follows the locale it was given', () => {
    const twelve = formatTime('2026-08-07T21:05', { locale: 'en-US', hour12: true });
    assert.match(twelve, /9:05/);
    assert.match(twelve, /PM/i);
  });

  it('pads a 24-hour clock and leaves a 12-hour one bare', () => {
    // A fixed choice gets one convention wrong everywhere: "2-digit" prints "03:40 PM" and
    // "numeric" prints "9:12" where a 24-hour reader expects "09:12".
    assert.equal(formatTime('2026-08-07T09:12', { locale: 'en-GB' }), '09:12');
    assert.equal(formatTime('2026-08-07T09:12', { locale: 'en-US', hour12: false }), '09:12');
    assert.equal(formatTime('2026-08-07T15:40', { locale: 'en-US', hour12: true }), '3:40 PM');
    assert.equal(formatTime('2026-08-07T09:12', { locale: 'en-US', hour12: true }), '9:12 AM');
  });
});

describe('minutesBetween', () => {
  it('measures the gap either way round', () => {
    assert.equal(minutesBetween('2026-08-07T09:12', '2026-08-07T09:15'), 3);
    assert.equal(minutesBetween('2026-08-07T09:15', '2026-08-07T09:12'), 3);
  });

  it('crosses midnight and the end of a month', () => {
    assert.equal(minutesBetween('2026-08-07T23:58', '2026-08-08T00:03'), 5);
    assert.equal(minutesBetween('2026-01-31T23:59', '2026-02-01T00:01'), 2);
  });

  it('reports no gap it cannot read', () => {
    assert.equal(minutesBetween('2026-08-07', '2026-08-07T09:12'), null);
    assert.equal(minutesBetween('', ''), null);
  });
});

describe('sameRun', () => {
  const at = (time, extra = {}) => ({ direction: 'them', author: 'Mai', type: 'text', time, ...extra });

  it('joins two messages from the same person moments apart', () => {
    assert.equal(sameRun(at('2026-08-07T09:12'), at('2026-08-07T09:13')), true);
  });

  it('starts a new run after a long silence', () => {
    // Without the gap, a reply six hours later joins the run above and inherits a timestamp
    // from this morning — a message that reads as never having been sent.
    assert.equal(sameRun(at('2026-08-07T09:12'), at('2026-08-07T15:40')), false);
    assert.equal(sameRun(at('2026-08-07T09:12'), at('2026-08-07T09:18')), false);
    assert.equal(sameRun(at('2026-08-07T09:12'), at('2026-08-07T09:17')), true);
  });

  it('never joins across the middle of the thread', () => {
    assert.equal(
      sameRun(at('2026-08-07T09:12'), at('2026-08-07T09:13', { direction: 'me' })),
      false,
    );
    assert.equal(
      sameRun(at('2026-08-07T09:12'), at('2026-08-07T09:13', { author: 'Linh' })),
      false,
    );
  });

  it('leaves a system message on its own, because nobody said it', () => {
    assert.equal(sameRun(at('2026-08-07T09:12', { type: 'system' }), at('2026-08-07T09:13')), false);
    assert.equal(sameRun(at('2026-08-07T09:12'), at('2026-08-07T09:13', { type: 'system' })), false);
  });

  it('lets the author decide when there are no times to compare', () => {
    // No readable time is not evidence of a long gap.
    assert.equal(sameRun(at(''), at('')), true);
  });

  it('has nothing to join at the top of the thread', () => {
    assert.equal(sameRun(null, at('2026-08-07T09:12')), false);
  });
});

describe('aspectRatio', () => {
  it('gives the box a picture will need before it arrives', () => {
    assert.equal(aspectRatio({ width: 1200, height: 800 }), '1200 / 800');
    assert.equal(aspectRatio({ width: '640', height: '640' }), '640 / 640');
  });

  it('refuses to guess, because a wrong box is worse than none', () => {
    // A reserved box of the wrong shape still reflows when the picture lands, and now it does
    // it twice.
    assert.equal(aspectRatio({ width: 1200 }), null);
    assert.equal(aspectRatio({ width: 0, height: 100 }), null);
    assert.equal(aspectRatio({ width: -4, height: 3 }), null);
    assert.equal(aspectRatio({}), null);
  });
});

describe('truncateQuote', () => {
  it('leaves a short quotation exactly as it was said', () => {
    assert.equal(truncateQuote('See you at three'), 'See you at three');
  });

  it('collapses the whitespace a wrapped quotation carries', () => {
    assert.equal(truncateQuote('See   you\n  at three'), 'See you at three');
  });

  it('cuts at a word and keeps the ellipsis', () => {
    const long = 'a'.repeat(40) + ' ' + 'b'.repeat(40) + ' ' + 'c'.repeat(60);
    const cut = truncateQuote(long);

    assert.ok(cut.length <= QUOTE_LIMIT + 1);
    assert.ok(cut.endsWith('…'));
    // A quotation that ends cleanly reads as the whole of what somebody said.
    assert.ok(!cut.endsWith(' …'));
  });

  it('cuts mid-word rather than throwing most of it away', () => {
    // One unbroken string longer than the limit has no space to cut at. Falling back to the
    // last space would return almost nothing.
    const cut = truncateQuote('x'.repeat(200));

    assert.equal(cut.length, QUOTE_LIMIT + 1);
    assert.ok(cut.endsWith('…'));
  });

  it('has nothing to quote from nothing', () => {
    assert.equal(truncateQuote(''), '');
    assert.equal(truncateQuote(null), '');
  });
});

describe('formatDuration', () => {
  it('reads a voice note the way a player does', () => {
    assert.equal(formatDuration(7), '0:07');
    assert.equal(formatDuration(83), '1:23');
    assert.equal(formatDuration(600), '10:00');
    assert.equal(formatDuration(0), '0:00');
  });

  it('never reports a negative length', () => {
    assert.equal(formatDuration(-5), '0:00');
  });
});

describe('formatSize', () => {
  it('reports a file the way a person would say it', () => {
    assert.equal(formatSize(900), '900 B');
    assert.equal(formatSize(10240), '10 KB');
    assert.equal(formatSize(1536), '1.5 KB');
    assert.equal(formatSize(5 * 1024 * 1024), '5 MB');
  });

  it('has nothing to say about a size it was not given', () => {
    assert.equal(formatSize(''), '');
    assert.equal(formatSize(-1), '');
  });
});

describe('fillLabel', () => {
  it('fills what it has', () => {
    assert.equal(fillLabel('{who}, {time}', { who: 'Mai', time: '09:12' }), 'Mai, 09:12');
  });

  it('leaves no punctuation stranded where a value was missing', () => {
    // The template carries the comma, so a missing time would otherwise announce "Mai," with
    // nothing after it.
    assert.equal(fillLabel('{who}, {time}', { who: 'Mai' }), 'Mai');
    assert.equal(fillLabel('Replying to {who}', {}), 'Replying to');
  });
});

describe('DEFAULT_LABELS', () => {
  it('has a word for every delivery state, because a tick is a picture', () => {
    // Two grey ticks and two blue ticks differ by colour alone, which is the whole reason
    // these strings exist.
    ['sending', 'sent', 'delivered', 'read', 'failed'].forEach((status) => {
      assert.equal(typeof DEFAULT_LABELS[status], 'string');
      assert.ok(DEFAULT_LABELS[status].length > 0);
    });
  });
});
