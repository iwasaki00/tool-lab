# 3D Starter Template

Framework Public APIだけを利用する最小アプリです。`framework/internal`、具象Manager、Sample Game、deprecated `LaboratoryApi`には依存しません。

## 新規アプリの開始

1. `templates/starter-3d`を新しいアプリ用フォルダへコピーします。
2. `index.html`の`title`と、`appComposition.ts`の`MY 3D APP`を変更します。
3. コピー先からFrameworkへの相対import pathを調整します。
4. Repository rootで`npm install`、`npm run dev`を実行します。
5. Vite上のコピー先`index.html`を開きます。

## 設定

- `appConfig.ts`の`profile`で`MINIMAL`、`EXPLORATION`、`FULL`を選択します。
- `features`でProfileのFeatureを個別に上書きします。
- `world`でMap mode、Seed、Styleを指定します。
- `config.map`でAuto ExpansionとChunk Unloadを指定します。
- `config.visual.quality`でVisual Qualityを指定します。
- Day/Night等のVisual presetは`framework.getVisual()`から変更します。

## ゲーム／ツール固有コード

固有処理は`appComposition.ts`または新しいアプリ側フォルダへ追加します。Framework内部や`src/game/sample`へ追加しないでください。

## Build

Repository全体の検証は`npm run build`で行います。独立packageへ切り出す場合も、Public Entry相当だけを依存先にしてください。
