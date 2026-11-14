# v0.1.3 検証報告

検証日：2026-11-14。Windows、Node.js 25.9.0。PlaywrightのChromiumとWebKit（iPhone SE設定）を使用。画像は390×844 CSS pxを基準とし、320×740 CSS px・文字200%相当でも確認した。WebKitの画像はdeviceScaleFactorによりCSS寸法の2倍のピクセル数となる。

## コマンド結果

| コマンド | 結果 |
| --- | --- |
| `npm test` | 3ファイル・31件成功 |
| `npm run test:e2e` | Chromium 18件・WebKit 18件、計36件成功 |
| `npm run build` | TypeScript・Vite・SW生成成功、distへ出力 |
| `npm run build:menu` | TypeScript・Vite・SW生成成功、appへ出力 |
| `git diff --check` | 成功 |

通常版・メニュー版の資産は同じ内容。最終ビルド：JS `index-lKv5IHjH.js`、CSS `index-BNjfPlH9.css`、SWキャッシュ `why-g-e9c841f04dca`（8資産）。tool-labの既存リンク先app/を再生成した。

## 受入・回帰確認

- 初回ホームには指定の紹介文を表示し、「あと1時間」を出さない。3コマはいつもの出荷→包装機停止→15時の到着の順で同一画面へ配置。最初の2コマには「あと1時間」がなく、3コマ目に初出。入力欄・選択欄0件、漫画の主ボタンは最後の1つだけ。
- 「仕分け台へ行く」→過去の良品・不良見本モニター→「最初の箱を流す」→人の確認が合格、AI判定が不良→別の箱W追加→良品、の順に進む。教師あり学習の説明は変化の後にだけ出る。
- Q自体を登録せず、初期の最近傍P4（距離√89）から別の箱W（距離√13）へ変わる実計算を単体テストで確認。判定とレーン位置が実際に変わり、詳細分類へWを引き継ぐ。SVG内のAI判定ラベルと人の確認文字の間隔も検証する。
- 漫画をスクロールして再読込した後、保存した読書位置を復元。AI試行画面で再読込した場合もその画面へ復帰。操作後の中断は良品判定の状態を復元する。
- v0.1.0の途中場面、v0.1.1の見本追加後、v0.1.2のprologue/sortingをそれぞれ対応する状態へ再開する。旧本編の保存位置を強制的に漫画へ戻さない。
- 「最初から学ぶ」は漫画から再開始し、見本追加前の不良→良品を再体験できる。回答履歴・復習候補・設定・他レッスンの状態を保持。旧完了記録の退避、再完了後2件の完了記録、完了後の再開始とバックアップ統合・置換も確認する。
- 演習を解かずに知識マップ→まとめ→完了できる。演習メニューから12問へ直接入れる。12問と48選択肢の解説は基準データとの一致、全選択肢の採点、ブラウザ上の全問操作で確認する。
- 漫画・AI試行のローカルSVGを含む全資産をSWへキャッシュ。オフライン再読込・再開始・見本追加・履歴再開を確認。既存の保存失敗時の再試行・JSON復元・教師なし学習の操作・強化学習の表示も回帰確認する。
- 390px幅では漫画を自然に縦スクロール。320px幅・文字200%相当では漫画とAI試行・誤判定・追加後に横溢れや本文・挿絵・ボタンの重なりがないことを矩形と画像で確認する。本文を一画面に押し込む縮小は行わない。

## スクリーンショット

| 場面 | Chromium | WebKit mobile |
| --- | --- | --- |
| 1コマ目・いつもの出荷 | [画像](screenshots/v0.1.3/comic-1-chromium.png) | [画像](screenshots/v0.1.3/comic-1-webkit-mobile.png) |
| 2コマ目・包装機停止 | [画像](screenshots/v0.1.3/comic-2-chromium.png) | [画像](screenshots/v0.1.3/comic-2-webkit-mobile.png) |
| 3コマ目・15時の到着 | [画像](screenshots/v0.1.3/comic-3-chromium.png) | [画像](screenshots/v0.1.3/comic-3-webkit-mobile.png) |
| 漫画全体と最後の主ボタン | [画像](screenshots/v0.1.3/prologue-chromium.png) | [画像](screenshots/v0.1.3/prologue-webkit-mobile.png) |
| AIを試す | [画像](screenshots/v0.1.3/ai-trial-chromium.png) | [画像](screenshots/v0.1.3/ai-trial-webkit-mobile.png) |
| 誤判定 | [画像](screenshots/v0.1.3/intro-before-chromium.png) | [画像](screenshots/v0.1.3/intro-before-webkit-mobile.png) |
| 別の見本追加後 | [画像](screenshots/v0.1.3/intro-after-chromium.png) | [画像](screenshots/v0.1.3/intro-after-webkit-mobile.png) |
| 320px・文字200%相当の漫画 | [画像](screenshots/v0.1.3/prologue-large-text-chromium.png) | [画像](screenshots/v0.1.3/prologue-large-text-webkit-mobile.png) |
| 320px・文字200%相当のAI試行 | [画像](screenshots/v0.1.3/ai-trial-large-text-chromium.png) | [画像](screenshots/v0.1.3/ai-trial-large-text-webkit-mobile.png) |
| 320px・文字200%相当の追加後 | [画像](screenshots/v0.1.3/intro-large-text-chromium.png) | [画像](screenshots/v0.1.3/intro-large-text-webkit-mobile.png) |

## 未確認

iPhone実機は未確認。OSの実際の文字拡大設定やVoiceOver、インストール済みPWAでの実機操作は未確認。文字200%相当はテスト用CSSによる確認。

commit・push・公開は行っていない。改行はLF。
