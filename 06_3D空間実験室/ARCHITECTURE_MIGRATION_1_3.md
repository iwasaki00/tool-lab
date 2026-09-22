# Framework 1.3.0 Migration — Phase 1

## 1. Scope

Architecture Audit の High 優先度を中心に、今後の Core / Optional Feature / Game / Dev 分離に必要な境界と契約を追加した。

今回の Phase 1 は段階移行であり、次は行っていない。

- 大規模なファイル移動
- Manager の全面的な作り直し
- Feature Toggle の本実装
- Game Mode の削除・仕様変更
- Mission Template の全面再設計
- Visual 機能の追加
- Map Format の変更
- 公開済み `LaboratoryApi` / TestBridge の削除や rename

## 2. Version and Compatibility

| Item | Result |
|---|---|
| Framework Version | **1.2.1（維持）** |
| Map Format Version | **1（維持）** |
| Existing `LaboratoryApi` | **互換維持** |
| Existing TestBridge API | **互換維持** |
| ESCAPE / STEALTH / EXPLORATION | **動作維持** |
| File moves | **なし** |

`LaboratoryApi.framework` を additive に追加した。既存プロパティは削除・変更していないため、既存 UI と E2E はそのまま利用できる。

## 3. Phase 1 Changes

### 3.1 Contracts layer

`src/contracts/` に最小限の契約を追加した。

| Contract | Purpose |
|---|---|
| `IWorldService` | Semantic World の読み取り境界 |
| `INavigationService` | Mission / Character / Debug が利用する Navigation 境界 |
| `IInteractionService` | Interactable 登録・操作・focus 取得境界 |
| `IInventoryService` | Door / Item が利用する所持品 capability |
| `IEventService` | Interior object が利用する最小イベント境界 |
| `IMapService` | Map state、生成、load/save、streaming 設定境界 |
| `IMissionProgressService` | Interior が利用する Mission 進行 capability |
| `MissionStepContract` | Step / prerequisite / status の共通構造 |
| `FrameworkContext` | Scene、Player、Service 集合への移行入口 |
| `FrameworkServices` | World、Navigation、Map、Interaction、Events、Visual の明示的集合 |

`FrameworkServices` は無制限な Service Locator にしないため、文字列検索や任意 Manager 登録 APIを持たない。Scene composition が明示的に構築した限定サービスだけを readonly で公開する。

### 3.2 Layer direction

Phase 1 後の基本方向:

```text
Game / Sample UI
        ↓
Optional Features
        ↓
Contracts / Framework Services
        ↓
Core World / Scene primitives
```

次の直接参照を除去した。

- `world/buildingInteriorGenerator` → Mission/Inventory/Objective concrete classes
- `interior/InteriorManager` → MissionPlan/MissionRuntime/Inventory/Objective concrete classes
- `objects/interactiveDoor` → InventoryManager/InteractionManager concrete classes
- `objects/interactiveItem` → InventoryManager/InteractionManager concrete classes
- `objects/interactiveSwitch` → EventManager/InteractionManager concrete classes
- Character/Mission Guide/Debug → concrete `NavigationManager`

### 3.3 Navigation boundary

`NavigationManager` は `INavigationService` を実装する。

共通 API:

- `findPath(start, goal)`
- `getNearestWalkablePoint(position)`
- `isReachable(start, goal)`
- `closestPoint(position)`
- `randomPoint(position, radius)`
- `pathLength(path)`

Enemy、NPC、CharacterNavigation、MissionGuide、DebugTest、DemoScenario は concrete class ではなく `INavigationService` を受け取る。

Navigation は Mission、Enemy、ESCAPE、STEALTH の型を import しない。利用側が Navigation contract を呼ぶ方向へ統一した。

既存の NavMesh / WorldGraph / Direct fallback 動作は変更していない。

### 3.4 Mission boundary

Mission の共通構造として以下を `MissionContracts.ts` へ分離した。

- Step status
- prerequisite AND / OR
- generic Mission step contract
- target 完了と active 判定の progress capability

ESCAPE / ACCESS_CONTROL / POWER_RESTORE / MULTI_BUILDING / TOWER と、ゲームモード固有ルールは引き続き Game/Gameplay 側に置いている。

完全分離は Phase 2 以降とし、今回は既存 Mission 生成・進行仕様を変更していない。

### 3.5 Interior boundary

`InteriorManager` と `buildingInteriorGenerator` は `InteriorServices` のみを受け取る。

Interior が知るもの:

- Floor / Room / Corridor / Stair
- Semantic registration
- Interaction capability
- Inventory capability
- Mission content の最小 DTO
- Mission progress の最小 capability
- Navigation geometry changed callback

Interior が知らなくなったもの:

- `MissionPlan` concrete type
- `MissionRuntime` concrete class
- `ObjectiveManager`
- `InventoryManager` concrete class
- `GamePlacementManager` concrete class

Mission 側は World Semantic と Interior contract を利用し、Interior は GameMode を参照しない。

### 3.6 Event boundary

新しい Event Bus 実装は作成していない。既存 `EventManager` を payload 対応の型付きイベントとして拡張した。

Framework 共通イベント:

- `ITEM_ACQUIRED`
- `DOOR_STATE_CHANGED`
- `SWITCH_STATE_CHANGED`
- `AREA_DISCOVERED`
- `MISSION_STEP_CHANGED`
- `MAP_STATUS_CHANGED`
- `NAVIGATION_STATUS_CHANGED`

現在接続済み:

- Item acquisition
- Door state
- Switch state
- Mission active step
- Map loading/boundary/error state
- Navigation building/ready/fallback/error state

`AREA_DISCOVERED` は契約を定義済みだが、DiscoveryManager 側の接続は Game rule 分離と一緒に Phase 2 で行う。

### 3.7 Map / UI boundary

`WorldMapManager` から次を削除した。

- `document.querySelector("#chunk-status")`
- DOM class の直接更新
- DOM timeout 管理

Map は `MapStatusEvent` を発行し、`ui/frameworkStatusUi.ts` が表示を更新する。

Map は引き続き World 構造のみを保持する。Mission、Enemy、Player runtime state は `WorldMapData` に追加していない。

### 3.8 Navigation / UI boundary

`NavigationManager` から `#navigation-loading` の直接 DOM 更新を削除した。

Navigation は `NavigationStatusEvent` を発行し、UI adapter が loading 表示を切り替える。

### 3.9 Scene composition entry

`createLaboratoryScene` は既存 `LaboratoryApi` を返しながら、同じ戻り値から `FrameworkContext` にアクセスできる。

```ts
laboratory.framework.scene
laboratory.framework.player
laboratory.framework.services.world
laboratory.framework.services.navigation
laboratory.framework.services.map
laboratory.framework.services.interaction
laboratory.framework.services.events
laboratory.framework.services.visual
```

これは Phase 2 以降に UI / Game / DevTools を `LaboratoryApi` の巨大 façade から移行する入口である。今回 `main.ts` の全面書き換えは行っていない。

## 4. Dependency Metrics

### Before

| Metric | Count |
|---|---:|
| Problematic Dependencies | **12** |
| Game-specific Leaks | **14** |
| Circular Dependencies | **0** |

### After Phase 1

| Metric | Count | Change |
|---|---:|---:|
| Problematic Dependencies | **7** | **-5** |
| Game-specific Leaks | **11** | **-3** |
| Circular Dependencies | **0** | unchanged |

測定補足:

- TypeScript source は 82 ファイル。
- 静的 import graph の SCC は 0。
- `world` / `interior` / `objects` / `map` / `navigation` から `gameplay`・`game`・`debug` への直接 import は 0。
- `map` / `navigation` 内の `document` / `querySelector` は 0。
- Core/feature 共通層内の ESCAPE / STEALTH / EXPLORATION 条件分岐は 0。条件分岐は Game/sample composition 側に残している。

### Resolved dependency list

| Audit ID | Result |
|---|---|
| P02 World interior generator → gameplay concrete types | Resolved |
| P03 InteriorManager → MissionPlan/MissionRuntime | Resolved |
| P04 Interactive objects → InventoryManager concrete type | Resolved |
| P07 WorldMapManager → DOM | Resolved |
| P08 NavigationManager → DOM | Resolved |
| G10 Building interior interprets MissionPlan concrete type | Resolved through DTO/capability boundary |
| G11 Interior owns MissionRuntime concrete type | Resolved |
| G12 Door/Item require InventoryManager concrete type | Resolved |

## 5. Remaining High Risk

1. `createScene.ts` が DemoScenario、Game、Debug の型と生成をまだ知っている。
2. `main.ts` が GameSession、UI、Scene rebuild、Debug/Test 公開を一括所有している。
3. `gameplay/createDemoScenario.ts` が Mission、Character、Interior、Discovery、Debug を束ねる sample composition のまま `gameplay` 配下にある。
4. `SemanticTypes.AreaType` / `AreaTag` は closed union で、game-specific 語彙を含む。
5. Visual と Objects の具象依存、Gameplay と Game の双方向フォルダ依存が残る。
6. Map persistence と Score/Movement persistence は `localStorage` に直接依存している。
7. DebugPanel/TestBridge は巨大な `LaboratoryApi` に依存している。

## 6. Regression Results

| Check | Result |
|---|---|
| BUILD | **PASS** |
| SMOKE | **PASS — 1/1** |
| E2E | **PASS — 11/11** |
| STABILITY | **PASS — 3 seed pairs** |
| VISUAL | **PASS — desktop + mobile** |
| CHUNK | **PASS — export/import/expansion/boundary/hybrid/unload** |
| PERFORMANCE | **PASS — desktop normal/stress + mobile low** |

### Game regression

| Area | Result |
|---|---|
| ESCAPE | PASS: item acquisition, door unlock, switch, completion flow |
| STEALTH | PASS: world start and mode flow |
| EXPLORATION | PASS: world start and discovery flow |
| Mission | PASS |
| Navigation | PASS: existing fallback and debug APIs retained |
| Interior | PASS |
| Enemy | PASS through ESCAPE/STEALTH E2E |
| Guide | PASS through game smoke/E2E |

### Map regression

| Mode/Operation | Result |
|---|---|
| Procedural Map | PASS |
| Prebuilt import | PASS |
| Hybrid Map | PASS |
| Chunk Expansion | PASS |
| Map Export / Import | PASS |

### Performance observation

- Performance budget status: `OK` in desktop normal, desktop stress, mobile low.
- Mesh / material / light count did not show an architecture-change-induced unbounded increase.
- Main minified bundle changed from approximately 2,120.61 kB to 2,121.57 kB（約 +0.96 kB、測定時ハッシュ差を含む）。
- Recast dynamic import と production bundle profile 分離は Phase 3 対象で、今回は行っていない。

## 7. Files Added

- `src/contracts/FrameworkContext.ts`
- `src/contracts/FrameworkEvents.ts`
- `src/contracts/MissionContracts.ts`
- `src/contracts/ServiceContracts.ts`
- `src/interior/InteriorContracts.ts`
- `src/ui/frameworkStatusUi.ts`
- `ARCHITECTURE_MIGRATION_1_3.md`

## 8. Existing Files Updated for Boundaries

- `scene/createScene.ts`
- `main.ts`
- `gameplay/EventManager.ts`
- `gameplay/InventoryManager.ts`
- `gameplay/MissionTypes.ts`
- `gameplay/createDemoScenario.ts`
- `navigation/NavigationManager.ts`
- `map/WorldMapManager.ts`
- `world/WorldRegistry.ts`
- `world/buildingInteriorGenerator.ts`
- `interior/InteriorManager.ts`
- `interaction/InteractionManager.ts`
- `objects/interactiveDoor.ts`
- `objects/interactiveItem.ts`
- `objects/interactiveSwitch.ts`
- `ai/CharacterNavigation.ts`
- `characters/CharacterManager.ts`
- `characters/NPCCharacter.ts`
- `characters/EnemyCharacter.ts`
- `gameplay/MissionGuideManager.ts`
- `debug/DebugTestManager.ts`

## 9. Phase 2 Top 5

1. `createScene.ts` から `createDemoScenario` を外し、Game/sample 側から scenario factory を注入する。
2. `main.ts` を `ApplicationHost` と sample game composition に分け、`FrameworkContext` 経由へ段階移行する。
3. `LaboratoryApi` から `DiagnosticsApi` と `TestControlApi` を分け、Debug/TestBridge の逆依存を解消する。
4. `SemanticTypes` を既存 Map Format 1 と互換のまま拡張可能にし、game-specific kind/tag を Game registration へ寄せる。
5. Visual↔Objects と Gameplay↔Game の双方向依存を port/event/policy injection で一方向化する。

## 10. Phase 3/4 Preparation

- Phase 3: Storage adapters、Recast dynamic import、feature registration、bundle entry 分離。
- Phase 4: `minimal/world/simulation/game/development` profile と Feature Toggle。
- Map Format 1 は継続し、将来の Game Save は別 schema/version とする。

## 11. Phase 2: Game-specific Separation

### 11.1 Result

Framework Version は **1.2.1**、Map Format Version は **1** のまま維持した。新しいゲーム機能は追加せず、既存の ESCAPE / STEALTH / EXPLORATION を Sample Game として外側から合成する構造へ変更した。

| Metric | Before Phase 2 | After Phase 2 | Change |
|---|---:|---:|---:|
| Problematic Dependencies | 7 | **4** | -3 |
| Game-specific Leaks | 11 | **4** | -7 |
| Circular Dependencies | 0 | **0** | unchanged |

After の集計は Phase 1 の audit ID を継続して再判定した値。解消した Problematic Dependency は P01、P05、P06。残る4件は persistence、巨大 facade、application host 集中、optional feature API 境界に関するもの。

### 11.2 Game-specific leak inventory

| Audit ID | Phase 2 result | Treatment |
|---|---|---|
| G01 fixed GameMode union | Remaining | Sample Game の外部設定型として `game/GameTypes.ts` に限定 |
| G02 mode-specific Mission/Enemy/Objective branches | Resolved | `IGameMode.configure()` と mode strategy |
| G03 mode-specific clear/fail conditions | Resolved | `IGameMode.completeOnMission`, `failOnCaught`, `isDiscoveryComplete` |
| G04 mode-specific score formula | Resolved | 各 mode の `calculateScore()` strategy |
| G05 mode/difficulty character counts | Resolved | `GameScenarioPolicy` を Sample Scenario へ注入 |
| G06 Scene creates default ESCAPE/DemoScenario | Resolved | `ScenarioFactory` injection。Scene は concrete Demo factory を import しない |
| G07 game area kinds in closed Core union | Resolved | Core kind + open string extension、game vocabulary は `GameSemantics.ts` |
| G08 game tags in closed Core union | Resolved | Core tag + open string extension。Map Format 1 の文字列互換を維持 |
| G09 scenario-owned IDs | Remaining | `game/sample/createDemoScenario.ts` 内に隔離 |
| G13 fixed gameplay UI | Remaining, reduced | mode visibility/tutorial は `GameUiAdapter` へ移動。Mission/Inventory facade は維持 |
| G14 mission/debug methods on LaboratoryApi | Remaining | Public API / TestBridge 互換のため Phase 3 へ延期 |

G10-G12 は Phase 1 で解消済み。

### 11.3 Introduced contracts, policies and strategies

- `IGameMode`: configure、scenario policy、clear/fail、detection、debug completion、UI policy、score strategy。
- `GameModeRegistry`: ESCAPE / STEALTH / EXPLORATION の明示登録と取得。
- `ScenarioFactory` / `ScenarioPolicy` / `LaboratoryScenario`: Framework Scene と Sample composition の境界。
- `MissionTemplateSource`: MissionGenerator が具体的なテンプレート集合を知らず、外部 source から取得・instantiateする境界。
- `GameUiAdapter`: Detection / Discovery / Tutorial の mode-specific 表示方針。
- `MISSION_COMPLETED` / `AREA_DISCOVERED`: 既存 typed `EventManager` を拡張。新規 Event Bus は追加していない。

Dependency direction は `Game -> Gameplay/Optional -> Framework Services -> Core`。`src/gameplay` から `src/game` への import は0件。`FrameworkContext` に game-specific service は追加していない。

### 11.4 DemoScenario separation

- 実装を `src/game/sample/createDemoScenario.ts` へ移動。
- Mission template definitions を `src/game/sample/MissionTemplates.ts` へ移動。
- `scene/createScene.ts` は concrete DemoScenario を importせず、`ScenarioFactory` を受け取る。
- `main.ts` が Sample Game composition root として factory と mode policy を注入する。
- `LaboratoryApi`、`LaboratoryApi.framework`、`TestBridge` の既存操作面は維持。

### 11.5 Semantic extension

`AreaType` / `AreaTag` を closed union から次の互換形へ変更した。

```ts
type AreaType = CoreAreaType | (string & {});
type AreaTag = CoreAreaTag | (string & {});
```

Core は ROAD / ROOM / CORRIDOR / PARK / BUILDING_ENTRANCE 等を所有し、ITEM / GOAL_AREA / ENEMY_SPAWN / mission / danger 等の Sample Game 語彙は `game/GameSemantics.ts` で定義する。保存形式は従来どおり string のため Map Format 1 の変更はない。

### 11.6 Visual / Objects boundary

`VisualManager -> objects/streetLight` の依存を削除した。Street light は night color metadata を登録し、VisualManager は受け取った material collection のみを制御する。Objects 側から VisualManager への逆参照はない。

### 11.7 Files moved and added

Moved:

- `src/gameplay/createDemoScenario.ts` -> `src/game/sample/createDemoScenario.ts`
- `src/gameplay/MissionTemplates.ts` -> `src/game/sample/MissionTemplates.ts`
- `src/game/DiscoveryManager.ts` -> `src/gameplay/DiscoveryManager.ts`（旧パスは compatibility export）

Added:

- `src/contracts/ScenarioContracts.ts`
- `src/game/GameMode.ts`
- `src/game/GameModeRegistry.ts`
- `src/game/GameUiAdapter.ts`
- `src/game/GameSemantics.ts`
- `src/game/modes/escapeMode.ts`
- `src/game/modes/stealthMode.ts`
- `src/game/modes/explorationMode.ts`

### 11.8 Regression

| Check | Result | Classification |
|---|---|---|
| BUILD | PASS | Framework regression |
| SMOKE | PASS 1/1 | Framework + Sample composition |
| E2E | PASS 11/11 | Full regression |
| STABILITY | PASS 3 seed pairs | Framework world/sample mission |
| VISUAL | PASS desktop + mobile | Framework visual |
| CHUNK | PASS export/import/expansion/boundary/hybrid/unload | Framework map |
| PERFORMANCE | PASS normal/stress/mobile-low budget | Framework performance |
| ESCAPE | PASS start/mission/guide/navigation/complete/result | Sample Game |
| STEALTH | PASS start/mode flow/navigation/result | Sample Game |
| EXPLORATION | PASS start/discovery/navigation/result | Sample Game |

Main production bundle: approximately **2,124.11 kB** minified / **607.98 kB gzip**。Phase 2 は registration/policy 分の小幅増加で、Performance budget は全測定で `OK`。

### 11.9 Remaining high risks

1. `main.ts` が bootstrap、Game UI、Scene rebuild、Debug/Test composition を集中所有している。
2. `LaboratoryApi` が Mission/Character/Debug/Test の巨大 compatibility facade のまま。
3. Scenario contract が既存 facade 互換のため多くの optional feature method を含む。
4. CitySettings / world persistence に Mission settings が残る。
5. Map / Score / Movement persistence が browser `localStorage` に直接依存する。

### 11.10 Phase 3 top 5

1. `ApplicationHost` と Sample Game bootstrap を分離し、`main.ts` を縮小する。
2. `LaboratoryApi` を Framework / Gameplay / Diagnostics / TestControl namespace に段階分割する。
3. Optional feature registration と `minimal/world/simulation/game/development` profile を導入する。
4. StoragePort + browser adapter で Map/Score/Movement persistence を分離する。
5. Recast と development-only tools を dynamic import / bundle entry へ分離する。

## 12. Phase 3: Scene / Bootstrap / UI Composition Separation

### 12.1 Result and compatibility

Framework Version は **1.2.1**、Map Format Version は **1** のまま維持した。新しいゲーム機能や保存形式変更は行わず、既存の ESCAPE / STEALTH / EXPLORATION を Sample Game composition として外側から組み立てる構造へ移行した。

| Metric | Before Phase 3 | After Phase 3 | Change |
|---|---:|---:|---:|
| Problematic Dependencies | 4 | **2** | -2 |
| Game-specific Leaks | 4 | **2** | -2 |
| Circular Dependencies | 0 | **0** | unchanged |

残る Problematic Dependency は、Application Host の責務集中と `LaboratoryApi` の巨大 compatibility facade。残る Game-specific Leak は、固定 Mission/Inventory façade と game/debug/test methods を含む `LaboratoryApi` である。Framework bootstrap / scene / feature initializer から ESCAPE、STEALTH、EXPLORATION、`GameMode`、concrete DemoScenario への参照は 0 件である。

### 12.2 Main and bootstrap responsibilities

Before:

- `main.ts` が CSS、副作用 import、DOM取得、Engine生成、Scene生成、Sample Game選択、UI、render loop、TestBridge、dispose を集中所有していた。
- Engine/resize failure と feature/game failure の境界が不明瞭だった。

After:

- `main.ts` は side-effect import、CSS、`startApplication()` 呼び出しだけの **5 lines entry point**。
- `FrameworkBootstrap` が Engine capability check、WebGL Engine生成、hardware scaling、resize、Engine dispose を所有する。
- `FrameworkConfig` が renderer / visual / map / performance / debug 設定を分離する。
- `ApplicationLifecycle` が FRAMEWORK / FEATURE / GAME の初期化stage、error分類、逆順disposeを管理する。
- `startApplication.ts` は Application Host として composition とセッション制御を行うが、Framework scene内部を直接構築しない。

### 12.3 Scene responsibilities

Before:

- `createScene.ts` が Babylon Scene、ground、player、visual、registry、field/city、navigation、scenario、map、debug API を同時に構築していた。
- Sample Game factoryの既定生成がScene層へ漏れていた。

After:

- `FrameworkSceneBootstrap` が Scene、gravity/collision、Player、VisualManager、WorldRegistry、ground、field/city、debug markerを構築する。
- `LaboratoryFeatureInitializer` が Navigation、ScenarioFactory、WorldMap、FrameworkContext を初期化し、feature単位の再起動とdisposeを提供する。
- `createScene.ts` は両者をcomposeして既存 `LaboratoryApi` 互換面を返す。
- ScenarioFactory は必須注入であり、Scene層は concrete Sample DemoScenario を知らない。
- 同一cityでの Mission restart は core Scene/Player/Visual/Registryを再構築せず、feature scenarioのみ再生成する。

### 12.4 Game composition

- `GameComposition` contract が mode、rules、scenario factory、callbacks のcomposition境界を定義する。
- `SampleGameComposition` が ESCAPE / STEALTH / EXPLORATION、DemoScenario factory、game UI policyを集約する。
- Application Host は `getGameMode`、`resolveGameMode`、`createDemoScenario` を直接importせず、composition経由で利用する。
- World / Navigation / Visual / Scene / Bootstrap に Sample Game mode条件分岐は追加していない。

### 12.5 UI and development composition

- `UiRegistry` が `FRAMEWORK | FEATURE | GAME | DEV` layer別に既存DOMを登録し、selector探索とdisposeを一元化する。
- framework loading/error/pause/settings、feature inventory/mission guide、game title/detection/discovery/result、dev debugを明示登録した。
- `DevComposition` が DebugPanel と TestBridge をApplication Hostから分離する。
- `installTestBridge()` は cleanup functionを返し、dispose時に `window.__SPACE_LAB_TEST__` とtest用dataset/statusを除去する。
- UIの見た目と既存selectorは維持し、mobile/desktop E2E互換を保った。

### 12.6 Dispose policy

Dispose orderは外側から内側へ、かつ登録の逆順で実行する。

1. TestBridge / Debug UI / mobile controls
2. Sample scenario / WorldMap / Navigation feature runtime
3. Framework scene runtime (Visual / Player / Registry / Scene)
4. Engine resize listeners / Babylon Engine
5. UI registry / remaining lifecycle disposers

Scene再生成時にも旧 `disposeWorld()` を先に実行する。beforeunloadでは同じcleanup pathを使用し、TestBridgeやresize listenerを残さない。

### 12.7 Files moved and added

Moved/extracted:

- `src/main.ts` application body -> `src/application/startApplication.ts`
- Scene/world construction -> `src/scene/FrameworkSceneBootstrap.ts`
- navigation/scenario/map feature construction -> `src/features/LaboratoryFeatureInitializer.ts`

Added:

- `src/application/ApplicationLifecycle.ts`
- `src/bootstrap/FrameworkConfig.ts`
- `src/bootstrap/FrameworkBootstrap.ts`
- `src/contracts/FeatureModule.ts`
- `src/contracts/GameComposition.ts`
- `src/dev/DevComposition.ts`
- `src/game/sample/SampleGameComposition.ts`
- `src/ui/UiRegistry.ts`

Updated:

- `src/main.ts`
- `src/scene/createScene.ts`
- `src/testing/TestBridge.ts`
- `src/application/startApplication.ts`

### 12.8 Regression

| Check | Result |
|---|---|
| BUILD | PASS, TypeScript + Vite, 582 modules |
| Full E2E | PASS 11/11 |
| SMOKE | PASS 1/1 |
| STABILITY | PASS 3 seed pairs |
| CHUNK | PASS export/import/expansion/boundary/hybrid/unload |
| VISUAL | PASS desktop + mobile |
| PERFORMANCE | PASS desktop normal/stress + mobile low, all budgets `OK` |
| DEMO | PASS headed 1/1 |
| ESCAPE | PASS item/door/switch/completion |
| STEALTH | PASS start and mode flow |
| EXPLORATION | PASS start and discovery flow |

Production main bundle: approximately **2,129.06 kB** minified / **609.77 kB gzip**。Viteの500 kB chunk warningは残るが、Phase 3の既存挙動・性能budget regressionは検出されなかった。

### 12.9 Remaining issues

1. `startApplication.ts` は約518 linesで、session state、DOM event wiring、game result UI、render loopをまだ集中所有する。
2. `LaboratoryApi` は Framework / Gameplay / Diagnostics / TestControl の多数methodを含む巨大な互換façadeである。
3. Map / Score / Movement persistence はbrowser `localStorage`へ直接依存する。
4. Main production chunkは2 MBを超え、Recast、Sample Game、development toolsの遅延load余地がある。
5. feature profile / toggleは未導入で、minimal framework consumerも全featureをbundleする。

### 12.10 Phase 4 top 5

1. Application Hostを `GameSessionController`、`ApplicationUiController`、render-loop coordinatorへ分割する。
2. `LaboratoryApi` を Framework / Gameplay / Diagnostics / TestControl のnamespaced portsへ段階移行する。
3. `minimal/world/simulation/game/development` profileとfeature registration/toggleを導入する。
4. StoragePort + browser adapterでMap/Score/Movement persistenceを分離する。
5. Recast、Sample Game、development-only toolsをdynamic importし、production bundle entryを分割する。

## 13. Phase 4: Folder / Public API / Compatibility Façade Cleanup

### 13.1 Result and metrics

Framework Version は **1.2.1**、Map Format Version は **1** のまま維持した。新ゲーム機能とMap schema変更は行っていない。

| Metric | Before Phase 4 | After Phase 4 | Change |
|---|---:|---:|---:|
| Problematic Dependencies | 2 | **1** | -1 |
| Game-specific Leaks | 2 | **1** | -1 |
| Circular Dependencies | 0 | **0** | unchanged |

残る1件は、Sample ApplicationのUI/session wiringを保持する約521 linesのinternal `ApplicationHost`。残るGame-specific Leak 1件は、既存UI/TestBridge互換のためdeprecated `LaboratoryApi`にMission/Inventory/Debug操作が存在する点である。どちらもFramework Public Entryから到達する必須依存ではない。

### 13.2 Framework Public API

`src/framework/index.ts`を唯一のFramework Public Entryとして追加した。公開一覧:

- `createFramework(options)`
- `FrameworkApi`
- `FrameworkConfig` / `DEFAULT_FRAMEWORK_CONFIG`
- `CreateFrameworkOptions`
- `WorldCreateOptions`
- `MapLoadOptions`
- `FeatureId` / `FrameworkFeatureOptions` / `FrameworkFeatureAccess`
- `FrameworkLifecycleState` / `FrameworkState`
- `FrameworkPlayerApi`
- `FrameworkVisualApi`
- `FrameworkEventApi` / `FrameworkEventMap` / `FrameworkEventName`
- `FRAMEWORK_EVENT`
- `WorldMapData`
- `FRAMEWORK_VERSION` / `MAP_FORMAT_VERSION`

`FrameworkApi`は`initialize/start/dispose/restartSession/loadMap/createProceduralMap/getWorld/getPlayer/getNavigation/getInteraction/getEvents/getVisual/getMap/getFeatures/getState`を提供する。WorldRegistry、NavigationManager、WorldMapManager、InteractionManager、VisualManagerを公開せず、既存service contractまたはnarrow adapterを返す。

Public EntryはSample Game、Mission、Enemy、Score、Debug、TestBridge、WebMCPをimportしない。Feature設定はnavigation/map/interactionを個別に無効化可能で、Phase 1.4以降のprofile/dynamic importに備える。

### 13.3 LaboratoryApi compatibility adapter

Before responsibility:

- Framework context、Player、Map、Navigation、Visual、Mission、Inventory、Enemy、Debug、Test controlを単一interfaceとして公開。
- createScene内に巨大interface定義と転送実装が混在。
- 新規Application codeもconcrete compatibility methodを利用。

After responsibility:

- contractを`src/compatibility/LaboratoryApi.ts`へ移し、`@deprecated`を明記。
- `api: FrameworkApi`を持つLegacy Adapterとして位置付け。
- `createEmbeddedFrameworkApi`が既存scene/feature runtimeをPublic APIへ変換。
- Application HostのPlayer、Map、Navigation、Visualの新規アクセスは`laboratory.api`経由へ移行。
- Mission/Inventory/Debug/TestBridge/WebMCP固有操作のみLegacy compatibility面に残した。
- 削除はFramework major versionまで行わず、既存TestBridgeとUIを維持する。

### 13.4 startApplication and application composition

Before responsibility:

- `startApplication.ts`が約518 linesのConfig load、Bootstrap、Game Session、UI wiring、Dev/Test、Error、render loop、disposeを所有。

After responsibility:

- `startApplication.ts`: **6 lines**。Application Factoryを生成してstartするだけ。
- `ApplicationFactory.ts`: **10 lines**。bundled Sample Application composition root。
- `ApplicationHost.ts`: 既存UI/session wiringをinternal implementationとして隔離。
- Frameworkの新規consumerはApplication Hostをimportせず、`framework/index.ts`を利用する。

Host本体の分割は挙動リスクを避けてPhase 5へ残したが、Public APIおよびTool consumerへの依存経路からは除外した。

### 13.5 Folder and boundary changes

Added:

- `src/framework/index.ts`
- `src/framework/public/FrameworkApi.ts`
- `src/framework/public/FrameworkTypes.ts`
- `src/framework/public/FrameworkEvents.ts`
- `src/framework/internal/DefaultFrameworkFacade.ts`
- `src/framework/internal/createEmbeddedFrameworkApi.ts`
- `src/compatibility/LaboratoryApi.ts`
- `src/application/ApplicationFactory.ts`
- `src/game/sample/index.ts`
- `framework-api-test.html`
- `tests/e2e/framework-api.spec.ts`
- `tools/check-module-cycles.mjs`

Moved:

- large application flow: `startApplication.ts` -> `ApplicationHost.ts`
- WebMCP: `ui/registerWebMcp.ts` -> `dev/integration/registerWebMcp.ts`
- generic EventManager: `gameplay/EventManager.ts` -> `core/events/EventManager.ts`
- LaboratoryApi contract: `scene/createScene.ts` -> `compatibility/LaboratoryApi.ts`
- DebugPanel: `debug/DebugPanel.ts` -> `dev/debug/DebugPanel.ts`
- TestBridge: `testing/TestBridge.ts` -> `dev/testing/TestBridge.ts`

Compatibility re-exportを旧`gameplay/EventManager.ts`に残し、一括renameによる破壊を避けた。全旧Feature folderの物理移動は行わず、Public Entryにexportされないものをinternalとして文書化した。

### 13.6 Core, feature, game and dev boundaries

- Core: Engine/Scene/typed events/Player/Visual/World bootstrap。
- Feature: Map/Navigation/Interactionをservice contract越しにcompose。
- Sample Game: ESCAPE/STEALTH/EXPLORATIONとscenario factoryを`game/sample`に隔離し、独立entryを追加。
- Dev: Debug composition、TestBridge integration、WebMCP integration。Framework Public Entryから依存しない。
- Compatibility: current Laboratory UI/TestBridge向けdeprecated adapter。

公開event mapはMap/Navigation lifecycleに限定し、Mission event vocabularyはPublic Framework Entryへexportしない。

### 13.7 Lifecycle and multiple-instance preparation

`DefaultFrameworkFacade`はinstance-localなEngine、Scene、World、Events、Navigation、Map、Interactionを所有する。通常利用で`window.xxx`を要求せず、canvasごとのinstance作成が可能な構造。Dev/Testの`window.__SPACE_LAB_TEST__`だけはLegacy pathに限定した。

Public `dispose()`はinteraction、map、navigation、visual/events、Scene、Engine、resize/orientation/VisualViewport listenerをcleanupし、冪等に`DISPOSED`へ遷移する。

### 13.8 Regression

| Check | Result |
|---|---|
| BUILD | PASS, TypeScript + Vite, 586 modules |
| FRAMEWORK API TEST | PASS 1/1: start/world/map/events/player/navigation/interaction/visual/dispose |
| Full E2E | PASS 12/12 |
| SMOKE | PASS 1/1 |
| STABILITY | PASS 3 seed pairs |
| VISUAL | PASS desktop + mobile |
| CHUNK | PASS export/import/expansion/boundary/hybrid/unload |
| PERFORMANCE | PASS desktop normal/stress + mobile low; all budgets `OK` |
| DEMO | PASS headed 1/1 |
| MOBILE | PASS virtual controls and mobile UI |
| ARCHITECTURE | PASS, 116 TypeScript modules, circular dependencies 0 |
| ESCAPE | PASS |
| STEALTH | PASS |
| EXPLORATION | PASS |

Production main bundle: approximately **2,130.89 kB** minified / **610.30 kB gzip**。Phase 3比は約+1.83 kB minified / +0.53 kB gzip。Public API追加による小幅増加で、Performance budget regressionはない。Public indexはSample Game/Dev/Compatibilityを再exportせず、将来のtree shakingとentry分割を阻害しない。

### 13.9 Public documentation

- `FRAMEWORK_API.md`: Quick Start、Lifecycle、Configuration、World、Map、Player、Navigation、Interaction、Visual、Events、Feature Access、Game Composition、Restart、Dispose、Compatibility、SemVer。
- `FOLDER_STRUCTURE.md`: Public/Internal/Compatibility/Sample Game/Dev構成とdependency direction。

### 13.10 Remaining high risk

1. Internal `ApplicationHost.ts`は依然約521 linesで、UI/session/game result/event wiringの分割余地がある。
2. Deprecated `LaboratoryApi`のMission/Inventory/Debug/Test surfaceは巨大で、Legacy consumerが残る。
3. Map/Score/Movement browser persistenceはStoragePort未導入。
4. Public feature toggleはcomposition制御のみで、dynamic importによるbundle分割は未実装。
5. Main bundleは約2.13 MBで、RecastとSample/Dev entryの遅延load余地がある。

### 13.11 Phase 5 top 5

1. `ApplicationHost`をGameSession controller、UI controller、Game generation flow、render telemetryへ分割する。
2. TestBridge/DebugPanelを`LaboratoryApi`からDiagnostics/TestControl portsへ移行し、Legacy surfaceを縮小する。
3. StoragePort + BrowserStorageAdapterを導入し、Map/Score/Movement persistenceを分離する。
4. Feature profile (`minimal/world/simulation/game/development`)とregistration registryを導入する。
5. Recast、Sample Game、Dev/Test toolingをdynamic importし、Public Core bundleを計測・分割する。

## 14. Phase 5: Release Candidate

Phase 5では新機能・新Layer・大規模Refactorを行わず、Framework 1.3.0のRelease Candidateとして起動、Public API、Lifecycle、Restart、Map再読込、Dispose、Sample Game、Mobile、Performanceを検証した。全Release Blockerが解消したためFramework Versionを **1.3.0** に更新し、Map Format Versionは互換性を保って **1** を維持した。

### 14.1 Release blocker fixes

- `DefaultFrameworkFacade.start()`へ二重起動Guardを追加し、Render Loopの重複を防止した。
- Framework dispose時にRender Loopの停止状態を明示的に戻した。
- `WorldMapManager`のMap再読込時にbase world由来のruntime chunkも破棄し、chunk debug mesh/materialの残留を解消した。
- Navigation path LinesMeshを所有マテリアル込みで破棄し、経路再生成時の`colorShader`残留を防止した。

### 14.2 Release Candidate tests

- Fresh browser contextと破損した既存LocalStorageの双方から起動できることを確認。
- Public Entryのみからinitialize/start/restart/load/dispose、World/Player/Navigation/Interaction/Events/Visual/Map/Features/Stateを確認。
- startの二重呼出し、restart loop 5回、Map import 2回、disposeの二重呼出しを確認。
- Mesh、Material、Light、Observable、UI数が再生成ごとに一方的に増加しないことを確認。
- 32回のchunk境界移動、生成、unload、reload、Mission進行を行うbounded soak testを追加。
- Map Format 1とFramework Version差の読込、未来Map Versionと不正Mapの安全な拒否を確認。
- Mobile portrait/landscapeとtouch safety、全Visual preset/quality、PREBUILT/HYBRID map modeを回帰確認。

### 14.3 Final verification

Final verification:

| Check | Result |
|---|---|
| BUILD | PASS, TypeScript + Vite, 586 modules |
| Full E2E | PASS 15/15 |
| SMOKE | PASS 1/1 |
| STABILITY | PASS, 3 seed pairs |
| VISUAL | PASS, desktop presets/qualities + mobile AUTO |
| CHUNK | PASS, PROCEDURAL/PREBUILT/HYBRID/export/import/expansion/unload |
| PERFORMANCE | PASS, desktop NORMAL/STRESS + mobile LOW, budgets OK |
| FRAMEWORK API | PASS 1/1 |
| RELEASE CANDIDATE | PASS 3/3 |
| DEMO | PASS 1/1 headed |
| ARCHITECTURE | PASS, 116 TypeScript modules, circular dependencies 0 |

Production main bundleは約 **2,130.92 kB minified / 610.31 kB gzip**。Phase 5ではbundle最適化を行わず、Release BlockerではないためBacklogへ移した。

### 14.4 Final architecture metrics

| Metric | Phase 4 | Phase 5 | Result |
|---|---:|---:|---|
| Problematic Dependencies | 1 | 1 | No increase |
| Game-specific Leaks | 1 | 1 | No increase |
| Circular Dependencies | 0 | 0 | PASS |

残る構造課題はRelease Blockerではないため、`BACKLOG.md`へ優先度付きで移した。Phase 5ではcommitおよびtagを作成していない。

## 15. Git

この Phase では commit と tag を作成していない。
