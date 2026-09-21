/** Instance-local typed event bus used by framework core and optional features. */
export class EventManager<TEvents extends object = Record<string, never>> {
  private readonly listeners = new Map<string, Set<(payload: unknown) => void>>();

  on<TKey extends Extract<keyof TEvents, string>>(eventId: TKey, listener: (payload: TEvents[TKey]) => void): () => void;
  on(eventId: string, listener: (payload?: unknown) => void): () => void;
  on(eventId: string, listener: (payload?: unknown) => void): () => void {
    const group = this.listeners.get(eventId) ?? new Set<(payload: unknown) => void>();
    const compatibleListener = listener as (payload: unknown) => void;
    group.add(compatibleListener); this.listeners.set(eventId, group);
    return () => group.delete(compatibleListener);
  }

  emit<TKey extends Extract<keyof TEvents, string>>(eventId: TKey, payload: TEvents[TKey]): void;
  emit(eventId: string, payload?: unknown): void;
  emit(eventId: string, payload?: unknown): void {
    this.listeners.get(eventId)?.forEach((listener) => listener(payload));
  }

  clear(): void { this.listeners.clear(); }
}
