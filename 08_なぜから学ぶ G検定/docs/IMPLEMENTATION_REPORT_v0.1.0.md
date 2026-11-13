# IMPLEMENTATION REPORT v0.1.0

## 結果

空の作業フォルダーにTypeScript / React / Viteで新規作成。L003を導入からまとめまで操作可能にし、IndexedDB保存・JSONバックアップ・PWAを実装した。commit・push・公開・デプロイは実施していない。既存のアプリや変更の破棄はしていない。

## 作成ファイル

- ルート：`package.json`、`package-lock.json`、`tsconfig.json`、`vite.config.ts`、`playwright.config.ts`、`index.html`、`.gitignore`、`.gitattributes`、`README.md`
- `src/`：`App.tsx`、`main.tsx`、`types.ts`、`vite-env.d.ts`、`style.css`
- `src/data/`：`content.ts`
- `src/components/`：`Learning.tsx`、`Simulations.tsx`
- `src/engine/`：`learning.ts`、`simulations.ts`、`storage.ts`、`engine.test.ts`
- `public/`：`manifest.webmanifest`、`icon.svg`、`icon-192.png`、`icon-512.png`、`apple-touch-icon.png`
- `scripts/`：`build-sw.mjs`、`normalize.mjs`、`write-content.mjs`
- `tests/`：`app.spec.ts`
- `docs/`：仕様、教材、アーキテクチャ、QA、実装報告の5資料
- 生成物：`dist/`（本番資産・sw.js）、`test-results/`（画面画像・テスト結果）。依存関係・生成物はGit対象外。

## 9場面

| 場面        | 状況 | 実装                                          |
| ----------- | ---- | --------------------------------------------- |
| 01 導入     | 完成 | 3依頼・非採点の予想・保存                     |
| 02 教師あり | 完成 | 2特徴のSVG・1最近傍・ラベルと入力変更         |
| 03 教師なし | 完成 | 実K-means・2/3/4群・中心・割当て／更新・再現  |
| 04 強化     | 完成 | 5×5格子・報酬変更・固定行動比較・概念デモ明示 |
| 05 比較     | 完成 | PC比較表・スマートフォン比較カード            |
| 06 応用     | 完成 | 正解と目的の条件切替・方法選択・理由          |
| 07 マップ   | 完成 | 概念選択・局所表示・種類付き関係              |
| 08 演習     | 完成 | 独自12問・4択・個別解説・根拠・履歴           |
| 09 まとめ   | 完成 | 方式整理・今回の結果・候補登録・学習完了記録  |

## 計算・内容

分類・K-means・報酬計算をUIから分離し単体検証可能にした。強化学習デモは固定行動を評価するもので、方策学習や最適経路の発見を主張しない。12問の全48選択肢は解説と正誤の整合をレビューし、4択採点を単体テスト、正解回答・全解説表示を両ブラウザで検証した。

## 保存と検証

保存位置・日時・版つき回答履歴・復習候補・学習完了・再生速度をIndexedDBへ保存。書込完了後に保存済みを表示し、失敗時は再試行を用意。JSONは形式・整合を検査し、置換確認・統合時のID重複排除・競合拒否・破損拒否を実装。

単体テスト20件PASS、ChromiumとWebKitのE2E計12件PASS、本番ビルドPASS。PCおよび320pxの画面を画像でも確認。iPhone実機確認は未実施。詳細はQA_REPORTを参照。

## 既知の制約・次段階

- 実機Safari・ホーム画面追加・VoiceOver・OSストレージ削除時は実機検証が必要。
- ブラウザの永続保存は保証されない。定期的にJSONバックアップを行う。
- 複数タブの同時編集は非対応。一つのタブで利用する。
- シミュレーションの作業状態は場面移動で初期化。K-meansのシードで再現できる。進行と回答履歴は保存。
- 大量履歴は単一スナップショット保存を分割ストアへ拡張する余地がある。
- 旧問題版のバックアップは拒否する。将来、問題版更新時に移行処理が必要。
- 復習は正誤に応じた候補提示のみ。詳細な間隔反復・方策学習・他のレッスンは対象外。
- 関連する未実装教材は「準備中」。外部シラバス参照はオンライン接続が必要。

## tool-labメニュー統合（2026-11-14）

親の `index.html` にG検定カードを先頭追加し、件数を8件へ変更。親と本アプリのREADMEにメニュー用ビルド手順を追記。`package.json` に `build:menu` を追加し、`scripts/build-sw.mjs` は `dist` / `app` の出力先に対応。`app/` にビルド済み静的資産を生成し、Git管理対象とした。メニューからの実際の遷移とオフライン再開をChromium・WebKitで確認した。commit・push・公開は行っていない。
