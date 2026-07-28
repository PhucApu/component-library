import componentRegistry from '../../generated/components-index.json';
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

function createTag(label) {
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = label;
  return tag;
}

function createComponentCard(component) {
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  const link = card.querySelector('[data-component-link]');
  const video = card.querySelector('[data-component-motion]');
  const fallback = card.querySelector('[data-preview-fallback]');

  link.href = `./component.html?id=${encodeURIComponent(component.id)}`;
  link.setAttribute('aria-label', `Xem component ${component.name}`);
  card.querySelector('[data-component-name]').textContent = component.name;
  card.querySelector('[data-component-description]').textContent = component.description;

  const tags = card.querySelector('[data-component-tags]');
  component.categories.slice(0, 2).forEach((category) => tags.append(createTag(category)));
  component.technologies.slice(0, 2).forEach((technology) => tags.append(createTag(technology)));

  if (component.preview?.motion) {
    video.src = resolveCatalogAsset(component.preview.motion);
    video.poster = resolveCatalogAsset(component.preview.poster);
    video.addEventListener(
      'canplay',
      () => {
        fallback.hidden = true;
        video.play().catch(() => {});
      },
      { once: true },
    );
    video.addEventListener('error', () => {
      video.hidden = true;
      fallback.hidden = false;
    });
  } else {
    video.hidden = true;
  }

  return card;
}

function updateEmptyState(filteredComponents, query) {
  const hasResults = filteredComponents.length > 0;
  emptyState.hidden = hasResults;

  if (!hasResults && components.length > 0 && query.trim()) {
    emptyTitle.textContent = 'Không tìm thấy component phù hợp';
    emptyDescription.textContent =
      'Hãy thử một tên, category hoặc tag khác để mở rộng kết quả tìm kiếm.';
    return;
  }

  emptyTitle.textContent = 'Chưa có component nào';
  emptyDescription.innerHTML =
    'Bộ khung đã sẵn sàng. Component đầu tiên được thêm vào <code>components/</code> sẽ tự động xuất hiện ở đây sau khi tạo registry.';
}

function render(query = '') {
  const filteredComponents = filterComponents(components, query);
  componentGrid.replaceChildren(...filteredComponents.map(createComponentCard));

  componentCount.textContent = `${components.length} component${components.length === 1 ? '' : 's'}`;
  resultSummary.textContent = `${filteredComponents.length} kết quả`;
  updateEmptyState(filteredComponents, query);
}

searchInput.addEventListener('input', (event) => {
  render(event.currentTarget.value);
});

document.addEventListener('keydown', (event) => {
  if (
    event.key === '/' &&
    document.activeElement !== searchInput &&
    !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
  ) {
    event.preventDefault();
    searchInput.focus();
  }
});

render();
