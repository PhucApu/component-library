export const COMPONENT_GROUPS = Object.freeze([
  { id: 'inputs', label: 'Inputs', anchor: 'inputs' },
  { id: 'data-display', label: 'Data display', anchor: 'data-display' },
  { id: 'feedback', label: 'Feedback', anchor: 'feedback' },
  { id: 'surface', label: 'Surface', anchor: 'surface' },
  { id: 'navigation', label: 'Navigation', anchor: 'navigation' },
  { id: 'layout', label: 'Layout', anchor: 'layout' },
  { id: 'utilities', label: 'Utilities', anchor: 'utilities' },
]);

// An animation is grouped by the motion it performs rather than by the value it produces,
// so it needs its own taxonomy. No id is shared with the component taxonomy: the homepage
// renders one tab at a time and a duplicate id would put the same anchor on two sections.
export const ANIMATION_GROUPS = Object.freeze([
  { id: 'loaders', label: 'Loaders', anchor: 'loaders' },
  { id: 'transitions', label: 'Transitions', anchor: 'transitions' },
  { id: 'pointer-effects', label: 'Pointer effects', anchor: 'pointer-effects' },
  { id: 'backgrounds', label: 'Backgrounds', anchor: 'backgrounds' },
  { id: 'text-effects', label: 'Text effects', anchor: 'text-effects' },
  { id: 'scroll-effects', label: 'Scroll effects', anchor: 'scroll-effects' },
]);

export const CATALOG_TABS = Object.freeze([
  {
    id: 'components',
    label: 'Components',
    kind: 'component',
    title: 'All components',
    noun: 'component',
    groups: COMPONENT_GROUPS,
  },
  {
    id: 'animations',
    label: 'Animations',
    kind: 'animation',
    title: 'All animations',
    noun: 'animation',
    groups: ANIMATION_GROUPS,
  },
]);

// The tab a URL without a tab parameter lands on, and the tab an entry falls back to when
// its kind is missing or unknown.
export const DEFAULT_CATALOG_TAB = CATALOG_TABS[0];

const GROUP_BY_ID = new Map(
  [...COMPONENT_GROUPS, ...ANIMATION_GROUPS].map((group) => [group.id, group]),
);
const TAB_BY_ID = new Map(CATALOG_TABS.map((tab) => [tab.id, tab]));
const TAB_BY_KIND = new Map(CATALOG_TABS.map((tab) => [tab.kind, tab]));

export function getComponentGroup(groupId) {
  return GROUP_BY_ID.get(groupId) ?? {
    id: groupId || 'utilities',
    label: groupId || 'Utilities',
    anchor: groupId || 'utilities',
  };
}

export function getCatalogTab(tabId) {
  return TAB_BY_ID.get(tabId) ?? DEFAULT_CATALOG_TAB;
}

export function getTabForComponent(component) {
  return TAB_BY_KIND.get(component?.kind) ?? DEFAULT_CATALOG_TAB;
}
