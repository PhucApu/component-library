import componentRegistry from '../../generated/components-index.json';
import { getComponentGroup } from './component-groups.js';
import { createFileSelect } from './file-select.js';
import {
  getVariant,
  mountPreview,
  resolveCatalogAsset,
  sendPreviewTheme,
} from './preview-loader.js';
import { getActiveTheme, initializeThemeToggle, onThemeChange } from './theme-toggle.js';

const ACCORDION_DURATION = 260;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

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

/**
 * Records the width the scrollbar takes from the pane so the copy button can sit clear
 * of it. Classic scrollbars claim real width, overlay scrollbars claim none, and the
 * scrollbar also comes and goes with the content, so this cannot be a fixed offset.
 */
function syncScrollbarInset(content) {
  const pane = content.closest('.document-pane');

  if (pane) {
    pane.style.setProperty(
      '--pane-scrollbar',
      `${content.offsetWidth - content.clientWidth}px`,
    );
  }
}

async function loadText(relativePath, target, label) {
  // Keep the current text in place while fetching. Swapping in a placeholder collapses
  // the pane to its min-height and snaps it back, which reads as a full page reload.
  target.dataset.loading = 'true';

  try {
    // The marker asks the dev server for the untouched file. A static host ignores it.
    const response = await fetch(`${resolveCatalogAsset(relativePath)}?source-view`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    target.textContent = await response.text();
  } catch {
    target.textContent = `Unable to load ${label}. Run the component build and publish flow again.`;
  } finally {
    delete target.dataset.loading;
    // A carried-over scroll position belongs to the previous file.
    target.scrollTop = 0;
    syncScrollbarInset(target);
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

  function animate(accordion, opening) {
    const content = accordion.querySelector('.source-accordion__content');

    if (!content || prefersReducedMotion()) {
      return;
    }

    content.getAnimations().forEach((animation) => animation.cancel());
    const full = `${content.scrollHeight}px`;

    content.animate(
      {
        blockSize: opening ? ['0px', full] : [full, '0px'],
        opacity: opening ? [0, 1] : [1, 0],
      },
      {
        duration: ACCORDION_DURATION,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
      },
    );
  }

  function close(accordion) {
    if (!accordion.open || accordion.dataset.closing === 'true') {
      return;
    }

    if (prefersReducedMotion()) {
      accordion.open = false;
      return;
    }

    // <details> hides its content the moment `open` clears, so the collapse has to run
    // first and the attribute has to follow once the animation finishes.
    accordion.dataset.closing = 'true';
    animate(accordion, false);
    setTimeout(() => {
      delete accordion.dataset.closing;
      accordion.open = false;
    }, ACCORDION_DURATION);
  }

  accordions.forEach((accordion) => {
    accordion.addEventListener('toggle', () => {
      if (!accordion.open || accordion.dataset.closing === 'true') {
        return;
      }

      animate(accordion, true);
      accordions.forEach((otherAccordion) => {
        if (otherAccordion !== accordion) {
          close(otherAccordion);
        }
      });
    });
  });
}

function configureCopyButtons() {
  const COPY_ICON =
    '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"></rect><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"></path></svg>';
  const DONE_ICON =
    '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>';

  document.querySelectorAll('[data-copy-for]').forEach((button) => {
    const target = document.querySelector(`#${button.dataset.copyFor}`);
    const status = document.querySelector('#copy-status');
    button.innerHTML = `${COPY_ICON}<span class="copy-button__label">Copy</span>`;

    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(target?.textContent ?? '');
      } catch {
        if (status) {
          status.textContent = 'Copy failed. Select the text and copy manually.';
        }
        return;
      }

      button.innerHTML = `${DONE_ICON}<span class="copy-button__label">Copied</span>`;
      button.classList.add('is-copied');
      if (status) {
        status.textContent = 'Copied to clipboard.';
      }

      setTimeout(() => {
        button.innerHTML = `${COPY_ICON}<span class="copy-button__label">Copy</span>`;
        button.classList.remove('is-copied');
      }, 1800);
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
  const technologies = document.querySelector('#component-technologies');
  technologies.replaceChildren();
  component.technologies.forEach((technology) => technologies.append(createTag(technology)));

  const frame = document.querySelector('#component-preview');

  const controls = document.querySelector('#variant-controls');
  const activeVariantName = document.querySelector('#active-variant-name');
  const activeVariantDescription = document.querySelector('#active-variant-description');
  const sourceContent = document.querySelector('#source-content');
  // The detail page shows the three distributable files, not the full source tree.
  const sourceFiles = component.distribution?.files ?? component.source?.files ?? [];
  let selectedVariant = getVariant(component, component.preview.variant);

  const fileSelect = createFileSelect(document.querySelector('[data-file-select]'), {
    labelId: 'source-file-label',
    onSelect: (value) => {
      void selectSourceFile(sourceFiles.find((item) => item.path === value));
    },
  });

  async function selectSourceFile(sourceFile) {
    if (!sourceFile) {
      sourceContent.textContent = 'No source files are available for this component.';
      return;
    }

    fileSelect.setValue(sourceFile.path);
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

  fileSelect.setItems(
    sourceFiles.map((sourceFile) => ({
      value: sourceFile.path,
      label: sourceFile.path.split('/').pop(),
      language: sourceFile.language,
    })),
  );
  void selectSourceFile(sourceFiles[0]);

  if (selectedVariant) {
    setActiveVariant(selectedVariant);
  }

  const downloadLink = document.querySelector('#download-link');
  downloadLink.href = resolveCatalogAsset(component.download);
  downloadLink.download = `${component.id}-${component.version}.zip`;

  const promptDownloadLink = document.querySelector('#prompt-download-link');
  promptDownloadLink.href = resolveCatalogAsset(component.docs.prompt);
  promptDownloadLink.download = `${component.id}-PROMPT.md`;

  // Only some components ship a prompt aimed at the three distributable files.
  const standalonePromptLink = document.querySelector('#standalone-prompt-download-link');
  if (component.docs.standalonePrompt) {
    standalonePromptLink.href = resolveCatalogAsset(component.docs.standalonePrompt);
    standalonePromptLink.download = `${component.id}-PROMPT-STANDALONE.md`;
    standalonePromptLink.hidden = false;
  }

  const designDownloadLink = document.querySelector('#design-download-link');
  designDownloadLink.href = resolveCatalogAsset(component.docs.design);
  designDownloadLink.download = `${component.id}-DESIGN.md`;

  configureExclusiveAccordions();
  configureCopyButtons();

  const documentPanes = [...document.querySelectorAll('.document-content')];
  const measurePanes = () => documentPanes.forEach(syncScrollbarInset);
  measurePanes();
  window.addEventListener('resize', measurePanes);
  void loadText(component.docs.prompt, document.querySelector('#prompt-content'), 'PROMPT.md');
  void loadText(component.docs.design, document.querySelector('#design-content'), 'DESIGN.md');
}

const previewFrame = document.querySelector('#component-preview');

// Wired at module scope, not inside renderComponent: the frame is part of the static
// page, and a per-render subscription would stack another listener on every call.
if (previewFrame) {
  // Switching variant reloads the frame, so the theme has to ride the load event rather
  // than the mount call that precedes it.
  previewFrame.addEventListener('load', () =>
    sendPreviewTheme(previewFrame, getActiveTheme()),
  );
  onThemeChange((theme) => sendPreviewTheme(previewFrame, theme));
}

initializeThemeToggle();

if (component) {
  renderComponent(component);
} else {
  renderNotFound();
}
