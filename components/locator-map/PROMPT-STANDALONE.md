# Recreate Locator Map as three files

You are a Senior Frontend Engineer. Build a Web Component named `<ui-locator-map>` using
plain HTML, CSS, and JavaScript. Do not use React, TypeScript, a Tailwind runtime, a UI
framework, a backend, or a new dependency.

This prompt targets the distributable form: three files and a drawing that a consumer drops
into a project. It is self-contained and assumes no repository, build step, manifest, or test
harness.

## The central instruction

**The map is not part of the component.** The element owns the search, the ranking, the
directory and the decision to go somewhere; the surface that moves is an **adapter** it is
handed — `mount`, `update`, `flyTo`, `reset`, `zoomBy`, `view`, `destroy`, and nothing else.

Ship **three** adapters and default to a real one: Leaflet over OpenStreetMap tiles, Google
over the Maps JavaScript API, and a drawing of the country that fetches nothing. Make the
choice one line — `MAP_PROVIDER` — defaulting to Leaflet, which needs no key and no billing
and has a flight of its own. Note that **only the Maps JavaScript API can be flown**; the
Embed API and the share-and-embed iframe are cross-origin and can only be reloaded, not moved.

**Mount the drawing before anything is fetched.** Then a provider that cannot be reached is
not a failure path: nothing is torn down, the search and the directory go on working, and the
element only gains an attribute so the page can say what happened. An empty grey box when a
third party is down trades away the only thing the component could guarantee.

Mark it **either way** — `data-map-provider` on success, `data-map-unavailable` on failure.
Marking only the failure looks equivalent and is not: removing an attribute that was never
there produces no mutation record, so nothing watching ever learns the map arrived.

**Do not commit an API key.** Leave `GOOGLE_API_KEY` empty and refuse to load Google without
one rather than sending a request that will be rejected. Say in the README that the download
now needs a connection, and that OpenStreetMap's tile servers are donated and are not for
building a product on.

Give every place a **directions link** to `google.com/maps/dir/?api=1&destination={lat},{lon}`,
named for its place. A link is not a request until it is pressed, so the useful half of a map
provider costs nothing — and stays useful on a page whose map never arrived.

**Group the directory** by region with a count, heading one level above the places' own
headings. The heading rows are list items — exclude them when reading the places back, or
every re-read counts them as places.

**Place the markers with real Web Mercator** wherever they are drawn, so a place is in the
same spot whichever surface is behind it. The drawing is decoration; the arithmetic is not.

## Output

Produce exactly these, flat apart from the drawing:

```text
locator-map.html
locator-map.css
locator-map.js
README.md
assets/
```

- `locator-map.js` is one ES module holding the DOM-free rules, the custom element, all three
  adapters, and the demo bootstrap. It defines the element only when it is not already
  registered.
- `locator-map.css` holds every style, driven by component-owned CSS custom properties.
- `locator-map.html` is a runnable example with a searchable map of several offices.
- `assets/` holds the outline as a file so it can be looked at on its own; the component
  inlines its own copy rather than fetching it.
- `README.md` documents the markup contract, the attribute table, the search, the keyboard,
  **what it costs to load a real map**, and **what this is not** — not a geocoder; it searches
  the list the author wrote and nothing else.

Use `lang="en"`. ES modules do not load from `file://`, so state in the README that the page
must be served over HTTP or HTTPS, while noting the directory would still be readable.

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

Read it, keep it, turn each name into a button. Do not hide it. With no script that leaves a
complete directory of addresses — a map component whose fallback is an empty grey box has
failed the person it was hardest to serve.

## Public API

Support `zoom`, `min-zoom`, `max-zoom`, `focus-zoom`, `region`, `no-search` and `no-popup` as
attributes. Expose `places`, `visible`, `selected`, `view`, `labels` and **`adapter`**, plus
`flyTo()`, `reset()`, `zoomIn()` and `zoomOut()`. Emit `locator-select` and
`locator-view-change`.

`adapter` is settable at any time: setting it again tears the old surface down and mounts the
new one in the same frame, which is what lets a page start with the drawing and hand over once
a provider's script has loaded. The frame belongs to the element — it carries the tab stop,
the size and the clipping — and `view` is passed through without being read into.

## A card over the chosen office

Choosing an office opens a card on its pin: name, address, a link out to Google Maps, and a
close button. It closes on that button, on <kbd>Escape</kbd>, and when the whole extent is
asked for — and closing it leaves the office chosen and the map where it was.

The component cannot place the card; it knows a coordinate, not a pixel. Build the node and
hand it to the adapter through two **optional** members, `showPopup(place, node)` and
`hidePopup()`. Every word inside belongs to the component; the adapter is asked where, never
what. Leave them out of an adapter and there is simply no card.

Link to `maps/search/?api=1&query=lat,lon`, not `maps/dir/` — "view on Google Maps" and "how
do I get there" are different questions, and the directory already answers the second. Stop
Escape at the card: a locator inside a dialog is the ordinary case, and one press should
dismiss one thing. Keep **wanting** a card separate from **having** one, or swapping to a
surface that cannot hold one and back again silently loses it.

## Trace the outline from the projection

Do not draw the country by eye. Run real coordinates through the same projection the markers
use, at several latitudes, and join the results. Drawn by hand it will leave places standing
in the sea.

## Geometry

- Latitude is not evenly spaced. Use Mercator, or every marker is wrong and worse the further
  from the equator.
- Size the frame by its **height** and let the width follow the drawing's proportions. A full
  width with a capped height stretches the country sideways.
- Counter-scale each pin by the map's scale and give the coastline
  `vector-effect: non-scaling-stroke`, or the pins swallow the places they point at.
- Move the map with **one CSS transform**, not by animating `viewBox`. Hold the view as three
  numbers in fractions of the frame.
- Clamp it: scaled by `k` the map spans `k` frames, so its edge sits between `1 - k` and `0`;
  centre it at life size.
- Make the flight proportional to the distance, floored and capped, counting a change of zoom
  as distance. `prefers-reduced-motion: reduce` removes it rather than slowing it, and
  `reduced` reaches every adapter so a provider's own flight goes off too.
- Clamp the requested zoom **before** working out the offsets. `focus-zoom` is whatever the
  page asked for, and a page driving a real provider asks for a tile zoom level the drawing's
  scale cannot reach; computing offsets at one scale and applying another puts the place a
  quarter of a frame off centre.

## The search

Fold both sides before comparing. Normalisation handles tone and vowel marks; a stroke drawn
through a letter must be mapped by hand. Keep the folding character-for-character separate
from the tidying that trims and collapses spaces, and use the first for the highlight — the
second changes how many characters there are and every offset after it is wrong.

Mark on the folded text, cut from the original. Rank: name-starts, then name-contains, then
address. A combobox with arrow keys, `Enter` and `Escape`; choose on `mousedown` so the blur
does not close the list out from under the press.

## The rest

- The map carries a tab stop; arrows pan, `+`/`-` zoom, `0` resets. Cancel the keys or the
  page scrolls too.
- Reset is a control, a method **and** a key: a map that can only be zoomed in is a trap.
- A region filter hides places from the directory as well as the map, and the search only sees
  what the map shows.
- Announce the chosen office through a `role="status"` region present and empty beforehand.
- Mark the chosen pin by size and a ring, not colour alone.
- Wrap `setPointerCapture`; it throws for a pointer id the browser does not know.
- Share one request per provider URL. Three maps on one page must not fetch it three times,
  and the second and third must not wait on a `load` event that already fired — or on one that
  never will because the first request failed.

## Verify before delivering

Serve the folder over HTTP and check each item by hand.

- Open the network panel: the only origins touched are the provider's, and no others.
- Open the search over the map: the results list is in front of the provider's zoom control.
  Positioning the frame is not enough — it has to be a stacking context, or the provider's
  `z-index: 1000` outranks the search.
- Zoom to an office: the pin is on the street the address names. Geocode the demo data; a city
  centroid behind a street map is wrong by kilometres and obvious at a glance.
- Turn the network off and reload: the drawing stands in, the search still works, and the page
  says the map could not be loaded.
- Turn scripting off: every address is still there and readable.
- Search a city and choose it: the map flies in and the marker lands in the middle.
- Zoom all the way in: the pins and the coastline are the size they were.
- Drag hard in every direction: the country never leaves the frame.
- Tab to the map and press the arrows, `+`, `-`, `0`.
- Filter to one region and search for something only in another: nothing is found.
- Replace the map with a stub that only logs: the search, the directory and the flight all
  still work, and nothing outside the seven members and the two optional popup ones is ever
called.
