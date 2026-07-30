# Snackbar

A framework-free Web Component that reports what just happened: persistent live regions so
the message is actually announced, a queue so two messages never talk over each other, and
no time limit on a message you can act on.

No React, no TypeScript, no Tailwind runtime, no dependencies.

## How it differs from the rest

You do not write a snackbar into your markup. You place the host once and summon messages
from code:

```html
<ui-snackbar placement="bottom-center"></ui-snackbar>
```

```js
const snackbar = document.querySelector('ui-snackbar');

snackbar.show({ message: 'Draft saved', severity: 'success' });
```

## Options

| Option | Type | Default | Effect |
|---|---|---|---|
| `message` | string | required | The sentence. An empty one is ignored |
| `severity` | `info` `success` `warning` `error` | `info` | Icon, colour, and how loudly it is announced |
| `duration` | number | `5000` | Milliseconds. `0` means until dismissed |
| `action` | `{ label, onSelect }` | none | Adds a button — and removes the timer |

`show()` returns an id.

## Attributes, properties, events

| Member | Notes |
|---|---|
| `placement` | `top-start` `top-center` `top-end` `bottom-start` `bottom-center` `bottom-end` |
| `current` | The message on screen, or `null` |
| `pending` | How many are waiting |
| `labels` | Overrides `dismiss` and the announcement template |
| `show(options)` | Queues a message, returns its id |
| `dismiss(id)` | Closes one, on screen or still waiting |
| `clear()` | Drops everything |

| Event | Detail |
|---|---|
| `snackbar-show` | `{ id, message, severity }` |
| `snackbar-dismiss` | `{ id, reason, severity }` |

`reason` is one of `timeout`, `action`, `dismiss`, `clear`, or `preempted` — enough to tell
whether someone chose Undo or simply let it go.

## Actions have no time limit

```js
snackbar.show({
  message: 'Message moved to Trash',
  action: { label: 'Undo', onSelect: () => restore(id) },
});
```

This message stays until the person closes it. A button that expires on a clock cannot be
reached in time by someone reading the sentence first, and often cannot be reached by
keyboard at all.

Because it never expires, **offer the same action somewhere permanent as well**. The
snackbar is a shortcut, not the only route to undoing something.

## How long the rest stay

Five seconds by default. The clock stops while the pointer rests on the message, while
focus is inside it, and while the tab is in the background — then resumes with the time
that was left rather than starting over.

## Several at once

Messages queue and appear one at a time. Two announcements at once means neither is heard
in full.

An `error` or `warning` does not wait its turn: it goes to the front and displaces a calm
message already on screen, which is dismissed with the reason `preempted`. A calm message
never displaces an urgent one.

## Where it appears, and how it gets there

The six anchors are named by logical edge — `start` and `end` rather than left and right —
so they follow the writing direction. Each message arrives out of the edge it is pinned to:

| Anchor | Arrives from |
|---|---|
| `top-start`, `bottom-start` | The inline-start edge |
| `top-end`, `bottom-end` | The inline-end edge |
| `top-center` | Above |
| `bottom-center` | Below |

The sideways travel is signed by direction too, so in a right-to-left document `top-start`
comes from the right. Below `30rem` every anchor spans the full width.

## Announcements

Two visually hidden regions, `role="status"` and `role="alert"`, sit in the document from
the start. Severity decides which one speaks. You do not choose politeness separately —
that is one fewer way for the urgency and the announcement to disagree.

The message names its action so the person knows the button is there:

```js
snackbar.labels = { withAction: '{message} — press {action} to reverse it' };
```

## Keyboard

| Key | Action |
|---|---|
| `Tab` | Reaches the action and the dismiss button |
| `Escape` | Closes, **only** while focus is inside the message |

Escape is scoped on purpose. A global listener would close your dialogs and pickers too.

## Browser support

Current Chrome, Edge, Firefox, and Safari. Uses custom elements, `color-mix()`, and the
Popover API for the top layer. Without the Popover API the message still renders, animates,
and behaves the same; it simply sits on a high `z-index` instead of the top layer.

## Running the files

ES modules do not load over `file://`, so serve the folder over HTTP or HTTPS:

```bash
npx serve .
```

## Files

| Path | Contents |
|---|---|
| `snackbar.html` | Runnable example |
| `snackbar.css` | Every style |
| `snackbar.js` | Rules, the custom element, and the demo bootstrap |
