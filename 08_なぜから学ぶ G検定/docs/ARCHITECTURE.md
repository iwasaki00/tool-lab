# アーキテクチャ

## 構成

- `src/types.ts`：Course / Lesson / Scene / Concept / Relationship / SyllabusItem / Question / QuestionAttempt / LearningProgress / ReviewState / Settings / Backup
- `src/data/content.ts`：固定ID付き教材、9場面、11概念、11関係、比較、12問、参照シラバス
- `src/engine/simulations.ts`：React非依存の最近傍・K-means・行動列の報酬計算。将来の方策学習は別モジュールで追加できる。
- `src/engine/learning.ts`：採点、復習候補、バックアップ検証・統合、新規状態
- `src/engine/storage.ts`：IndexedDBオープン、読込、トランザクション完了を待つ書込
- `src/components/Simulations.tsx`：3つの操作体験、SVG・格子表示
- `src/components/Learning.tsx`：知識マップ、4択と個別解説
- `src/App.tsx`：5画面とレッスン、保存キュー、進行、復元UI
- `src/style.css`：PC左メニュー、モバイル下部メニュー、320px対応
- `scripts/build-sw.mjs`：ビルド成果物からService Workerを生成
- `public/`：PWA manifest、SVGとPNGアイコン
- `src/engine/engine.test.ts`：計算・データ検証・IndexedDBテスト
- `tests/app.spec.ts`：Chromium / WebKitでの操作検証

## データの流れ

教材は型付き固定データ → UIの描画。ユーザー操作 → 採点または進行更新 → React状態と最新スナップショットを更新 → 保存キュー → 検証 → IndexedDBトランザクション → 完了または失敗の表示。

DB名 `why-learn-g`、DB版1、object store `state`、キー `snapshot`。履歴の配列を含むスナップショットを原子的に保存する。初期版の規模を優先した設計で、長期間の大量履歴を扱う際は履歴別ストア・索引へ移行する。

## セッションとID

教材・問題・関係のIDは固定。各履歴・演習セッションにUUID。レッスンの解答結果は現在セッションの各問題の最新回答で集計する。新規演習は新しいセッションへ移るが、全履歴は保持する。進行ID `progress-L003`、設定ID `settings`、復習ID `review-{questionId}`。

## 並行操作と制限

一つのタブ内では保存を直列化し、古い保存完了で新しい操作を「保存済み」にしない。複数タブ・複数ウィンドウの同時編集には対応していないため、一つのタブで利用する。クラウド同期はない。JSON統合時の同一ID競合は拒否し、手動解決を要する。

## PWA更新

資産単位のハッシュでキャッシュを更新し、インストール完了後に有効化する。同一プレフィックスの旧キャッシュだけを削除し、IndexedDBには触れない。教材はアプリのJSに含め、外部フォント・外部画像への依存を持たない。
