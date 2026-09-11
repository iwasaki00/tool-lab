import type { Engine } from "@babylonjs/core/Engines/engine";
import type { LaboratoryApi } from "../scene/createScene";

export type RendererName = "WebGL2" | "WebGL";

export function getRendererName(engine: Engine): RendererName {
  return engine.webGLVersion >= 2 ? "WebGL2" : "WebGL";
}

export function updateDebugReadout(engine: Engine, laboratory: LaboratoryApi, mobile: boolean): void {
  const canvas = engine.getRenderingCanvas();
  const telemetry = laboratory.telemetry();
  setText("renderer-value", getRendererName(engine));
  setText("canvas-value", canvas ? `${canvas.width} × ${canvas.height}` : "0 × 0");
  setText("viewport-value", `${Math.round(window.visualViewport?.width ?? window.innerWidth)} × ${Math.round(window.visualViewport?.height ?? window.innerHeight)}`);
  setText("device-value", mobile ? "Mobile" : "Desktop");
  setText("fps-value", String(Math.round(engine.getFps())));
  setText("mesh-value", String(laboratory.objectCount()));
  setText("camera-value", `${telemetry.x.toFixed(1)} / ${telemetry.y.toFixed(1)} / ${telemetry.z.toFixed(1)}`);
}

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}
