# Tilt 3D Lab / 傾き3D実験室

スマートフォンの画面を3D空間への窓として扱い、端末の傾き、またはPCのマウス位置に応じてPerspective Cameraを移動する実験用Webアプリです。オブジェクトを入力に合わせて回転させるのではなく、観察者の位置を動かすことで、側面、重なり、遮蔽の変化を作ります。

## Version

**0.2.0 — Phase 2「3D WINDOW」**

テーマは「スマートフォン画面を、3D空間を覗く窓にする」です。

## Three.js

- Version: **0.170.0**
- 導入方法: 公式配布ES Moduleを`js/three.module.js`としてプロジェクト内へ同梱し、ローカルから動的ロード
- 取得元: `https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js`

同梱ファイルのVersionを固定しているため、実行時の外部通信は不要です。Three.jsやWebGLを読み込めない場合も、センサーUIを停止せず、3D表示を利用できない旨をシーン領域に表示します。

## Phase 2で実装した範囲

- Three.js `WebGLRenderer`と`PerspectiveCamera`による実3D描画
- `viewX` / `viewY`によるカメラ位置移動と固定注視点への`lookAt`
- 背景壁、奥側オブジェクト、中央オブジェクト、前景オブジェクトのZ深度分離
- Perspectiveによる自然な視差と、中央物体の裏が見える遮蔽変化
- 未来的な展示室、空間グリッド、立体フレーム、複数ライト、簡易シャドウ
- 控えめに浮遊する前景オブジェクト
- 縦画面専用UIと横画面時の回転案内
- カメラ座標、FOV、描画サイズ、Pixel Ratio、WebGL状態のDEBUG表示
- WebGL／Three.jsロード失敗時のフォールバック表示
- Phase 1のセンサー、反転、ニュートラル、感度、スムージング、PCマウス操作を継承

## 3Dシーン構成

```text
CAMERA            z = +7.5
FRONT OBJECTS     z = +1.2 ～ +1.7
MAIN OBJECT       z = -0.15
HIDDEN OBJECTS    z = -1.55 ～ -1.8
BACK WALL         z = -5.2
```

中央には面ごとの材質差が分かるBox型展示物、手前にはSphere、Icosahedron、Cube、Tetrahedronを配置しています。中央物体の後ろには発光する球体と多面体があり、左右から覗くと隠れていた部分が見える構成です。

## カメラ制御とDeviceOrientation

`orientation.js`はDeviceOrientationの取得、画面方向補正、ニュートラル差分、正規化された`tiltX` / `tiltY`の提供を担当します。`app.js`で反転設定を適用して`viewX` / `viewY`を作り、`renderer.js`でスムージングします。`scene3d.js`は入力方式を意識せず、描画用の視点値だけを受け取ります。

```text
DeviceOrientation / Mouse
  → tiltX / tiltY
  → invertX / invertY
  → viewX / viewY
  → smoothing + sensitivity
  → camera.position.x / y
  → camera.lookAt(focalTarget)
```

中央オブジェクトは入力によって回転しません。実際にカメラが少し横・縦へ移動するため、Z深度の異なる物体にPerspective由来の視差が生じます。

## ファイル構成

```text
index.html          画面構造、3D Canvas、縦向き案内
style.css           UI、3D窓枠、レスポンシブ表示
js/app.js           UI、状態管理、view変換、シーン接続
js/orientation.js   許可、姿勢取得、画面方向補正、正規化
js/renderer.js      単一RAF、スムージング、感度、FPS計測
js/scene3d.js       Three.jsシーン、カメラ、リサイズ、3D描画
js/three.module.js  Three.js 0.170.0（同梱依存ファイル）
README.md           このファイル
```

## ローカル確認方法

ES Moduleを使うため、HTTPサーバーから表示します。

```powershell
cd 07_スマホ傾き疑似3Dツール
py -3 -m http.server 8080
```

ブラウザで `http://localhost:8080` を開きます。Three.jsは同梱済みなので、実行時のインターネット接続は不要です。

## iPhoneでの確認方法

1. HTTPSでアクセスできる場所へ配置し、iPhone Safariで縦向きに開きます。
2. 「モーション開始」をタップし、モーション利用を許可します。
3. 自然な姿勢で「現在位置を中央にする」をタップします。
4. 端末を小さく上下左右へ傾け、中央物体の側面や背後の発光体が見えることを確認します。

iOSではユーザー操作内で`DeviceOrientationEvent.requestPermission()`を呼びます。センサーには原則としてHTTPSのSecure Contextが必要です。

## Androidでの確認方法

HTTPSで配置したページをAndroid Chromeで開き、「モーション開始」をタップします。機種やOS設定によってセンサーが制限される場合はDEBUGで受信値を確認してください。

## PCのマウス操作

3D窓領域の中央がニュートラルです。マウスを左右上下へ動かすと、実センサーと同じ`viewX` / `viewY`経路を通ってカメラが移動します。領域から外すと中央へ戻ります。

## 縦画面専用仕様

タッチ端末ではportraitを正式な表示方向としています。landscapeにすると3D描画ループを一時停止し、操作UIを隠して「端末を縦向きに戻してください」と表示します。portraitへ戻るとシーンをリサイズして自動復帰します。Orientation Lockの成功には依存しません。

## パフォーマンス

- センサー処理、スムージング、浮遊アニメーション、Three.js描画を単一の`requestAnimationFrame`へ統合
- Pixel Ratioを`Math.min(devicePixelRatio, 2)`に制限
- GeometryとMaterialは初期化時に一度だけ生成
- 影のマップを512×512に制限
- 非表示時とスマートフォン横画面時はRAFを停止
- Reduce Motion時はカメラ移動量と浮遊量を低減

## WebGL要件と既知の制限

- WebGL対応ブラウザが必要です。
- ブラウザや端末ごとにセンサー軸、感度、GPU性能に差があります。
- 実機によって方向の体感が異なる場合は、DEBUGの左右・上下反転を個別に調整できます。
- Phase 2ではGLTF、外部モデル、Post Processing、Bloom、物理エンジンは使用していません。

## Phase 3候補

- GLTF / GLBによる展示モデルの読み込み
- 複数の3D WINDOWデモ切替
- 水中・浮遊空間シーン
- 端末別カメラ範囲のキャリブレーション
- Depth Mapを使った画像の疑似3D表示
