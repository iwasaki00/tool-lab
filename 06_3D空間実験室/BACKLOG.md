# Framework Backlog

Framework 1.4.0完成時点で凍結した改善候補。共通3D基盤の完成を優先し、実際のゲーム／ツール開発中にRelease BlockerとなるまでFramework本体へ追加しない。

## HIGH

- `ApplicationHost`をGame Session、UI、生成フロー、telemetry単位へ分割する。
- `StoragePort`とBrowser adapterを導入し、Map、Score、Movement設定の永続化を分離する。
- `DiagnosticsPort` / `TestControlPort`を導入し、TestBridgeとDebugPanelのdeprecated `LaboratoryApi`依存を縮小する。
- 残るProblematic Dependency 1件を、互換性を保てる次回migrationで解消する。
- 残るGame-specific Leak 1件をFramework public/core境界から除去する。

## MEDIUM

- Recast、Sample Game、Dev/Test toolingをdynamic import可能なentryへ分離する。
- Recastを初期bundleから分離し、Navigationが不要な構成の起動コストを下げる。
- Main bundle sizeを計測し、Public Core向けのbundleを削減する。

## LOW

- 大量の反復装飾や遠距離オブジェクトへThin Instance最適化を追加する。

## Completion

- Feature Toggle、Starter Template、3D Walk SampleはFramework 1.4.0で完了。
- 次工程はFramework改善ではなく、実際のゲーム／ツール作成。
