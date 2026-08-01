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

/**
 * The theme message a preview may implement. The name and payload carry no catalog
 * identity on purpose: a downloaded component keeps the listener, answers whoever embeds
 * it, and falls back to `prefers-color-scheme` when nobody does. A preview that ignores
 * the message simply keeps its own colours.
 */
export const PREVIEW_THEME_MESSAGE = 'ui-theme';

function previewOrigin(frame) {
  try {
    // Addressing the exact origin keeps the message out of any document that replaced
    // the preview, which a wildcard target would happily deliver to.
    const origin = new URL(frame.src, document.baseURI).origin;
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

export function sendPreviewTheme(frame, theme) {
  const origin = frame?.src ? previewOrigin(frame) : null;

  if (!frame?.contentWindow || !origin) {
    return;
  }

  // Form controls the preview does not paint itself still come from the browser, so the
  // frame needs the scheme even when the component answers the message.
  frame.style.colorScheme = theme;
  frame.contentWindow.postMessage({ type: PREVIEW_THEME_MESSAGE, theme }, origin);
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
