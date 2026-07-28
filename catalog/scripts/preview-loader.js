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

export function mountPreview(frame, component, variant) {
  if (!frame || !component || !variant) {
    return;
  }

  const entryPath = `components/${encodeURIComponent(component.id)}/${variant.entry}`;
  frame.title = `${component.name} — ${variant.name}`;
  frame.src = resolveCatalogAsset(entryPath);
}
