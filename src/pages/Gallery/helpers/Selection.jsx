// selection.js

export function toggleSelectImageHelper(id, selectedIds, setSelectedIds) {
  const newIds = new Set(selectedIds);
  if (newIds.has(id)) newIds.delete(id);
  else newIds.add(id);
  setSelectedIds(newIds);
}

export function selectAllHelper(imagesVisible, setSelectedIds) {
  setSelectedIds(new Set(imagesVisible.map((i) => i.id)));
}

export function clearSelectionHelper(setSelectedIds) {
  setSelectedIds(new Set());
}
