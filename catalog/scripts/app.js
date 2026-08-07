import componentRegistry from '../../generated/components-index.json';
import { DEFAULT_CATALOG_TAB, getCatalogTab, getTabForComponent } from './component-groups.js';
import { resolveCatalogAsset } from './preview-loader.js';
import { createSearchIndex, filterComponents } from './search.js';
import { initializeThemeToggle } from './theme-toggle.js';

const TAB_PARAMETER = 'tab';

const components = componentRegistry.map((component) => ({
  ...component,
  searchIndex: createSearchIndex(component),
}));

const searchInput = document.querySelector('#component-search');
const componentGrid = document.querySelector('#component-grid');
const cardTemplate = document.querySelector('#component-card-template');
const emptyState = document.querySelector('#empty-state');
const emptyTitle = document.querySelector('#empty-title');
const emptyDescription = document.querySelector('#empty-description');
const componentCount = document.querySelector('#component-count');
const resultSummary = document.querySelector('#result-summary');
const resultsTitle = document.querySelector('#results-title');
const tabButtons = Array.from(document.querySelectorAll('[data-catalog-tab]'));

// One message per reason the panel is empty. A tab that holds nothing yet is a different
// situation from a query that matched nothing, and the second sentence has to say so.
const EMPTY_STATES = {
  components: {
    title: 'No components yet',
    description:
      'The catalog is ready. The first component added to <code>components/</code> will appear here after the registry is generated.',
  },
  animations: {
    title: 'No animations yet',
    description:
      'The Animations tab is ready. A component published with <code>"kind": "animation"</code> will appear here after the registry is generated.',
  },
};

let activeTab = readTabFromLocation();
let activeQuery = '';

function formatTechnologies(technologies = []) {
  return technologies
    .map((technology) => (technology === 'javascript' ? 'JS' : technology.toUpperCase()))
    .join(' · ');
}

function mountThumbnail(image, fallback, thumbnailPath) {
  if (!thumbnailPath) {
    image.hidden = true;
    fallback.hidden = false;
    return;
  }

  image.addEventListener(
    'load',
    () => {
      image.hidden = false;
      fallback.hidden = true;
    },
    { once: true },
  );
  image.addEventListener(
    'error',
    () => {
      image.hidden = true;
      fallback.hidden = false;
    },
    { once: true },
  );
  image.src = resolveCatalogAsset(thumbnailPath);
}

export function createComponentCard(component) {
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  const link = card.querySelector('[data-component-link]');
  const thumbnail = card.querySelector('[data-component-thumbnail]');
  const fallback = card.querySelector('[data-preview-fallback]');

  link.href = `./component.html?id=${encodeURIComponent(component.id)}`;
  link.setAttribute('aria-label', `View ${component.name}`);
  card.querySelector('[data-component-name]').textContent = component.name;
  card.querySelector('[data-component-technology]').textContent = formatTechnologies(
    component.technologies,
  );
  thumbnail.alt = `${component.name} component illustration`;
  mountThumbnail(thumbnail, fallback, component.preview?.thumbnail);

  return card;
}

function createGroupSection(group, groupComponents) {
  const section = document.createElement('section');
  section.id = group.anchor;
  section.className = 'component-group';
  section.setAttribute('aria-labelledby', `${group.anchor}-title`);

  const heading = document.createElement('div');
  heading.className = 'component-group__heading';

  const title = document.createElement('h2');
  title.id = `${group.anchor}-title`;
  title.className = 'component-group__title';

  const anchor = document.createElement('a');
  anchor.href = `#${group.anchor}`;
  anchor.textContent = group.label;
  title.append(anchor);

  const count = document.createElement('span');
  count.className = 'component-group__count';
  count.textContent = `${groupComponents.length} component${groupComponents.length === 1 ? '' : 's'}`;

  const grid = document.createElement('div');
  grid.className = 'catalog-grid component-group__grid';
  grid.append(...groupComponents.map(createComponentCard));

  heading.append(title, count);
  section.append(heading, grid);
  return section;
}

function updateEmptyState(filteredComponents, query) {
  const hasResults = filteredComponents.length > 0;
  emptyState.hidden = hasResults;

  if (!hasResults && componentsForTab(activeTab).length > 0 && query.trim()) {
    emptyTitle.textContent = `No matching ${activeTab.noun}s`;
    emptyDescription.textContent = `Try another ${activeTab.noun} name, slug, group, category, or tag.`;
    return;
  }

  const message = EMPTY_STATES[activeTab.id];
  emptyTitle.textContent = message.title;
  emptyDescription.innerHTML = message.description;
}

function componentsForTab(tab) {
  return components.filter((component) => getTabForComponent(component).id === tab.id);
}

function readTabFromLocation() {
  return getCatalogTab(new URL(window.location.href).searchParams.get(TAB_PARAMETER));
}

// The tab belongs in the URL so a deep link, a reload, and the group link on a detail page
// all land on the same section. It replaces the entry rather than pushing one, because a
// tab is a filter over one page instead of a place of its own.
function writeTabToLocation(tab) {
  const url = new URL(window.location.href);

  if (tab.id === DEFAULT_CATALOG_TAB.id) {
    url.searchParams.delete(TAB_PARAMETER);
  } else {
    url.searchParams.set(TAB_PARAMETER, tab.id);
  }

  window.history.replaceState(window.history.state, '', url);
}

function updateTabControls(query) {
  tabButtons.forEach((button) => {
    const tab = getCatalogTab(button.dataset.catalogTab);
    const isActive = tab.id === activeTab.id;
    // The count follows the query so a search that comes up empty here still shows where
    // its matches are, and roving tabindex keeps the strip to one tab stop.
    const matches = filterComponents(componentsForTab(tab), query);

    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
    button.querySelector('[data-tab-count]').textContent = String(matches.length);
  });
}

export function render(query = '', tabId = activeTab.id) {
  activeQuery = query;
  activeTab = getCatalogTab(tabId);

  const filteredComponents = filterComponents(componentsForTab(activeTab), query);
  const sections = activeTab.groups.flatMap((group) => {
    const groupComponents = filteredComponents
      .filter((component) => component.group === group.id)
      .sort((left, right) => left.name.localeCompare(right.name, 'en'));
    return groupComponents.length > 0 ? [createGroupSection(group, groupComponents)] : [];
  });

  componentGrid.replaceChildren(...sections);
  componentGrid.setAttribute('aria-labelledby', `tab-${activeTab.id}`);
  resultsTitle.textContent = activeTab.title;
  updateTabControls(query);
  // The header count stays the size of the whole registry: it names the library, not the
  // tab that happens to be open.
  componentCount.textContent = `${components.length} component${components.length === 1 ? '' : 's'}`;
  resultSummary.textContent = `${filteredComponents.length} result${filteredComponents.length === 1 ? '' : 's'}`;
  updateEmptyState(filteredComponents, query);
}

function selectTab(tabId) {
  const tab = getCatalogTab(tabId);

  if (tab.id === activeTab.id) {
    return;
  }

  render(activeQuery, tab.id);
  writeTabToLocation(tab);
}

const TAB_STEP_KEYS = { ArrowLeft: -1, ArrowRight: 1 };

tabButtons.forEach((button, index) => {
  button.addEventListener('click', () => {
    selectTab(button.dataset.catalogTab);
  });

  button.addEventListener('keydown', (event) => {
    const step = TAB_STEP_KEYS[event.key];
    let nextIndex = null;

    if (step) {
      nextIndex = (index + step + tabButtons.length) % tabButtons.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabButtons.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextButton = tabButtons[nextIndex];
    selectTab(nextButton.dataset.catalogTab);
    nextButton.focus();
  });
});

window.addEventListener('popstate', () => {
  render(activeQuery, readTabFromLocation().id);
});

searchInput.addEventListener('input', (event) => {
  render(event.currentTarget.value, activeTab.id);
});

document.addEventListener('keydown', (event) => {
  if (
    event.key === '/' &&
    document.activeElement !== searchInput &&
    !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
  ) {
    event.preventDefault();
    searchInput.focus();
  }
});

initializeThemeToggle();
render('', activeTab.id);
