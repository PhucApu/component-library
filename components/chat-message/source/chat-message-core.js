/**
 * The rules a message decides by, with no DOM in any of it.
 *
 * Most of a chat bubble is layout, but the parts that go wrong are not: what a screen reader is
 * told about who spoke, what box to hold open before a picture arrives, and how a quotation is
 * shortened without lying about what was said. Those live here, where they can be argued with
 * in a test file.
 */

/** What a bubble can hold. `text` is the default because most messages are just words. */
export const TYPES = Object.freeze(['text', 'image', 'voice', 'file', 'link', 'system', 'deleted']);

/** Who sent it. The visual answer is left or right, which is why it also has to be a word. */
export const DIRECTIONS = Object.freeze(['them', 'me']);

/**
 * How far a message has got. Ordered, because they only ever move forward — except `failed`,
 * which is the one that leaves the sequence and needs a way back.
 */
export const STATUSES = Object.freeze(['sending', 'sent', 'delivered', 'read', 'failed']);

/** Past this a bubble stops being a line of text and becomes a paragraph nobody can track. */
export const QUOTE_LIMIT = 120;

export const DEFAULT_LABELS = Object.freeze({
  you: 'You',
  them: 'Them',
  said: '{who}, {time}',
  saidNoTime: '{who}',
  sending: 'Sending',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Not sent',
  retry: 'Try again',
  replyTo: 'Replying to {who}',
  goToQuoted: 'Go to the message from {who}',
  image: 'Image',
  imageLoading: 'Image loading',
  imageFailed: 'That image could not be loaded',
  voice: 'Voice message, {duration}',
  transcript: 'Transcript',
  showTranscript: 'Show transcript',
  hideTranscript: 'Hide transcript',
  file: '{name}, {size}',
  download: 'Download {name}',
  edited: 'Edited',
  deleted: 'This message was deleted',
  system: 'System message',
});

function pick(value, allowed, fallback) {
  const found = String(value ?? '').trim().toLowerCase();
  return allowed.includes(found) ? found : fallback;
}

export function normalizeType(value) {
  return pick(value, TYPES, 'text');
}

export function normalizeDirection(value) {
  return pick(value, DIRECTIONS, 'them');
}

/** `null` rather than a default: most messages have no status to report, and inventing one lies. */
export function normalizeStatus(value) {
  const found = String(value ?? '').trim().toLowerCase();
  return STATUSES.includes(found) ? found : null;
}

/**
 * Who spoke, as a word.
 *
 * Every chat app in the world encodes this as **which side of the thread the bubble sits on**,
 * and sometimes as its colour. Neither exists for a screen reader, so without this the whole
 * conversation arrives as one block of text with no idea who is talking. It is the single most
 * skipped thing in a chat interface.
 */
export function speakerFor({ direction = 'them', author = '', labels = DEFAULT_LABELS } = {}) {
  if (normalizeDirection(direction) === 'me') {
    return labels.you;
  }

  return String(author ?? '').trim() || labels.them;
}

/**
 * The one line that goes in front of a message for anybody not looking at it.
 *
 * Said once per message, even when the name is visually hidden because this is the fourth
 * bubble in a run. A run is a visual grouping; somebody listening has no run to see.
 */
export function messageIntro({
  direction = 'them',
  author = '',
  time = '',
  locale = 'en-US',
  hour12,
  labels = DEFAULT_LABELS,
} = {}) {
  const who = speakerFor({ direction, author, labels });
  // The spoken time follows the same locale as the printed one. A bubble that reads 9:12 AM
  // and announces 09:12 is two different messages.
  const spoken = formatTime(time, { locale, hour12 });

  return spoken
    ? fillLabel(labels.said, { who, time: spoken })
    : fillLabel(labels.saidNoTime, { who });
}

/**
 * Reads the civil time out of a `datetime` attribute without going near a timezone.
 *
 * A message carries the wall-clock time it was sent. Round-tripping that through UTC is how a
 * conversation ends up with messages that arrive before they were sent.
 */
export function formatTime(value, { locale = 'en-US', hour12 } = {}) {
  const raw = String(value ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(raw);

  if (!match || match[4] === undefined) {
    return '';
  }

  const [, year, month, day, hour, minute] = match;
  const local = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );

  if (Number.isNaN(local.getTime())) {
    return '';
  }

  const clock = hour12 === undefined ? {} : { hour12 };

  // Pad the hour on a 24-hour clock and leave it bare on a 12-hour one, which is what each
  // convention actually does. A fixed choice gets one of them wrong in every locale: `2-digit`
  // prints "03:40 PM" and `numeric` prints "9:12" where a 24-hour reader expects "09:12".
  const cycle = new Intl.DateTimeFormat(locale, { hour: 'numeric', ...clock }).resolvedOptions()
    .hourCycle;
  const padded = cycle === 'h23' || cycle === 'h24';

  return new Intl.DateTimeFormat(locale, {
    hour: padded ? '2-digit' : 'numeric',
    minute: '2-digit',
    ...clock,
  }).format(local);
}

/** Minutes of silence after which the next message starts its own run rather than joining. */
export const RUN_GAP_MINUTES = 5;

/** Civil minutes between two `datetime` values, or `null` when either cannot be read. */
export function minutesBetween(from, to) {
  const parse = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(value ?? '').trim());

    if (!match) {
      return null;
    }

    const [, year, month, day, hour, minute] = match.map(Number);
    return Date.UTC(year, month - 1, day, hour, minute);
  };

  const a = parse(from);
  const b = parse(to);

  return a === null || b === null ? null : Math.abs(b - a) / 60000;
}

/**
 * Whether a message joins the one above it into a run.
 *
 * A run is what lets a conversation show one avatar and one timestamp for four bubbles instead
 * of four of each. The gap matters: without it a reply six hours later joins the run above and
 * inherits a timestamp from this morning, which reads as a message that was never sent.
 *
 * A system message never joins anything — it is not somebody talking.
 */
export function sameRun(previous, current, { minutes = RUN_GAP_MINUTES } = {}) {
  if (!previous || !current) {
    return false;
  }

  if (previous.type === 'system' || current.type === 'system') {
    return false;
  }

  if (normalizeDirection(previous.direction) !== normalizeDirection(current.direction)) {
    return false;
  }

  if (String(previous.author ?? '').trim() !== String(current.author ?? '').trim()) {
    return false;
  }

  const gap = minutesBetween(previous.time, current.time);

  // No readable times on either side is not evidence of a long gap, so the author and
  // direction are allowed to decide on their own.
  return gap === null || gap <= minutes;
}

/**
 * The box to hold open before a picture arrives.
 *
 * Without it the thread reflows the moment every image lands and the reader loses the line they
 * were on — the fault the loading state exists to prevent, and the reason a skeleton has to be
 * the picture's own shape rather than a square that grows.
 */
export function aspectRatio({ width, height } = {}) {
  const w = Number.parseFloat(width);
  const h = Number.parseFloat(height);

  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return null;
  }

  return `${w} / ${h}`;
}

/**
 * Shortens a quotation without pretending it was short.
 *
 * Cut at a word rather than mid-syllable, and keep the ellipsis, because a quotation that ends
 * cleanly reads as the whole of what somebody said.
 */
export function truncateQuote(text, limit = QUOTE_LIMIT) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();

  if (clean.length <= limit) {
    return clean;
  }

  const cut = clean.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');

  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** `7` becomes `0:07`, `83` becomes `1:23`. Nobody reads a voice note's length in seconds. */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number.parseFloat(seconds)));

  if (!Number.isFinite(total)) {
    return '';
  }

  const minutes = Math.floor(total / 60);
  const rest = total % 60;

  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** `10240` becomes `10 KB`. Bytes are for machines. */
export function formatSize(bytes) {
  const value = Number.parseFloat(bytes);

  if (!Number.isFinite(value) || value < 0) {
    return '';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }

  const rounded = size >= 10 || unit === 0 ? Math.round(size) : Math.round(size * 10) / 10;

  return `${rounded} ${units[unit]}`;
}

/** Fills a template such as `{who}, {time}`, leaving nothing ragged. */
export function fillLabel(template, values = {}) {
  return String(template ?? '')
    .replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : ''))
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();
}
