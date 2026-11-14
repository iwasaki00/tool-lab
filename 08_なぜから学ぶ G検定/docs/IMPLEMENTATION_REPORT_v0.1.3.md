# v0.1.3 実装報告

L003の冒頭を3コマ漫画→AIを試す→既存の誤判定→別の見本追加の順へ改修した。ホームの紹介文を指定文言へ変更した。集荷時刻の変更ではなく、包装機停止によって仕分けの開始が遅れたことを、同じ16:00の札・停止したベルト・15:00の時計・届いた箱の列で表現した。

既存SVGの箱・検査員・コンベアを共用してusual/stopped/arrivals/ai-trialを追加した。SVGはアプリのJS内に含まれ、外部画像を取得しない。漫画は通常16pxの本文で自然に縦スクロールする。

introStageへai-trialを追加し、漫画の読書位置prologueScrollも保存する。旧prologueは漫画へ、sortingまたは未設定は既存の仕分けへ復帰する。再開始は現在の進行だけを初期化する。回答・過去の完了・復習・設定は保持する。既存の分類エンジン、問題12問と48選択肢解説、教師なし学習・強化学習の本編は変更していない。

## 変更ファイル

- `src/App.tsx`：ホーム紹介、導入の段階遷移、読書位置の保存・復元、表示版。
- `src/components/ShippingPrologue.tsx`：縦3コマとAI試行の表示。
- `src/components/ShippingIllustration.tsx`：共通SVGの4場面を追加。
- `src/components/ShippingStory.tsx`：似た検査済みの箱を追加する提案。
- `src/data/shippingStory.ts`：指定された漫画・会話・ボタン文言。
- `src/data/content.ts`：プロローグの題名。
- `src/types.ts`、`src/engine/learning.ts`：新段階と読書位置の保存・入力検証。
- `src/style.css`：漫画のコマと読みやすい縦配置。
- `src/engine/restart.test.ts`、`tests/app.spec.ts`、`tests/story.spec.ts`、`tests/restart.spec.ts`：保存・再開始・表示・回帰確認。
- `package.json`、`package-lock.json`：0.1.3へ更新。依存関係の追加なし。
- `README.md`、`docs/ARCHITECTURE.md`、`scripts/write-content.mjs`、`docs/CONTENT_L003.md`、本仕様・検証・実装報告：最新の操作と設計を記載。
- `docs/screenshots/v0.1.3/`：ChromiumとWebKitの画面画像。
- `app/index.html`、`app/assets/`、`app/sw.js`：tool-labメニュー用成果物を再生成。

## 結果と制限

単体31件、ブラウザ回帰36件が成功。通常版とメニュー版ビルド成功。詳細と画像は[検証報告](QA_REPORT_v0.1.3.md)を参照。

iPhone実機は未確認。WebKitのモバイル設定による確認。改行はLF。commit・push・公開は行っていない。
