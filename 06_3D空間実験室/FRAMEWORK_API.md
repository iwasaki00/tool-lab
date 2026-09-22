# Framework Public API

Framework Version: **1.4.0**
Map Format Version: **1**

`src/framework/index.ts` is the supported public entry point for new games and 3D tools. Files below `framework/internal`, concrete Managers, `scene/createScene.ts`, and `compatibility` are not public API.

## Quick Start

```ts
import { createFramework } from "./framework";

const framework = await createFramework({
  canvas: "#render-canvas",
  world: { mode: "city", city: { seed: 12345 } },
});

await framework.start();
```

The public entry point does not register Mission, Enemy, Inventory, Score, Debug UI, TestBridge, or the sample game.

## Lifecycle

`createFramework()` creates an isolated instance in `CREATED` state. `initialize()` creates Engine, Scene, World, Player, and enabled services without starting the render loop. `start()` is idempotent, calls `initialize()`, and starts rendering. `dispose()` is idempotent and changes the state to `DISPOSED`.

```ts
const framework = await createFramework({ canvas });
await framework.initialize();
await framework.start();
console.log(framework.getState().lifecycle); // RUNNING
framework.dispose();
```

Do not use an instance after disposal. Create another instance instead. No framework global is required, so separate canvases can host separate instances in a future multi-instance application.

## Configuration

`CreateFrameworkOptions` contains:

- `canvas`: an `HTMLCanvasElement` or selector.
- `mobile`: optional explicit mobile mode; otherwise pointer/touch capability is detected.
- `config`: renderer, visual, map, performance, and debug defaults.
- `world`: `field` or `city`, plus partial `CitySettings`.
- `profile`: `MINIMAL`, `EXPLORATION`, or `FULL`.
- `features`: optional per-feature overrides applied after the selected Profile.

`chunkStreaming` requires `worldMap`, `interiors` requires `worldMap`, and `missionGuide` requires `missions`. When a required Feature is disabled, the dependent Feature is disabled with a warning instead of unexpectedly enabling dependencies. Feature switches do not dynamically split bundles in 1.4.0.

```ts
const framework = await createFramework({
  canvas,
  profile: "EXPLORATION",
  features: {
    navigation: false,
    missions: false,
    enemies: false,
  },
});
```

## World

`getWorld()` returns `IWorldService`, not `WorldRegistry`:

```ts
const world = framework.getWorld();
const areas = world.getAll();
const location = world.getLocationAt(framework.getPlayer().getPosition());
```

The stable contract supports semantic lookup, nearest-area lookup, statistics, and 2D map projection. Registry mutation remains internal.

## Map

`getMap()` returns the map service contract or `undefined` when the feature is disabled. Convenience methods are available on the façade:

```ts
const generated = framework.createProceduralMap(81234, "future");
await framework.loadMap(generated, {
  autoExpansion: true,
  chunkUnload: true,
});
const saved = framework.getMap()?.saveMap();
```

Map Format Version is independent from Framework Version. Loading continues to use the existing migration/validation path.

## Player

`getPlayer()` exposes a narrow `FrameworkPlayerApi` instead of the Babylon camera or concrete controller:

- `getPosition()`
- `setPosition()`
- `setMovementSpeeds()`
- `setInputEnabled()`
- `setMoveInput()`
- `setSprinting()`
- `rotate()`
- `jump()`

`bindStandardMobileControls()` connects app-owned joystick/look/jump elements to this API. Camera implementation, collision internals, and input observers remain internal.

## Navigation

`getNavigation()` returns `INavigationService | undefined`. Consumers can request paths, inspect status, use nearest walkable points, and toggle debug paths without constructing `NavigationManager`.

```ts
const navigation = framework.getNavigation();
if (navigation) {
  const path = navigation.findPath(start, goal);
  console.log(navigation.pathLength(path), navigation.stats().mode);
}
```

NavMesh failure continues to use the existing WorldGraph/direct fallback policy.

## Interaction

`getInteraction()` returns `IInteractionService | undefined`. Games may register objects against this port without importing `InteractionManager`.

## Visual

`getVisual()` provides environment, quality, and read-only visual telemetry:

```ts
framework.getVisual().setEnvironment("NIGHT");
framework.getVisual().setQuality("AUTO");
console.log(framework.getVisual().getState().budgetStatus);
```

Materials, lights, shadows, and `VisualManager` remain internal.

## Events

`getEvents()` returns a typed event port:

```ts
import { FRAMEWORK_EVENT } from "./framework";

const unsubscribe = framework.getEvents().on(
  FRAMEWORK_EVENT.MAP_STATUS_CHANGED,
  (event) => console.log(event.state, event.message),
);

unsubscribe();
```

Event listener storage is instance-local and is cleared during disposal.

## Feature Access

`getFeatures()` exposes `profile`, `has()` / `isEnabled()`, `enabled()`, `disabled()`, and dependency-disable `reason()`. The compatibility id `map` aliases `worldMap`. Disabled optional services return `undefined` from their getter. This avoids a mandatory Mission/Enemy/Score dependency for non-game tools.

Profile intent:

- `MINIMAL`: World Map, Chunk Streaming, Interaction, and core Visual/Player functionality.
- `EXPLORATION`: MINIMAL plus Interiors and Navigation; no Mission, Inventory, NPC, or Enemy.
- `FULL`: existing 3D Space Laboratory composition.

## Game Composition

The bundled ESCAPE / STEALTH / EXPLORATION implementation is a Sample Game and has its own entry point:

```ts
import { createFramework } from "./framework";
import { createSampleGameComposition } from "./game/sample";

const framework = await createFramework({ canvas: "#render-canvas" });
const sampleGame = createSampleGameComposition();
await framework.start();

// The application layer owns the selected GameConfig and applies the
// sample composition; framework internals do not select a game mode.
console.log(sampleGame.id, framework.getState());
```

The current bundled UI uses an internal Application Host to preserve all legacy flows. New tools should not import that host.

## Restart

`restartSession()` resets the player spawn and may regenerate the public map data without replacing the Engine instance. Sample-game Mission restart remains a game composition responsibility.

## Dispose

`dispose()` cleans up:

1. interaction observers;
2. map chunks and observers;
3. navigation paths, NavMesh resources, and observers;
4. visual resources and framework events;
5. Babylon Scene and Engine;
6. resize and VisualViewport listeners.

## Compatibility API

`LaboratoryApi` remains available under `src/compatibility/LaboratoryApi.ts` for the current UI, TestBridge, and WebMCP integration. It is marked `@deprecated` and includes `api: FrameworkApi`. New production code must prefer `api` or the public framework entry point.

## Stability and Versioning

From Framework 1.3.0 onward, exports from `src/framework/index.ts` are the supported public surface:

- breaking public API change: Framework **MAJOR**;
- backward-compatible API addition: Framework **MINOR**;
- compatible bug fix: Framework **PATCH**;
- map schema change: separate Map Format Version.

Types and files under `framework/internal`, `compatibility`, `scene`, concrete feature Managers, Sample Game implementation, and Dev tooling are internal and may change without constituting a public API promise before 1.3.0.
