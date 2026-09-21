import type { FrameworkApi, CreateFrameworkOptions } from "./FrameworkTypes";
import { DefaultFrameworkFacade } from "../internal/DefaultFrameworkFacade";

/**
 * Creates an isolated framework instance. No game, mission, score, or debug
 * feature is registered by this entry point.
 */
export async function createFramework(options: CreateFrameworkOptions): Promise<FrameworkApi> {
  return new DefaultFrameworkFacade(options);
}
