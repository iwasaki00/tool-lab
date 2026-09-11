# 3D空間実験室

Babylon.jsのプリミティブ形状とTypeScriptだけで構築した、一人称視点の3D実験フィールドです。外部3Dモデルは使用していません。

## 起動

リポジトリのルートで次を実行します。

```sh
npm install
npm run dev
```

本番ビルドは `npm run build` です。

## 操作

- `W` `A` `S` `D`: 移動
- マウス: 視点移動（画面クリックでPointer Lock）
- `Space`: ジャンプ
- `Shift`: ダッシュ
- `Esc`: Pointer Lock解除

生成処理は `src/objects`、シーン構成は `src/scene`、プレイヤー操作は `src/player`、画面UIは `src/ui` に分割しています。
