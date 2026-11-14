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

## v0.1.1：物語導入

- `src/data/shippingStory.ts`：対象箱Q、追加する検査済み箱W、導入文言。
- `src/engine/shippingStory.ts`：既存のclassifyを呼び、見本追加前後を計算。
- `src/components/ShippingStory.tsx`：同一SVGの箱位置・判定文字・見本を計算に応じて切替。外部画像やアニメーションに依存しない。
- 進行へ任意の `started` / `storySampleAdded` を追加。旧データの欠落時は未操作として描画する。旧 `predictions` は表示しないが削除しない。DB版1とバックアップ形式版1を継続する。
- 完了記録は演習以外の8場面の閲覧で可能。12問の回答履歴と復習管理は従来通り独立して保存する。
- `tests/fixtures/` に新フィールドを含まない旧形式の保存例と、既存12問の基準データを保持し、互換性と内容不変を検証する。

## v0.1.2：プロローグ・再開始・完了の履歴

- `ShippingIllustration.tsx`で検査員・箱・コンベアを共用し、プロローグでは出荷口・時計・待ち箱、仕分けでは人とAIの判定を表示する。`ShippingPrologue.tsx`は短い説明とボタンを配置する。
- 新しい `L003-P00` をレッスンの場面一覧の先頭へ追加。既存の `scenes` 配列9件の添字・IDは変更しない。進行の任意フィールド `introStage` によって、scene=0内のプロローグ／仕分けを区別する。新規・再開始はprologue、旧データの未設定時はsortingと解釈し、保存位置を移動しない。
- `restartLesson`は現在のL003進行だけをnewProgressで初期化し、新しいセッションIDを発行する。スナップショットの他フィールドは維持する。
- `LessonCompletion`と任意の `completions` 配列を追加。旧 completed=true は再開始・進行変更・新規演習の前に完了記録へ退避する。旧版に正確な完了日時がないため、旧進行のupdatedAtを記録日時として継承する。新規の完了は完了操作の日時を記録する。
- 完了IDはlessonIdとsessionIdから安定して生成。JSON統合時はIDで重複を排除して完了記録を残す。再開始・復元・履歴更新は従来のIndexedDBトランザクションで保存する。

## v0.1.3：漫画とAI試行

- scene=0のintroStageへai-trialを追加し、prologue（同一画面の縦3コマ）→ai-trial（過去の見本モニター）→sortingへ進む。既存のL003-P00・S01〜S09は変更しない。旧prologueは新しい漫画、sortingまたは未設定は従来の仕分け操作状態へ復帰する。
- 任意のprologueScrollは漫画の縦スクロール位置。180msのデバウンスで既存の保存キューへ書き込み、再開時に復元する。再開始時は0へ初期化。非数値・非有限・負値をバックアップ検証で拒否する。DB・バックアップ形式の版は1を継続する。
- ShippingIllustrationの共通SVGへusual/stopped/arrivals/ai-trialを追加。ローカルのJSに含まれるためSWでオフライン表示できる。判定計算・問題・教師なし学習・強化学習は変更しない。

## v0.1.4：1話完結の本編

- 新規開始時とrestartLessonで任意のEpisodeProgressを設定する。stageはsorting/records/routes/ending、操作はgrouped/compared、条件はpriority=speed/care。scene=0の内部で本編を進め、旧版のscene・ID・introStageを変更しない。episodeのない保存データは既存画面のまま再開する。
- Episode.tsxは困りごと→操作→結果→名前の順に表示。旧版の詳細教材へ移動した場合もepisodeを保持し、出荷の物語に戻る導線を表示する。新しい本編は見本追加・グループ分け・報酬比較を終えたendingで完了可能。旧版は従来の8場面閲覧条件を維持する。
- episode.tsは架空記録と固定経路の入力を持ち、既存のinitializeK/kStep/evaluateRouteを呼ぶ。K-means初期化は任意データを受け取れるよう拡張し、既存の既定データ・seedは維持。UnsupervisedとPlotも任意データ・軸名を受け取れ、本編と詳細で同じ記録を使う。
- 新状態の型・前提条件・完了条件をJSON復元とDB保存の両方で検証。DB版1・JSON形式版1を維持し、回答・完了履歴・復習・設定の統合処理は従来どおり。

## v0.1.5：独立した第2話L004

- data/evaluation.tsは未使用の評価用100箱、人の検査結果、A/Bの判定、独自3問を持つ。engine/evaluation.tsは4区分・一致数・正解率・不良品の再現率を集計する。分類エンジンと見本データへ追加しない。
- 既存progressとattemptsはL003のまま維持。Backupへ任意のevaluation（L004の段階・閲覧・問題番号・セッション・完了・更新日時）とevaluationAttemptsを追加する。両レッスンの再開始は相互の進行・回答・復習・設定へ触れない。DB版・JSON形式版は1を継続。
- completionRecordsはL003/L004の完了をセッションごとの安定IDで保持する。進行更新・再開始前に現在の完了を退避し、過去の日時を維持。hasLearningRecordはL003に属する記録のみで判定し、L004だけを学んだ人もL003を初回状態から始められる。
- JSON検証ではL004の場面の前提・閲覧・3問の採点整合性・重複IDを検証する。統合ではL003とL004の更新日時を別々に比べて進行を選び、両方の回答と完了を保持する。旧バックアップにないフィールドは勝手に初期化しない。
- AppのactiveLessonで表示を切替え、L004表示中はL003のスクロール保存を停止する。コースとL003結末の明示操作でのみL004へ入る。EvaluationEpisodeは4場面・結果後の用語・任意の混同行列・3問を描画する。Quizは既定の12問を保ち、任意の問題配列を受け取れる。
- ShippingIllustrationの既存検査員・箱・コンベアを共用。100箱の集まり、1箱の人とAIのラベル、止まった良品の再確認をインラインSVGで表現する。新しい画像・データも同じJS資産に含まれ、既存SWでオフライン表示できる。

## v0.1.6：第0章

`BeginnerGuide.tsx`に4項目・包含枠・任意details解説・工場への入口と、共用の`GuideIllustration`を配置。PNGは`public/illustrations`から相対BASE_URLで読み、Service Workerの全成果物キャッシュへ自動で含まれる。

Appの`guideOpen`は保存対象の学習状態から独立する。背後のページはアンマウントせずhiddenで保持し、呼び出し前のスクロールとフォーカスを復元する。L003プロローグの位置保存は第0章表示中に停止し、L003/L004の進行や履歴は変更しない。新しいDBフィールドやバックアップ移行は不要。案内ページ自体の読書位置は一時状態で、再読込後はホームから開く。

ホームは両レッスンの学習記録・更新時刻から再開先を示し、同じ話へのやり直しを提供する。静的なAI試行挿絵は見本用PNGへ置換し、動的な結果図は従来のSVG・データ描画を維持する。
