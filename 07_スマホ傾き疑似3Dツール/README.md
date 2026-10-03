# Tilt 3D Lab / 傾き3D実験室

スマートフォン画面を3D世界への窓として扱い、端末の傾きやPCのマウス位置に応じてPerspective Cameraを移動するショーケースです。物体ではなく観察者の位置を動かし、側面、重なり、遮蔽、透明物の見え方を変化させます。

## Version

**0.3.1 — VIEW CALIBRATION**

Phase 3の3シーンを維持したまま、端末や好みに合わせて視点挙動を調整できる実機調整機能を追加しています。

## VIEW SETTINGS

メイン画面の「VIEW SETTINGS」から、次の項目を調整できます。

- `MASTER SENSITIVITY`: 25〜400%。全体の移動量を調整します。初期値は100%です。
- `HORIZONTAL / VERTICAL`: 軸別ゲインを0〜300%で調整します。初期値は各100%です。
- `NORMAL / INVERT / OFF`: 左右・上下それぞれの方向を独立して設定します。初期値は既存挙動を引き継ぐ`INVERT`です。
- `WINDOW`: カメラの向きを固定し、画面を固定された窓として覗き込むモードです。初期設定です。
- `LOOK AT`: カメラを常にシーン中央へ向ける、従来の注視挙動です。
- `FOV`: 35〜80°。初期値は42°です。
- `SMOOTHING`: 滑らか・標準・追従重視から選択できます。

調整値は`localStorage`へ保存され、再訪時に復元されます。不正値や古い形式は安全な初期値へ戻します。「RESET VIEW SETTINGS」は視点設定だけを初期化し、「現在位置を中央にする」はセンサーのニュートラル位置だけを更新します。

## 入力からカメラまで

```text
DeviceOrientation / Mouse
  → tiltX / tiltY
  → direction X / Y（NORMAL・INVERT・OFF）
  → viewX / viewY
  → smoothing
  → master sensitivity × axis gain
  → finalX / finalY（安全範囲でクランプ）
  → camera.position.x / y
  → WINDOW または LOOK AT
```

最大設定でも最終入力を±3.5に制限し、過大なカメラ移動を防ぎます。`prefers-reduced-motion`環境では移動量も抑えます。

## SHOWCASE SCENES

- **AQUARIUM（デフォルト）**: 水面、FogExp2、光線、泡、魚、海底、岩、サンゴで構成した多層の水中世界です。
- **NEON CHAMBER**: グリッド、立体フレーム、発光オブジェクト、前景・背景を配置したSF空間です。
- **BUBBLE / CRYSTAL**: 透明Icosahedron、発光Octahedron、結晶群、光線、前景Sphereで透明物の重なりを確認できます。

シーンはページ再読み込みなしで切り替わります。切り替え時に旧シーンのGeometry、Material、Texture、Shadow Mapを破棄し、単一のRAFで入力平滑化・シーン更新・カメラ更新・Three.js描画を行います。

## DEBUG

DEBUGを有効にすると、次の情報を確認できます。

- raw tilt、方向適用後のview、平滑化後のview、最終入力
- X/Y方向、マスター感度、X/Yゲイン、視点モード
- DEVICE/CAMERAの方向図、カメラ座標、FOV、FPS
- Scene、Object、Triangle、Draw Call、GPU Geometry/Texture
- Rendererサイズ、Pixel Ratio、Fog、Shadow、Animation状態

## Three.jsとファイル構成

- Three.js: **0.170.0**（`js/three.module.js`へ同梱、実行時の外部通信なし）
- `index.html`: Canvas、シーン切替、操作UI、調整シート
- `style.css`: 3D窓、レスポンシブUI、調整シート
- `js/app.js`: UI、入力変換、設定保存、Scene Manager接続
- `js/orientation.js`: センサー許可、画面方向補正、正規化
- `js/renderer.js`: 単一RAF、平滑化、感度・ゲイン、安全制限、FPS
- `js/scene3d.js`: Three.js共通処理、視点モード、シーン管理
- `js/scenes/*.js`: AQUARIUM、NEON、CRYSTALの各シーン

## ローカル確認

```powershell
cd 07_スマホ傾き疑似3Dツール
py -3 -m http.server 8080
```

ブラウザで`http://localhost:8080`を開きます。PCでは3D窓内のマウス位置で端末の傾きを再現できます。

## iPhone / Android

HTTPSで配信し、縦向きで開きます。「モーション開始」からセンサー利用を許可し、自然な姿勢で「現在位置を中央にする」を押してください。iOSではユーザー操作内で`DeviceOrientationEvent.requestPermission()`を呼びます。スマートフォンの横画面では描画ループを停止し、縦向きへ戻す案内を表示します。

実機ではまず初期値で試し、必要に応じて軸方向、軸別ゲイン、マスター感度、視点モード、FOVの順で調整してください。端末傾きを視点位置として利用しているため、体感上の自然な方向には端末・持ち方・ユーザー差があります。

## パフォーマンスと既知の制約

- Pixel Ratioは通常最大2、スマートフォンでは最大1.5です。
- スマートフォンではShadowを無効化し、同時に保持するShowcase Sceneを1つに限定します。
- 水面反射・屈折、Post Processing、Bloom、GLTF/GLB読み込みは未実装です。
- センサーの軸、感度、許可仕様は端末・OS・ブラウザにより差があります。
- WebGL非対応時もUIを維持し、3D表示を利用できない旨を表示します。
