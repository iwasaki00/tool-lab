import { Engine } from "@babylonjs/core/Engines/engine";
import { DEFAULT_FRAMEWORK_CONFIG, type FrameworkConfig } from "./FrameworkConfig";

export interface FrameworkRuntime {
  engine: Engine;
  resize(): void;
  dispose(): void;
}

/** Renderer-only bootstrap. It has no knowledge of scenarios or game modes. */
export function bootstrapFramework(canvas: HTMLCanvasElement, mobile: boolean, config: FrameworkConfig = DEFAULT_FRAMEWORK_CONFIG): FrameworkRuntime {
  if (!Engine.IsSupported) throw new Error("このブラウザではWebGLを利用できません。");
  const engine = new Engine(canvas, config.renderer.antialias, { stencil: config.renderer.stencil, preserveDrawingBuffer: false }, false);
  const dpr = Math.min(window.devicePixelRatio || 1, config.renderer.hardwareScalingLimit);
  engine.setHardwareScalingLevel(mobile ? 1 : 1 / dpr);
  return { engine, resize: () => engine.resize(), dispose: () => engine.dispose() };
}
