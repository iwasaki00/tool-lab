import type { WorldRegistry } from "../world/WorldRegistry";

export class WorldGraph {
  constructor(private readonly registry: WorldRegistry) {}

  findPath(startId: string, goalId: string): string[] | undefined {
    if (startId === goalId) return [startId];
    const queue = [startId];
    const previous = new Map<string, string | undefined>([[startId, undefined]]);
    while (queue.length) {
      const current = queue.shift()!;
      const area = this.registry.get(current);
      if (!area) continue;
      for (const next of area.connections) {
        if (previous.has(next) || !this.registry.get(next)) continue;
        previous.set(next, current);
        if (next === goalId) return reconstruct(previous, goalId);
        queue.push(next);
      }
    }
    return undefined;
  }

  isReachable(startId: string, goalId: string): boolean { return Boolean(this.findPath(startId, goalId)); }
}

function reconstruct(previous: Map<string, string | undefined>, goalId: string): string[] {
  const path: string[] = [];
  let current: string | undefined = goalId;
  while (current) { path.unshift(current); current = previous.get(current); }
  return path;
}

