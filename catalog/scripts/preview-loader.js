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

function getPreviewHeight(component) {
  const height = Number(component.preview?.viewport?.height);
  return Number.isFinite(height) && height > 0 ? height : 720;
}

export function mountPreview(frame, component, variant) {
  if (!frame || !component || !variant) {
    return;
  }

  // The stage holds one constant height for every preview state. A component panel
  // opens inside the iframe and cannot escape it, so growing the frame on open would
  // reflow the detail page around it every time the user opens or closes a control.
  frame.style.height = `${getPreviewHeight(component)}px`;

  const entryPath = `components/${encodeURIComponent(component.id)}/${variant.entry}`;
  frame.title = `${component.name} - ${variant.name}`;
  frame.src = resolveCatalogAsset(entryPath);
}
