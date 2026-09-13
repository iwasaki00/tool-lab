import type { PlayerController } from "./createPlayer";

export function attachMobileControls(player: PlayerController): () => void {
  const joystick = document.querySelector<HTMLElement>("#joystick");
  const knob = document.querySelector<HTMLElement>("#joystick-knob");
  const lookZone = document.querySelector<HTMLElement>("#look-zone");
  const jump = document.querySelector<HTMLButtonElement>("#jump-button");
  const sprint = document.querySelector<HTMLButtonElement>("#sprint-button");
  const abort = new AbortController();
  const options = { signal: abort.signal };
  let joystickPointer = -1;
  let lookPointer = -1;
  let lastLookX = 0;
  let lastLookY = 0;

  joystick?.addEventListener("pointerdown", (event) => {
    joystickPointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    updateJoystick(event);
  }, options);
  joystick?.addEventListener("pointermove", (event) => {
    if (event.pointerId === joystickPointer) updateJoystick(event);
  }, options);
  const releaseJoystick = (event: PointerEvent) => {
    if (event.pointerId !== joystickPointer) return;
    joystickPointer = -1;
    player.setMoveInput(0, 0);
    if (knob) knob.style.transform = "translate(-50%, -50%)";
  };
  joystick?.addEventListener("pointerup", releaseJoystick, options);
  joystick?.addEventListener("pointercancel", releaseJoystick, options);

  lookZone?.addEventListener("pointerdown", (event) => {
    lookPointer = event.pointerId;
    lastLookX = event.clientX;
    lastLookY = event.clientY;
    lookZone.setPointerCapture(event.pointerId);
    document.querySelector("#start-guide")?.classList.add("is-hidden");
  }, options);
  lookZone?.addEventListener("pointermove", (event) => {
    if (event.pointerId !== lookPointer) return;
    player.rotate(event.clientX - lastLookX, event.clientY - lastLookY);
    lastLookX = event.clientX;
    lastLookY = event.clientY;
  }, options);
  const releaseLook = (event: PointerEvent) => { if (event.pointerId === lookPointer) lookPointer = -1; };
  lookZone?.addEventListener("pointerup", releaseLook, options);
  lookZone?.addEventListener("pointercancel", releaseLook, options);
  jump?.addEventListener("pointerdown", (event) => { event.preventDefault(); player.jump(); }, options);
  sprint?.addEventListener("pointerdown", () => player.setSprinting(true), options);
  sprint?.addEventListener("pointerup", () => player.setSprinting(false), options);
  sprint?.addEventListener("pointercancel", () => player.setSprinting(false), options);

  function updateJoystick(event: PointerEvent): void {
    if (!joystick) return;
    event.preventDefault();
    const rect = joystick.getBoundingClientRect();
    const radius = rect.width * .34;
    let x = event.clientX - (rect.left + rect.width / 2);
    let y = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(x, y);
    if (length > radius) { x = x / length * radius; y = y / length * radius; }
    if (knob) knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    player.setMoveInput(x / radius, -y / radius);
  }

  return () => abort.abort();
}
