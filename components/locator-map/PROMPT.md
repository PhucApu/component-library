# Recreate Locator Map

You are a Senior Frontend Engineer. Build a Web Component named `<ui-locator-map>` using
plain HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI
framework, a backend, or a new dependency.

## The central instruction

**The map is not part of the component.** The element owns the search, the ranking, the
directory, the announcements and the decision to go somewhere; the surface that moves is an
**adapter** it is handed. Seven members, plus two optional ones for the popup:

```js
{ mount, update, flyTo, reset, zoomBy, get view, destroy }
{ showPopup, hidePopup }   // optional; without them there is simply no popup
```

Ship **three** adapters:

| Adapter | Fetches |
|---|---|
| Leaflet, over OpenStreetMap tiles | Its script and stylesheet, plus tiles. No key |
| Google, over the Maps JavaScript API | Its script, with a key the consumer supplies |
| A drawing of the country | **Nothing** |

Every variant must show a **real provider's** map. A page in a catalog that shows a drawing
where it promises a map has not answered the question. The drawing is not what the catalog
shows; it is what the catalog falls back to.

That split is the whole design. Building the map into the element is the obvious first
version and it is the one that has to be taken apart the moment somebody wants Google Maps.

**The projection must be real** wherever the markers are drawn: Web Mercator, the same one
every tile provider uses, so a place is in the same spot whichever surface is behind it. The
drawing is decoration; the arithmetic is not.

Say plainly what the component is and is not: a locator map, not a geocoder. It searches the
list the author wrote and nothing else.

Two decisions keep the seam honest:

- **The frame belongs to the element.** It carries the tab stop, the size and the clipping, so
  swapping the surface inside it disturbs none of them.
- **`view` is passed through and never read into.** One adapter reports fractions of a frame,
  another a centre and a zoom level; the component has no business understanding either.

## Reaching the network, and paying for it out loud

This is the one component allowed to make an external request, so the exemption has to be
narrow and the cost has to be written down:

- **Name the origins.** Export an `ALLOWED_ORIGINS` list and make a test fail on anything
  else. Narrow the no-request rule; do not delete it.
- **Say what it costs** in the documentation: the download needs a connection, the preview
  build and the test suite depend on a third party, and OpenStreetMap's servers are donated
  and are not for building a product on.
- **Do not commit a key.** Leave `GOOGLE_API_KEY` empty and refuse to load Google without one,
  rather than sending a request that will be rejected. A key in a repository is a key
  published.
- **Choosing a provider is one line.** `MAP_PROVIDER` decides, defaulting to the one that
  needs no key.
- **Share one request per URL.** A page with three maps on it must not fetch the provider
  three times — and an element that arrives second must not end up waiting on a `load` event
  that already fired, or on one that never will because the first request failed.

Note in the documentation, for anyone reaching for Google: **only the Maps JavaScript API can
be flown.** The Embed API and the share-and-embed iframe are cross-origin — nothing can be
called on them, and changing the `src` reloads the frame rather than moving it.

## Failing without losing anything

Mount the drawing when the element connects, *before* anything is fetched. Then a provider
that cannot be reached is not a failure path at all: nothing is torn down, the markers and the
search go on working, and the element only gains an attribute so the page can say what
happened. A map that shows an empty grey box when a third party is down has traded away the
only thing it could have guaranteed.

**Mark the element either way** — `data-map-provider` on success, `data-map-unavailable` on
failure. Marking only the failure looks equivalent and is not: removing an attribute that was
never there produces no mutation record, so nothing watching ever learns that the map arrived,
and a status line written before the fetch describes the wrong surface for ever.

## Wearing the page's clothes, not the provider's

A provider's map arrives with its own look and its own stacking, and both fight the page it is
dropped into. Three fixes, all scoped to the frame — which also makes them outrank a stylesheet
appended at run time:

- **Make the frame a stacking context** (`isolation: isolate`). Positioning it is not enough:
  Leaflet stacks its controls at `z-index: 1000`, and with nothing containing them that number
  competes against the search above the map. The open results list ends up painted **behind
  the map's own zoom buttons**, which is a bug nobody finds by reading the CSS.
- **Darken the tiles for a dark page** by inverting the tile *pane* and turning the hue back
  through half a circle. On the pane rather than each tile, or every seam between two tiles
  shows as a line where the filter composites twice.
- **Give the provider your own pin**, through a `divIcon` rather than its default image. It
  matches the built-in surface exactly, it marks the chosen place the same way, and it fetches
  neither an icon nor a shadow.

Restyle the attribution; do not hide it. It is a licence condition.

## Demo data on a real map has to be real

Coordinates that were fine behind a drawing are indefensible behind a street map. Do not pair
a **city centroid** with a **street address** — geocode the street, against the same data the
tiles are drawn from, so the pin lands where the address says. One office in the first version
sat eight kilometres from the street it named, and the first person to zoom in saw it.

Name the ward the coordinate is actually in. An address naming a ward the map disagrees with
reads as a wrong pin even when the pin is right. And set `focus-zoom` close enough that the
street name is on screen: correct data that lands too far out to read is correct data nobody
can check.

## A card over the chosen office

Choosing an office opens a card on its pin: the name, the address, a link out to Google Maps
and a close button. It closes on that button, on <kbd>Escape</kbd>, and when the whole extent
is asked for again — and closing it leaves the office chosen and the map where the flight left
it. A card is a card, not the selection.

**The component cannot place it.** It knows a latitude and a longitude; turning those into
pixels is the whole job it handed away. Do not anchor the card at the middle of the frame
because the flight centres the place — true until somebody drags the map — and do not go
looking for the marker element, because a provider drawing to a canvas has none and reaching
in is what the seam exists to prevent. **Build the node and ask the adapter to anchor it**:
`showPopup(place, node)`. Every word inside belongs to the component; the adapter is asked
where, never what.

Make both members optional, and the payoff is real: a library popup stays glued to its
coordinate through a flight, a drag and a zoom for nothing, so no part of this has to track
anything.

Keep **wanting** a card and **having** one as two separate pieces of state, or swapping to a
surface that cannot hold one and back again silently loses it.

Link to `maps/search/?api=1&query=lat,lon`, not `maps/dir/`. "View on Google Maps" and "how do
I get there" are different questions.

Stop <kbd>Escape</kbd> at the card. A locator inside a dialog is the ordinary case, and one
press should dismiss one thing.

## Directions cost nothing, so include them

Give every place a link to `google.com/maps/dir/?api=1&destination={lat},{lon}`. A link is not
a request; it is an offer of one, taken up only when somebody presses it. So the useful half
of a map provider costs nothing at all, and the links stay on a page whose map never arrived.

**Name each link for its place.** Nine links called "Directions" are nine links nobody can
tell apart, which is exactly how a screen reader lists them. Give a place with unusable
coordinates no link rather than one to the middle of the ocean.

## Group the directory

Gather the places of one region together wherever they were written, keep groups in the order
their region first appeared, and keep places in the order they were written inside their
group. A directory that reshuffles itself between renders is one nobody can scan. Show a count
per group.

Put the heading **one level above whatever the places use**, inferred from the first one
rather than fixed: the author chose the level their places sit at.

The heading rows are list items, so **exclude them when reading the places back**. Miss that
and every re-read after the first render counts them as places — extra entries with no
coordinates, and markers that never appear.

## The markup is the data and the fallback

```html
<ui-locator-map>
  <ul class="locator-map__places">
    <li data-lat="21.0235" data-lon="105.8573" data-region="north">
      <h3>Hanoi head office</h3>
      <p>72 Le Thanh Tong, Cua Nam</p>
    </li>
  </ul>
</ui-locator-map>
```

Read it, keep it, and turn each name into a button. **Do not hide it and do not rewrite it.**
With no script that leaves a complete directory of addresses, which for a page of offices is
most of what anyone wanted. A map component whose fallback is an empty grey box has failed the
person it was hardest to serve.

## Variants

Build seven, each teaching one thing.

- **Default**: offices, a search, and the flight.
- **Search**: ranking, marking, the keyboard, the empty answer.
- **Detail**: the chosen office written out, and the way back.
- **Regions**: narrowing markers, directory and search together.
- **Controls**: zoom, drag, keyboard, and markers that keep their size.
- **States**: one office, none at all, and the search taken off.
- **Adapter**: three surfaces behind one search — the real provider it starts on, a plain grid
  written in the page, and the drawing — swapped live, with the choice and the typed query
  surviving each swap. Make the grid plain on purpose: what is on show is the seam, not
  artwork. Three rather than two is the proof — if the contract had leaked, only one of them
  could exist.

## Trace the outline from the projection

Do **not** draw the country by eye. Run real coordinates through the same `project` the
markers use, at several latitudes, and join the results. Drawn by hand the first time, this
left three offices standing in the sea, because the real country reaches further east in the
centre and further west in the delta than a sketch suggests.

## Three geometry traps

- **Latitude is not evenly spaced.** A degree of longitude is the same width everywhere; a
  degree of latitude is not. Spacing markers evenly would put every one of them in the wrong
  place, worse the further from the equator.
- **Size the frame by its height** and let the width follow the drawing's proportions.
  `aspect-ratio` with a full width and a capped height is three rules fighting: the width
  wins, the cap crops, and the country is stretched into something else.
- **The markers must not grow.** Counter-scale each pin by exactly the map's scale, and give
  the coastline `vector-effect: non-scaling-stroke`. Measured without it: a pin went from
  `19px` to `135px` and swallowed the place it was pointing at.

## Move the map with one transform

Transform a single box and let the browser ease it. Animating the SVG `viewBox` means driving
every frame from a script, for the same movement and a harder time honouring
`prefers-reduced-motion`.

Hold the view as three numbers in **fractions of the frame**, so the same view means the same
thing at any size and nothing is recomputed on resize.

**Clamp it.** Scaled by `k` the map spans `k` frames, so its edge may sit between `1 - k` and
`0` and no further; at life size or smaller, centre it instead. Without the clamp a hard drag
put the edge eleven frames away, showing sea where the country was.

Make the flight proportional to how far the view travels, floored and capped, and count a
change of zoom as distance — zooming in on the spot is a journey even though nothing moved
sideways. `prefers-reduced-motion: reduce` **removes** it rather than slowing it: slowing a
movement is answering a different request. Pass `reduced` to every adapter, so a provider's
own flight is turned off too.

**Clamp the requested zoom before working out the offsets, not after.** `focus-zoom` is
whatever the page asked for, and a page driving a real provider asks for a tile zoom level —
`14`, say — that a drawing's scale stops at `8`. Computing the offsets at one scale and then
reducing the other leaves the two halves of the view disagreeing about how big the map is.
Measured, that put the office `239px` off centre on a `595px` frame.

## The search folds both sides

Somebody looking for an office in Da Nang types `da nang`, and every letter of that is
different from the letters on the page.

Unicode normalisation separates a combining mark from its letter, which handles every tone and
vowel mark. It does **nothing** for a stroke drawn through the glyph — `d with stroke` is one
letter rather than a letter with something added — so map that by hand.

Keep **two** functions. One folds character for character; the other adds trimming and the
collapsing of runs of spaces. Mark the match using the first, because trimming changes how
many characters there are and every offset after it points at the wrong letter. Guard that
assumption with a length check rather than trusting it.

Mark on the folded text and **cut from the original**, so a result found by typing `da nang`
is still shown written the way it is written.

Rank: a name that starts with the query, then one that contains it, then a match found only in
the address. Ties keep the order the places are written in.

## The rest

- A combobox: `role`, `aria-expanded`, `aria-activedescendant`, arrow keys, `Enter`,
  `Escape`. Choose on `mousedown`, not `click` — waiting lets the blur close the list out from
  under the press.
- The map carries a tab stop; arrow keys pan, `+` and `-` zoom, `0` resets. Cancel them, or
  the frame scrolls the page as well as panning the map. Pan less the closer you are, so one
  press covers about the same amount of what you can see.
- **A map that can only be zoomed in is a trap**: make reset a control, a method and a key.
- Filtering by region must hide the filtered places from the **directory** as well as the map,
  and the search must only ever see what the map can show.
- Announce the chosen office through a `role="status"` region present and empty beforehand.
- Mark the chosen pin by size and a ring as well as by colour.
- Wrap `setPointerCapture`: it throws for a pointer id the browser does not know, and an
  exception there leaves the drag half started with no way back.
- Define every CSS custom property the component reads inside the component itself, including
  the ones the script writes.

## Verify before calling it done

Keep the rules that decide things — the projection, the view for a point, the clamp, the zoom
about a point, the flight length, the folding, the ranking, the highlight — reachable without a
browser.

Check these explicitly, because each is a place this component quietly goes wrong:

- **Every variant really shows the provider's map**, not the drawing standing in for it.
  Assert the adapter and the mounted surface, on every element on the page.
- **Nothing is requested outside `ALLOWED_ORIGINS`** — and assert that something *was*
  requested, or the check is a check of nothing.
- **Block the provider for the rest of the suite.** Most of what is worth measuring belongs to
  the component rather than the map, and it should be measured against a surface that behaves
  the same way every run and needs nobody else to be awake. Blocking it also exercises the
  fallback for free.
- Filter the console when you do: a blocked request logs `Failed to load resource` with the
  URL in the message's **location**, not its text, so a naive filter counts a third party's
  outage as the component's fault.
- **Three maps on one page get three surfaces from one script and one stylesheet.**
- **The open results list is in front of the provider's controls.** Ask the browser what is
  painted at the control's centre rather than reading a `z-index` and hoping — and assert that
  a control really is underneath, or the check proves nothing.
- **The pin the provider draws is your pin**, the chosen one is marked, and no marker image is
  ever requested.
- With scripting disabled, the directory is every address and no map or search is invented.
- Markers sit inside the drawing and lie south and east of one another as their coordinates
  say.
- Choosing a result lands the marker in the middle of the frame within a pixel or two.
- A pin is the same size at life size and at four times it. Measure a pin that is **not** the
  chosen one — the chosen one is drawn larger on purpose, and measuring it reports the
  selection style as a scaling fault.
- The map cannot be dragged off the frame. Use a **real pointer** for this: a dispatched
  `PointerEvent` carries no pointer id the browser knows, capture throws, the drag never
  starts, and the test passes because nothing moved.
- An unmarked query matches a marked name and the answer keeps its marks.
- Count search **options**, not rows: the "no office matches" line is a row too, and counting
  it reports a match that is not one.
- Reduced motion removes the flight, on the drawing and on the real map alike.
- A stub adapter written in the test receives **only** the seven members and the two optional
  popup ones, and `showPopup` is handed a node the component built. Anything else the
  component reaches for is a leak that makes a real provider harder to plug in than it looks.
- The card opens over the pin and clear of it, closes on its button and on Escape, and closing
  it leaves the office chosen and the map where the flight left it.
- Escape at the card does not reach a `document`-level listener. Add one in the test and count
  it, or the claim is untested.
- An adapter without `showPopup` loses the card and nothing else.
- Swapping one surface for another leaves one behind, not two, and the choice survives it.
- Every place has a directions link, every link is named differently, and **none of them
  fetches anything** — a link is an offer, not a request.
- The group headings sit a level above the places, above their own group, and are **not**
  counted as places when the list is read again.
