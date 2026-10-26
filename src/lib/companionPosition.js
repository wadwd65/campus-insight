/** Persist only the portrait's relative screen position, never account or answer data. */
export const POSITION_STORAGE_KEY = 'campus-insight:companion-position:v1';

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const dimension = (value) => finite(value) ? Math.max(0, value) : 0;
const validGeometry = (value) => finite(value?.width) && value.width >= 0 && finite(value?.height) && value.height >= 0;
const validPreference = (value) => finite(value?.rx) && value.rx >= 0 && value.rx <= 1 && finite(value?.ry) && value.ry >= 0 && value.ry <= 1;

function axisBounds(viewport, extent, startMargin, endMargin) {
  const space = Math.max(0, dimension(viewport) - dimension(extent));
  // Shrink the starting margin only when the portrait cannot otherwise fit.
  // If the portrait itself is larger than the viewport, anchor at zero.
  const min = Math.min(startMargin, space);
  return {min, max: Math.max(min, space - endMargin)};
}

function positionBounds(viewport, size) {
  return {
    x: axisBounds(viewport?.width, size?.width, 8, 8),
    y: axisBounds(viewport?.height, size?.height, 42, 8),
  };
}

function clamp(value, bounds) {
  return Math.min(bounds.max, Math.max(bounds.min, finite(value) ? value : bounds.min));
}

export function clampCompanionPosition(position, viewport, size) {
  const bounds = positionBounds(viewport, size);
  return {x: clamp(position?.x, bounds.x), y: clamp(position?.y, bounds.y)};
}

export function readCompanionPosition(storage) {
  try {
    const value = JSON.parse(storage.getItem(POSITION_STORAGE_KEY));
    if (value?.version !== 1 || !validPreference(value)) return null;
    return {rx: value.rx, ry: value.ry};
  } catch {
    return null;
  }
}

export function restoreCompanionPosition(preference, viewport, size) {
  if (!validPreference(preference) || !validGeometry(viewport) || !validGeometry(size)) return null;
  const bounds = positionBounds(viewport, size);
  return {
    x: bounds.x.min + preference.rx * (bounds.x.max - bounds.x.min),
    y: bounds.y.min + preference.ry * (bounds.y.max - bounds.y.min),
  };
}

export function saveCompanionPosition(storage, position, viewport, size) {
  if (!finite(position?.x) || !finite(position?.y) || !validGeometry(viewport) || !validGeometry(size)) return false;
  const bounds = positionBounds(viewport, size);
  const current = clampCompanionPosition(position, viewport, size);
  const ratio = (value, axis) => axis.max > axis.min ? (value - axis.min) / (axis.max - axis.min) : 0;
  try {
    storage.setItem(POSITION_STORAGE_KEY, JSON.stringify({
      version: 1,
      rx: ratio(current.x, bounds.x),
      ry: ratio(current.y, bounds.y),
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearCompanionPosition(storage) {
  try {
    storage.removeItem(POSITION_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
