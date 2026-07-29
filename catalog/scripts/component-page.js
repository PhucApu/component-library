import componentRegistry from '../../generated/components-index.json';
import { getComponentGroup } from './component-groups.js';
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

async function loadText(relativePath, target, label) {
  target.textContent = `Loading ${label}…`;

  try {
    const response = await fetch(resolveCatalogAsset(relativePath));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    target.textContent = await response.text();
  } catch {
    target.textContent = `Unable to load ${label}. Run the component build and publish flow again.`;
  }
}

function renderNotFound() {
  if (!componentId) {
    notFoundMessage.textContent =
      'The URL is missing an id parameter. Choose a component from the catalog.';
    return;
  }

  notFoundMessage.textContent = `No component with the ID “${componentId}” exists in the current registry.`;
}

function configureExclusiveAccordions() {
  const accordions = [...document.querySelectorAll('[data-source-accordion]')];

  accordions.forEach((accordion) => {
    accordion.open = false;
    accordion.addEventListener('toggle', () => {
      if (!accordion.open) {
        return;
      }

      accordions.forEach((otherAccordion) => {
        if (otherAccordion !== accordion) {
          otherAccordion.open = false;
        }
      });
    });
  });
}

export function renderComponent(component) {
  notFoundState.hidden = true;
  componentShell.hidden = false;
  document.title = `${component.name} · Component UI Collection`;

  const group = getComponentGroup(component.group);
  const groupLink = document.querySelector('#component-group-link');
  groupLink.href = `./index.html#${group.anchor}`;
  groupLink.textContent = group.label;

  document.querySelector('#component-name').textContent = component.name;
  document.querySelector('#component-description').textContent = component.description;
  document.querySelector('#component-version').textContent = `v${component.version}`;

  const technologies = document.querySelector('#component-technologies');
  technologies.replaceChildren();
  component.technologies.forEach((technology) => technologies.append(createTag(technology)));

  const frame = document.querySelector('#component-preview');

  const controls = document.querySelector('#variant-controls');
  const activeVariantName = document.querySelector('#active-variant-name');
  const activeVariantDescription = document.querySelector('#active-variant-description');
  const sourceFileSelect = document.querySelector('#source-file-select');
  const sourceContent = document.querySelector('#source-content');
  const sourceFiles = component.source?.files ?? [];
  let selectedVariant = getVariant(component, component.preview.variant);

  async function selectSourceFile(sourceFile) {
    if (!sourceFile) {
      sourceContent.textContent = 'No source files are available for this component.';
      return;
    }

    sourceFileSelect.value = sourceFile.path;
    sourceContent.dataset.language = sourceFile.language;
    await loadText(sourceFile.url, sourceContent, sourceFile.path);
  }

  function setActiveVariant(variant) {
    selectedVariant = variant;
    controls
      .querySelectorAll('button')
      .forEach((control) =>
        control.setAttribute('aria-pressed', String(control.dataset.variantId === variant.id)),
      );
    activeVariantName.textContent = variant.name;
    activeVariantDescription.textContent = variant.description;
    mountPreview(frame, component, variant);

    const entrySource =
      sourceFiles.find((sourceFile) => sourceFile.path === variant.entry) ?? sourceFiles[0];
    void selectSourceFile(entrySource);
  }

  controls.replaceChildren();
  component.variants.forEach((variant) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'variant-button';
    button.dataset.variantId = variant.id;
    button.textContent = variant.name;
    button.setAttribute('aria-pressed', String(variant.id === selectedVariant?.id));
    button.addEventListener('click', () => setActiveVariant(variant));
    controls.append(button);
  });

  sourceFileSelect.replaceChildren(
    ...sourceFiles.map((sourceFile) => {
      const option = document.createElement('option');
      option.value = sourceFile.path;
      option.textContent = sourceFile.path;
      return option;
    }),
  );
  sourceFileSelect.disabled = sourceFiles.length === 0;
  sourceFileSelect.addEventListener('change', () => {
    const sourceFile = sourceFiles.find((item) => item.path === sourceFileSelect.value);
    void selectSourceFile(sourceFile);
  });

  if (selectedVariant) {
    setActiveVariant(selectedVariant);
  }

  const downloadLink = document.querySelector('#download-link');
  downloadLink.href = resolveCatalogAsset(component.download);
  downloadLink.download = `${component.id}-${component.version}.zip`;

  const promptDownloadLink = document.querySelector('#prompt-download-link');
  promptDownloadLink.href = resolveCatalogAsset(component.docs.prompt);
  promptDownloadLink.download = `${component.id}-PROMPT.md`;

  const designDownloadLink = document.querySelector('#design-download-link');
  designDownloadLink.href = resolveCatalogAsset(component.docs.design);
  designDownloadLink.download = `${component.id}-DESIGN.md`;

  configureExclusiveAccordions();
  void loadText(component.docs.prompt, document.querySelector('#prompt-content'), 'PROMPT.md');
  void loadText(component.docs.design, document.querySelector('#design-content'), 'DESIGN.md');
}

if (component) {
  renderComponent(component);
} else {
  renderNotFound();
}
