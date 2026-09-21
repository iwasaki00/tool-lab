import type { IGameMode } from "./GameMode";

export interface GameUiElements {
  detection?: HTMLElement | null;
  discovery?: HTMLElement | null;
  tutorialTitle?: HTMLElement | null;
  tutorialText?: HTMLElement | null;
}

/** Applies sample-game presentation policy without teaching shared UI about modes. */
export function applyGameUiPolicy(mode: IGameMode, elements: GameUiElements): void {
  if (elements.detection) elements.detection.hidden = !mode.ui.showDetection;
  if (elements.discovery) elements.discovery.hidden = !mode.ui.showDiscovery;
  if (elements.tutorialTitle) elements.tutorialTitle.textContent = mode.id;
  if (elements.tutorialText) elements.tutorialText.textContent = mode.ui.tutorial;
}
