const STORAGE_KEY = "water-strobe-state-v1";

export const DEFAULT_STATE = {
  frequency: 10,
  duty: 10,
  autoStop: 60,
  wakeLock: true,
  recordingEnabled: false,
  presets: [],
  stopPoints: []
};

export function loadState(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
    if (!saved) return { ...DEFAULT_STATE };
    return {
      ...DEFAULT_STATE,
      ...saved,
      presets: Array.isArray(saved.presets) ? saved.presets : [],
      stopPoints: Array.isArray(saved.stopPoints) ? saved.stopPoints : []
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state, storage = globalThis.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function makePresetName(presets) {
  let index = 1;
  const names = new Set(presets.map((preset) => preset.name));
  while (names.has(`Preset ${index}`)) index += 1;
  return `Preset ${index}`;
}

