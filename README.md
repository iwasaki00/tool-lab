# tool-lab

ツール作成用の実験・開発リポジトリです。

## Usage

`index.html` をブラウザで開くと、Tool Lab のトップメニューを表示します。
ゲームアイコンをタップすると各ツールを開き、長押しすると機能の詳細を確認できます。
ハモリ練習ツールでは、iPhoneのマイクを使って単音・フレーズ・つられ耐性を練習できます。
Water Strobeでは、対応するiPhoneの背面カメラ用ライトを周期点滅させ、水滴などの動きを観察できます。
オウム返しでは、話し終わりを自動検出し、Pitch Shiftやロボット・宇宙人・逆再生などの声でまねします。履歴とお気に入りにも対応しています。
HTML / CSS / JavaScript のみで動作するため、GitHub Pages にそのまま配置できます。

## GitHub Pages

GitHub の `Settings` → `Pages` で、`Build and deployment` の `Source` を `Deploy from a branch` に変更します。
`Branch` は `main`、フォルダは `/ (root)` を選び、`Save` を押してください。

反映後のURLは通常 `https://iwasaki00.github.io/tool-lab/` です。

## カメラ連動型・学習タイマー

カメラ機能は、GitHub PagesなどのHTTPS環境、または `localhost` で利用できます。ローカル確認では、リポジトリ直下で次を実行してください。

```powershell
py -3 -m http.server 8042 --bind 127.0.0.1
```

起動後に `http://127.0.0.1:8042/02_学習タイマー/` を開きます。通常のタイマー機能はカメラなしでも利用でき、カメラは画面上の操作後にのみ許可を求めます。
カメラの初回利用時はMediaPipe本体と検出モデルを取得するため、インターネット接続が必要です。デバッグ表示はURL末尾に `?debug=1` を付けて有効にできます。

終了通知はローカルに生成した5種類のWAV音源から選択でき、既定では画面上の「通知を停止」を押すまで繰り返します。Webブラウザの制約により、Safariをバックグラウンドへ移動した場合やiPhoneをロックした場合は、音の継続を保証できません。
通常タイマー、試験、ポモドーロ、クイックタイマーは分と秒を組み合わせて設定できます。デバッグモードは設定画面のスイッチから有効化でき、再読み込み後に検出状態とテスト操作を表示します。

ロジックと静的構成の回帰テストは次で実行できます。

```powershell
node 02_学習タイマー/tests/run-tests.mjs
```

## Structure

- `index.html`: Tool Lab のトップメニュー
- `style.css`: トップメニューの画面スタイル
- `home.js`: トップメニューの長押し・詳細表示
- `favicon.svg` / `favicon-64.png`: ブラウザ用ファビコン
- `apple-touch-icon.png`: iPhoneホーム画面用アイコン
- `assets/game-icons/`: トップメニュー用のゲームアイコン
- `01_ticket-simulator/`: 乗車券購入シミュレーション
- `01_ticket-simulator/index.html`: シミュレーション画面
- `01_ticket-simulator/style.css`: シミュレーション画面スタイル
- `01_ticket-simulator/script.js`: 日付生成、シミュレーション、CSV出力
- `02_学習タイマー/`: カメラ連動型・学習タイマー（PWA対応）
- `02_学習タイマー/js/`: タイマー、カメラ検出、履歴、設定などのモジュール
- `03_ハモリ練習/`: iPhone向けハモリ練習ツール（マイク音程検出・PWA対応）
- `03_ハモリ練習/data/exercises.js`: 追加しやすいフレーズ練習問題
- `04_ストロボ効果実験/`: iPhone Safari向け水滴ストロボ（診断・録画・PWA対応）
- `04_ストロボ効果実験/js/`: カメラ、Torch、周期制御、録画、診断、保存の各モジュール
- `05_オウム返し/`: iPhone Safari向けオウム返し（自動録音・Pitch Shift・音声エフェクト・履歴対応）
- `05_オウム返し/js/main.js`: 音声検出、状態管理、録音、波形、履歴UI
- `05_オウム返し/js/audio-effects.js`: Pitch Shift、フィルター、特殊効果、空間系エフェクト
- `05_オウム返し/js/storage.js`: IndexedDBを利用したお気に入り音声の保存
- `.nojekyll`: GitHub Pagesで静的ファイルをそのまま配信するための設定
