# Tilt 3D Lab / 傾き3D実験室

スマートフォン画面を3D世界への窓として扱い、端末の傾きやPCのマウス位置に応じてPerspective Cameraを移動するショーケースです。物体を入力で回転させるのではなく観察者の位置を動かし、側面、重なり、遮蔽、透明物の見え方を変化させます。

## Version

**0.3.0 — Phase 3「SHOWCASE SCENES」**

テーマは「3Dになる」から「3Dを体験したくなる」へ、です。

## Three.js

- Version: **0.170.0**
- 導入方法: 公式配布ES Moduleを`js/three.module.js`として同梱
- 取得元: `https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js`

実行時の外部通信は不要です。WebGLを利用できない場合もUIは停止せず、3D表示を利用できない旨を表示します。

## SHOWCASE SCENES

### AQUARIUM（デフォルト）

小さな水中世界です。波打つ半透明水面と波紋、FogExp2、上方からの光線、12個の多深度Bubble、Geometryを組み合わせた3匹の魚、海底、岩、サンゴを配置しています。大きな前景魚、岩、泡は意図的に画面端からはみ出し、視点移動で画面外だった部分や背後の物体が見えます。

### NEON CHAMBER

Phase 2の展示室を発展させたSF空間です。奥行きグリッド、立体フレーム、Box・Octahedron・Torus・Cylinderからなる中央展示物、背後の発光体、画面端の大型前景物を配置しています。正面で隠れたCylinderや発光球が横から見える構成です。

### BUBBLE / CRYSTAL

透明物の重なりを体験する幻想的な空間です。中央の透明Icosahedronシェルと発光Octahedron、周囲の小型結晶、奥の光点、画面端から切れる大型透明Sphereを配置しています。透明Materialは`depthWrite: false`と明示的な`renderOrder`で描画順を調整しています。

## Scene切替とリソース管理

Canvas内下部のAQUARIUM／NEON／CRYSTALボタンで、ページ再読み込みなしに切り替えます。共通Scene Managerが現在のシーンだけをThree.js Sceneへ接続します。切替時は旧シーンを走査し、Geometry、Material、Textureを`dispose()`してから削除します。イベントは親要素への1つのイベント委譲のみで、シーンごとのRAFやイベントは作りません。切替時には約210msの軽いフェードを使用します。

## 前景・中景・背景

各シーンは実際のZ座標で、画面端にはみ出す前景、主役となる中景、Fogへ溶ける背景に分けています。視差量をCSSで作り分けず、Perspective Cameraと実Z深度によって自然に変化させています。

## カメラ制御とDeviceOrientation

Phase 2までの入力構造を維持しています。

```text
DeviceOrientation / Mouse
  → tiltX / tiltY
  → invertX / invertY
  → viewX / viewY
  → smoothing + sensitivity
  → camera.position.x / y
  → camera.lookAt(focalTarget)
```

基本FOVは42°です。カメラ移動倍率はAQUARIUM 1.0、NEON 1.1、CRYSTAL 0.92です。

## Animation

単一RAF内でセンサー平滑化、シーン更新、カメラ更新、Three.js描画を順番に処理します。AQUARIUMでは魚の遊泳、泡の上昇、水面の波、NEONではRing回転と発光変化、CRYSTALでは結晶の緩やかな自転を行います。Reduce Motion時は自動Animationとカメラ移動量を低減します。

## DEBUG

センサー値に加えて、現在のScene、Object Count、Triangle Count、Draw Calls、GPU Geometry／Texture数、Quality、Fog、Shadow、Animation、Camera座標、FOV、描画サイズ、Pixel Ratio、WebGL状態、FPSを表示します。描画統計は`renderer.info`から取得します。

## ファイル構成

```text
index.html                    Canvas、シーン切替、UI
style.css                     3D窓枠、シーンUI、レスポンシブ表示
js/app.js                     UI、入力変換、Scene Manager接続
js/orientation.js             センサー許可、画面方向補正、正規化
js/renderer.js                単一RAF、スムージング、感度、FPS
js/scene3d.js                 Three.js共通処理とシーン管理
js/scenes/aquariumScene.js    水中ショーケース
js/scenes/neonScene.js        ネオン展示室
js/scenes/crystalScene.js     透明結晶ショーケース
js/three.module.js            Three.js 0.170.0
README.md
```

## ローカル確認方法

```powershell
cd 07_スマホ傾き疑似3Dツール
py -3 -m http.server 8080
```

ブラウザで`http://localhost:8080`を開きます。PCでは3D窓内のマウス位置を使って全シーンのカメラを移動できます。

## iPhone / Android

HTTPSで配置し、縦向きで開きます。「モーション開始」からセンサー利用を許可し、自然な姿勢で「現在位置を中央にする」を押してください。iOSではユーザー操作内で`DeviceOrientationEvent.requestPermission()`を呼びます。

## 縦画面仕様

スマートフォンではportraitが正式対象です。landscape時は描画ループを停止し、「端末を縦向きに戻してください」と表示します。portraitへ戻すとリサイズして自動復帰します。

## Performance

- Pixel Ratioを最大2、スマートフォンでは最大1.5に制限
- GeometryとMaterialはScene生成時のみ作成
- 同時に保持するShowcase Sceneは1つだけ
- Shadow Mapは512×512、スマートフォンではShadowを無効化
- 透明物とライト数を限定
- 非表示時・スマートフォン横画面時はRAF停止
- Quality表示は現在`STANDARD`固定

## 既知の制限

- Geometryのみで構成しているため、魚や岩はスタイライズされた表現です。
- 本格的な水面反射・屈折、Post Processing、Bloomは未使用です。
- 半透明物は端末GPUや視点によって重なりの見え方が多少変化します。
- 端末ごとにセンサー感度とGPU性能が異なります。

## Phase 4候補

**GLTF / GLB MODEL VIEWER**

- GLTF / GLBモデル読み込み
- モデルごとの自動フレーミング
- ライト・背景プリセット
- モデル情報とAnimation一覧
- モバイル向け品質自動調整
