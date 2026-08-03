/**
 * Wires the demo output.
 *
 * The map reports what it decided; this only reads it back and drives the buttons the
 * Regions and Detail variants put outside it.
 */
export function initializeLocatorMapDemo() {
  const output = document.querySelector('output');
  const map = document.querySelector('ui-locator-map');

  document.querySelectorAll('[data-demo-action]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!map) {
        return;
      }

      const actions = {
        reset: () => map.reset(),
        'zoom-in': () => map.zoomIn(),
        'zoom-out': () => map.zoomOut(),
        region: () => {
          const region = button.dataset.demoRegion ?? '';

          if (region) {
            map.setAttribute('region', region);
          } else {
            map.removeAttribute('region');
          }

          document.querySelectorAll('[data-demo-action="region"]').forEach((other) => {
            other.toggleAttribute('data-current', other === button);
          });
        },
      };

      actions[button.dataset.demoAction]?.();
    });
  });

  const detail = document.querySelector('[data-demo-detail]');

  if (detail && map) {
    const write = (place) => {
      detail.textContent = '';

      if (!place) {
        detail.textContent = 'Nothing chosen yet. Search above, or press a marker.';
        return;
      }

      const name = document.createElement('strong');
      name.textContent = place.name;
      const address = document.createElement('span');
      address.textContent = place.address;

      detail.append(name, document.createElement('br'), address);
    };

    write(null);
    document.addEventListener('locator-select', (event) => write(event.detail));
  }

  if (!output || !map) {
    return;
  }

  let note = 'Search for an office, or press a marker.';

  /**
   * Prints the view without reading into it.
   *
   * The component passes the adapter's view through and never looks inside, and this had
   * better not either: the drawing reports `{ x, y, k }`, Leaflet reports a centre and a zoom
   * level, and a demo that assumes one of them throws on the other. It did — reading `.k` off
   * a Leaflet view is how this comment came to be written.
   */
  const describeView = (view) => {
    if (!view || typeof view !== 'object') {
      return 'view: none reported';
    }

    return `view: ${Object.entries(view)
      .map(([key, value]) => `${key} ${typeof value === 'number' ? value.toFixed(2) : JSON.stringify(value)}`)
      .join(', ')}`;
  };

  const report = () => {
    output.textContent = [
      note,
      // A provider that could not be loaded leaves the drawing in place rather than an empty
      // box, and says so rather than letting the drawing pass for the map that was asked for.
      map.hasAttribute('data-map-unavailable')
        ? 'The map provider could not be loaded, so the built-in drawing is standing in.'
        : null,
      describeView(map.view),
      `${map.visible.length} of ${map.places.length} offices shown`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  report();
  // Watched rather than read once: the provider is fetched after this runs, so neither whether
  // it arrived nor what shape its view has is known at the moment the first line is written.
  new MutationObserver(report).observe(map, {
    attributes: true,
    attributeFilter: ['data-map-provider', 'data-map-unavailable'],
  });

  document.addEventListener('locator-select', (event) => {
    note = `chose ${event.detail.name}`;
    report();
  });
  // The note is kept rather than cleared: a view change is usually the tail of the choice
  // that caused it, and blanking the line would hide what the person just did.
  document.addEventListener('locator-view-change', report);
}

/**
 * Lets an embedding page pin the demo to one theme.
 *
 * The stylesheet resolves every colour through `light-dark()`, so a page that says
 * nothing keeps following the operating system. A host that shows this file in a frame
 * posts the theme it is displaying, and narrowing `color-scheme` to a single keyword
 * repoints every pair at once. The message names no host and carries nothing but a theme
 * keyword, so answering it adds no dependency on whoever sent it.
 */
function applyPreviewTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.style.colorScheme = theme;
  }
}

// Guarded because these demo modules are also imported by unit tests, which run in Node
// where there is no window to listen on.
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    // Only the embedder may pin the theme. An unframed page has itself as its parent, and
    // the worst a stray message can do is repaint the demo.
    if (event.source === window.parent && event.data?.type === 'ui-theme') {
      applyPreviewTheme(event.data.theme);
    }
  });
}
