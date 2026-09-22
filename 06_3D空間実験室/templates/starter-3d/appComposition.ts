import { bindStandardMobileControls, createFramework } from "../../src/framework/index";
import { appConfig } from "./appConfig";

export async function startApp(): Promise<void> {
  const canvas = get<HTMLCanvasElement>("#app-canvas");
  const mobile = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  const framework = await createFramework({ ...appConfig, canvas, mobile });
  await framework.start();
  get("#app-title").textContent = "MY 3D APP";
  get("#feature-profile").textContent = framework.getFeatures().profile;
  get("#day").addEventListener("click", () => framework.getVisual().setEnvironment("CLEAR_DAY"));
  get("#night").addEventListener("click", () => framework.getVisual().setEnvironment("NIGHT"));
  canvas.addEventListener("click", () => { if (!mobile && document.pointerLockElement !== canvas) void canvas.requestPointerLock(); });
  let releaseControls: () => void = () => undefined;
  if (mobile) {
    document.body.classList.add("is-mobile");
    releaseControls = bindStandardMobileControls(framework.getPlayer(), {
      joystick: get<HTMLElement>("#joystick"), knob: get<HTMLElement>("#joystick-knob"), lookZone: get<HTMLElement>("#look-zone"), jumpButton: get<HTMLElement>("#jump"), interactionButton: get<HTMLElement>("#use"),
    }, () => framework.getInteraction()?.interact());
  }
  document.documentElement.dataset.starterReady = "true";
  window.addEventListener("beforeunload", () => { releaseControls(); framework.dispose(); }, { once: true });
}

function get<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`STARTER UI NOT FOUND: ${selector}`);
  return element;
}
