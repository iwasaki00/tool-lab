# tool-lab

ツール作成用の実験・開発リポジトリです。

## Usage

`index.html` をブラウザで開くと、乗車券購入シミュレーションツールを使用できます。
HTML / CSS / JavaScript のみで動作するため、GitHub Pages にそのまま配置できます。

## GitHub Pages

GitHub の `Settings` → `Pages` で、`Build and deployment` の `Source` を `Deploy from a branch` に変更します。
`Branch` は `main`、フォルダは `/ (root)` を選び、`Save` を押してください。

反映後のURLは通常 `https://iwasaki00.github.io/tool-lab/` です。

## Structure

- `tools/`: 作成中のツールを置く場所
- `index.html`: アプリ画面
- `style.css`: 画面スタイル
- `script.js`: 日付生成、シミュレーション、CSV出力
- `.nojekyll`: GitHub Pagesで静的ファイルをそのまま配信するための設定
