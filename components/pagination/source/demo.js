/** Reports what the component decided, so the page changes are visible in writing. */
export function initializePaginationDemo() {
  const output = document.querySelector('output');

  if (!output) {
    return;
  }

  const lines = [];
  const record = (line) => {
    lines.unshift(line);
    lines.splice(5);
    output.textContent = lines.join('\n');
  };

  record('waiting');

  document.addEventListener('pagination-change', (event) => {
    const { page, previous, count, range } = event.detail;
    const rows = range ? `, rows ${range.start}-${range.end} of ${range.total}` : '';
    record(`${previous} to ${page} of ${count}${rows}`);
  });
}

const ORDERS = [
  ['AP-1001', 'Ha Linh Nguyen', 'Shipped', '248.00'],
  ['AP-1002', 'Marcus Bell', 'Packing', '1,120.50'],
  ['AP-1003', 'Priya Raman', 'Shipped', '64.25'],
  ['AP-1004', 'Tomas Vogel', 'Cancelled', '399.99'],
  ['AP-1005', 'Amara Diallo', 'Shipped', '82.40'],
  ['AP-1006', 'Jonas Weber', 'Pending', '1,904.00'],
  ['AP-1007', 'Sofia Marchetti', 'Shipped', '318.75'],
  ['AP-1008', 'Kenji Watanabe', 'Packing', '55.10'],
  ['AP-1009', 'Isabel Ferreira', 'Shipped', '742.00'],
  ['AP-1010', 'Oliver Grant', 'Pending', '129.90'],
  ['AP-1011', 'Nadia Haddad', 'Shipped', '2,480.00'],
  ['AP-1012', 'Lars Nilsen', 'Cancelled', '17.99'],
  ['AP-1013', 'Mei Chen', 'Shipped', '605.40'],
  ['AP-1014', 'Rafael Costa', 'Packing', '88.20'],
  ['AP-1015', 'Fatima Zahra', 'Shipped', '1,015.00'],
  ['AP-1016', 'Declan Moore', 'Pending', '46.60'],
  ['AP-1017', 'Yuki Tanaka', 'Shipped', '390.00'],
  ['AP-1018', 'Elena Petrova', 'Shipped', '271.35'],
  ['AP-1019', 'Samuel Okafor', 'Packing', '958.00'],
  ['AP-1020', 'Clara Jensen', 'Shipped', '133.45'],
  ['AP-1021', 'Hugo Martin', 'Cancelled', '204.00'],
  ['AP-1022', 'Ines Rodriguez', 'Shipped', '77.80'],
  ['AP-1023', 'Viktor Novak', 'Pending', '1,442.10'],
  ['AP-1024', 'Aisha Rahman', 'Shipped', '512.00'],
  ['AP-1025', 'Peter Lindgren', 'Packing', '29.95'],
  ['AP-1026', 'Camila Rojas', 'Shipped', '860.70'],
];

/**
 * Drives a plain table from the pagination component.
 *
 * The table is ordinary semantic markup built right here rather than another component.
 * Reaching outside this folder would leave the downloaded package missing the files it
 * depends on, and the page would arrive broken.
 */
export function initializePagedTable() {
  const pagination = document.querySelector('ui-pagination');
  const body = document.querySelector('.pagination-demo__table tbody');
  const rangeLabel = document.querySelector('[data-demo-range]');
  const perPage = document.querySelector('[data-demo-per-page]');

  if (!pagination || !body) {
    return;
  }

  const draw = () => {
    const range = pagination.range;
    const slice = range ? ORDERS.slice(range.start - 1, range.end) : ORDERS;

    body.replaceChildren(
      ...slice.map(([id, customer, status, total]) => {
        const row = document.createElement('tr');
        row.innerHTML =
          `<th scope="row">${id}</th><td>${customer}</td><td>${status}</td>` +
          `<td class="pagination-demo__numeric">${total}</td>`;
        return row;
      }),
    );

    if (rangeLabel && range) {
      rangeLabel.textContent = `Showing ${range.start} to ${range.end} of ${range.total}`;
    }
  };

  pagination.setAttribute('total', String(ORDERS.length));
  draw();

  pagination.addEventListener('pagination-change', draw);

  perPage?.addEventListener('change', () => {
    pagination.setAttribute('page-size', perPage.value);
    // A different page size makes the old page number meaningless, so start again.
    pagination.setAttribute('page', '1');
    draw();
  });
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
