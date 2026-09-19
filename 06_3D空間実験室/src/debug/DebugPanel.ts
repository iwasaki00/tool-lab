import type { LaboratoryApi } from "../scene/createScene";
import type { MissionGuideMode } from "../gameplay/MissionGuideManager";
import type { DebugCommand } from "./DebugTestManager";

export interface DebugPanelActions {
  laboratory: () => LaboratoryApi;
  completeGame: () => void;
  failGame: () => void;
  pauseTimer: (paused: boolean) => void;
  adjustTime: (seconds: number) => void;
  adjustScore: (points: number) => void;
  resetScore: () => void;
  resetTestState: () => void;
  restartGame: () => void;
  setSpeedMultiplier: (multiplier: number) => void;
  guideMode: (mode: MissionGuideMode) => void;
  setSimulationSpeed: (scale: number) => void;
  setSimulationPaused: (paused: boolean) => void;
  snapshotHeader: () => string[];
  panelOpenChanged: (open: boolean) => void;
}

export function createDebugPanel(actions: DebugPanelActions): { update: () => void; isOpen: () => boolean; open: () => void } {
  const panel = document.querySelector<HTMLElement>("#debug-test-panel"); const toggle = document.querySelector<HTMLButtonElement>("#play-test-toggle");
  let timerPaused = false; let noClip = false; let simulationPaused = false; let selectMode = false;
  const setOpen = (open: boolean) => { if (panel) panel.hidden = !open; toggle?.setAttribute("aria-expanded", String(open)); actions.panelOpenChanged(open); if (open) update(); };
  toggle?.addEventListener("click", (event) => { event.stopPropagation(); setOpen(Boolean(panel?.hidden)); });
  document.querySelector("#debug-test-close")?.addEventListener("click", () => setOpen(false));
  panel?.addEventListener("pointerdown", (event) => event.stopPropagation());
  panel?.addEventListener("click", (event) => {
    event.stopPropagation(); const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button"); if (!button) return;
    const command = button.dataset.debugCommand as DebugCommand | undefined; if (command) actions.laboratory().debugCommand(command, button.dataset.debugValue);
    if (button.dataset.debugTeleport) actions.laboratory().debugCommand(button.dataset.debugTeleport === "goal" ? "teleport-goal" : "teleport-current");
    if (button.dataset.debugStep) actions.laboratory().debugJumpTo(button.dataset.debugStep);
    if (button.dataset.debugFloor) actions.laboratory().debugCommand("teleport-floor", Number(button.dataset.debugFloor));
    if (button.dataset.debugEnemy) actions.laboratory().debugEnemy(button.dataset.debugEnemy as Parameters<LaboratoryApi["debugEnemy"]>[0]);
    if (button.dataset.debugDiscovery) actions.laboratory().debugDiscovery(button.dataset.debugDiscovery as Parameters<LaboratoryApi["debugDiscovery"]>[0]);
    if (button.dataset.debugGuide) actions.guideMode(button.dataset.debugGuide as MissionGuideMode);
    if (button.dataset.debugSpeed) actions.setSpeedMultiplier(Number(button.dataset.debugSpeed));
    if (button.dataset.debugTime) actions.adjustTime(Number(button.dataset.debugTime));
    if (button.dataset.debugScore) actions.adjustScore(Number(button.dataset.debugScore));
    if (button.dataset.debugGameSpeed) actions.setSimulationSpeed(Number(button.dataset.debugGameSpeed));
    if (button.id === "debug-complete-game") actions.completeGame(); if (button.id === "debug-fail-game") actions.failGame();
    if (button.id === "debug-timer-pause") { timerPaused = !timerPaused; actions.pauseTimer(timerPaused); button.textContent = timerPaused ? "RESUME TIMER" : "PAUSE TIMER"; }
    if (button.id === "debug-score-reset") actions.resetScore();
    if (button.id === "debug-simulation-pause") { simulationPaused = !simulationPaused; actions.setSimulationPaused(simulationPaused); button.textContent = simulationPaused ? "RESUME SIMULATION" : "PAUSE SIMULATION"; }
    if (button.id === "debug-no-clip") { noClip = !noClip; actions.laboratory().setNoClip(noClip); button.textContent = `NO CLIP ${noClip ? "ON" : "OFF"}`; }
    if (button.id === "debug-select-mode") { selectMode = !selectMode; actions.laboratory().setDebugSelectMode(selectMode); button.textContent = `DEBUG SELECT ${selectMode ? "ON" : "OFF"}`; }
    if (button.id === "debug-reset-state") actions.resetTestState(); if (button.id === "debug-restart-game") actions.restartGame(); update();
  });
  document.querySelector<HTMLSelectElement>("#debug-room-select")?.addEventListener("change", (event) => { const id = (event.target as HTMLSelectElement).value; if (id) actions.laboratory().debugCommand("teleport-room", id); update(); });
  return { update, isOpen: () => Boolean(panel && !panel.hidden), open: () => setOpen(true) };

  function update(): void {
    if (!panel || panel.hidden) return; const laboratory = actions.laboratory(); const state = laboratory.debugTest(); const characters = laboratory.characterDebug(); const navigation = laboratory.navigationDebug();
    const missionList = document.querySelector<HTMLOListElement>("#debug-mission-steps"); if (missionList) missionList.replaceChildren(...state.mission.plan.steps.map((step, index) => { const row = document.createElement("li"); const button = document.createElement("button"); button.dataset.debugStep = step.id; button.textContent = `${index + 1}. ${step.description} — ${step.status}`; row.append(button); return row; }));
    setText("debug-inventory-list", state.inventory.length ? state.inventory.map((item) => `${item.id} ×${item.count}`).join("\n") : "EMPTY");
    const doorList = document.querySelector<HTMLElement>("#debug-door-list"); if (doorList) { doorList.replaceChildren(); state.doors.forEach((item) => doorList.append(objectControls(item.id, item.state, ["door-unlock", "door-open", "door-close", "door-lock"]))); state.switches.forEach((item) => doorList.append(objectControls(item.id, item.state, ["switch-on", "switch-off", "switch-toggle"]))); if (!state.doors.length && !state.switches.length) doorList.textContent = "—"; }
    setText("debug-player-position", `X: ${state.player.x.toFixed(2)}\nY: ${state.player.y.toFixed(2)}\nZ: ${state.player.z.toFixed(2)}\nAREA: ${state.player.area}\nFLOOR: ${state.player.floor}\nROOM: ${state.player.room}`);
    const detection = characters.detectionInfo; setText("debug-detection-info", detection ? `DETECTION ${(detection.level * 100).toFixed(0)}%\nLOS ${detection.lineOfSight ? "YES" : "NO"}\nFOV ${detection.inFov ? "YES" : "NO"}\nDISTANCE ${detection.distance.toFixed(1)}m` : "NO ENEMY");
    const discovery = laboratory.discovery();
    setText("debug-world-info", `NAVIGATION ${navigation.status} / ${navigation.mode}\nAREA ${state.player.area}\nTYPE ${laboratory.semanticDebug().area?.type ?? "—"}\nTAGS ${state.player.tags}\nBUILDING ${state.player.building}\nFLOOR ${state.player.floor}\nROOM ${state.player.room}\nDISCOVERY ${discovery.discovered}/${discovery.target}`);
    setText("debug-selected-object", state.selected ? `ID ${state.selected.id}\nTYPE ${state.selected.type}\nPOSITION ${state.selected.x.toFixed(2)} / ${state.selected.y.toFixed(2)} / ${state.selected.z.toFixed(2)}\nSTATE ${state.selected.state}\nINTERACTION ${state.selected.interaction}\nAREA ${state.selected.area}\nDISTANCE ${state.selected.distance.toFixed(1)}m` : "NO SELECTION");
    const roomSelect = document.querySelector<HTMLSelectElement>("#debug-room-select"); if (roomSelect) { const selected = roomSelect.value; roomSelect.replaceChildren(new Option("—", ""), ...state.rooms.map((room) => new Option(`${room.type} / F${room.floor ?? "?"} / ${room.id}`, room.id))); roomSelect.value = selected; }
    const objects = document.querySelector<HTMLUListElement>("#debug-object-list"); if (objects) objects.replaceChildren(...state.objects.map((item) => { const row = document.createElement("li"); row.textContent = `${item.type} — ${item.id}`; return row; }));
    setText("debug-text-snapshot", [...actions.snapshotHeader(), `STEP=${state.mission.completed}/${state.mission.total}`, `OBJECTIVE=${state.mission.current?.id ?? "COMPLETE"}`, `PLAYER_AREA=${state.player.area}`, `NAVIGATION=${navigation.mode}`, `ENEMY=${characters.enemyCount}`].join("\n"));
    const log = document.querySelector<HTMLOListElement>("#debug-action-log"); if (log) log.replaceChildren(...state.logs.slice(-50).reverse().map((message) => { const row = document.createElement("li"); row.textContent = message; return row; }));
  }
}

function objectControls(id: string, state: string, commands: DebugCommand[]): HTMLElement { const row = document.createElement("section"); const label = document.createElement("small"); label.textContent = `${id} — ${state}`; row.append(label); const controls = document.createElement("div"); controls.className = "debug-tool-grid"; commands.forEach((command) => { const button = document.createElement("button"); button.dataset.debugCommand = command; button.dataset.debugValue = id; button.textContent = command.replace(/^(door|switch)-/, "").toUpperCase(); controls.append(button); }); row.append(controls); return row; }

function setText(id: string, value: string): void { const element = document.getElementById(id); if (element) element.textContent = value; }
