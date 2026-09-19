# 3D SPACE LAB — 自動動作確認

PlaywrightからVer.11のDebug Managerを経由し、World生成、Mission、Inventory、Door、Switch、Enemy、Discovery、Goal、Resultまでをブラウザ上で検証します。テスト専用のゲームロジックは持たず、通常プレイと同じManager／State Machineを呼び出します。

## 準備

```sh
npm install
npx playwright install chromium
```

## 実行コマンド

```sh
npm run test:e2e       # Smoke、3モード、Mobile、Stability
npm run test:smoke     # 最小起動確認
npm run test:stability # 3組のSeedで生成確認
npm run demo           # Chromiumを表示して自動デモ
npm run build          # TypeScript + Vite本番ビルド
```

テスト実行時はVite開発サーバーが自動起動します。既にポート`4173`で起動している場合は、そのサーバーを再利用します。

## 成果物

- 状態別スクリーンショット: `test-results/screenshots/`
- 失敗時のTrace・Screenshot: `test-results/artifacts/`
- HTMLレポート: `test-results/report/`
- Demo動画: `test-results/artifacts/`（`npm run demo`時）

HTMLレポートは次で開けます。

```sh
npx playwright show-report test-results/report
```

## Test Bridge

開発サーバーでURLへ`?e2e=1`または`?demo=1`を付けた場合だけ、`window.__SPACE_LAB_TEST__`が公開されます。本番ビルドでは公開されません。

主なAPI:

- `startGame()` / `getGameState()`
- `getMissionState()` / `getCurrentObjective()` / `getGuideState()`
- `teleportToObjective()` / `teleportToGoal()`
- `giveMissionItem()` / `completeCurrentObjective()`
- `setDoorState()` / `setSwitchState()`
- `getEnemyStates()` / `setEnemyAI()` / `enemyCommand()`
- `getDiscoveryState()` / `discover()`

## 失敗時の確認

Console Errorと`pageerror`はテスト失敗として収集されます。失敗したStep、Expected／Actual、Seed、Game／Mission／Navigation状態はPlaywrightのエラーとTraceから確認できます。Navigationが`NAVMESH`ではなく`WORLD_GRAPH`へフォールバックしても、ゲームが`PLAYING`まで到達すれば正常扱いです。
