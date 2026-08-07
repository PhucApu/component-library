# Sortable List

A framework-free Web Component that lets a reader put rows in the order they want — in a list or
in a table, with a pointer or with a keyboard.

No React, no TypeScript, no Tailwind runtime, no drag-and-drop library, no build step, no network.

## Why not the HTML5 drag-and-drop API

| The API offers | What it actually does |
|---|---|
| `dragstart` / `dragover` / `drop` | **Does not fire on touch** in most mobile browsers — on a phone the feature is simply absent |
| A drop target | Only after `preventDefault()` on `dragover` |
| A drag image | A browser-rendered bitmap you can barely style |
| `dataTransfer` | Built to move data **between applications**, not to reorder a list |

Pointer events give one code path for mouse, touch and pen.

## The keyboard is not an extra

Tab to a handle. Nothing here needs a pointer.

| Key | Does |
|---|---|
| `Space` / `Enter` | Picks the row up, and puts it down |
| `↑` `↓` | Moves it one place |
| `Home` `End` | To the ends of what it can reach |
| `Escape` | Cancels **and puts the row back** |

Every step is announced through a `role="status"` region — the pick-up with its position, each
move, the drop, the cancel, and any refusal.

Focus stays on the handle that moved. That takes an explicit restore: re-inserting a node removes
it first, and removing the focused element blurs it, so being the *same* node is not enough.

## The markup

```html
<ui-sortable-list>
  <ol>
    <li>Review pull requests</li>
    <li data-locked>Deploy to production</li>
  </ol>
</ui-sortable-list>
```

An ordinary `<ol>`, `<ul>`, or a `<table>` with a `<tbody>`. With scripting off it is still a
readable, correctly numbered list — reordering is the enhancement, not the content.

| Attribute on a row | Does |
|---|---|
| `data-locked` | Makes the row a wall |
| `data-sortable-name` | Names it for the announcement when its text reads badly out loud |
| `data-sortable-handle` | Puts the handle where you want it instead of where the component would |

## A locked row is a wall

Not merely a row you cannot pick up. Rows reorder freely on either side of it and never across
it — which is what "this one stays first" means. Treating it as only unpickable lets everything
else slide underneath and changes its position anyway.

A refused move names what stopped it: *"In progress cannot move past Triage."* Running out of
list at the top says nothing, because nothing stopped you there.

The lock is a **glyph, not a colour**. In dark mode no tint cleared its contrast floor against the
neighbouring row without going darker than the page behind it.

## Saving the new order

```js
list.commit = async ({ from, to, order }) => {
  const response = await fetch('/api/order', {
    method: 'PUT',
    body: JSON.stringify(order),
  });

  if (!response.ok) {
    throw new Error('refused');   // the list goes back
  }
};
```

The row lands where it was dropped and the request goes out afterwards, because a reorder has to
feel instant. While it is in flight the list holds at reduced opacity and the handles are
disabled. On rejection the previous order is restored and the reason announced.

Each request carries a token, so a slow failure cannot roll back a change the reader has since
replaced.

## In a table

The only difference is where the component looks for the container. Two costs:

- **The handle goes inside the first cell.** A component cannot invent a table column — a new
  `<td>` would leave the header one heading short.
- **`border-collapse: separate`.** A row cannot carry a shadow while the table collapses its
  borders, and the shadow is what says the row is in your hand.

## Rows of different heights

A row travels the **neighbour's** height plus the gap, never its own. With one height any formula
looks right; with a real table the wrong one commits a place early. Measured: a `47px` row passing
a `59px` row swaps at `30px`, not at `23px`.

## Attributes, properties, methods

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `drag` | `handle` `row` | `handle` | Whether the whole row is draggable |
| `disabled` | present | absent | Disables every handle |
| `pending` | present | absent | Set while a commit is in flight |
| `error` | string | — | Says what went wrong; the rows stay |

| Member | Notes |
|---|---|
| `order` | The row names in their current order |
| `items` | The same rows with index, lock state and element |
| `commit` | An async function; reject it to refuse a reorder |
| `move(from, to)` | Moves a row; returns `false` if a wall refused it |
| `refresh()` | Re-read the rows after the page rewrites them |
| `labels` | Overrides every generated string |

| Event | Detail |
|---|---|
| `reorder` | `{ from, to, order, name }` |
| `reorder-failed` | `{ from, to, reason }` |

## Colour, measured

Against this component's own surfaces, on exact ratios:

| | Floor | Light | Dark |
|---|---|---|---|
| Row text vs row | `4.5` | `17.7397` | `15.0855` |
| Handle icon vs row | `3.0` | `3.7700` | `4.7480` |
| Grabbed row vs its neighbour | `1.2` | `1.2613` | `1.2850` |
| Grabbed outline on it | `3.0` | `3.5007` | `3.4905` |

## Reduced motion

`prefers-reduced-motion: reduce` removes the travel between the two positions. The reorder still
happens — removing the motion must never remove the function.

## Not included

**Moving rows between two lists.** It needs two live regions, a keyboard model that crosses
lists, and a drop affordance for an empty one. Adding it here would do both jobs badly.

## Browser support

Current Chrome, Edge, Firefox, and Safari. Uses custom elements, pointer events, `light-dark()`,
`color-mix()`, and CSS grid.

## Files

| Path | Contents |
|---|---|
| `sortable-list.html` | Runnable example |
| `sortable-list.css` | Every style, including the measured palette |
| `sortable-list.js` | The arithmetic, the custom element, and the demo bootstrap |
