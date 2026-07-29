import componentRegistry from '../../generated/components-index.json';
import { COMPONENT_GROUPS } from './component-groups.js';
import { resolveCatalogAsset } from './preview-loader.js';
import { createSearchIndex, filterComponents } from './search.js';

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

  if (!hasResults && components.length > 0 && query.trim()) {
    emptyTitle.textContent = 'No matching components';
    emptyDescription.textContent =
      'Try another component name, slug, group, category, or tag.';
    return;
  }

  emptyTitle.textContent = 'No components yet';
  emptyDescription.innerHTML =
    'The catalog is ready. The first component added to <code>components/</code> will appear here after the registry is generated.';
}

export function render(query = '') {
  const filteredComponents = filterComponents(components, query);
  const sections = COMPONENT_GROUPS.flatMap((group) => {
    const groupComponents = filteredComponents
      .filter((component) => component.group === group.id)
      .sort((left, right) => left.name.localeCompare(right.name, 'en'));
    return groupComponents.length > 0 ? [createGroupSection(group, groupComponents)] : [];
  });

  componentGrid.replaceChildren(...sections);
  componentCount.textContent = `${components.length} component${components.length === 1 ? '' : 's'}`;
  resultSummary.textContent = `${filteredComponents.length} result${filteredComponents.length === 1 ? '' : 's'}`;
  updateEmptyState(filteredComponents, query);
}

searchInput.addEventListener('input', (event) => {
  render(event.currentTarget.value);
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

render();
