import {
  DEFAULT_LABELS,
  aspectRatio,
  fillLabel,
  formatDuration,
  formatSize,
  formatTime,
  messageIntro,
  normalizeDirection,
  normalizeStatus,
  normalizeType,
  sameRun,
  speakerFor,
  truncateQuote,
} from './chat-message-core.js';

let sequence = 0;

function uniqueId(prefix) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

const TICK = {
  sending:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.6V8l2.4 1.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  sent: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.6 6.2 12 13 4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  delivered:
    '<svg viewBox="0 0 20 16" aria-hidden="true"><path d="M2 8.6 5.2 12 12 4.6M8.4 11.4 9.6 12.6 16.4 5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  read: '<svg viewBox="0 0 20 16" aria-hidden="true"><circle cx="10" cy="8" r="7.2" fill="currentColor" opacity="0.16"/><path d="M4 8.4 6.8 11.2 12 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.6 10.6 10.6 11.6 15.8 5.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  failed:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.8v3.8M8 10.8v.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

/**
 * One message in a conversation.
 *
 * ```html
 * <ol class="chat-thread" role="log">
 *   <li><ui-chat-message from="them" author="Mai" time="2026-08-07T09:12">
 *     <p>Are we still on for three?</p>
 *   </ui-chat-message></li>
 * </ol>
 * ```
 *
 * **Which side the bubble sits on is invisible.** Every chat interface encodes the speaker as
 * left-or-right and a colour, and neither of those exists for a screen reader — without help the
 * whole conversation arrives as one block of text with no idea who is talking. So every message
 * carries its speaker as a *word*, said once, in front of the content, even when the name is
 * visually hidden because this is the fourth bubble in a run.
 *
 * The thread itself belongs to the page. A page may hold several conversations and only the page
 * can decide which of them is a live region, so `role="log"` is the author's to place.
 */
export class UiChatMessage extends HTMLElement {
  static get observedAttributes() {
    return [
      'from',
      'author',
      'time',
      'type',
      'status',
      'loading',
      'edited',
      'locale',
      'hour12',
      'reply-to',
      'reply-author',
    ];
  }

  constructor() {
    super();
    this._connected = false;
    this._labelOverrides = {};
    this._handleRetry = this._handleRetry.bind(this);
    this._handleQuoteClick = this._handleQuoteClick.bind(this);
    this._handlePlay = this._handlePlay.bind(this);
    this._handleAudioState = this._handleAudioState.bind(this);
    this._handleTranscript = this._handleTranscript.bind(this);
    this._handleImageLoad = this._handleImageLoad.bind(this);
    this._handleImageError = this._handleImageError.bind(this);
  }

  connectedCallback() {
    if (this._connected) {
      return;
    }

    this._connected = true;
    this._build();
    this._render();
    // A message cannot know whether it starts a run until its neighbours exist, and the last
    // message in a thread changes the one above it. One pass after the thread is parsed.
    queueMicrotask(() => this._syncRun({ neighbours: true }));
  }

  disconnectedCallback() {
    this._connected = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._connected || oldValue === newValue) {
      return;
    }

    this._render();
    this._syncRun({ neighbours: true });
  }

  /* ---- What the page can ask ---------------------------------------------------------- */

  get direction() {
    return normalizeDirection(this.getAttribute('from'));
  }

  get type() {
    return this.hasAttribute('type') ? normalizeType(this.getAttribute('type')) : this._inferType();
  }

  get status() {
    return normalizeStatus(this.getAttribute('status'));
  }

  get author() {
    return this.getAttribute('author') ?? '';
  }

  get time() {
    return this.getAttribute('time') ?? '';
  }

  /** The speaker as a word — what a screen reader is told, and what the sides cannot say. */
  get speaker() {
    return speakerFor({ direction: this.direction, author: this.author, labels: this.labels });
  }

  get locale() {
    return this.getAttribute('locale') || document.documentElement.lang || 'en-US';
  }

  get hour12() {
    return this.hasAttribute('hour12') ? this.getAttribute('hour12') !== 'false' : undefined;
  }

  get labels() {
    return { ...DEFAULT_LABELS, ...this._labelOverrides };
  }

  set labels(value) {
    this._labelOverrides = value && typeof value === 'object' ? { ...value } : {};
    this._render();
  }

  refresh() {
    this._render();
    this._syncRun({ neighbours: true });
  }

  /* ---- Reading the markup ------------------------------------------------------------- */

  /**
   * What kind of message this is, when the author did not say.
   *
   * Inference is a convenience, never the contract: `type` set explicitly always wins, because
   * a picture inside a text message is still a text message with a picture in it.
   */
  _inferType() {
    if (this.querySelector('audio')) {
      return 'voice';
    }

    if (this.querySelector('[data-file]')) {
      return 'file';
    }

    if (this.querySelector('img')) {
      return 'image';
    }

    return 'text';
  }

  /* ---- The furniture ------------------------------------------------------------------ */

  _build() {
    if (this._bubble) {
      return;
    }

    this.id = this.id || uniqueId('chat-message');

    // Said once, in front of everything. A screen reader hears the speaker before the words,
    // which is what somebody looking at the thread gets from the bubble's position for free.
    this._intro = document.createElement('span');
    this._intro.className = 'chat__sr-only';

    this._avatar = document.createElement('span');
    this._avatar.className = 'chat__avatar';
    this._avatar.setAttribute('aria-hidden', 'true');

    this._name = document.createElement('span');
    this._name.className = 'chat__author';
    this._name.setAttribute('aria-hidden', 'true');

    this._bubble = document.createElement('div');
    this._bubble.className = 'chat__bubble';

    // Everything the author wrote moves inside the bubble, in the order they wrote it.
    while (this.firstChild) {
      this._bubble.append(this.firstChild);
    }

    this._footer = document.createElement('p');
    this._footer.className = 'chat__footer';

    this._column = document.createElement('div');
    this._column.className = 'chat__column';
    this._column.append(this._name, this._bubble, this._footer);

    this.append(this._intro, this._avatar, this._column);
  }

  _render() {
    if (!this._bubble) {
      return;
    }

    const labels = this.labels;
    const type = this.type;

    this.dataset.direction = this.direction;
    this.dataset.type = type;
    this.toggleAttribute('data-failed', this.status === 'failed');

    this._intro.textContent = messageIntro({
      direction: this.direction,
      author: this.author,
      time: this.time,
      locale: this.locale,
      hour12: this.hour12,
      labels,
    });

    this._name.textContent = this.author;
    this._avatar.textContent = this._initials();

    this._renderQuote(labels);
    this._renderImage(labels);
    this._renderVoice(labels);
    this._renderFile(labels);
    this._renderFooter(labels);
  }

  _initials() {
    const name = this.direction === 'me' ? this.labels.you : this.author;

    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  /**
   * The quotation above a reply.
   *
   * Truncated, because repeating a whole message doubles the length of the thread for anybody
   * reading it aloud. Made into a link, because the point of a quotation is that the original
   * is somewhere else and you want to get to it — a quote you cannot follow is decoration.
   */
  _renderQuote(labels) {
    const quote = this.querySelector('[data-quote]');

    if (!quote) {
      return;
    }

    if (!quote.dataset.chatWired) {
      quote.dataset.chatWired = 'true';
      quote.dataset.quoteText = quote.textContent;
      quote.classList.add('chat__quote');
    }

    const who = this.getAttribute('reply-author') || '';
    const target = this.getAttribute('reply-to');

    quote.replaceChildren();

    const heading = document.createElement('span');
    heading.className = 'chat__quote-who';
    heading.textContent = fillLabel(labels.replyTo, { who: who || labels.them });

    const said = document.createElement('span');
    said.className = 'chat__quote-text';
    said.textContent = truncateQuote(quote.dataset.quoteText);

    if (target) {
      const link = document.createElement('a');
      link.className = 'chat__quote-link';
      link.href = `#${target}`;
      link.setAttribute('aria-label', fillLabel(labels.goToQuoted, { who: who || labels.them }));
      link.append(heading, said);
      link.addEventListener('click', this._handleQuoteClick);
      quote.append(link);
      return;
    }

    quote.append(heading, said);
  }

  /**
   * Holds the picture's own shape open before it arrives.
   *
   * A thread that reflows as each image lands throws the reader off the line they were on. The
   * skeleton has to be the picture's shape, not a square that then grows into it — otherwise
   * the jump happens anyway and now there are two of them.
   */
  _renderImage(labels) {
    const image = this.querySelector('img');

    if (!image) {
      return;
    }

    image.classList.add('chat__image');

    // A frame around the picture rather than styling the picture itself. The frame is what
    // holds the box open, and it has to keep holding it while the picture is not there —
    // hiding the image and letting a skeleton size the bubble collapses it to nothing, which
    // is the very jump the reserved box exists to prevent.
    let frame = image.parentElement?.classList.contains('chat__image-frame')
      ? image.parentElement
      : null;

    if (!frame) {
      frame = document.createElement('span');
      frame.className = 'chat__image-frame';
      image.before(frame);
      frame.append(image);
    }

    const ratio = aspectRatio({
      width: image.getAttribute('width'),
      height: image.getAttribute('height'),
    });

    if (ratio) {
      frame.style.setProperty('--image-ratio', ratio);
      this._bubble.toggleAttribute('data-image-reserved', true);
    }

    if (!image.dataset.chatWired) {
      image.dataset.chatWired = 'true';
      image.addEventListener('load', this._handleImageLoad);
      image.addEventListener('error', this._handleImageError);
    }

    // `loading` forces the state so it can be looked at; an image that simply has not arrived
    // yet reports the same thing on its own.
    const waiting = this.hasAttribute('loading') || !image.complete;
    this._bubble.toggleAttribute('data-image-loading', waiting);

    if (!this._imageStatus) {
      this._imageStatus = document.createElement('span');
      this._imageStatus.className = 'chat__image-status';
      // Inside the frame, over the skeleton — not under it. A line of text that appears and
      // disappears below the picture moves everything after it, which is the same jump the
      // reserved box was there to prevent, just 25px of it.
      frame.append(this._imageStatus);
    }

    this._imageStatus.textContent = waiting ? labels.imageLoading : '';
    this._imageStatus.hidden = !waiting;
  }

  _handleImageLoad() {
    this._bubble.removeAttribute('data-image-loading');
    this._bubble.removeAttribute('data-image-failed');

    if (this._imageStatus) {
      this._imageStatus.hidden = true;
      this._imageStatus.textContent = '';
    }
  }

  _handleImageError() {
    // A broken-image icon says nothing. The message says what happened, and the alt text is
    // still there to say what was in it.
    this._bubble.removeAttribute('data-image-loading');
    this._bubble.toggleAttribute('data-image-failed', true);

    if (this._imageStatus) {
      this._imageStatus.hidden = false;
      this._imageStatus.textContent = this.labels.imageFailed;
    }
  }

  /**
   * A voice note, and the words in it.
   *
   * The waveform is decoration. A voice message with no transcript is a message that some
   * people simply cannot read, which is why the transcript is part of the contract here rather
   * than an enhancement somebody remembers.
   */
  _renderVoice(labels) {
    const audio = this.querySelector('audio');

    if (!audio || this._player) {
      return;
    }

    audio.classList.add('chat__audio');
    audio.preload = 'metadata';

    this._player = document.createElement('div');
    this._player.className = 'chat__player';

    this._play = document.createElement('button');
    this._play.type = 'button';
    this._play.className = 'chat__play';
    this._play.innerHTML =
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.4 12.4 8 5 12.6Z" fill="currentColor"/></svg>';
    this._play.addEventListener('click', this._handlePlay);

    const wave = document.createElement('span');
    wave.className = 'chat__wave';
    wave.setAttribute('aria-hidden', 'true');
    // A fixed pattern rather than a real analysis: nothing here claims to be the sound, and
    // pretending otherwise would be a picture that lies.
    [3, 7, 12, 8, 15, 10, 6, 13, 9, 16, 11, 5, 14, 8, 4, 10, 7, 12, 6, 3].forEach((height) => {
      const bar = document.createElement('span');
      bar.style.setProperty('--bar', String(height));
      wave.append(bar);
    });

    this._elapsed = document.createElement('span');
    this._elapsed.className = 'chat__duration';

    this._player.append(this._play, wave, this._elapsed);
    audio.before(this._player);

    audio.addEventListener('loadedmetadata', this._handleAudioState);
    audio.addEventListener('timeupdate', this._handleAudioState);
    audio.addEventListener('play', this._handleAudioState);
    audio.addEventListener('pause', this._handleAudioState);
    audio.addEventListener('ended', this._handleAudioState);

    const transcript = this.querySelector('[data-transcript]');

    if (transcript) {
      transcript.classList.add('chat__transcript');
      transcript.id = transcript.id || uniqueId('chat-transcript');
      transcript.hidden = true;

      this._transcriptToggle = document.createElement('button');
      this._transcriptToggle.type = 'button';
      this._transcriptToggle.className = 'chat__transcript-toggle';
      this._transcriptToggle.textContent = labels.showTranscript;
      this._transcriptToggle.setAttribute('aria-expanded', 'false');
      this._transcriptToggle.setAttribute('aria-controls', transcript.id);
      this._transcriptToggle.addEventListener('click', this._handleTranscript);
      transcript.before(this._transcriptToggle);
    }

    this._handleAudioState();
  }

  _handleAudioState() {
    const audio = this.querySelector('audio');

    if (!audio || !this._player) {
      return;
    }

    const total = Number.isFinite(audio.duration) ? audio.duration : Number(this.getAttribute('duration'));
    const playing = !audio.paused && !audio.ended;

    this._player.toggleAttribute('data-playing', playing);
    this._player.style.setProperty(
      '--played',
      total > 0 ? String(Math.min(1, audio.currentTime / total)) : '0',
    );

    this._elapsed.textContent = formatDuration(playing || audio.currentTime > 0 ? audio.currentTime : total);
    this._play.setAttribute(
      'aria-label',
      playing
        ? `Pause. ${fillLabel(this.labels.voice, { duration: formatDuration(total) })}`
        : fillLabel(this.labels.voice, { duration: formatDuration(total) }),
    );
    this._play.toggleAttribute('data-playing', playing);
  }

  _handlePlay() {
    const audio = this.querySelector('audio');

    if (!audio) {
      return;
    }

    if (audio.paused) {
      // Two voice notes talking over each other is nobody's idea of a conversation.
      document.querySelectorAll('ui-chat-message audio').forEach((other) => {
        if (other !== audio) {
          other.pause();
        }
      });
      audio.play().catch(() => this._handleAudioState());
    } else {
      audio.pause();
    }
  }

  _handleTranscript() {
    const transcript = this.querySelector('[data-transcript]');
    const open = transcript.hidden;

    transcript.hidden = !open;
    this._transcriptToggle.textContent = open
      ? this.labels.hideTranscript
      : this.labels.showTranscript;
    this._transcriptToggle.setAttribute('aria-expanded', String(open));
  }

  _renderFile(labels) {
    const file = this.querySelector('[data-file]');

    if (!file) {
      return;
    }

    file.classList.add('chat__file');

    const name = file.getAttribute('data-name') || file.textContent.trim();
    const size = formatSize(file.getAttribute('data-size'));

    if (!file.dataset.chatWired) {
      file.dataset.chatWired = 'true';
      file.replaceChildren();

      const icon = document.createElement('span');
      icon.className = 'chat__file-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML =
        '<svg viewBox="0 0 16 16"><path d="M4 1.6h5L12.4 5v9.4H4Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 1.6V5h3.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';

      const label = document.createElement('span');
      label.className = 'chat__file-name';
      label.textContent = name;

      const meta = document.createElement('span');
      meta.className = 'chat__file-size';
      meta.textContent = size;

      const stack = document.createElement('span');
      stack.className = 'chat__file-stack';
      stack.append(label, meta);
      file.append(icon, stack);
    }

    file.setAttribute('aria-label', fillLabel(labels.download, { name }));
  }

  /**
   * The time and the delivery state, on the last message of a run.
   *
   * Both on every bubble is noise: a run of four messages needs one timestamp, not four. A
   * failure is the exception and always shows, because it is the one state that needs an
   * answer rather than an acknowledgement.
   */
  _renderFooter(labels) {
    const labelFor = {
      sending: labels.sending,
      sent: labels.sent,
      delivered: labels.delivered,
      read: labels.read,
      failed: labels.failed,
    };

    this._footer.replaceChildren();

    const printed = formatTime(this.time, { locale: this.locale, hour12: this.hour12 });

    if (printed) {
      const stamp = document.createElement('time');
      stamp.className = 'chat__time';
      stamp.dateTime = this.time;
      stamp.textContent = printed;
      // Already said in the intro; reading it twice makes every message a stutter.
      stamp.setAttribute('aria-hidden', 'true');
      this._footer.append(stamp);
    }

    if (this.hasAttribute('edited')) {
      const edited = document.createElement('span');
      edited.className = 'chat__edited';
      edited.textContent = labels.edited;
      this._footer.append(edited);
    }

    const status = this.status;

    if (status) {
      const mark = document.createElement('span');
      mark.className = 'chat__status';
      mark.dataset.status = status;
      // A glyph and a word. Two grey ticks against two blue ticks differ by colour alone,
      // which is exactly what a delivery state must not do.
      mark.innerHTML = TICK[status] ?? '';

      const word = document.createElement('span');
      word.className = 'chat__status-word';
      word.textContent = labelFor[status];
      mark.append(word);

      this._footer.append(mark);
    }

    if (status === 'failed') {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'chat__retry';
      retry.textContent = labels.retry;
      retry.addEventListener('click', this._handleRetry);
      this._footer.append(retry);
    }

    this._footer.hidden = this._footer.childElementCount === 0;
  }

  _handleRetry() {
    this.dispatchEvent(
      new CustomEvent('chat-retry', {
        detail: { id: this.id, direction: this.direction },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Follows a quotation back to what it quoted.
   *
   * Moving focus as well as the scroll position, because a link that only scrolls leaves
   * anybody driving by keyboard exactly where they were.
   */
  _handleQuoteClick(event) {
    const target = document.getElementById(this.getAttribute('reply-to'));

    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ block: 'center', behavior: this._reducedMotion() ? 'auto' : 'smooth' });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.toggleAttribute('data-highlight', true);
    setTimeout(() => target.removeAttribute('data-highlight'), 1600);
  }

  _reducedMotion() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---- Runs, which the message works out for itself -------------------------------------- */

  _shape() {
    return { direction: this.direction, author: this.author, time: this.time, type: this.type };
  }

  /**
   * Where this message sits in a run of messages from the same person.
   *
   * Worked out from the neighbours rather than declared, because a run is a property of the
   * thread and not of any one message — and asking an author to keep `first`/`last` attributes
   * in step as messages arrive is asking for them to be wrong.
   */
  _syncRun({ neighbours = false } = {}) {
    const thread = this.closest('[role="log"], .chat-thread') ?? this.parentElement?.parentElement;
    const all = thread ? [...thread.querySelectorAll('ui-chat-message')] : [this];
    const at = all.indexOf(this);
    const previous = at > 0 ? all[at - 1] : null;
    const next = at >= 0 && at < all.length - 1 ? all[at + 1] : null;

    const startsRun = !previous || !sameRun(previous._shape?.(), this._shape());
    const endsRun = !next || !sameRun(this._shape(), next._shape?.());

    this.toggleAttribute('data-run-start', startsRun);
    this.toggleAttribute('data-run-end', endsRun);

    // The name and the avatar belong to the top of a run; the time and the receipt to the
    // bottom of it. Neither is hidden from a screen reader by this, because both are already
    // in the intro said in front of every message.
    this._name.hidden = !startsRun || this.direction === 'me' || !this.author;
    this._avatar.hidden = !startsRun;
    this._footer.hidden =
      this._footer.childElementCount === 0 || (!endsRun && this.status !== 'failed');

    if (neighbours) {
      previous?._syncRun?.();
      next?._syncRun?.();
    }
  }
}

if (!customElements.get('ui-chat-message')) {
  customElements.define('ui-chat-message', UiChatMessage);
}
