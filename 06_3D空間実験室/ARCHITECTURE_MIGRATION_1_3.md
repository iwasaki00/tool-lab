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

## 11. Git

この Phase では commit と tag を作成していない。
