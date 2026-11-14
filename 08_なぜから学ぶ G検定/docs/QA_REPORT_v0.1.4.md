# v0.1.4 検証報告

検証日：2026-11-14。Windows、Node.js 25.9.0、Playwright Chromium／WebKit（iPhone SE設定）。通し確認は390×844 CSS px。320×740 CSS pxの通常文字と拡大文字でも完走を確認した。

## 操作手順

ホーム「出荷ラインを見に行く」→3コマ漫画→「仕分け台へ行く」→「最初の箱を流す」→「検査済みの箱を見本に加える」→「搬送の様子を見る」→「似た搬送記録をまとめる」→「別の搬送経路を試す」→「2つの運び方を比べる」→「箱を丁寧に運ぶ」に切り替える→「出荷を見届ける」→16時のトラックと3枚の振り返りカード→「ここで終える」で完了を記録してホームへ戻る。

予想クイズ・数式・詳細設定・試験問題を開く必要はない。最後の「試験問題で確認する」を選ぶと既存12問へ進む。演習メニューから直接入る経路も残る。

## テスト・ビルド

| コマンド | 結果 |
| --- | --- |
| `npm test` | 4ファイル・36件成功 |
| `npm run test:e2e` | Chromium 23件・WebKit 23件、計46件成功 |
| `npx playwright test tests/episode.spec.ts` | ホーム進捗の最終調整後、本編10件を再実行して成功 |
| `npm run build` | TypeScript・Vite・SW生成成功、distへ出力 |
| `npm run build:menu` | TypeScript・Vite・SW生成成功、appへ出力 |
| `git diff --check` | 成功 |

通常版・メニュー版の入口と資産の内容は一致する。最終JSはindex-B3vU8fs6.js、CSSはindex-B3cibBv3.css、SWキャッシュはwhy-g-256a5382593f。キャッシュ対象は8資産。tool-labメニューの既存リンク先app/を更新した。

## 受入・回帰

- 390px幅で、ホームの目的説明から漫画、3方式、トラック、振り返り、完了まで操作した。最初のボタンは各場面1つ。詳細を開かず、入力・選択欄を操作せずに完了し、回答履歴は0件のまま。3つの名称はそれぞれ結果後に表示する。
- 箱Qそのものを見本にせず、別の良品W追加によって既存classifyの計算結果が不良→良品へ変わる。箱の位置と判定も計算値から変化する。
- 搬送記録12件が既存K-meansで3群へ収束。全記録の割当ては最近傍中心と一致し、中心は各群の平均。本編の表示メンバーと計算結果が一致する。待ち時間・停止が多い群はR9〜R12。原因は現場で確かめると説明し、グループを正解・原因としない。詳細も同じデータ・初期値を使う。
- 固定された同じ2経路で、早さ重視はA22点／B14点、丁寧さ重視はA26点／B38点へ順位が反転する。9／12行動、停止1／0回、両方到着。mainの合計と加減点内訳、詳細の各行の累計が既存evaluateRouteと一致する。画面に概念デモであり学習結果ではないことを明記する。
- 漫画の読書位置、AI試行、見本追加後、搬送記録の操作前後、経路比較前、条件切替後、結末を再読込・続きから学ぶで復元する。詳細教材を開いてから物語へ戻っても見本追加済み状態を保持する。
- 「最初から学ぶ」で漫画と3体験を初期化する。不良→別の箱追加→良品を再体験できる。回答・復習候補・設定を保持し、過去の完了を残して再完了・再開始できる。完了後はホームで3／3方式を表示する。
- v0.1.0の途中場面、v0.1.1の見本追加後、v0.1.2以降のprologue／sortingと、従来の詳細画面の再開を確認。episodeがない保存データは対応する従来画面へ直接復帰し、冒頭へ強制移動しない。既存のDB版・JSON形式版は1を維持する。
- 本編の完了には詳細・比較・応用・知識マップ・問題回答が不要。旧9場面の閲覧・全12問の回答・全選択肢の解説表示、演習からの直接アクセス、復習候補、保存失敗の再試行、バックアップ書出し・統合・置換・不正拒否も回帰確認する。12問と48解説の基準データ一致を単体テストで確認した。
- 初回取得後にオフラインへ切り替え、漫画から3方式・出荷・振り返り・完了まで通した。再読込後も完了記録と結末を復元する。SVG・計算・教材はローカル資産内にあり、外部画像は取得しない。
- 320pxの通常文字と文字拡大では、ホームから結末まで各操作後の横溢れ、主ボタン・結果カードの境界、挿絵とセリフの重なりを検査した。結果・本文は自然な縦スクロールで読む。拡大文字はテスト用CSS（本編本文32px、既存導入の確認28px）による確認。

## 3方式と結末の画像

| 場面 | Chromium | WebKit mobile |
| --- | --- | --- |
| ホーム | [画像](screenshots/v0.1.4/episode-home-chromium.png) | [画像](screenshots/v0.1.4/episode-home-webkit-mobile.png) |
| 教師あり：別の見本追加後 | [画像](screenshots/v0.1.4/episode-supervised-chromium.png) | [画像](screenshots/v0.1.4/episode-supervised-webkit-mobile.png) |
| 教師なし：搬送記録のまとまり | [画像](screenshots/v0.1.4/episode-unsupervised-chromium.png) | [画像](screenshots/v0.1.4/episode-unsupervised-webkit-mobile.png) |
| 報酬：早さ重視 | [画像](screenshots/v0.1.4/episode-rewards-speed-chromium.png) | [画像](screenshots/v0.1.4/episode-rewards-speed-webkit-mobile.png) |
| 報酬：丁寧さ重視 | [画像](screenshots/v0.1.4/episode-rewards-care-chromium.png) | [画像](screenshots/v0.1.4/episode-rewards-care-webkit-mobile.png) |
| 結末と3方式の振り返り | [画像](screenshots/v0.1.4/episode-ending-chromium.png) | [画像](screenshots/v0.1.4/episode-ending-webkit-mobile.png) |
| オフラインの結末 | [画像](screenshots/v0.1.4/episode-ending-offline-chromium.png) | [画像](screenshots/v0.1.4/episode-ending-offline-webkit-mobile.png) |
| 320pxの結末 | [画像](screenshots/v0.1.4/episode-ending-320-chromium.png) | [画像](screenshots/v0.1.4/episode-ending-320-webkit-mobile.png) |
| 320px・拡大文字の結末 | [画像](screenshots/v0.1.4/episode-ending-large-text-chromium.png) | [画像](screenshots/v0.1.4/episode-ending-large-text-webkit-mobile.png) |

導入の[3コマ漫画](screenshots/v0.1.4/prologue-chromium.png)、[AI試行](screenshots/v0.1.4/ai-trial-chromium.png)、[誤判定](screenshots/v0.1.4/intro-before-chromium.png)も撮影した。画像は全38枚。WebKit画像はdeviceScaleFactorによりCSS寸法の2倍のピクセル数になる。

## 未確認

iPhone実機は未確認。WebKitのモバイル設定での確認であり、OSの実際の文字拡大、VoiceOver、インストール済みPWAの実機操作は未確認。文字拡大はCSSによる相当表示の検証。

改行はLF。commit・push・公開は行っていない。
