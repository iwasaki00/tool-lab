export interface ControlActions {
  day: () => void;
  night: () => void;
  box: () => void;
  sphere: () => void;
  building: () => void;
  random: () => void;
  debug: () => void;
  reset: () => void;
}

export function createControls(actions: ControlActions): {
  updateCount: (count: number) => void;
  updateTelemetry: (fps: number, x: number, z: number) => void;
  setMode: (mode: "day" | "night") => void;
  showToast: (message: string) => void;
} {
  const panel = document.querySelector<HTMLElement>(".control-panel");
  const count = document.querySelector<HTMLElement>("#object-count");
  const mode = document.querySelector<HTMLElement>("#mode-label");
  const toast = document.querySelector<HTMLElement>("#toast");
  const performance = document.querySelector<HTMLElement>("#performance-label");
  let toastTimer = 0;

  panel?.addEventListener("click", (event) => {
    event.stopPropagation();
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (!button) return;
    const action = button.dataset.action as keyof ControlActions;
    actions[action]();
    if (action === "day" || action === "night") {
      setMode(action);
    }
  });

  return {
    updateCount: (value) => { if (count) count.textContent = `OBJECTS ${String(value).padStart(3, "0")}`; },
    updateTelemetry: (fps, x, z) => { if (performance) performance.textContent = `${Math.round(fps)} FPS · X ${x.toFixed(1)} Z ${z.toFixed(1)}`; },
    setMode,
    showToast: (message) => {
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add("is-visible");
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 1500);
    },
  };

  function setMode(value: "day" | "night"): void {
    panel?.querySelectorAll<HTMLButtonElement>(".mode-switch button").forEach((item) => item.classList.toggle("is-active", item.dataset.action === value));
    if (mode) mode.textContent = value === "day" ? "DAY CYCLE" : "NIGHT CYCLE";
  }
}
