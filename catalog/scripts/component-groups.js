export const COMPONENT_GROUPS = Object.freeze([
  { id: 'inputs', label: 'Inputs', anchor: 'inputs' },
  { id: 'data-display', label: 'Data display', anchor: 'data-display' },
  { id: 'feedback', label: 'Feedback', anchor: 'feedback' },
  { id: 'surface', label: 'Surface', anchor: 'surface' },
  { id: 'navigation', label: 'Navigation', anchor: 'navigation' },
  { id: 'layout', label: 'Layout', anchor: 'layout' },
  { id: 'utilities', label: 'Utilities', anchor: 'utilities' },
]);

const GROUP_BY_ID = new Map(COMPONENT_GROUPS.map((group) => [group.id, group]));

export function getComponentGroup(groupId) {
  return GROUP_BY_ID.get(groupId) ?? {
    id: groupId || 'utilities',
    label: groupId || 'Utilities',
    anchor: groupId || 'utilities',
  };
}
