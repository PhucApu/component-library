import { getComponentGroup } from './component-groups.js';

const DIACRITIC_PATTERN = /\p{Diacritic}/gu;

export function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(DIACRITIC_PATTERN, '')
    .toLocaleLowerCase('en')
    .trim();
}

export function createSearchIndex(component) {
  const group = getComponentGroup(component.group);

  return normalizeSearchText(
    [
      component.id,
      component.name,
      component.description,
      group.id,
      group.label,
      ...(component.categories ?? []),
      ...(component.tags ?? []),
    ].join(' '),
  );
}

export function filterComponents(components, query) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return components;
  }

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  return components.filter((component) => {
    const searchIndex = component.searchIndex ?? createSearchIndex(component);
    return terms.every((term) => searchIndex.includes(term));
  });
}
