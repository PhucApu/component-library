import componentRegistry from '../../generated/components-index.json';
import { getVariant, mountPreview, resolveCatalogAsset } from './preview-loader.js';

const params = new URLSearchParams(window.location.search);
const componentId = params.get('id')?.trim() ?? '';
const component = componentRegistry.find((item) => item.id === componentId);

const notFoundState = document.querySelector('#not-found-state');
const notFoundMessage = document.querySelector('#not-found-message');
const componentShell = document.querySelector('#component-shell');

function createTag(label) {
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = label;
  return tag;
}

async function loadDocument(relativePath, target, label) {
  try {
    const response = await fetch(resolveCatalogAsset(relativePath));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    target.textContent = await response.text();
  } catch {
    target.textContent = `Không thể tải ${label}. Hãy chạy lại build/publish component.`;
  }
}

function renderNotFound() {
  if (!componentId) {
    notFoundMessage.textContent =
      'URL chưa có tham số id. Hãy chọn một component từ trang danh mục.';
    return;
  }

  notFoundMessage.textContent = `Không có component mang ID “${componentId}” trong registry hiện tại.`;
}

function renderComponent() {
  notFoundState.hidden = true;
  componentShell.hidden = false;
  document.title = `${component.name} · Component UI Collection`;

  document.querySelector('#component-categories').textContent = component.categories.join(' · ');
  document.querySelector('#component-name').textContent = component.name;
  document.querySelector('#component-description').textContent = component.description;
  document.querySelector('#component-version').textContent = `v${component.version}`;

  const technologies = document.querySelector('#component-technologies');
  component.technologies.forEach((technology) => technologies.append(createTag(technology)));

  const frame = document.querySelector('#component-preview');
  const controls = document.querySelector('#variant-controls');
  const activeVariant = getVariant(component, component.preview.variant);

  component.variants.forEach((variant) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'variant-button';
    button.textContent = variant.name;
    button.setAttribute('aria-pressed', String(variant.id === activeVariant?.id));
    button.addEventListener('click', () => {
      controls
        .querySelectorAll('button')
        .forEach((control) => control.setAttribute('aria-pressed', 'false'));
      button.setAttribute('aria-pressed', 'true');
      mountPreview(frame, component, variant);
    });
    controls.append(button);
  });

  if (activeVariant) {
    mountPreview(frame, component, activeVariant);
  }

  const downloadLink = document.querySelector('#download-link');
  downloadLink.href = resolveCatalogAsset(component.download);
  downloadLink.download = `${component.id}-${component.version}.zip`;

  loadDocument(component.docs.prompt, document.querySelector('#prompt-content'), 'PROMPT.md');
  loadDocument(component.docs.design, document.querySelector('#design-content'), 'DESIGN.md');
}

if (component) {
  renderComponent();
} else {
  renderNotFound();
}
