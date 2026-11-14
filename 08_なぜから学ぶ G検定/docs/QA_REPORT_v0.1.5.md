# v0.1.5 検証報告

検証日：2026-11-15。Windows、Node.js 25.9.0、PlaywrightのChromiumとWebKit（iPhone SE設定）。通しの画面確認は390×844 CSS px。320×740 CSS pxの通常文字と拡大文字でも検証した。

## テスト・ビルド結果

| コマンド | 結果 |
| --- | --- |
| `npm test` | 5ファイル・45件成功（既存36件＋追加9件） |
| `npm run test:e2e` | Chromium 28件・WebKit 28件、合計56件成功（既存46件＋追加10件） |
| `npm run build` | TypeScript・Vite・SW生成成功、distへ出力 |
| `npm run build:menu` | TypeScript・Vite・SW生成成功、appへ出力 |
| `git diff --check` | 成功 |

最終JS：index-DY1nUqM-.js、CSS：index-S5BrSv6z.css。SWキャッシュはwhy-g-25d32a247de6（8資産）。通常版とメニュー版は同じ資産を持つ。tool-labの既存リンク先app/を更新した。

## 受入確認

- 第1話を未読の状態で「コース」からL004を開始。導入で工場のAI仕分けと、学習用の見本ではない100箱による試運転を説明する。事前クイズ・選択欄なしで「100箱を流す」から進める。
- Aは一致99箱／99％、不良品の見逃し1箱、良品の止めすぎ0箱。Bは一致98箱／98％、見逃し0箱、止めすぎ2箱。全100件が同じID・人の検査結果を持つことと、表示の集計がレコードと一致することを確認した。
- 4区分はAが良品通過99／良品停止0／不良通過1／不良停止0、Bが97／2／0／1。混同行列の全セルと照合した。再現率は不良品を見つけたい対象としてAが0/1＝0％、Bが1/1＝100％。データを変えると集計も変わり、対象0件は対象なしとする。
- 学習用の見本データは変更しない。100箱を1個ずつ流す演出はなく、まとまりと見逃した1箱を表示する。人の検査結果とAIの判定を別ラベルにし、色に加え記号と文字で結果を区別する。
- 比較はA/Bを選ぶクイズではない。全体の一致・不良品の見逃し・良品の止めすぎを同じ表で並べ、100箱の図を併記する。結末でこの工場の目的からBを候補にし、良品2箱を人が再確認する。Bが常に優れる、本番の安全が保証される、という説明はしない。
- 正解率・再現率は結果後の「試験での呼び方」に配置。混同行列は任意の「詳しく見る」。演習を一問も解かずに完了でき、L004の完了記録が残る。
- 独自3問の全12選択肢の採点を単体で検証し、ブラウザで3問の回答・全解説・再開を確認した。第3問の次へが無効になり、3問用の番号・進捗で動くことも確認する。
- コース一覧とL003結末から明示操作でL004へ入れる。L003の「ここで終える」「試験問題で確認する」は維持。L003の結末から勝手に第2話へ移動しない。
- L004の見逃し発見、A/B比較、任意演習、結末を再読込後に「続きから学ぶ」で復元する。L004をやり直してもL003の進行・12問の回答・復習候補・設定が変わらない。L003の再開・やり直しでもL004の進行・3問の履歴・完了を保持する。L004だけ完了した人もL003は初回の物語から始められる。
- 両レッスンが完了済みでも、再開始・再完了・JSON統合で過去の完了日時と記録を残し、同一セッションを重複させない。
- 両話を含むJSONを書き出し・置換復元して再開した。旧バックアップとの統合では2レッスンの位置を独立に選び、古いファイルにないL004を消さない。不正な進行・採点・重複履歴を拒否する。DB版・JSON形式版1を維持し、旧フィールドを勝手に初期化しない。
- 初回取得後にオフラインへ切り替え、L004の導入から結末・完了まで操作した。再読込後も結末と用語・完了を復元する。挿絵はインラインSVGであり、外部画像は取得しない。
- L003の3方式・出荷・任意12問・全解説・詳細教材・途中再開・やり直し・オフライン・保存失敗の再試行も全件回帰した。
- 390pxで主ボタン・図・用語を画像確認。320pxの各場面・比較表・混同行列と拡大文字で、横スクロール、境界の切れ、挿絵とセリフの重なりがないことを確認した。拡大はテスト用CSSで本文等を32pxにした相当表示であり、OSの実際の文字拡大設定ではない。

## L004のスクリーンショット

| 場面 | Chromium | WebKit mobile |
| --- | --- | --- |
| 冒頭・未使用の100箱 | [画像](screenshots/v0.1.5/evaluation-intro-chromium.png) | [画像](screenshots/v0.1.5/evaluation-intro-webkit-mobile.png) |
| 見逃しの発見 | [画像](screenshots/v0.1.5/evaluation-discovery-chromium.png) | [画像](screenshots/v0.1.5/evaluation-discovery-webkit-mobile.png) |
| A/B比較 | [画像](screenshots/v0.1.5/evaluation-comparison-chromium.png) | [画像](screenshots/v0.1.5/evaluation-comparison-webkit-mobile.png) |
| 結末と試験での呼び方 | [画像](screenshots/v0.1.5/evaluation-ending-chromium.png) | [画像](screenshots/v0.1.5/evaluation-ending-webkit-mobile.png) |
| 任意の混同行列 | [画像](screenshots/v0.1.5/evaluation-confusion-chromium.png) | [画像](screenshots/v0.1.5/evaluation-confusion-webkit-mobile.png) |
| オフラインの結末 | [画像](screenshots/v0.1.5/evaluation-ending-offline-chromium.png) | [画像](screenshots/v0.1.5/evaluation-ending-offline-webkit-mobile.png) |
| 320pxの比較 | [画像](screenshots/v0.1.5/evaluation-comparison-320-chromium.png) | [画像](screenshots/v0.1.5/evaluation-comparison-320-webkit-mobile.png) |
| 320pxの結末・表 | [画像](screenshots/v0.1.5/evaluation-ending-320-chromium.png) | [画像](screenshots/v0.1.5/evaluation-ending-320-webkit-mobile.png) |
| 320px・拡大文字の比較 | [画像](screenshots/v0.1.5/evaluation-comparison-large-text-chromium.png) | [画像](screenshots/v0.1.5/evaluation-comparison-large-text-webkit-mobile.png) |
| 320px・拡大文字の結末 | [画像](screenshots/v0.1.5/evaluation-ending-large-text-chromium.png) | [画像](screenshots/v0.1.5/evaluation-ending-large-text-webkit-mobile.png) |

L004の画像20枚、L003の回帰画像38枚、合計58枚。WebKit画像はdeviceScaleFactorによりCSS寸法の2倍のピクセル数となる。旧版の画像は上書きしていない。

## 未確認事項

iPhone実機は未確認。WebKitのモバイル設定による検証で、OS文字拡大・VoiceOver・インストール済みPWAの実機操作は未確認。

改行はLF。commit・push・公開は行っていない。
