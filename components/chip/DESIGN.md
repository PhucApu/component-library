# Chip - Design Specification

## 1. Purpose

Present a compact token: a label, a removable entry, an action, a link, or a filter toggle. The
component owns the shell and the states; the author owns the semantics.

## 2. The central decision: a chip is a shape, not a control

Five things share this shape and behave differently:

| Use | Element |
|---|---|
| Presents information | `span` |
| Runs an action | `button` |
| Goes somewhere | `a` |
| Toggles a filter | `button` with `aria-pressed` |
| A token you can remove | `span` plus a sibling remove `button` |

Collapsing those into one element switched by attributes is how a chip ends up announced as the
wrong thing. So the author writes the element and this component never rewrites it: it adds the
shell, the remove button, the states, and the events.

**A button is never nested inside a button or a link.** That is invalid markup and assistive
technology treats it unpredictably. A chip that both acts and removes is therefore two adjacent
controls inside one pill, with two tab stops.

## 3. Group

`data-display`. By the catalog taxonomy the question is what a component produces, not what it
renders, and the tie-breaker between `inputs` and `data-display` is whether it owns a value and
announces changes to it. A chip presents a token; it holds no value of its own. The filter chip
reports a toggle, which is behavior on top of a token rather than the component's identity.

## 4. Visual tokens

Every token is defined by the component. Nothing is inherited from the catalog.

Each intent supplies a surface, a text colour, and a border, and the generic slots point at the
active intent:

| Token group | Members |
|---|---|
| Per intent | `--chip-{neutral,accent,success,warning,danger}-{surface,text,border}` |
| Active slots | `--chip-surface`, `--chip-text`, `--chip-border` |
| Other | `--chip-focus`, `--chip-radius` |

Surfaces are soft tints carrying strong text rather than saturated fills. A solid warning fill
with white text is the usual way a chip fails contrast at this text size, so the palette avoids
that shape entirely.

## 5. Anatomy

1. The host, which draws the pill: border, background, radius.
2. The author's control, styled through `.chip__control` so a span, a button, and an anchor look
   identical while each keeps its own behavior.
3. Optional adornments as light-DOM children: an avatar, a leading icon, a trailing count.
4. The remove button, appended by the component as a sibling of the control.

## 6. Interaction

- The remove button and Backspace or Delete both report `chip-remove`. The chip never removes
  itself: whether the token disappears is the consumer's decision.
- Backspace and Delete only act while focus is inside the chip, so the keys still edit text
  elsewhere on the page.
- A control carrying `aria-pressed` toggles `selected` and reports `chip-toggle`.
- A disabled chip blocks activation before it reaches the author's element.

## 7. States

Resting, hover, focus, selected, disabled, and the removable shell.

- Selection shows a check as well as a surface change.
- Disabled shows dimming plus a blocked cursor.
- Neither state relies on colour alone.
- Focus rings sit on the interactive elements themselves, so there is exactly one indicator.

## 8. Disabling a link

`disabled` is not an attribute on `<a>`; the browser ignores it. A disabled link chip therefore
has its `href` removed, which also drops it from the tab order, gains `aria-disabled`, and has
activation blocked. The original `href` is stored and restored when the chip is enabled.

This is the same class of trap as `readonly` on a radio input: an attribute that looks like it
works and silently does not.

## 9. Responsive behavior and motion

- The chip is inline-flex and sits on a text baseline, so rows of chips wrap naturally.
- Labels stay on one line; a chip is not a paragraph.
- Transitions cover background at `140ms`; `prefers-reduced-motion: reduce` removes them.

## 10. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Removable variant with a row of
status chips beneath. It is self-contained with no animation, script, external asset, or embedded
raster image.

## 11. Acceptance criteria

- All six variants run independently in an iframe with no external request.
- No interactive element is nested inside another anywhere in the rendered output.
- A static chip is not reachable by Tab.
- A disabled link chip does not navigate.
- Every intent meets `4.5:1` for its label against its surface, in both appearances and both
  themes.
- Removing reports the chip's own label rather than a generic name.
