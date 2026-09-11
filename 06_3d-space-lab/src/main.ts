import "@babylonjs/core/Collisions/collisionCoordinator";
import { Engine } from "@babylonjs/core";
import "./style.css";
import { createLaboratoryScene, type LaboratoryApi } from "./scene/createScene";
import { createControls } from "./ui/createControls";

const canvas = document.querySelector<HTMLCanvasElement>("#render-canvas");
if (!canvas) throw new Error("Rendering canvas was not found.");

const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
let laboratory: LaboratoryApi = createLaboratoryScene(engine, canvas);

const controls = createControls({
  day: () => { laboratory.setDayMode(true); controls.showToast("昼モードに切り替えました"); },
  night: () => { laboratory.setDayMode(false); controls.showToast("夜モードに切り替えました"); },
  box: () => { laboratory.addBox(); refresh("箱を追加しました"); },
  sphere: () => { laboratory.addSphere(); refresh("球を追加しました"); },
  building: () => { laboratory.addBuilding(); refresh("建物を生成しました"); },
  random: () => { laboratory.randomize(); refresh("実験オブジェクトを再配置しました"); },
  reset: () => {
    laboratory.scene.dispose();
    laboratory = createLaboratoryScene(engine, canvas);
    refresh("シーンを初期化しました");
  },
});

function refresh(message: string): void {
  controls.updateCount(laboratory.objectCount());
  controls.showToast(message);
}

controls.updateCount(laboratory.objectCount());
engine.runRenderLoop(() => laboratory.scene.render());
window.addEventListener("resize", () => engine.resize());

canvas.addEventListener("click", () => {
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
});
document.addEventListener("pointerlockchange", () => {
  document.querySelector("#start-guide")?.classList.toggle("is-hidden", document.pointerLockElement === canvas);
});
