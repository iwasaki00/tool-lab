# tool-lab

ツール作成用の実験・開発リポジトリです。

## Usage

`index.html` をブラウザで開くと、Tool Lab のトップメニューを表示します。
トップメニューから学習タイマーや乗車券購入シミュレーションツールを選択できます。
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

起動後に `http://127.0.0.1:8042/study-camera-timer/` を開きます。通常のタイマー機能はカメラなしでも利用でき、カメラは画面上の操作後にのみ許可を求めます。
カメラの初回利用時はMediaPipe本体と検出モデルを取得するため、インターネット接続が必要です。デバッグ表示はURL末尾に `?debug=1` を付けて有効にできます。

終了通知は5種類の音から選択でき、既定では画面上の「通知を停止」を押すまで繰り返します。Webブラウザの制約により、Safariをバックグラウンドへ移動した場合やiPhoneをロックした場合は、音の継続を保証できません。
iPhone SafariのWebKitはVibration APIに対応していないため、バイブレーション通知を選択した場合は画面点滅へ切り替えます。AndroidなどVibration API対応環境ではバイブレーションを使用します。

ロジックと静的構成の回帰テストは次で実行できます。

```powershell
node study-camera-timer/tests/run-tests.mjs
```

## Structure

- `index.html`: Tool Lab のトップメニュー
- `style.css`: トップメニューの画面スタイル
- `study-camera-timer/`: カメラ連動型・学習タイマー（PWA対応）
- `study-camera-timer/js/`: タイマー、カメラ検出、履歴、設定などのモジュール
- `ticket-simulator/`: 乗車券購入シミュレーション
- `ticket-simulator/index.html`: シミュレーション画面
- `ticket-simulator/style.css`: シミュレーション画面スタイル
- `ticket-simulator/script.js`: 日付生成、シミュレーション、CSV出力
- `.nojekyll`: GitHub Pagesで静的ファイルをそのまま配信するための設定
