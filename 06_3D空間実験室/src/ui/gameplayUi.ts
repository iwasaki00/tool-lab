import type { InventoryEntry } from "../gameplay/InventoryManager";
import type { GameplayCallbacks } from "../contracts/ScenarioContracts";
import type { InteractionFocus } from "../interaction/Interactable";
import type { MissionResult, MissionRuntimeSnapshot } from "../gameplay/MissionTypes";

export interface GameplayUi {
  callbacks: GameplayCallbacks;
  setInteractHandler: (handler: () => void) => void;
}

export function createGameplayUi(mobile: boolean): GameplayUi {
  const prompt = document.querySelector<HTMLElement>("#interaction-prompt");
  const actionButton = document.querySelector<HTMLButtonElement>("#interact-button");
  const crosshair = document.querySelector<HTMLElement>(".crosshair");
  const objective = document.querySelector<HTMLElement>("#objective-text");
  const message = document.querySelector<HTMLElement>("#gameplay-message");
  const inventoryPanel = document.querySelector<HTMLElement>("#inventory-panel");
  const inventoryList = document.querySelector<HTMLElement>("#inventory-list");
  const inventoryToggle = document.querySelector<HTMLButtonElement>("#inventory-toggle");
  const inventoryClose = document.querySelector<HTMLButtonElement>("#inventory-close");
  const controlPanel = document.querySelector<HTMLElement>("#control-panel");
  const menuToggle = document.querySelector<HTMLButtonElement>("#menu-toggle");
  const missionComplete = document.querySelector<HTMLElement>("#mission-complete");
  const missionResult = document.querySelector<HTMLElement>("#mission-result");
  const missionProgress = document.querySelector<HTMLElement>("#mission-progress");
  const missionSummary = document.querySelector<HTMLElement>("#mission-summary");
  const missionDependency = document.querySelector<HTMLElement>("#mission-dependency");
  const missionLog = document.querySelector<HTMLOListElement>("#mission-log");
  let interact: () => void = () => undefined;
  let messageTimer = 0;

  const performInteraction = (event?: Event): void => {
    event?.preventDefault(); event?.stopPropagation();
    if (document.querySelector("#dialogue-panel")?.classList.contains("is-visible")) return;
    interact();
  };
  actionButton?.addEventListener("pointerdown", performInteraction, { passive: false });
  inventoryToggle?.addEventListener("click", (event) => { event.stopPropagation(); toggleInventory(); });
  inventoryClose?.addEventListener("click", (event) => { event.stopPropagation(); setInventoryOpen(false); });
  document.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.matches("input, textarea, select")) return;
    if (event.code === "KeyE" && !event.repeat) performInteraction(event);
    if (event.code === "KeyI" && !event.repeat) { event.preventDefault(); toggleInventory(); }
  });

  const callbacks: GameplayCallbacks = {
    onFocus: updateFocus,
    onMessage: showMessage,
    onObjective: (text) => { if (objective) objective.textContent = text; if (text !== "MISSION COMPLETE") missionComplete?.classList.remove("is-visible"); },
    onInventory: renderInventory,
    onMissionState: renderMissionState,
    onMissionComplete: (result) => {
      renderMissionResult(result);
      missionComplete?.classList.add("is-visible");
      window.setTimeout(() => missionComplete?.classList.remove("is-visible"), 7000);
    },
  };

  return { callbacks, setInteractHandler: (handler) => { interact = handler; } };

  function updateFocus(focus?: InteractionFocus): void {
    crosshair?.classList.toggle("is-interactable", Boolean(focus));
    if (prompt) {
      prompt.hidden = !focus || mobile;
      prompt.textContent = focus ? `[E] ${focus.actionLabel} — ${focus.displayName}` : "";
    }
    if (actionButton) {
      actionButton.hidden = !focus || !mobile;
      actionButton.textContent = focus ? focus.actionLabel : "操作";
    }
  }

  function showMessage(text: string): void {
    if (!message) return;
    message.textContent = text; message.classList.add("is-visible");
    window.clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => message.classList.remove("is-visible"), 2600);
  }

  function renderInventory(items: InventoryEntry[]): void {
    if (!inventoryList) return;
    inventoryList.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("li"); empty.textContent = "所持アイテムなし"; empty.className = "inventory-empty"; inventoryList.append(empty); return;
    }
    items.forEach((item) => {
      const row = document.createElement("li");
      const name = document.createElement("span"); name.textContent = item.name;
      const count = document.createElement("b"); count.textContent = `×${item.count}`;
      row.append(name, count); inventoryList.append(row);
    });
  }

  function renderMissionState(state: MissionRuntimeSnapshot): void {
    if (missionProgress) missionProgress.textContent = `MISSION ${state.completed} / ${state.total}`;
    if (missionSummary) {
      missionSummary.replaceChildren();
      const heading = document.createElement("strong"); heading.textContent = `${state.plan.type} / ${state.plan.difficulty}`; missionSummary.append(heading);
      const list = document.createElement("ol");
      state.plan.steps.forEach((step) => { const row = document.createElement("li"); row.className = `mission-step-${step.status.toLowerCase()}`; row.textContent = `${step.description}${step.optional ? " (OPTIONAL)" : ""}`; list.append(row); });
      missionSummary.append(list);
    }
    if (missionDependency) missionDependency.textContent = state.plan.steps.map((step) => `${step.prerequisites.stepIds.length ? step.prerequisites.stepIds.join(step.prerequisites.mode === "AND" ? " + " : " / ") : "START"} → ${step.id}`).join("\n");
    if (missionLog) {
      missionLog.replaceChildren(...state.logs.map((entry) => { const row = document.createElement("li"); row.textContent = `${formatTime(entry.elapsedSeconds)}  ${entry.message}`; return row; }));
    }
  }

  function renderMissionResult(result: MissionResult): void {
    if (!missionResult) return;
    missionResult.textContent = `${result.type} / ${result.difficulty}｜CLEAR ${formatTime(result.clearTimeSeconds)}｜STEPS ${result.completedSteps}/${result.totalSteps}｜OPTIONAL ${result.optionalCompleted}/${result.optionalTotal}｜SEED ${result.seed}`;
  }

  function toggleInventory(): void {
    if (!inventoryPanel) return;
    setInventoryOpen(inventoryPanel.hidden);
  }

  function setInventoryOpen(open: boolean): void {
    if (!inventoryPanel) return;
    inventoryPanel.hidden = !open;
    inventoryToggle?.setAttribute("aria-expanded", String(open));
    if (open) {
      // MENUの外に独立表示し、設定パネルとの重なりを避ける。
      controlPanel?.classList.remove("is-open");
      menuToggle?.setAttribute("aria-expanded", "false");
    }
  }
}

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}
