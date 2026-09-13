import type { Engine } from "@babylonjs/core/Engines/engine";
import type { LaboratoryApi } from "../scene/createScene";

export type RendererName = "WebGL2" | "WebGL";

export function getRendererName(engine: Engine): RendererName {
  return engine.webGLVersion >= 2 ? "WebGL2" : "WebGL";
}

export function updateDebugReadout(engine: Engine, laboratory: LaboratoryApi, mobile: boolean): void {
  const canvas = engine.getRenderingCanvas();
  const telemetry = laboratory.telemetry();
  const city = laboratory.cityStats();
  const interaction = laboratory.interactionDebug();
  const interior = laboratory.interiorDebug();
  setText("renderer-value", getRendererName(engine));
  setText("canvas-value", canvas ? `${canvas.width} × ${canvas.height}` : "0 × 0");
  setText("viewport-value", `${Math.round(window.visualViewport?.width ?? window.innerWidth)} × ${Math.round(window.visualViewport?.height ?? window.innerHeight)}`);
  setText("device-value", mobile ? "Mobile" : "Desktop");
  setText("fps-value", String(Math.round(engine.getFps())));
  setText("mesh-value", String(laboratory.objectCount()));
  setText("camera-value", `${telemetry.x.toFixed(1)} / ${telemetry.y.toFixed(1)} / ${telemetry.z.toFixed(1)}`);
  setText("city-seed-value", city ? String(city.seed) : "—");
  setText("building-count-value", city ? String(city.buildingCount) : "0");
  setText("road-count-value", city ? String(city.roadCount) : "0");
  setText("city-object-count-value", city ? String(city.objectCount) : "0");
  setText("generation-time-value", city ? `${city.generationTime.toFixed(1)} ms` : "—");
  setText("city-style-value", city?.styleLabel ?? "—");
  setText("interpretation-value", city?.interpretation ?? "—");
  setText("focus-value", interaction?.id ?? "—");
  setText("interaction-type-value", interaction?.type ?? "—");
  setText("interaction-distance-value", interaction ? `${interaction.distance.toFixed(2)} m` : "—");
  setText("current-building-value", interior?.building ?? "—");
  setText("current-floor-value", interior ? String(interior.floor) : "—");
  setText("current-room-value", interior?.room ?? "—");
}

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}
