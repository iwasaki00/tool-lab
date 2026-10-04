# Tilt 3D Lab / 傾き3D実験室

スマートフォンの傾き、またはPCのマウス位置をカメラ移動へ変換し、画面を「窓」として覗き込むWebアプリです。Version 0.5.0では写真とDepth Mapから疑似3Dを生成する `DEPTH PHOTO` を追加しました。

## Version

**0.5.0 — Phase 5A「DEPTH PHOTO CORE」**

既存のAQUARIUM / NEON / CRYSTAL / MODEL VIEWER、DeviceOrientation、iOS許可導線、マウスシミュレーション、VIEW CALIBRATION、Debug表示を維持しています。

## DEPTH PHOTOの使い方

1. シーン切替で `DEPTH` を選びます。
2. 内蔵サンプルはそのまま操作できます。
3. `PHOTO` で表示する写真を、`DEPTH MAP` で対応する深度画像を選びます。
4. 端末を傾けるかPCでマウスを動かし、視差を確認します。
5. `SETTINGS` でモード、強度、反転、平滑化、品質を調整します。

白を手前、黒を奥として扱います。逆のDepth Mapは `INVERT` を選びます。写真とDepth Mapの解像度が違う場合、Depth Mapを写真比率のメッシュへ再サンプリングします。縦横比の差が大きい場合は警告します。

### 入力画像

- ブラウザがデコード可能な `image/*`（JPG / PNG / WebPを推奨）
- HEICはOS・ブラウザにより非対応です。失敗時はJPG / PNG / WebPへ変換してください。
- EXIF回転は `createImageBitmap(..., { imageOrientation: "from-image" })` を優先し、ブラウザの画像デコードに従います。
- 長辺2,048pxを上限としてCanvasへ展開し、端末メモリを抑えます。

選択した画像は外部サーバーやAPIへ送信しません。File → ImageBitmap → Canvas → WebGL Textureの順にブラウザ内だけで処理します。画像そのものはlocalStorageへ保存しません。

## 立体化方式

- `FLAT`: 分割なしの平面。Depth強度は0です。
- `LAYERS`: 深度を8段階へ量子化した段差メッシュです。
- `MESH`: Depth輝度を頂点Zへ連続変換する本命モードです。

深度値 `0.5` を中央面とし、`(depth - 0.5) × amplitude × strength` でZを求めます。強度は0–300%。写真の縦横比を保って自動スケールします。

### Mesh Quality

- LOW: 長辺64分割
- STANDARD: 長辺112分割（既定、約1万頂点以下が目安）
- HIGH: 長辺192分割
- 上限: 40,000頂点

短辺分割数は写真比率から算出します。品質・モード変更時はGeometryを再構築します。強度・反転変更時は既存GeometryのZだけを更新します。

### 平滑化と段差制限

`DEPTH SMOOTH` はOFF / LOW / MEDIUM / HIGH。3×3近傍平均を指定回数適用します。`MAX DEPTH STEP` は隣接頂点差を0.18以内へ抑え、深度境界のゴム状突起を軽減します。

## Disocclusion対策

- 表示面を約6.5%拡張
- 背面に約13%拡張した写真面を配置
- 外周UVをストレッチ
- DEPTH PHOTO固有の入力Clamp（X 1.45 / Y 1.35）
- 強度・頂点数からLOW / MEDIUM / HIGHのリスクをDebug表示

完全な穴埋めではありません。深度差が大きい境界や強度200%以上では、引き伸ばしや隠れていた領域の不足が見えることがあります。

## View Calibration

既定値はHorizontal `NORMAL`、Vertical `INVERT`、View Mode `LOOK AT`、FOV 42°です。DEPTH PHOTOでも写真面自体は回転せず、既存設計どおりカメラが移動して中心を注視します。

## 保存範囲

localStorageへ保存するDepth設定は `mode / strength / invert / smooth / quality` だけです。写真・Depth Map・プレビュー・MAX DEPTH STEPは保存しません。VIEW CALIBRATIONは従来の保存キーを継続します。

## Debug

共通の姿勢、視点、FPS、Camera、FOV、Renderer、Draw Call、GPUリソースに加え、次を表示します。

- Photo / Depthの解像度とソース
- Mode、Strength、Invert、Smooth、Quality
- Depth最小 / 平均 / 最大
- Mesh分割、頂点数、三角形数
- Camera距離・移動幅
- Disocclusion Risk
- 処理時間、Resource State、Error Code

## エラー処理

未選択、空ファイル、画像でないファイル、デコード失敗を区別します。失敗しても現在表示中の写真とDepthは保持し、別ファイルを再選択できます。大きな縦横比差は停止せず警告したうえで再サンプリングします。

## リソース管理と性能

差し替え時は旧Texture / Geometry / Materialをdisposeします。画像デコード後のImageBitmapはCanvas転写後にcloseします。既存の単一RAF内で入力平滑化、カメラ、シーン、AnimationMixer、描画を更新し、追加RAFは作りません。

## ローカル実行

```powershell
cd 07_スマホ傾き疑似3Dツール
py -3 -m http.server 8080
```

`http://localhost:8080` を開きます。DeviceOrientationはHTTPSまたはlocalhostが必要です。iPhoneでは縦向きで「モーション開始」を押して許可してください。

## 既知の制限

- 単一Depth Mapから見えていない背景を復元することはできません。
- ブラウザがHEICをデコードできない環境があります。
- Depth境界が硬い画像は高強度で引き伸ばしが見えます。
- HIGH品質は古いスマートフォンで重くなる場合があります。
- 自動Depth推定、人物セグメント、AI補完は未実装です。

## Phase 5B候補

**AUTO DEPTH**: 画像からDepth Mapをブラウザ内または選択式バックエンドで推定し、境界マスク、穴埋め、被写体別レイヤー調整を追加する予定です。
