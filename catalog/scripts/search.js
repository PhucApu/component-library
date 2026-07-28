const DIACRITIC_PATTERN = /\p{Diacritic}/gu;

export function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(DIACRITIC_PATTERN, '')
    .toLocaleLowerCase('vi')
    .trim();
}

export function createSearchIndex(component) {
  return normalizeSearchText(
    [
      component.id,
      component.name,
      component.description,
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
