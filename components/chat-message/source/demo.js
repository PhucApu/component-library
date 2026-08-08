/**
 * Wires the demo output and the buttons the variants put beside the thread.
 */
export function initializeChatMessageDemo() {
  const output = document.querySelector('output');
  let note = 'Read the thread, or tab through it.';

  document.querySelectorAll('[data-demo-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.demoTarget
        ? document.getElementById(button.dataset.demoTarget)
        : document.querySelector('ui-chat-message');

      if (!target) {
        return;
      }

      const actions = {
        loading: () => {
          target.toggleAttribute('loading');
          button.toggleAttribute('data-current', target.hasAttribute('loading'));
          note = target.hasAttribute('loading')
            ? 'Holding the box open at the picture\'s own shape.'
            : 'The picture arrived into exactly the space that was waiting for it.';
        },
        // Points the picture at something that is not there, so the failure is the real one
        // rather than a state somebody typed in.
        break: () => {
          const image = target.querySelector('img');
          const original = image.dataset.demoSrc || image.getAttribute('src');
          image.dataset.demoSrc = original;
          const broken = image.getAttribute('src').includes('missing');
          target.removeAttribute('loading');
          image.setAttribute('src', broken ? original : './does-not-exist.svg');
          button.toggleAttribute('data-current', !broken);
          note = broken ? 'Restored.' : 'The picture could not be loaded.';
        },
        status: () => {
          target.setAttribute('status', button.dataset.demoStatus ?? 'sent');
          mark(button, 'status');
          note = `Status is now "${target.getAttribute('status')}".`;
        },
      };

      actions[button.dataset.demoAction]?.();
      report();
    });
  });

  function mark(pressed, group) {
    document
      .querySelectorAll(`[data-demo-action="${group}"]`)
      .forEach((other) => other.toggleAttribute('data-current', other === pressed));
  }

  document.addEventListener('chat-retry', (event) => {
    const message = document.getElementById(event.detail.id);
    note = 'Retrying…';
    report();

    message.setAttribute('status', 'sending');
    setTimeout(() => {
      message.setAttribute('status', 'delivered');
      note = 'Sent on the second attempt.';
      report();
    }, 1200);
  });

  function report() {
    if (!output) {
      return;
    }

    const messages = [...document.querySelectorAll('ui-chat-message')];
    const runs = messages.filter((message) => message.hasAttribute('data-run-start')).length;

    output.textContent = [
      note,
      `${messages.length} messages in ${runs} runs`,
      `speakers: ${[...new Set(messages.map((message) => message.speaker))].join(', ')}`,
    ].join('\n');
  }

  // The run marks are worked out a microtask after the thread is parsed.
  queueMicrotask(report);
}
