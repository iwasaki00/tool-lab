export class EventManager {
  private readonly listeners = new Map<string, Set<() => void>>();

  on(eventId: string, listener: () => void): () => void {
    const group = this.listeners.get(eventId) ?? new Set<() => void>();
    group.add(listener); this.listeners.set(eventId, group);
    return () => group.delete(listener);
  }

  emit(eventId: string): void {
    this.listeners.get(eventId)?.forEach((listener) => listener());
  }

  clear(): void { this.listeners.clear(); }
}
