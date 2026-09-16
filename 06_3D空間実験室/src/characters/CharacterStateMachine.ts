export interface CharacterStateHandler<TContext> {
  enter?: (context: TContext) => void;
  update: (context: TContext, deltaSeconds: number) => void;
  exit?: (context: TContext) => void;
}

export class CharacterStateMachine<TState extends string, TContext> {
  private current: TState;

  constructor(initial: TState, private readonly context: TContext, private readonly handlers: Record<TState, CharacterStateHandler<TContext>>) {
    this.current = initial;
    this.handlers[this.current].enter?.(this.context);
  }

  get state(): TState { return this.current; }

  transition(next: TState): void {
    if (next === this.current) return;
    this.handlers[this.current].exit?.(this.context);
    this.current = next;
    this.handlers[this.current].enter?.(this.context);
  }

  update(deltaSeconds: number): void { this.handlers[this.current].update(this.context, deltaSeconds); }
}
