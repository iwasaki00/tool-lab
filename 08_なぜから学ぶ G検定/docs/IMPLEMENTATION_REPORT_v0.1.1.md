# IMPLEMENTATION REPORT v0.1.1 — STORY FIRST

## 結果

初めてホームから開く利用者は「出荷ラインを見に行く」→「検査済みの箱を見本に加える」の2ボタンだけで、質問に答えず最初の判定変化に到達できる。旧版の途中データはその場面から再開する。

## 変更・追加ファイル

- `src/App.tsx`：ホームの初回／再開／導入再訪、導入の描画、任意演習の分岐、回答なしのまとめ・完了、v0.1.1表示。
- `src/components/ShippingStory.tsx`（新規）：インラインSVG・セリフ・見本追加・操作後の説明。箱Qの位置・判定・見本Wの状態を切替。
- `src/data/shippingStory.ts`（新規）：物語の文言と対象Q・別の見本Wの特徴。
- `src/engine/shippingStory.ts`（新規）：既存のclassifyによる見本追加前後の計算。
- `src/components/Simulations.tsx`：操作後のQとWを教師ありの詳細シーンへ引継ぎ。教師なし・強化の本編は変更なし。
- `src/data/content.ts`：導入タイトルを変更し3依頼データを除去。9場面IDと12問・48解説は不変。
- `src/types.ts` / `src/engine/learning.ts`：任意の開始・見本追加フラグ、旧データ対応の再開判定、試験を必須にしない完了条件。
- `src/style.css`：導入とSVG・セリフ・ボタン、320px・文字拡大時の折返し。
- `src/engine/shippingStory.test.ts`（新規）、`tests/story.spec.ts`（新規）、`tests/app.spec.ts`（更新）：受入条件と既存機能の回帰。
- `tests/fixtures/v0.1.0-backup.json` / `v0.1.0-questions.json`（新規）：旧保存形式・既存問題の比較基準。
- `package.json` / `package-lock.json`：バージョン0.1.1。追加ライブラリなし。
- `README.md` / `docs/CONTENT_L003.md` / `docs/ARCHITECTURE.md` / `scripts/write-content.mjs`：現行操作・教材内容・設計を反映。
- `docs/SPEC_v0.1.1.md` / `docs/QA_REPORT_v0.1.1.md` / 本報告（新規）。v0.1.0の版付き資料は保持。
- `docs/screenshots/v0.1.1/`：操作前後と320px・文字200%相当の6画像。
- `app/`：tool-labメニューから開く静的アプリを最新版へ再ビルド。通常の成果物はGit対象外の`dist/`。

## 教材の正確性

初期見本での対象Q=(60,60)の最近傍は不良P4=(68,65)。追加する別の良品W=(58,57)がより近いため判定が変わる。Qの正解登録や結果文字の固定は行わない。SVG・判定文字は実計算から表示する。操作前に教師あり学習の説明を出さない。

## 保存と互換

DB版1・バックアップ形式版1・場面ID・問題ID／版を維持。新たなフラグは任意なので、旧JSON／IndexedDBを初期化せず読み込める。削除した予想フォームの旧回答値も保存内容では維持する。回答履歴・復習候補・設定も保持する。最初の体験を行った状態も逐次保存する。新しい完了条件は演習以外の8場面閲覧で、問題への回答は必須にしない。

## 検証と残課題

単体25件、Chromium・WebKitのブラウザ操作22件、本番とメニュー用ビルドを確認。詳細と画像はQA_REPORT_v0.1.1を参照。

iPhone実機は未確認。教師なし・強化学習を出荷現場の物語へ作り直す作業は今回行っていない。外部画像・外部AI API・新規の依存ライブラリは追加していない。commit・push・公開・デプロイは行っていない。
