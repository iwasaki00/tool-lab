# v0.1.4 実装報告

L003を、工場の出荷の導入から3方式の体験、16時のトラック、振り返りまで通せる1話に仕上げた。初回の本編では予想クイズ・数式・詳細設定を開かずに完了できる。

## 通しの操作手順

ホームの「出荷ラインを見に行く」→3コマ漫画を読む→「仕分け台へ行く」→「最初の箱を流す」→「検査済みの箱を見本に加える」→「搬送の様子を見る」→「似た搬送記録をまとめる」→「別の搬送経路を試す」→「2つの運び方を比べる」→「早く届ける／箱を丁寧に運ぶ」を切り替える→「出荷を見届ける」→16時のトラックと3方式のカードを読む→「ここで終える」で完了を記録しホームへ戻る。

最後に「試験問題で確認する」を選ぶと既存12問へ進める。ホームの演習メニューから直接解く経路も維持する。

## 変更内容

- ホームで教材の目的・専門知識不要・試験任意を案内する。新本編の進捗は体験した3方式で表示し、旧データは9場面の表示を保つ。
- 最近傍分類の見本追加から、搬送記録のK-means、同じ2経路の報酬比較へ接続。各操作の結果を見せた後に名称を説明する。
- 記録のまとまりを原因の確定としない。報酬比較は固定行動列の概念デモと明記し、学習済みの経路とは表示しない。
- 共通SVGへ搬送待ち・2経路・トラックへの積込みを追加。同じ検査員・箱・コンベアを使う。
- 細かな計算は任意の詳細へ分離する。旧詳細教材・比較・応用・知識マップも任意で開け、物語の保存状態へ戻れる。
- 新本編の段階・結果・条件を保存する。旧データの場面を変更しない。「最初から学ぶ」は今回の体験だけを初期化し、回答・完了・復習・設定を保つ。

## 変更ファイル

- `src/components/Episode.tsx`（追加）：搬送記録・経路比較・出荷・振り返り・任意演習と詳細への入口。
- `src/engine/episode.ts`（追加）：架空記録、固定経路、既存計算を呼ぶ本編用処理。
- `src/App.tsx`：新規開始と旧再開の分岐、本文と見出し、完了、詳細から戻る導線、ホーム紹介と進捗、版表示。
- `src/types.ts`、`src/engine/learning.ts`：EpisodeProgress、保存検証、新旧の完了条件、現在のプレイの再開始。
- `src/engine/simulations.ts`：K-means初期化へ任意データを渡せる拡張。既存の既定値を保持。
- `src/components/Simulations.tsx`：詳細教材に任意の点群と軸名を渡せる拡張。
- `src/components/ShippingIllustration.tsx`：共通SVGの3場面を追加。経路は実評価の座標列から描画。
- `src/components/ShippingStory.tsx`、`src/data/shippingStory.ts`：結果後の説明と、本編・詳細への導線。
- `src/data/content.ts`：L003の題名。
- `src/style.css`：本編・記録群・報酬カード・結末・詳細・狭い画面の配置。
- `src/engine/episode.test.ts`（追加）、`src/engine/restart.test.ts`：計算・進行・再開始・完了・保存の検証。
- `tests/episode.spec.ts`、`tests/helpers.ts`（追加）、`tests/app.spec.ts`、`tests/restart.spec.ts`、`tests/story.spec.ts`：通し体験と旧詳細・保存・全問・オフラインの回帰。
- `package.json`、`package-lock.json`：0.1.4。依存関係の追加なし。
- `README.md`、`scripts/write-content.mjs`、`docs/CONTENT_L003.md`、`docs/ARCHITECTURE.md`と本版の仕様・検証・実装報告：操作・データ・検証を更新。
- `docs/screenshots/v0.1.4/`：本編・導入・狭い画面・オフラインの画像。
- `app/index.html`、`app/assets/`、`app/sw.js`：tool-labメニュー用ビルドを更新。

## 検証と制限

[検証報告と画像](QA_REPORT_v0.1.4.md)にコマンド結果と受入確認を記載する。

iPhone実機は未確認。WebKitのモバイル設定による確認であり、OSの実際の文字拡大・VoiceOver・インストール済みPWAでの実機操作は未確認。改行はLF。commit・push・公開は行っていない。
