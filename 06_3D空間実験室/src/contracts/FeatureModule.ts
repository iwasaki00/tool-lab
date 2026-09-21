export interface DisposableFeature {
  dispose(): void;
}

/** Preparation for Phase 4 toggles; a feature owns its initialization and cleanup. */
export interface FeatureModule<TContext, TRuntime extends DisposableFeature> {
  readonly id: string;
  initialize(context: TContext): TRuntime;
}
