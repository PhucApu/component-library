# Locator Map

A framework-free Web Component that plots offices on a real map, searches them without
diacritics, and flies to the one that is chosen.

No React, no TypeScript, no Tailwind runtime, no build step and no npm dependency — **but
this one does load a map from somebody else**, and that is the one thing worth reading before
anything else here.

## The map is not part of this component

The component owns the **search**, the ranking, the directory, the announcements and the
decision to go somewhere. The surface that actually moves is an **adapter** it is handed:
seven members, and anything that answers them can take the job.

Three of them ship. Which one is in front of you depends on what the page does:

| Adapter | Where it lives | Fetches |
|---|---|---|
| `LeafletMap` | `source/real-map.js` | Leaflet, and OpenStreetMap tiles |
| `GoogleMap` | `source/real-map.js` | The Maps JavaScript API, with your key |
| `DrawingMap` | `source/shared.js` | **Nothing.** A traced outline of the country |

Every variant in this catalog calls `attachRealMap()`, so every variant shows a provider's
map. `DrawingMap` is what the element mounts before that call finishes, and what stays there
if it fails.

Markers are placed with real **Web Mercator**, the same projection every tile provider uses,
so a place is in the same spot whichever surface is behind it.

## What this costs, plainly

Every other component in this collection is checked for making **no external request at all**
and works as static files with no network. This one does not, and the price is not small:

- **The download needs a connection.** It will not work on a train.
- **It depends on somebody else being up.** Both the preview build and the test suite reach
  the network, and both are therefore as reliable as a third party.
- **OpenStreetMap's tile servers are donated.** Their usage policy asks people not to build a
  product on them. For anything real, point `L.tileLayer` at a provider you pay, or use
  Google.
- **The reaches-nowhere rule is narrowed here, not dropped.** `ALLOWED_ORIGINS` in
  `source/real-map.js` names the only origins this component may touch, and a test fails on
  any other.

If none of that is acceptable, set `map.adapter = new DrawingMap()` and none of it applies.

## Choosing the provider

One line, in `source/real-map.js`:

```js
export const MAP_PROVIDER = 'leaflet';   // or 'google'
export const GOOGLE_API_KEY = '';        // yours, on your machine, never committed
```

Leaflet is the default because it needs no key and no billing account. Google needs both;
`attachRealMap` refuses rather than sending a keyless request, and the drawing stays up.

**Do not commit a key.** A key written into a repository is a key published. Paste yours into
your own working copy and restrict it by HTTP referrer at Google's end.

## What this is not

Not a geocoder. It searches the list you wrote and nothing else — no addresses looked up, no
places suggested, no routing. Choosing a result moves the map to coordinates that were already
in your markup.

## Markup contract

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

The list **is** the data and the fallback at once. With no script it is a complete, readable
directory of addresses rather than an empty grey box. The component never removes it or
rewrites what it says; it only turns each name into a button.

| Attribute on a place | |
|---|---|
| `data-lat` / `data-lon` | Decimal degrees |
| `data-region` | Any string you like; used by the `region` filter |

## Attributes

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `zoom` | number | `1` | Where it starts |
| `min-zoom` / `max-zoom` | number | `1` / `8` | How far out and in the drawing will go |
| `focus-zoom` | number | `4.5` | How close a flight lands, **on the surface's own scale** (the variants set `16`) |
| `region` | string | — | Shows only places whose `data-region` matches, ignoring case |
| `no-search` | present | absent | Removes the search and leaves everything else |
| `no-directions` | present | absent | Removes the directions links |
| `no-groups` | present | absent | Leaves the directory ungrouped |

`focus-zoom` is handed to the adapter untouched, and every adapter counts in its own units.
Leaflet and Google use tile zoom levels — `16` puts the street name on screen, `14` the
district, `11` the city — while the drawing uses a plain multiplier that stops at `max-zoom`.
The variants here ask for `16`: an office locator that lands somewhere you cannot read the
street name has not finished the job. The drawing reads `16` as "as close as I go" and clamps.

## Directions

Every office gets a link to Google's directions, built from its coordinates:

```text
https://www.google.com/maps/dir/?api=1&destination=21.0235,105.8573
```

This is the one piece of a real map provider that costs nothing: **no key, no billing, no
script, and no request at all until it is pressed** — which is why the links stay even on a
page whose map never arrived. It opens in a new tab.

Each link is named for its office. Nine links all called "Directions" are nine links nobody
can tell apart, which is exactly how a screen reader lists them.

`no-directions` takes them off. A place with unusable coordinates gets no link rather than one
to the middle of the ocean.

## Groups

The directory is grouped under the region each office belongs to, with a count, and the
offices of one region are gathered together wherever they were written. The heading sits one
level above whatever the offices use — `h2` over `h3` — inferred rather than fixed, because
the author chose the level their offices sit at.

The region is shown as it is written, so write it the way you want it read. `no-groups` leaves
the list flat.

## Properties, methods, events

| Member | Notes |
|---|---|
| `places` | Every place in the markup |
| `visible` | The places the region filter allows |
| `selected` | The chosen place, by position; `-1` for none |
| `view` | Whatever the adapter reports; the built-in one gives `{ x, y, k }` in fractions of the frame |
| `adapter` | The map surface; settable at any time |
| `flyTo(i)` / `reset()` / `zoomIn()` / `zoomOut()` | |
| `labels` | Overrides every generated name |

| Event | Detail |
|---|---|
| `locator-select` | `{ index, name, address, region }` |
| `locator-view-change` | `{ view }` |

## Writing an adapter

Seven members. Set it on the element as a property, before it connects or afterwards to swap
one out:

```js
document.querySelector('ui-locator-map').adapter = {
  mount(frame, { onSelect, onViewChange, labels }) {},
  update({ places, selected }) {},
  flyTo(place, { zoom, reduced }) {},
  reset({ reduced }) {},
  zoomBy(factor) {},
  get view() {},
  destroy() {},
};
```

| Member | Called when |
|---|---|
| `mount` | The adapter is attached. `frame` is yours to fill; `onSelect(index)` tells the component a marker was pressed, and `-1` means "show everything" |
| `update` | The places or the selection changed. `place.lat`, `place.lon`, `place.name`, `place.address`, `place.index` |
| `flyTo` | Somebody chose a place. `reduced` is `true` under `prefers-reduced-motion` |
| `reset` | The whole extent was asked for |
| `zoomBy` | `zoomIn()` or `zoomOut()` |
| `view` | Anything you like; the component passes it through and never reads into it |
| `destroy` | Another adapter is taking over |

The component never touches the frame's contents, so a provider can own it entirely.

`LeafletMap` and `GoogleMap` in `source/real-map.js` are both worked examples of exactly this,
and neither is longer than a screen. Two standalone pages ship beside this README as well, for
running the thing outside the catalog:

| File | Needs |
|---|---|
| `example-leaflet.html` | **Nothing.** Leaflet and OpenStreetMap need no key and no billing |
| `example-google-maps.html` | An API key with billing enabled |

Serve the component folder over HTTP and open them directly.

### Google Maps

Set `MAP_PROVIDER = 'google'` and paste a key into `GOOGLE_API_KEY`. `GoogleMap` is already
written; it loads the **Maps JavaScript API** itself and is thirty lines of the same seven
members. Two things worth knowing before choosing this route:

- **Only the JavaScript API can be flown.** The Maps *Embed* API and the share-and-embed
  iframe are cross-origin: nothing can be called on them, and changing the `src` reloads the
  frame instead of moving it. The smooth zoom is not available that way.
- `zoom` is the component's `focus-zoom`, passed through untouched. Google's zoom levels are
  their own, so pick a `focus-zoom` that means something there — around `14` for a street,
  `11` for a city.

A page starts on the drawing and hands over once the provider's script has arrived: setting
`adapter` again tears the old surface down and mounts the new one in the same frame, and the
search does not lose its place.

## Searching

The search is a combobox: type, use <kbd>&darr;</kbd> and <kbd>&uarr;</kbd>,
<kbd>Enter</kbd> to choose, <kbd>Escape</kbd> to close.

**Both sides are folded before they are compared**, so a name written with Vietnamese marks
is found by typing none of them. Every tone and vowel mark comes off through Unicode
normalisation, and `d with stroke` is mapped by hand — it is one letter rather than a letter
with something added, so no amount of normalising takes it apart.

The match is marked on the folded text but **cut from the original**, so a result found by
typing `da nang` is still shown written the way it is written.

Results are ranked: a name that starts with the query, then a name that contains it, then a
match found only in the address. Ties keep the order the places are written in.

## Flying

Whose flight it is depends on the adapter. Leaflet has one of its own and is simply asked to
use it. The drawing moves by transforming one box, so the browser does the easing: a flight
takes longer the further the view travels, and a change of zoom counts as distance — zooming
in on the spot is a journey even though nothing moved sideways. Measured on the drawing:
`586ms` between two neighbours, `900ms` across the country.

`prefers-reduced-motion: reduce` removes the flight rather than slowing it, on every adapter.
The map arrives instead of travelling; `reduced` is passed to `flyTo` and `reset`, and an
adapter that ignores it is a bug in that adapter.

## Keyboard

| Key | While the map has focus |
|---|---|
| `←` `→` `↑` `↓` | Pan; one press covers about the same amount of what you can see at any zoom |
| `+` `-` | Zoom |
| `0` | The whole country again |

The map itself carries a tab stop, and every marker and directory entry is a real button.
Panning and zooming are asked of the adapter rather than done to it, which is why the keys go
on working when the surface underneath them is swapped for a different one.

## Accessibility

- The chosen office is announced through a `role="status"` region that is present and empty
  beforehand.
- Markers are named with the office and its address, so they mean something out of context.
- The chosen marker is marked by size and a ring as well as by colour.
- Filtering by region hides the filtered places from the **directory** as well as the map:
  leaving them in would mean announcing addresses that nothing on screen can show.
- A map that can only be zoomed in is a trap, so reset is a control, a method and a key.

Measured contrast on the drawing: an office name `16.11:1`, its address `7.9:1`, the search
field `16.11:1`, a marker over the sea `7.69:1` and over the land `5.55:1`. The rules ask for
`4.5:1` on text and `3:1` on a user interface boundary. What a provider's tiles look like
underneath its own markers is the provider's business, not this component's.

## When the provider is down

The element mounts `DrawingMap` before `attachRealMap` is even called, so a failure changes
nothing that was already on screen: the drawing stays, the markers stay, the search and the
directory go on working.

`attachRealMap` marks the element either way, and never leaves it unmarked:

| Attribute | Means |
|---|---|
| `data-map-provider="leaflet"` \| `"google"` | That provider is up and mounted |
| `data-map-unavailable` | It could not be loaded; the drawing is standing in |

Both are worth watching rather than reading once — the fetch finishes after the page has
already been laid out. Setting `adapter` yourself clears both, because a claim about the last
surface is not a claim about the one that replaced it. A page that quietly shows a drawing
where a street map was promised is a page that lies.

## Without JavaScript

Every address, readable and complete, each with a directions link. The map, the markers, the
search and the flight are what the script adds — and the directory is the part that depends on
nobody at all.

## Browser support

Current Chrome, Edge, Firefox, and Safari. Uses custom elements, `aspect-ratio`,
`vector-effect: non-scaling-stroke`, and `color-mix()`.

## Using a different country

Nothing to do, if a provider is driving: a real map already has every country on it. The
drawing is the one that needs changing — set `MAP_BOUNDS` to the corner of the world you want
and replace the outline path. Every point of the supplied outline was worked out by running
real coordinates through the same projection, which is what keeps the coast under the markers;
an outline drawn by eye will leave places standing in the sea. It did, the first time.

## Running the files

ES modules do not load over `file://`, so serve the folder over HTTP or HTTPS:

```bash
npx serve .
```

## Files

| Path | Contents |
|---|---|
| `locator-map.html` | Runnable example |
| `locator-map.css` | Every style |
| `locator-map.js` | Rules, the custom element, all three adapters, and the demo bootstrap |
| `assets/` | The outline, kept as a file so it can be looked at on its own |
