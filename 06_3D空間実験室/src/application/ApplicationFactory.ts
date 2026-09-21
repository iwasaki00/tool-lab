import { runApplicationHost } from "./ApplicationHost";

export interface Application {
  start(): void;
}

/** Composition root for the bundled 3D Space Laboratory sample application. */
export function createApplication(): Application {
  return { start: () => runApplicationHost() };
}
