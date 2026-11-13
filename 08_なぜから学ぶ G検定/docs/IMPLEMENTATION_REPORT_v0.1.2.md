# IMPLEMENTATION REPORT v0.1.2

## 実装した動作

ホームの同じレッスンカードに「続きから学ぶ」「最初から学ぶ」を表示。後者は今回のL003を新しいセッションで初期化し、見本追加前からやり直せる。前者は保存された位置と見本追加状態へ戻る。完了後も再開始可能。

「出荷まで、あと1時間。」のプロローグを追加した。検査員一人に仕分けが追いつかない現場から、AIを試す理由へつなぐ。既存のSVGを共通化し、同じ検査員・箱・コンベアに箱の列・時計・出荷口を追加。続く箱Qの場面では、検査員の確認結果とAIの判定を分けて表示する。別の箱Wによる最近傍分類の実計算と、結果後の用語説明は継続する。

## 変更ファイル

- `src/App.tsx`：再開始、旧完了の退避、プロローグの表示・遷移、完了履歴の表示、バージョン。
- `src/components/ShippingIllustration.tsx`（追加）：共有SVGと場面別の要素。
- `src/components/ShippingPrologue.tsx`（追加）：短い説明、セリフ、主ボタン。
- `src/components/ShippingStory.tsx`：共有SVGへ置換、人とAIの結果表示。
- `src/data/shippingStory.ts`：プロローグの文言。
- `src/data/content.ts`：新ID L003-P00をレッスンに追加。既存9場面と12問は維持。
- `src/engine/learning.ts`：再開始・完了履歴・JSON検証と統合。
- `src/types.ts`：任意のintroStage、LessonCompletion、任意のcompletions。
- `src/style.css`：プロローグ、人とAIの確認表示、完了履歴の表示。
- `src/engine/restart.test.ts`（追加）：再開始、履歴、旧データ、完了、復元、IDの5テスト。
- `tests/restart.spec.ts`（追加）：受入条件の4シナリオ、2ブラウザ。
- `tests/fixtures/v0.1.1-backup.json`（追加）：段階情報のない操作済み旧データ。
- `tests/app.spec.ts` / `tests/story.spec.ts`：プロローグ経由に追従し、既存の期待値と検証範囲を維持。
- `package.json` / `package-lock.json`：0.1.2。依存ライブラリ追加なし。
- `README.md` / `docs/ARCHITECTURE.md` / `docs/CONTENT_L003.md` / `scripts/write-content.mjs`：操作と保存・教材の説明。
- `docs/SPEC_v0.1.2.md` / `docs/QA_REPORT_v0.1.2.md` / 本報告（追加）。
- `docs/screenshots/v0.1.2/`：通常の3場面×2ブラウザと、320px文字拡大の画像。
- `app/`：メニュー用の静的アプリを更新。通常版はGit対象外のdist/へ生成。

## データを消さない方法

再開始はスナップショット全体を維持したまま、現在のL003進行のみをnewProgressへ置換する。回答・復習・設定は保持し、新しいsessionIdで今回と過去の回答を区別する。完了履歴は別の配列へ保存する。旧completed=trueは再開始やセッション変更前に一つの完了記録へ退避する。

既存のscene配列0〜8はそのまま。新しいプロローグはL003-P00とintroStageで管理する。新規／最初からはprologue、旧データでintroStageがない場合はsortingと解釈するため、更新前の途中位置を冒頭へ移動しない。DB版1とバックアップ形式版1は維持し、新フィールドは任意として旧JSONを受け入れる。

## 検証

単体30件・ブラウザ30件PASS。通常版とメニュー用ビルドPASS。390×844でプロローグが一画面に収まり、320px・文字200%相当の表示も確認。12問・48解説、任意演習、保存・復習・JSON入出力、旧版再開、オフラインを維持した。詳細と3場面の画像はQA_REPORT_v0.1.2を参照。

iPhone実機は未確認。旧版で既に消去されていた過去の完了記録を復元する処理ではない。commit・push・公開は行っていない。
