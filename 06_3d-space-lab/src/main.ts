import "@babylonjs/core/Collisions/collisionCoordinator";
import { Engine } from "@babylonjs/core";
import "./style.css";
import { createLaboratoryScene, type LaboratoryApi } from "./scene/createScene";
import { createControls } from "./ui/createControls";
import { registerWebMcp } from "./ui/registerWebMcp";

const canvas = document.querySelector<HTMLCanvasElement>("#render-canvas");
if (!canvas) throw new Error("Rendering canvas was not found.");

const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
let laboratory: LaboratoryApi = createLaboratoryScene(engine, canvas);

const controls = createControls({
  day: () => setTime("day"),
  night: () => setTime("night"),
  box: () => { laboratory.addBox(); refresh("箱を追加しました"); },
  sphere: () => { laboratory.addSphere(); refresh("球を追加しました"); },
  building: () => { laboratory.addBuilding(); refresh("建物を生成しました"); },
  random: () => { laboratory.randomize(); refresh("実験オブジェクトを再配置しました"); },
  reset: () => {
    laboratory.scene.dispose();
    laboratory = createLaboratoryScene(engine, canvas);
    controls.setMode("day");
    refresh("シーンを初期化しました");
  },
});

function refresh(message: string): void {
  controls.updateCount(laboratory.objectCount());
  controls.showToast(message);
}

controls.updateCount(laboratory.objectCount());
let lastTelemetryUpdate = 0;
engine.runRenderLoop(() => {
  laboratory.scene.render();
  const now = performance.now();
  if (now - lastTelemetryUpdate > 250) {
    const telemetry = laboratory.telemetry();
    controls.updateTelemetry(engine.getFps(), telemetry.x, telemetry.z);
    lastTelemetryUpdate = now;
  }
});
window.addEventListener("resize", () => engine.resize());

canvas.addEventListener("click", () => {
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
});
document.addEventListener("pointerlockchange", () => {
  document.querySelector("#start-guide")?.classList.toggle("is-hidden", document.pointerLockElement === canvas);
});

function setTime(mode: "day" | "night"): void {
  laboratory.setDayMode(mode === "day");
  controls.setMode(mode);
  controls.showToast(mode === "day" ? "昼モードに切り替えました" : "夜モードに切り替えました");
}

registerWebMcp({
  addObject: (type) => {
    if (type === "box") laboratory.addBox();
    else if (type === "sphere") laboratory.addSphere();
    else laboratory.addBuilding();
    refresh(`${type} を追加しました`);
  },
  setTime,
  randomize: () => { laboratory.randomize(); refresh("実験オブジェクトを再配置しました"); },
  getStatus: () => ({ objectCount: laboratory.objectCount(), ...laboratory.telemetry() }),
});
