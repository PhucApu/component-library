# Locator Map - Design Specification

## 1. Purpose

Offices on a map of a country, a search over them, and a flight to the one that is chosen.

## 2. What was asked for, and where it ended up

The request was Google Maps with a search over it, and it took three answers to get there.

**First answer: build the behaviour and draw the map.** The catalog's rules were read as
forbidding a provider outright — every variant is checked for making no external request, a
downloaded component cannot carry an API key, and a paid third-party dependency is not allowed.
So the map was drawn.

**Second answer: split the component.** On acceptance the request came back, and the rule
turned out to forbid a provider *inside* the catalog, not a component that *accepts* one from
outside. The element kept the search, the ranking, the directory, the announcements and the
decision to go somewhere; the surface that moves became an **adapter** it is handed. Two
runnable examples were written beside the component, outside the catalog, where a provider was
allowed.

**Third answer, and the one that ships: every variant uses a real provider.** The request came
back a third time, and the plain reading of it was right — a page in a catalog that shows a
drawing where it promises a map is a page that has not answered the question. So the drawing
stopped being what the catalog shows and became what the catalog falls back to.

There is also a technical fact that decides the route for anyone using Google: **only the Maps
JavaScript API can be flown.** The Embed API and the share-and-embed iframe are cross-origin,
nothing can be called on them, and changing the `src` reloads the frame rather than moving it.
The smooth zoom that prompted this component does not exist down that path.

## 2e. The price of the third answer, written down

This is the only component in the collection that reaches the network, and pretending
otherwise would be the worst part of the change. What it actually costs:

| | |
|---|---|
| The packaged download | Needs a connection. It will not work on a train. |
| `generate:previews` | Loads a real map every run. |
| The e2e suite | Would too, so most of it blocks the provider on purpose and runs against the drawing. Four tests are deliberately online. |
| OpenStreetMap | Donated servers whose policy asks people not to build products on them. Fine for a catalog; point `L.tileLayer` somewhere paid for anything real. |
| The no-request rule | **Narrowed, not dropped.** `ALLOWED_ORIGINS` names six origins and a test fails on a seventh. |

Two things keep it from being a one-way door. `MAP_PROVIDER` is one line, so Leaflet and
Google are a single edit apart; and `DrawingMap` still ships, so a consumer who cannot accept
any of the above sets it and loses nothing but the tiles.

The key is not in the repository and must not be. `GOOGLE_API_KEY` is empty, and
`attachRealMap` refuses rather than sending a keyless request — a failure that says so beats a
request that quietly 403s.

## 2f. What happens when the provider is not there

The element mounts `DrawingMap` in `connectedCallback`, before anything is fetched. So the
failure path is not a path at all: nothing is torn down, and what was already on screen stays.

`attachRealMap` marks the element **either way** — `data-map-provider` on success,
`data-map-unavailable` on failure — and that symmetry is not decoration. The first version
only set the failure attribute and removed it on success, and removing an attribute that was
never there produces no mutation record at all: the demo's own status line was written before
the fetch finished and then never rewritten, so a page running Leaflet reported the drawing's
`{ x, y, k }` underneath it. Success has to be observable, not merely not-failure.

A map component that shows an empty grey box when a third party is down has traded away the
only thing it could have guaranteed.

Setting `adapter` clears both marks, and `attachRealMap` writes its own afterwards. Otherwise
the Adapter variant announces `leaflet` over a grid drawn on the page itself.

## 2g. Three things a real map broke that a drawing never could

Putting a provider behind the search exposed three faults that had been invisible while the
surface was something this component drew itself.

**The results list went behind the map.** `.locator-map__frame` was `position: relative` with
no `z-index`, which positions it without making it a **stacking context**. Leaflet stacks its
own controls at `z-index: 1000`, and with nothing containing them those numbers competed
directly against the search's `z-index: 2` — so the open list was painted under the map's zoom
buttons. `isolation: isolate` on the frame says what was always meant: whatever the surface
does inside the frame, it does inside the frame. Measured before the fix, at the centre of the
zoom control with the list open, the topmost element was `a.leaflet-control-zoom-out`.

**The offices were not where the addresses said.** Every coordinate was a **city centroid**
paired with a **street address** — `10.8231, 106.6297` labelled "65 Le Loi, District 1", which
is about eight kilometres from Le Loi. On a drawing of the country nobody could tell; on a
street map it is the first thing anyone notices. All twelve were re-geocoded against OSM, the
same data the tiles are drawn from, so the pin now lands on the street the tile labels. The
ward names went with them, because Vietnam's 2025 reform renamed most of them and an address
naming a ward the map disagrees with reads as a wrong pin even when the pin is right.

`focus-zoom` went from `14` to `16` at the same time. Correct data that lands too far out to
read is correct data nobody can check.

**The map did not look like the rest of it.** A bright street map dropped into a dark page
reads as a hole punched in it. Three things fixed that, all scoped under `.locator-map__frame`
so this component never styles a map belonging to somewhere else — and so its rules outrank a
stylesheet that is appended at run time and therefore always comes last:

- The tile **pane** is inverted and turned back through half the colour wheel. On the pane and
  not on each tile, or every seam shows as a line where the filter composites twice.
- The zoom control is restyled to match the three the drawing puts in the same corner.
- The pins are the component's own, through a `divIcon` rather than Leaflet's default image.
  They match the drawing exactly, the chosen one is marked the same way, and neither an icon
  nor a shadow is fetched.

Attribution is restyled rather than hidden. It is a licence condition, not decoration.

## 2a. The seam

Seven members: `mount`, `update`, `flyTo`, `reset`, `zoomBy`, `view`, `destroy`. Nothing else
is asked for, which is what makes a provider's map a plausible substitute rather than a
rewrite.

Two more are **optional**: `showPopup(place, node)` and `hidePopup()`. They came with the card
over the chosen office, and they were the only honest way to build it — see §2h.

Two decisions keep it honest:

- **The frame belongs to the element, not the adapter.** It carries the tab stop, the size and
  the clipping, so swapping the surface inside it disturbs none of them.
- **`view` is passed through and never read into.** The drawing reports `{ x, y, k }` in
  fractions of a frame; Google would report a centre and a zoom level. The component has no
  business understanding either.

The Adapter variant starts on the real map and swaps between three surfaces: Leaflet, a grid
written in about thirty lines on the page itself, and the drawing. The grid is deliberately
plain because what is on show is the seam and not the artwork, and three surfaces rather than
two is the proof: if the contract had leaked, only one of them could exist.

Swapping tears the old surface down. Measured: after a swap the frame holds one world and no
leftover provider surface, and the chosen office is still chosen.

One defect the third answer exposed, worth recording because it had been latent from the
start. `focus-zoom` is passed to the adapter untouched, and a page driving Leaflet asks for
`14`, a number the drawing's scale stops at `8`. `DrawingMap.flyTo` computed the offsets at
`14` and then let `clampView` reduce the scale to `8`, so the two halves of the view no longer
agreed about how big the map was and the office landed **239px** off centre on a 595px frame.
The scale is now clamped before the offsets are worked out — which is what `GridMap` had been
doing all along.

## 2b. What the reference site actually does

The site this was compared against turned out **not to embed Google Maps at all**. Its
interactive map is **Leaflet**, loaded on demand; Google appears only as a "Chi duong" link
per branch, of the form `google.com/maps/dir/?api=1&destination=...`. It also filters by
region and province and lists its branches grouped by region with counts.

That finding changed three things here, all in the consumer's favour:

- **Leaflet is the recommended adapter**, not Google. It needs no API key and no billing
  account, which removes the whole cost that had been about to be paid.
- **The directions link came into the component.** It is a plain anchor: no key, no script,
  and no request until it is pressed, so it breaks nothing this collection promises. It is
  also the piece people actually use.
- **The directory is grouped by region with a count.**

Worth saying plainly: the earlier advice to go and get a Maps API key was reasonable given
what had been asked for, and wrong given what was actually wanted. Looking at the reference
first would have found this before any of it was built.

## 2c. Directions, and why they are allowed here

The rule this collection holds is that a component makes **no request**. A link is not a
request; it is an offer of one, taken up only when somebody presses it. So the useful half of
a map provider — telling somebody how to get there — costs nothing at all.

Each link is named for its office. Nine links called "Directions" are nine links nobody can
tell apart, which is exactly how a screen reader lists them. A place with unusable coordinates
gets no link rather than one to the middle of the ocean.

## 2d. Grouping

The offices of one region are gathered together wherever they were written, groups keep the
order their region first appears in, and places keep the order they were written in inside
their group. A directory that reshuffles itself between renders is a directory nobody can
scan.

The heading sits one level above whatever the offices use — inferred from the first office's
heading rather than fixed, because the author chose the level their offices sit at and a group
above them has to be above them in the outline too.

The heading rows are list items, which caused the one real bug in this change: `_read` counted
them as offices on every re-read after the first render, giving thirteen places where there
were ten. Found by a test that was checking something else.

## 2h. The card over the chosen office, and the two members it cost

A popup has to sit on the pin, and **the pin's position on screen is the one thing this
component does not know**. It knows a latitude and a longitude; turning those into pixels is
the whole job it handed to the adapter. Three ways out were considered:

| Approach | Why not |
|---|---|
| Anchor the card at the middle of the frame — the flight centres the office, so that is where the pin is | True until somebody drags the map, and then the card is describing a pin that has moved out from under it |
| Find the selected marker in the frame and measure it | The frame's contents belong to the adapter. A provider drawing markers to a canvas has no element to find, and reaching in is exactly what the seam exists to prevent |
| Ask the adapter to anchor a node the component built | Costs two members |

The third one won, because it makes the same division the rest of the contract already makes:
**the component decides what, the adapter decides where on screen.** Every word in the card —
the name, the address, the link, the close button, the labels, the focus behaviour — is the
component's. `showPopup(place, node)` is handed a finished node and asked only to put it in the
right place.

That has a payoff beyond tidiness: Leaflet keeps a popup glued to a coordinate through a
flight, a drag and a zoom for free, because that is what `L.popup` is for. Nothing in this
component tracks anything, and there is no animation frame loop anywhere.

**Both members are optional.** An adapter with seven keeps working and simply has no card;
`GridMap` leaves them out on purpose so the Adapter variant shows what that looks like. That
is the whole reason the contract could grow without breaking anything written against it.

### Wanting a card and having one

`_popupWanted` is the decision — somebody chose an office and has not dismissed it.
`_popupNode` is whether one is actually mounted. Keeping them apart is what lets the card
return when the map is swapped from a surface that cannot hold it to one that can, without it
reappearing after somebody closed it. Collapsing them into one flag was the first version, and
swapping grid → drawing silently lost the card.

### The link that went nowhere

The card's link was correct from the first version and still did nothing on the catalog's
detail page. The cause was not in this component at all: the preview iframe in
`component.html` was sandboxed `allow-scripts allow-same-origin allow-forms allow-modals`, and
a sandbox without `allow-popups` swallows every `target="_blank"` inside it. Measured, the
only trace was one console line:

```text
Blocked opening 'https://www.google.com/maps/search/?api=1&query=21.0235,105.8573' in a new
window because the request was made in a sandboxed frame whose 'allow-popups' permission is
not set.
```

It was never only this card. The nine directions links in the directory had been dead the same
way since they were written, and so is any outbound link in any other component's preview. The
fix is a shared one — `allow-popups allow-popups-to-escape-sandbox` on that iframe — and it is
covered by a catalog test rather than a locator-map one, because the fault belongs to the
catalog. `allow-top-navigation` is still withheld, so a preview still cannot navigate the page
around it.

### Two smaller decisions

`maps/search/` rather than `maps/dir/`. A card that says "view on Google Maps" and then opens
a route from wherever you happen to be has answered a question nobody put. The directory keeps
the directions link, so both are on offer.

<kbd>Escape</kbd> is stopped at the card. Nothing inside this component reads Escape there —
the frame only answers `0` — so the reason is entirely about whatever the component was
dropped into. A locator inside a dialog is the ordinary case, and one press should dismiss one
thing. Measured: with the press left to bubble, a `document`-level listener sees it.

## 3. The drawing is decoration; the projection is not

Markers are placed with real **Web Mercator**, the same projection every tile provider uses.
The silhouette is generalised, but the arithmetic that puts a pin on it is not, so replacing
the drawing with real tiles later moves nothing.

The outline is the mainland only. It claims nothing about any border and shows nothing at
sea.

## 4. Latitude is not evenly spaced

A degree of longitude is the same width everywhere; a degree of latitude is not. Spacing
markers evenly by latitude would put every one of them in the wrong place, and worse the
further from the equator. Measured in the unit tests: the five degrees from 15 to 20 take up
more of the drawing than the five from 10 to 15.

## 5. The outline was traced from the projection, not drawn by eye

The first attempt was drawn by hand and left three offices — Da Lat, Ho Chi Minh City and
Can Tho — standing in the sea, because the real country reaches further east in the centre
and further west in the delta than a sketch suggests.

The outline was rebuilt by running real coordinates through the same `project` the markers
use and joining the results. That is the only way the coast can be under the pins.

## 6. The frame is sized by its height

`aspect-ratio` with `inline-size: 100%` and a capped height is three rules fighting: the
width wins, the cap crops, and the silhouette is stretched sideways into something that is
not the country. Setting the height and letting the width follow the drawing's proportions
leaves one rule in charge.

Because the frame's proportions equal the drawing's, a marker positioned as a percentage of
the frame is the same point as a marker positioned in the projection's coordinates. Nothing
has to be recomputed on resize.

## 7. Moving the map is one transform

Measured before building: transforming a box gives real intermediate widths —
`600 → 719 → 836 → … → 2400` — with the browser doing the easing. Animating the SVG
`viewBox` instead would mean driving every frame from a script, for the same movement and a
harder time honouring `prefers-reduced-motion`.

The view is three numbers in **fractions of the frame**, so the same view means the same
thing at any size.

## 8. The markers do not grow

Measured: a pin is `19px` at life size and `19px` at four times it, because it is shrunk by
exactly as much as the map was enlarged. Without that it reached `135px` — a pin that
swallows the place it is pointing at, which is why no map anyone has used does this.

The coastline holds its width the same way, with `vector-effect: non-scaling-stroke`.

## 9. The list is the data and the fallback

The markup is a plain list of addresses. The component reads it, keeps it, and turns each
name into a button. Nothing is hidden and nothing is rewritten.

With no script that leaves a complete, readable directory — which for a page of office
addresses is most of what anyone wanted. A map component whose fallback is an empty grey box
has failed the person it was hardest to serve.

## 10. Diacritics, and the letter that cannot be decomposed

Somebody looking for an office in Da Nang types `da nang`, and every letter of that is
different from the letters on the page. Both sides are folded before they are compared.

Unicode normalisation separates a combining mark from its letter, which handles every tone
and vowel mark. It does **nothing** for a stroke drawn through the glyph, because that is
part of the letter itself — so `d with stroke` is mapped by hand.

Two functions, not one: `fold` swaps one character for one, and `normalise` adds trimming and
the collapsing of runs of spaces. The highlight uses `fold` alone, because trimming changes
how many characters there are and every offset after it would point at the wrong letter. A
length check guards the assumption rather than trusting it.

## 11. This cannot be shown in the demo pages

The repository keeps its own text unaccented and a check enforces it, so no page here can
carry a marked place name. The folding is covered by unit tests that spell the marked letters
as escaped code points, and by one end-to-end test that writes a marked name into the page at
run time.

Saying so plainly on the Search variant is better than a demo that quietly proves nothing.

## 12. Ranking

A name that starts with the query, then a name that contains it, then a match found only in
the address. Somebody typing two letters means the city, not an address that happens to hold
them. Ties keep the order the places are written in — a stable rule rather than an
alphabetical one nobody asked for.

## 13. The flight

Proportional to how far the view travels, floored at `260ms` and capped at `900ms`. A change
of zoom counts as distance, because zooming in on the spot is a journey even though nothing
moved sideways. Measured: `586ms` between two neighbours, `900ms` across the country.

`prefers-reduced-motion: reduce` removes it rather than slowing it down. Slowing a movement
is answering a different request from the one that was made.

## 14. Getting back out

A map that can only be zoomed in is a trap, so reset is a control on the map, a method, and
the `0` key. The view is clamped so the map always covers the frame: scaled by `k` it spans
`k` frames, so its edge may sit between `1 - k` and `0` and no further. Measured without the
clamp: a hard drag put the edge at `11.3` frames off, showing sea where the country was.

## 15. Visual tokens

Each colour token is a `light-dark()` pair, so which half a browser uses follows the
page's `color-scheme` rather than a class the author has to remember to set.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--locator-sea` | `#cfe0ee` | `#101822` | Behind the country |
| `--locator-land` | `#f8fafc` | `#26333f` | The country |
| `--locator-coast` | `#6b8299` | `#3d5468` | Its outline |
| `--locator-marker` | `#c2410c` | `#ff8a5b` | A pin |
| `--locator-pin-ring` | `#10131a` | `#10131a` | The pin's outline |
| `--locator-accent` | `#4f46e5` | `#86a0ff` | The chosen pin, the marked match, the current entry |
| `--locator-surface` | `#ffffff` | `#171a20` | Panel, results, and entries |
| `--locator-text` | `#111827` | `#f4f6fa` | |
| `--locator-muted` | `#5f6878` | `#a8afbc` | |
| `--locator-border` | `#dfe4ec` | `#2e3440` | |
| `--locator-focus` | `#6366f1` | `#86a0ff` | |
| `--locator-radius` | `12px` | | |

The map is drawn rather than photographed, so its three colours are as much a part of the
theme as the panel around them — unlike a carousel slide or a lightbox picture, there is
no photograph here to leave alone.

Sea against land is a quiet step in either half, which is what a map looks like: `1.29:1`
on the light map. The coastline is what actually draws that boundary, so that is the
stroke that owes `3:1` — measured `3.81:1` against the light land.

The warm pin is the one colour that could not simply be carried across. A pin is a user
interface boundary, and it is measured against the sea it may be standing on; the dark
theme's `#ff8a5b` reaches only `1.27:1` there once the sea is pale. The light half is
taken down to `#c2410c`, which holds `3.83:1` on the sea and `4.91:1` on the land.

`--locator-pin-ring` does not pair. It outlines the pin so its shape reads whatever it is
standing on, and a dark outline does that on both a dark map and a pale one; a white one
would vanish into the light theme's land.

### Choosing a theme

`:root` declares `color-scheme: light dark`, so a page on its own follows the operating
system and needs no script at all. A page that shows this demo inside a frame may post
`{ type: 'ui-theme', theme: 'light' | 'dark' }`, and the demo narrows its own
`color-scheme` to that keyword, which repoints every pair at once. The message carries a
theme keyword and no sender identity, so answering it creates no dependency on whoever
sent it, and a demo that never receives one keeps following the system.
| `--locator-ratio` | `400 / 720` | The drawing's proportions, and the frame's |
| `--map-x`, `--map-y`, `--map-k`, `--map-flight` | | Written by the element, declared here |

Measured: an office name `16.11:1`, its address `7.9:1`, the search field `16.11:1`, a marker
over the sea `7.69:1`, a marker over the land `5.55:1`. The rules ask for `4.5:1` on text and
`3:1` on a user interface boundary.

## 16. Accessibility

- The chosen office is announced through a `role="status"` region present and empty
  beforehand.
- The map carries a tab stop; markers and directory entries are real buttons named with the
  office and its address.
- The chosen marker is marked by size and a ring as well as by colour.
- Filtering by region hides the filtered offices from the directory too. Leaving them would
  mean announcing addresses nothing on screen can show.

## 17. Variants

| Variant | What it is for |
|---|---|
| Default | Offices, search, and the flight |
| Search | Ranking, marking, the keyboard, the empty answer |
| Detail | The chosen office written out, and the way back |
| Regions | Narrowing markers, directory and search together |
| Controls | Zoom, drag, keyboard, and markers that keep their size |
| States | One office, none at all, and the search taken off |
| Adapter | Three surfaces behind one search, swapped live |

## 18. Distribution preview

`preview/thumbnail.svg` is a static `640x360` miniature of the Default variant. It is
self-contained with no animation, script, external asset, or embedded raster image.

## 19. Acceptance criteria

- All seven variants run independently in an iframe without overflowing.
- Every variant, on a working network, puts a **real provider's** map up — not the drawing.
- Nothing is requested from an origin outside `ALLOWED_ORIGINS`, and no marker image is
  requested at all.
- The open results list is painted in front of the provider's own controls.
- The tiles are darkened, the zoom control matches the drawing's, and the pins are this
  component's pins with the chosen one marked.
- Three maps on one page get three surfaces from **one** script and **one** stylesheet.
- With the provider unreachable the drawing stays, the search still works, and the page says
  what happened.
- With scripting disabled the directory is every address, and no map or search is invented.
- Markers sit inside the drawing, south of and east of one another as their coordinates say.
- Choosing a result lands the marker in the middle of the frame within a pixel or two, and
  moves the real map to the office's own coordinates at the zoom asked for.
- The flight passes through real intermediate widths.
- A pin is the same size at life size and at four times it, and so is the coastline.
- An unmarked query matches a marked name, and the answer keeps its marks.
- Results are ranked, and an empty answer says so rather than vanishing.
- The map cannot be dragged off the frame.
- A region narrows markers, directory and search together.
- Reduced motion removes the flight, on the drawing and on the real map alike.
- A map surface the component has never heard of takes its place, and everything the search
  does still works over it.
- Swapping one surface for another leaves one behind, not two, and the choice survives.
- The component calls nothing on an adapter beyond the seven members and the two optional
  popup ones, and hands `showPopup` a node it built itself.
- Choosing an office opens a card over its pin, clear of the pin and inside the frame, with
  the name, the address and a `maps/search/` link.
- The card closes on its button, on Escape, and when the whole country is asked for — and
  closing it leaves the office chosen and the map where it was.
- Escape at the card does not reach a listener outside the component.
- A surface that cannot hold a card loses nothing else, and the card returns when one that
  can is put back.
- `no-popup` removes the card and nothing else.
