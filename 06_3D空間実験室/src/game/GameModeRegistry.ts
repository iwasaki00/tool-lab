import type { IGameMode } from "./GameMode";
import type { GameMode } from "./GameTypes";
import { escapeMode } from "./modes/escapeMode";
import { explorationMode } from "./modes/explorationMode";
import { stealthMode } from "./modes/stealthMode";

export class GameModeRegistry {
  private readonly modes = new Map<GameMode, IGameMode>();
  register(mode: IGameMode): this { this.modes.set(mode.id, mode); return this; }
  get(id: GameMode): IGameMode {
    const mode = this.modes.get(id);
    if (!mode) throw new Error(`GAME MODE NOT REGISTERED: ${id}`);
    return mode;
  }
  has(id: GameMode): boolean { return this.modes.has(id); }
  all(): IGameMode[] { return [...this.modes.values()]; }
}

export const gameModeRegistry = new GameModeRegistry()
  .register(escapeMode)
  .register(stealthMode)
  .register(explorationMode);

export function getGameMode(id: GameMode): IGameMode { return gameModeRegistry.get(id); }
