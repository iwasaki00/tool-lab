import { createApplication } from "./ApplicationFactory";

export function startApplication(): void {
  const application = createApplication();
  application.start();
}
