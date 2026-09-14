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
  const semantic = laboratory.semanticDebug();
  const world = laboratory.worldStatistics();
  const mission = laboratory.missionDebug();
  const guide = laboratory.missionGuideDebug();
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
  setText("current-area-value", semantic.area?.id ?? "—");
  setText("current-area-type-value", semantic.area?.type ?? "—");
  setText("current-area-tags-value", semantic.area?.tags.join(", ") || "—");
  setText("current-building-value", semantic.building ?? interior?.building ?? "—");
  setText("current-floor-value", semantic.floor ? String(semantic.floor) : interior ? String(interior.floor) : "—");
  setText("current-room-value", semantic.room ?? interior?.room ?? "—");
  setText("world-road-value", String(world.roads));
  setText("world-building-value", String(world.buildings));
  setText("world-room-value", String(world.rooms));
  setText("world-dead-end-value", String(world.deadEnds));
  setText("world-safe-value", String(world.safeAreas));
  setText("world-danger-value", String(world.dangerAreas));
  setText("enemy-spawn-value", String(world.enemySpawns));
  setText("npc-spawn-value", String(world.npcSpawns));
  setText("mission-seed-value", String(mission.plan.seed));
  setText("mission-type-value", mission.plan.type);
  setText("mission-difficulty-value", mission.plan.difficulty);
  setText("mission-total-value", String(mission.plan.steps.length));
  setText("mission-current-value", mission.state.current?.id ?? "COMPLETE");
  setText("mission-retry-value", String(mission.plan.retryCount));
  setText("mission-valid-value", mission.validation.valid ? "PASS" : "FAIL");
  setText("guide-objective-value", guide.objectiveId);
  setText("guide-target-value", guide.targetId);
  setText("guide-type-value", guide.targetType);
  setText("guide-distance-value", guide.status === "READY" ? `${guide.distance.toFixed(1)}m` : "—");
  setText("guide-height-value", guide.status === "READY" ? `${guide.heightDiff >= 0 ? "+" : ""}${guide.heightDiff.toFixed(1)}m` : "—");
  setText("guide-visible-value", guide.visible ? "YES" : "NO");
  setText("guide-screen-value", guide.onScreen ? "YES" : "NO");
  setText("guide-status-value", guide.status);
}

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}
