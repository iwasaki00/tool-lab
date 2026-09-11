export interface ControlActions {
  day: () => void;
  night: () => void;
  box: () => void;
  sphere: () => void;
  building: () => void;
  random: () => void;
  reset: () => void;
}

export function createControls(actions: ControlActions): { updateCount: (count: number) => void; showToast: (message: string) => void } {
  const panel = document.querySelector<HTMLElement>(".control-panel");
  const count = document.querySelector<HTMLElement>("#object-count");
  const mode = document.querySelector<HTMLElement>("#mode-label");
  const toast = document.querySelector<HTMLElement>("#toast");
  let toastTimer = 0;

  panel?.addEventListener("click", (event) => {
    event.stopPropagation();
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (!button) return;
    const action = button.dataset.action as keyof ControlActions;
    actions[action]();
    if (action === "day" || action === "night") {
      panel.querySelectorAll(".mode-switch button").forEach((item) => item.classList.toggle("is-active", item === button));
      if (mode) mode.textContent = action === "day" ? "DAY CYCLE" : "NIGHT CYCLE";
    }
  });

  return {
    updateCount: (value) => { if (count) count.textContent = `OBJECTS ${String(value).padStart(3, "0")}`; },
    showToast: (message) => {
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add("is-visible");
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 1500);
    },
  };
}
