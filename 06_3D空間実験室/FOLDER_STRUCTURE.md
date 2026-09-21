# Folder Structure

Phase 4 introduces explicit public, internal, compatibility, sample-game, and development boundaries without moving every legacy feature at once.

```text
src/
  main.ts                         # five-line browser entry
  application/
    startApplication.ts           # small orchestrator
    ApplicationFactory.ts         # bundled app composition root
    ApplicationHost.ts            # internal legacy/sample UI host
    ApplicationLifecycle.ts
  framework/
    index.ts                       # supported public entry point
    public/
      FrameworkApi.ts
      FrameworkTypes.ts
    internal/
      DefaultFrameworkFacade.ts
      createEmbeddedFrameworkApi.ts
  compatibility/
    LaboratoryApi.ts              # deprecated legacy façade contract
  bootstrap/                       # renderer configuration/bootstrap
  scene/                           # framework scene construction + legacy adapter
  contracts/                       # cross-feature ports/events
  features/                        # feature composition
  game/
    sample/                        # ESCAPE/STEALTH/EXPLORATION sample game
      index.ts                     # sample public entry
  dev/
    DevComposition.ts
    debug/DebugPanel.ts
    testing/TestBridge.ts
    integration/registerWebMcp.ts
  testing/, debug/                 # compatibility exports / debug runtime
  navigation/, map/, interaction/ # concrete feature implementations (internal)
  world/, visual/, player/         # framework implementation modules
  gameplay/, characters/, ai/     # optional/sample gameplay implementation
```

## Dependency Direction

```text
Application / Sample Game / Tool
              ↓
       framework/index.ts
              ↓
  public contracts and façade
              ↓
 framework internal composition
              ↓
 core scene + optional services
```

Compatibility direction:

```text
Legacy UI / TestBridge
          ↓
  LaboratoryApi adapter
          ↓
     FrameworkApi
```

Framework core does not import Sample Game or Dev tooling. `framework/index.ts` does not export Sample Game, compatibility code, TestBridge, or WebMCP, preventing those modules from becoming mandatory public dependencies.

## Internal Modules

Until later migration phases, older folders remain in place to avoid high-risk mass rename changes. A folder is internal when it is not exported from `framework/index.ts` or `game/sample/index.ts`. New consumers must not import concrete Managers from these locations.
