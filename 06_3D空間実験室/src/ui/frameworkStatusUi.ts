import type { MapStatusEvent, NavigationStatusEvent } from "../contracts/FrameworkEvents";

let boundaryTimer = 0;

export function renderMapStatus(event: MapStatusEvent): void {
  const element = document.querySelector<HTMLElement>("#chunk-status");
  if (!element) return;
  window.clearTimeout(boundaryTimer);
  element.textContent = event.message;
  element.classList.toggle("is-boundary", event.state === "BOUNDARY");
  element.classList.toggle("is-visible", event.state !== "IDLE");
  if (event.state === "BOUNDARY") boundaryTimer = window.setTimeout(() => element.classList.remove("is-visible", "is-boundary"), 900);
}

export function renderNavigationStatus(event: NavigationStatusEvent): void {
  document.querySelector("#navigation-loading")?.classList.toggle("is-visible", event.status === "BUILDING");
}
