export interface MovementSettings {
  normalSpeed: number;
  shiftSpeed: number;
}

export const DEFAULT_MOVEMENT_SETTINGS: MovementSettings = {
  normalSpeed: 2.88,
  shiftSpeed: .32,
};

const STORAGE_KEY = "3d-space-lab-movement-settings";

export function normalizeMovementSettings(value: Partial<MovementSettings>): MovementSettings {
  return {
    normalSpeed: normalizeSpeed(value.normalSpeed, DEFAULT_MOVEMENT_SETTINGS.normalSpeed),
    shiftSpeed: normalizeSpeed(value.shiftSpeed, DEFAULT_MOVEMENT_SETTINGS.shiftSpeed),
  };
}

export function loadMovementSettings(): MovementSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<MovementSettings> | null;
    return normalizeMovementSettings(stored ?? DEFAULT_MOVEMENT_SETTINGS);
  } catch {
    return { ...DEFAULT_MOVEMENT_SETTINGS };
  }
}

export function saveMovementSettings(settings: MovementSettings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeMovementSettings(settings))); } catch { /* Private browsing may disable storage. */ }
}

function normalizeSpeed(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.round(Math.min(8, Math.max(.05, value!)) * 100) / 100;
}
