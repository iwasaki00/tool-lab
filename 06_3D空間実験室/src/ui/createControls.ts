import { normalizeSeed } from "../random/seededRandom";
import { CITY_STYLE_OPTIONS, resolveCityStyle } from "../world/cityStyles";
import { saveCitySettings } from "../world/citySettingsStorage";
import { DEFAULT_CITY_SETTINGS, type BuildingDensity, type CitySettings, type CitySize, type CityStyle, type HeightProfile, type WorldMode } from "../world/types";
import type { MissionGuideMode } from "../gameplay/MissionGuideManager";
import { normalizeMovementSettings, saveMovementSettings, type MovementSettings } from "../player/movementSettings";
import type { MissionDifficulty, MissionType } from "../gameplay/MissionTypes";

export interface ControlActions {
  day: () => void;
  night: () => void;
  box: () => void;
  sphere: () => void;
  building: () => void;
  random: () => void;
  debug: () => void;
  reset: () => void;
  selectWorld: (mode: WorldMode, settings: CitySettings) => void;
  regenerateCity: (settings: CitySettings) => void;
  guideMode: (mode: MissionGuideMode) => void;
  movementSpeed: (settings: MovementSettings) => void;
  restartMission: (settings: CitySettings) => void;
  regenerateMission: (settings: CitySettings) => void;
  enemyAI: (enabled: boolean) => void;
  missionTestMode: (enabled: boolean) => void;
}

export function createControls(actions: ControlActions, initialSettings: CitySettings, initialMovementSettings: MovementSettings): {
  updateTelemetry: (fps: number, mode: WorldMode, seed?: number, style?: string) => void;
  setMode: (mode: "day" | "night") => void;
  setWorldMode: (mode: WorldMode) => void;
  getCitySettings: () => CitySettings;
  showToast: (message: string) => void;
} {
  const panel = document.querySelector<HTMLElement>("#control-panel");
  const menuToggle = document.querySelector<HTMLButtonElement>("#menu-toggle");
  const debugToggle = document.querySelector<HTMLButtonElement>("#debug-toggle");
  const debugReadout = document.querySelector<HTMLElement>("#debug-readout");
  const citySettingsPanel = document.querySelector<HTMLElement>("#city-settings");
  const modeLabel = document.querySelector<HTMLElement>("#mode-label");
  const toast = document.querySelector<HTMLElement>("#toast");
  const styleSelect = document.querySelector<HTMLSelectElement>("#city-style");
  let toastTimer = 0;
  let enemyAIEnabled = true;
  let missionTestMode = false;

  if (styleSelect) {
    styleSelect.replaceChildren(...CITY_STYLE_OPTIONS.map((option) => {
      const element = document.createElement("option");
      element.value = option.id; element.textContent = option.label;
      return element;
    }));
  }
  applySettings(initialSettings);
  applyMovementSettings(initialMovementSettings);
  updateInterpretation();

  menuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = !panel?.classList.contains("is-open");
    panel?.classList.toggle("is-open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
  });
  debugToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!debugReadout) return;
    const open = debugReadout.hidden;
    debugReadout.hidden = !open;
    debugToggle.setAttribute("aria-expanded", String(open));
    actions.debug();
  });

  panel?.addEventListener("click", (event) => {
    event.stopPropagation();
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;
    const world = button.dataset.world as WorldMode | undefined;
    if (world) {
      setWorldMode(world);
      actions.selectWorld(world, getCitySettings());
      return;
    }
    switch (button.dataset.action) {
      case "day": actions.day(); setMode("day"); break;
      case "night": actions.night(); setMode("night"); break;
      case "box": actions.box(); break;
      case "sphere": actions.sphere(); break;
      case "building": actions.building(); break;
      case "random": actions.random(); break;
      case "debug": actions.debug(); break;
      case "reset": actions.reset(); break;
      case "random-seed": {
        const input = document.querySelector<HTMLInputElement>("#seed-input");
        if (input) input.value = String(Math.floor(Math.random() * 4294967294) + 1);
        persistAndGenerate();
        break;
      }
      case "regenerate-city": persistAndGenerate(); break;
      case "restart-mission": actions.restartMission(getCitySettings()); break;
      case "regenerate-mission": actions.regenerateMission(getCitySettings()); break;
      case "toggle-enemy-ai": {
        enemyAIEnabled = !enemyAIEnabled; button.classList.toggle("is-active", enemyAIEnabled); button.textContent = `ENEMY AI ${enemyAIEnabled ? "ON" : "OFF"}`; actions.enemyAI(enemyAIEnabled); break;
      }
      case "toggle-mission-test": {
        missionTestMode = !missionTestMode; button.classList.toggle("is-active", missionTestMode); button.textContent = `MISSION TEST ${missionTestMode ? "ON" : "OFF"}`; actions.missionTestMode(missionTestMode); break;
      }
    }
  });
  panel?.addEventListener("input", (event) => {
    const target = event.target as HTMLSelectElement;
    if (target.id === "mission-guide-mode") actions.guideMode(target.value as MissionGuideMode);
    if (target.id === "normal-speed-input" || target.id === "shift-speed-input") {
      const settings = getMovementSettings();
      saveMovementSettings(settings);
      actions.movementSpeed(settings);
      return;
    }
    updateInterpretation();
    saveCitySettings(getCitySettings());
  });

  return { updateTelemetry, setMode, setWorldMode, getCitySettings, showToast };

  function updateTelemetry(fps: number, mode: WorldMode, seed?: number, style?: string): void {
    setText("compact-fps", `${Math.round(fps)} FPS`);
    setText("compact-mode", mode === "city" ? "街生成" : "実験フィールド");
    setText("compact-seed", seed ? `SEED ${seed}` : "SEED —");
    setText("compact-style", style ?? "STYLE —");
  }

  function setMode(value: "day" | "night"): void {
    panel?.querySelectorAll<HTMLButtonElement>(".mode-switch button").forEach((item) => item.classList.toggle("is-active", item.dataset.action === value));
    if (modeLabel) modeLabel.textContent = value === "day" ? "DAY CYCLE" : "NIGHT CYCLE";
  }

  function setWorldMode(value: WorldMode): void {
    panel?.querySelectorAll<HTMLButtonElement>(".world-switch button").forEach((item) => item.classList.toggle("is-active", item.dataset.world === value));
    if (citySettingsPanel) citySettingsPanel.hidden = value !== "city";
  }

  function getCitySettings(): CitySettings {
    return {
      seed: normalizeSeed(document.querySelector<HTMLInputElement>("#seed-input")?.value ?? DEFAULT_CITY_SETTINGS.seed),
      missionSeed: normalizeSeed(document.querySelector<HTMLInputElement>("#mission-seed-input")?.value ?? DEFAULT_CITY_SETTINGS.missionSeed),
      size: (document.querySelector<HTMLSelectElement>("#city-size")?.value as CitySize) ?? DEFAULT_CITY_SETTINGS.size,
      density: (document.querySelector<HTMLSelectElement>("#city-density")?.value as BuildingDensity) ?? DEFAULT_CITY_SETTINGS.density,
      height: (document.querySelector<HTMLSelectElement>("#city-height")?.value as HeightProfile) ?? DEFAULT_CITY_SETTINGS.height,
      style: (styleSelect?.value as CityStyle) ?? DEFAULT_CITY_SETTINGS.style,
      customText: document.querySelector<HTMLTextAreaElement>("#city-image-text")?.value.trim().slice(0, 160) ?? "",
      missionType: (document.querySelector<HTMLSelectElement>("#mission-type")?.value as MissionType) ?? DEFAULT_CITY_SETTINGS.missionType,
      missionDifficulty: (document.querySelector<HTMLSelectElement>("#mission-difficulty")?.value as MissionDifficulty) ?? DEFAULT_CITY_SETTINGS.missionDifficulty,
    };
  }

  function applySettings(settings: CitySettings): void {
    setValue("seed-input", String(settings.seed));
    setValue("mission-seed-input", String(settings.missionSeed));
    setValue("city-size", settings.size);
    setValue("city-density", settings.density);
    setValue("city-height", settings.height);
    setValue("city-style", settings.style);
    setValue("city-image-text", settings.customText);
    setValue("mission-type", settings.missionType);
    setValue("mission-difficulty", settings.missionDifficulty);
  }

  function getMovementSettings(): MovementSettings {
    return normalizeMovementSettings({
      normalSpeed: Number(document.querySelector<HTMLInputElement>("#normal-speed-input")?.value),
      shiftSpeed: Number(document.querySelector<HTMLInputElement>("#shift-speed-input")?.value),
    });
  }

  function applyMovementSettings(settings: MovementSettings): void {
    setValue("normal-speed-input", String(settings.normalSpeed));
    setValue("shift-speed-input", String(settings.shiftSpeed));
  }

  function updateInterpretation(): void {
    const resolved = resolveCityStyle(getCitySettings());
    setText("style-analysis", resolved.interpretation);
  }

  function persistAndGenerate(): void {
    const settings = getCitySettings();
    saveCitySettings(settings);
    updateInterpretation();
    actions.regenerateCity(settings);
  }

  function showToast(message: string): void {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 1500);
  }
}

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setValue(id: string, value: string): void {
  const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  if (element) element.value = value;
}
