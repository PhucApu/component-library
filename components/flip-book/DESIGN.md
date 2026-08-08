# Flip Book - Design Specification

## 1. Purpose

A set of pages shown as an object with a thickness rather than as a sequence: a stack you
can take hold of and turn. What is on offer is the turn itself — remove it and this is a
list of pictures — which is why it is an animation, and why it sits in `transitions` rather
than beside the carousels.

## 2. One number describes the book

How many leaves have been turned is the whole state. Which pages are readable, where each
leaf sits in its pile, whether an arrow has anywhere to go: all of it is worked out from
that number and, while a leaf is in the air, from its angle.

A leaf caught half way through a turn is therefore still a book with a definite state rather
than an animation with a value inside it. That is what lets a drag be released at any angle
and carried on from there.

## 3. A leaf carries two pages

Pages are paired into leaves: front and back, as a sheet of paper is. This is the whole
reason a turn leaves something behind on the left instead of swapping one picture for
another, and it is what makes the arithmetic of the book non-obvious in a useful way — eight
pages are four leaves, and turning the second one takes the reader from pages 2 and 3 to
pages 4 and 5.

An odd page count ends on a blank back. Dropping the last leaf instead would take the page in
front of it with it.

## 4. The book opens closed

A leaf turns about its left edge, so a turned leaf lands to the left of the spine. The
spread is therefore two pages wide, and at the start the whole stack is on the right with
nothing on the left: a closed book, opening as it is read, and ending with everything on the
left.

This is a consequence rather than a decoration, and it is the reason the component is not a
single page wide. A one-page-wide stage with double-sided leaves would either hide the back
of every leaf as it swung out of frame — losing half the pages — or need the turned pile
drawn somewhere it does not belong.

Below `34rem` there is no room for the second page, so the spine moves to the edge of the
stage: one page fills it, and a turning leaf sweeps off the side and is clipped there.

## 5. Two piles, and one leaf above both

The unturned pile is highest at the top of the book; the turned pile is highest at the end of
what has been read. Each leaf is also offset a little from the one below, which is the whole
of the thickness at the edge — and only the top few are drawn, because past that there is
nothing to see and something to pay for.

The two ranges of stacking order are kept apart rather than allowed to meet. A leaf in the
air is above both of them, and anything it can tie with is something it can pass through.

## 6. The turn is driven frame by frame, not by a transition

A leaf let go half way must carry on from the angle it is at. A CSS transition only knows how
to go from one value to another, so it would restart the arc from wherever the browser
believed it was — visibly, at the moment the hand lets go.

So the arc is a `requestAnimationFrame` loop with an ease at both ends, and the time it takes
is `duration` scaled by the distance actually left to travel. The loop runs only while a leaf
is moving; a book at rest asks for no frames.

## 7. Two things commit a turn

Past half way, or still moving quickly when released. Distance alone would throw away the
short flick that is how most people turn a page, and speed alone would commit a slow drag
that was clearly being reconsidered.

Which leaf a drag takes follows the direction the hand moved rather than where it landed:
pulling left takes the top of the unturned pile, pulling right takes the top of the turned
one. A press that becomes a drag also drops the click that would have followed, so dragging
across a link on a page does not follow the link.

## 8. An end is a real end

Forwards means a page the reader has not reached yet, not merely a leaf that could be
lifted. A book of one page has a leaf with a blank back, so turning it would be a page turn
that showed nothing: the forward arrow is disabled instead. Both arrows carry that state
rather than sitting there doing nothing when pressed.

## 9. What the status region says, and when

A polite region reports the spread — `Pages 2 and 3 of 8` — once a turn has landed, and says
nothing during it. Reporting mid-turn would announce a page the reader cannot read yet, and
announcing on load would talk over a page nobody has touched.

## 10. Visual tokens

| Token | Role |
|---|---|
| `--flip-paper` | The page surface |
| `--flip-empty` | The half the book has not reached yet — an inside cover, not a hole |
| `--flip-border` / `--flip-spine` / `--flip-shadow` | The edge of a page, the fold, and the leaf in the air |
| `--flip-focus` | Focus ring on the stage and the arrows |
| `--flip-page-width` / `--flip-page-height` | The size of one page |
| `--flip-radius` / `--flip-perspective` | Corner and how strongly the turn reads as 3D |

### Choosing a theme

Every pair resolves through `light-dark()`, so the component follows the operating system
without a script. An embedding page posts `{ type: 'ui-theme', theme }` and the demo narrows
`color-scheme` to that keyword. The message carries no token and no stylesheet, so answering
it adds no dependency on the host. The plates do not change with the theme: a picture is a
picture in both.

## 11. Motion

A turn takes 520ms by default, eased at both ends — slow to leave, slow to land, quick in
between, which is what a page under a hand does. The only other motion is the shading on the
leaf, strongest where it stands upright and gone at either end; it is the only cue that the
leaf has a face turned away from the light.

`prefers-reduced-motion: reduce` makes a turn arrive without travelling. Dragging still
works, because it is a movement the reader is making rather than one happening at them, and
it lands the moment it is let go.

## 12. Variants

| Variant | Shows |
|---|---|
| `default` | Eight pages, four leaves, by hand and by arrow |
| `content` | Pages of words with a working link, and an odd count ending on a blank |
| `drag` | What commits a turn, what falls back, and `no-drag` |
| `pace` | A twelve-page thickness, and turns from 220ms to 1200ms |
| `states` | One page, two pages, a page that never arrived, reduced motion |

## 13. Distribution preview

The packaged demo is the `default` variant: it is the only one that shows the stack, a turn
by hand, and the arrows together.

## 14. Acceptance criteria

- The book opens closed, with the stack and its edge thickness on the right.
- A drag turns a leaf, follows the pointer, and commits past half way or on a flick.
- A short slow drag falls back and the page does not change.
- The arrows turn one leaf and are disabled at each end.
- Three tab stops; arrows, Home and End work from the keyboard.
- The status region reports the spread after a turn, not during it.
- A page carrying a link keeps it, and a drag across it does not follow it.
- Reduced motion turns without travelling.
- No horizontal page overflow from 320px, and no external requests.
