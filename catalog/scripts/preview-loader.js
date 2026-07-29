export function resolveCatalogAsset(relativePath) {
  return new URL(relativePath, document.baseURI).href;
}

export function getVariant(component, variantId) {
  return (
    component.variants.find((variant) => variant.id === variantId) ??
    component.variants[0] ??
    null
  );
}

const previewControllers = new WeakMap();

function getPreviewHeight(component) {
  const height = Number(component.preview?.viewport?.height);
  return Number.isFinite(height) && height > 0 ? height : 720;
}

function createPreviewController(frame, component) {
  const stage = frame.closest('.preview-stage');
  const expandedHeight = getPreviewHeight(component);
  let closedHeight = Math.min(320, expandedHeight);
  let mutationObserver;
  let resizeObserver;
  let destroyed = false;

  function disconnectDocumentObservers() {
    mutationObserver?.disconnect();
    resizeObserver?.disconnect();
    mutationObserver = undefined;
    resizeObserver = undefined;
  }

  function setExpanded(expanded) {
    if (!stage || destroyed) {
      return;
    }

    const compactStageHeight = stage.getBoundingClientRect().height;
    stage.classList.toggle('is-preview-open', expanded);
    frame.classList.toggle('is-preview-open', expanded);

    if (expanded) {
      stage.style.height = `${compactStageHeight}px`;
      frame.style.height = `${expandedHeight}px`;
    } else {
      stage.style.height = '';
      frame.style.height = `${closedHeight}px`;
    }
  }

  function measureClosedHeight(documentElement) {
    if (destroyed || frame.classList.contains('is-preview-open')) {
      return;
    }

    const body = documentElement.body;
    const bodyTop = body?.getBoundingClientRect().top ?? 0;
    const childBottom = body
      ? Math.max(
          bodyTop,
          ...[...body.children].map(
            (child) => child.getBoundingClientRect().bottom,
          ),
        )
      : 0;
    const measuredHeight = Math.ceil(
      Math.max(
        body?.getBoundingClientRect().height ?? 0,
        childBottom - bodyTop,
      ),
    );

    if (measuredHeight > 0) {
      closedHeight = Math.min(expandedHeight, Math.max(160, measuredHeight));
      frame.style.height = `${closedHeight}px`;
    }
  }

  function syncExpandedState(documentElement) {
    const expanded = [
      ...documentElement.querySelectorAll('[aria-expanded="true"]'),
    ].some((element) => element.getClientRects().length > 0);
    setExpanded(expanded);

    if (!expanded) {
      requestAnimationFrame(() => measureClosedHeight(documentElement));
    }
  }

  function attach() {
    disconnectDocumentObservers();

    try {
      const documentElement = frame.contentDocument;
      if (!documentElement?.documentElement) {
        frame.style.height = `${expandedHeight}px`;
        return;
      }

      measureClosedHeight(documentElement);
      syncExpandedState(documentElement);

      mutationObserver = new MutationObserver(() => {
        syncExpandedState(documentElement);
      });
      mutationObserver.observe(documentElement.documentElement, {
        attributes: true,
        attributeFilter: ['aria-expanded'],
        childList: true,
        subtree: true,
      });

      if ('ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(() => {
          measureClosedHeight(documentElement);
        });
        resizeObserver.observe(documentElement.documentElement);
        if (documentElement.body) {
          resizeObserver.observe(documentElement.body);
        }
      }
    } catch {
      frame.style.height = `${expandedHeight}px`;
    }
  }

  function destroy() {
    destroyed = true;
    disconnectDocumentObservers();
    frame.removeEventListener('load', attach);
    stage?.classList.remove('is-preview-open');
    frame.classList.remove('is-preview-open');
    stage?.style.removeProperty('height');
  }

  frame.style.height = `${closedHeight}px`;
  frame.addEventListener('load', attach);

  return { destroy };
}

export function mountPreview(frame, component, variant) {
  if (!frame || !component || !variant) {
    return;
  }

  previewControllers.get(frame)?.destroy();
  const controller = createPreviewController(frame, component);
  previewControllers.set(frame, controller);

  const entryPath = `components/${encodeURIComponent(component.id)}/${variant.entry}`;
  frame.title = `${component.name} - ${variant.name}`;
  frame.src = resolveCatalogAsset(entryPath);
}
