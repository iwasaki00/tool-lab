import { startApp } from "./appComposition";

void startApp().catch((error) => {
  console.error("STARTER INITIALIZE ERROR", error);
  const panel = document.querySelector<HTMLElement>("#error");
  if (panel) { panel.hidden = false; panel.textContent = error instanceof Error ? error.message : String(error); }
});
