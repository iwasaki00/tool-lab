# Tilt 3D Lab / 傾き3D実験室

## Version 1.0.0

スマートフォンの傾きを利用し、画面を3D空間への窓のように見せられるかを検証する実験ツールです。このVersion 1.0.0を実験プロジェクトとしての完成版とします。

## 最終機能

- DeviceOrientationとiPhoneのモーション利用許可
- PC Mouse Simulation
- 現在の姿勢を基準にするNeutral操作
- Three.js Perspective Cameraによる視点移動
- VIEW SETTINGSによる視点キャリブレーション
- AQUA / NEON / CRYSTAL / OBJECTの4シーン
- GLBのローカル読込
- GLBのBounding Box、Auto Scale、Auto Framing、Animation
- Lighting / Background Preset
- Portrait向け表示とLandscape案内
- Debug telemetry

## シーン

- **AQUA**: 水面、泡、魚、岩、海底、Fogからなる水中空間。前景・中景・背景の視差を確認できます。
- **NEON**: 発光オブジェクトとGridを使い、遮蔽、側面、空間の奥行きを確認できます。
- **CRYSTAL**: 透明物体、前景物体、背景の重なりを確認できます。
- **OBJECT**: 非対称な標準Geometryオブジェクトを傾けて観察します。正面から隠れた側面・上面・背面側のパーツを視点移動で確認できます。

内部Scene IDは互換性維持のため`model`のままですが、通常UIでは`OBJECT`と表示します。

## OBJECTとGLB

OBJECTを開くとThree.js標準Geometryを組み合わせた`TILT OBJECT`をすぐ表示します。`OPEN GLB`は自分の3Dオブジェクトを試す補助機能です。

- 対象は自己完結した単一`.glb`
- 選択ファイルは外部へ送信せず、ブラウザ内で処理
- Bounding Boxから中央配置、Auto Scale、Camera Distanceを算出
- Animation Clipがあれば選択とPlay / Pauseが可能
- 差し替え時とScene切替時にGeometry / Material / Texture / Mixerを解放

Draco、KTX2、Meshopt、外部`.bin`参照を持つ`.gltf`は対象外です。

## 実機で確定した基準設定

iPhone実機確認で最も自然だった組み合わせを正式デフォルトとしています。

- Horizontal Direction: **NORMAL**
- Vertical Direction: **INVERT**
- View Mode: **LOOK AT**
- Master Sensitivity: 100%
- Horizontal / Vertical Gain: 100%
- FOV: 42°

既存のlocalStorage設定は上書きしません。`RESET VIEW SETTINGS`で上記基準へ戻ります。

## VIEW SETTINGS

Master Sensitivity、Horizontal Gain、Vertical Gain、各軸のNORMAL / INVERT / OFF、LOOK AT / WINDOW、FOV、Smoothingを調整できます。設定はlocalStorageへ保存します。

## 実験した機能: DEPTH PHOTO

Version 0.5.0でPHOTO + DEPTH MAPから疑似3Dを生成し、次の方式まで実装・検証しました。

- FLAT
- LAYERS
- MESH
- Strength / Invert / Smooth / Quality
- Depth Map再サンプリング
- Disocclusion軽減

Depth Mapを別途用意する必要があり、通常ユーザーには目的と操作が分かりにくいため、このツールでは深追いしません。Version 1.0.0では通常のScene切替と写真操作UIから外しました。実験コードは検証記録として残しています。

## Motion / Portrait

DeviceOrientationはHTTPSまたはlocalhostが必要です。iPhoneでは縦向きで「モーション開始」を押し、ブラウザの許可操作を行います。PCではマウス位置で傾きをシミュレーションできます。

スマートフォンはPortraitを正式対象とします。Landscapeでは「端末を縦向きに戻してください」と案内し、Portraitへ戻ると自動復帰します。

## Performance

- 入力平滑化、Camera、Scene、AnimationMixer、描画を単一RAFで更新
- Device Pixel Ratioをモバイル最大1.5、その他最大2に制限
- モバイルではShadowを軽量化
- 非表示時とLandscape案内中はRAFを停止
- Scene切替とGLB差し替え時にリソースをdispose

## Debug

姿勢角、Tilt、View入力、最終入力、Direction、Gain、Sensor状態、Orientation、FPS、Camera、FOV、Renderer、DPR、Scene、Object数、Triangle数、Draw Call、GPUリソース、Fog、Shadow、Animation、GLB情報を確認できます。通常シーンではDepth専用項目を表示しません。

## ローカル実行

```powershell
cd 07_スマホ傾き疑似3Dツール
py -3 -m http.server 8080
```

`http://localhost:8080`を開きます。

## 既知の制限

- DeviceOrientationの値、許可方法、軸の挙動にはブラウザ差があります。
- 見え方と性能は端末のセンサー、GPU、画面サイズに依存します。
- Webアプリのため、本物のiPhoneホーム画面やロック画面には適用できません。
- 大きなGLBや高ポリゴンGLBの性能は端末に依存します。
- DEPTH PHOTOは実験済みコードであり、Version 1.0.0の通常機能ではありません。

## 完成状態

主要な技術検証、実機方向調整、4シーン比較、GLB検証、Depth Photo実験まで完了しました。Version 1.0.0を「スマートフォンを傾けて画面内を立体的に覗き込めるか」という実験プロジェクトの完成版とします。
