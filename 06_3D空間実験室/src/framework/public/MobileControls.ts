import type { FrameworkPlayerApi } from "./FrameworkTypes";

export interface MobileControlElements {
  joystick: HTMLElement;
  knob: HTMLElement;
  lookZone: HTMLElement;
  jumpButton: HTMLElement;
  sprintButton?: HTMLElement;
  interactionButton?: HTMLElement;
}

/** Binds the framework player input API to app-owned mobile UI elements. */
export function bindStandardMobileControls(player: FrameworkPlayerApi, elements: MobileControlElements, interact: () => void = () => undefined): () => void {
  const abort = new AbortController();
  const options = { signal: abort.signal };
  let joystickPointer = -1;
  let lookPointer = -1;
  let lastX = 0;
  let lastY = 0;

  const updateJoystick = (event: PointerEvent) => {
    event.preventDefault();
    const rect = elements.joystick.getBoundingClientRect();
    const radius = Math.max(1, rect.width * .34);
    let x = event.clientX - rect.left - rect.width / 2;
    let y = event.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(x, y);
    if (length > radius) { x = x / length * radius; y = y / length * radius; }
    elements.knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    player.setMoveInput(x / radius, -y / radius);
  };
  elements.joystick.addEventListener("pointerdown", (event) => { joystickPointer = event.pointerId; elements.joystick.setPointerCapture(event.pointerId); updateJoystick(event); }, options);
  elements.joystick.addEventListener("pointermove", (event) => { if (event.pointerId === joystickPointer) updateJoystick(event); }, options);
  const releaseJoystick = (event: PointerEvent) => { if (event.pointerId !== joystickPointer) return; joystickPointer = -1; player.setMoveInput(0, 0); elements.knob.style.transform = "translate(-50%, -50%)"; };
  elements.joystick.addEventListener("pointerup", releaseJoystick, options);
  elements.joystick.addEventListener("pointercancel", releaseJoystick, options);

  elements.lookZone.addEventListener("pointerdown", (event) => { lookPointer = event.pointerId; lastX = event.clientX; lastY = event.clientY; elements.lookZone.setPointerCapture(event.pointerId); }, options);
  elements.lookZone.addEventListener("pointermove", (event) => { if (event.pointerId !== lookPointer) return; player.rotate(event.clientX - lastX, event.clientY - lastY); lastX = event.clientX; lastY = event.clientY; }, options);
  const releaseLook = (event: PointerEvent) => { if (event.pointerId === lookPointer) lookPointer = -1; };
  elements.lookZone.addEventListener("pointerup", releaseLook, options);
  elements.lookZone.addEventListener("pointercancel", releaseLook, options);
  elements.jumpButton.addEventListener("pointerdown", (event) => { event.preventDefault(); player.jump(); }, options);
  elements.sprintButton?.addEventListener("pointerdown", () => player.setSprinting(true), options);
  elements.sprintButton?.addEventListener("pointerup", () => player.setSprinting(false), options);
  elements.sprintButton?.addEventListener("pointercancel", () => player.setSprinting(false), options);
  elements.interactionButton?.addEventListener("pointerdown", (event) => { event.preventDefault(); interact(); }, options);
  return () => { abort.abort(); player.setMoveInput(0, 0); player.setSprinting(false); };
}
