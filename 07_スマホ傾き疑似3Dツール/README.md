# Tilt 3D Lab / 傾き3D実験室

スマートフォンの傾きやPCのマウス位置をカメラ移動へ変換し、GLBモデルや3つのショーケースを画面という窓から覗き込むWebアプリです。モデル自体を入力で回転させず、観察者の位置を動かして側面・上面・隠れた部分を表示します。

## Version

**0.4.0 — Phase 4「MODEL VIEWER」**

「Geometryで作ったデモ」から「実際の3Dモデルを傾けて覗く」へ進みました。

## MODEL VIEWER

シーン切替の`MODEL`を選ぶと、同梱した小型GLBサンプルを表示します。`OPEN GLB`から端末内の別モデルへ差し替えられます。

- 正式なユーザー読込対象: 単一ファイルの`.glb`
- `.gltf`: Loader自体は対応しますが、外部`.bin`やTexture参照を伴うローカル単一ファイル選択は正式対応外です。
- 選択したファイルは`File.arrayBuffer()`で読み、GLTFLoaderへ直接渡します。
- 選択した3Dモデルを外部サーバーへアップロードしません。Object URLも作成しません。
- GLB内の外部Buffer/Image URIを事前検査し、Data URI以外の外部参照は読み込みません。
- 同梱サンプル以外の実行時CDN通信はありません。

### GLTFLoader

- Three.js: **0.170.0**
- GLTFLoader: **Three.js r170対応版**
- `js/addons/loaders/GLTFLoader.js`と依存する`BufferGeometryUtils.js`をローカル同梱
- 取得元: Three.js公式GitHubリポジトリの`r170`タグ
- Draco、KTX2、Meshopt decoderはVersion 0.4.0では同梱していません。

## 自動センタリングとフレーミング

読み込み後に`THREE.Box3`でBounding Boxを取得し、次の処理を行います。

1. 元モデルの中心とX/Y/Z寸法を計測
2. GLTF内部の階層を保ったまま、最上位Sceneを`MODEL_ROOT`配下へ配置
3. Bounding Box中心がViewer原点へ来るよう平行移動
4. 最大Dimensionが約3.35ワールド単位になるよう均一Scale
5. FOVと縦長ViewportのAspectから必要距離を算出
6. モデルが約70〜80%に収まり、視点移動の余白が残る距離へCameraを配置
7. モデル寸法に合わせてCamera移動量とNear/Far Clipを設定

LOOK ATモードでは、中央化後のBounding Box中心をCamera Targetとして使用します。

## Lighting / Background

MODEL SETTINGSからリアルタイムに切り替えられます。

- Lighting: `STUDIO`、`SOFT`、`DRAMATIC`
- Background: `DARK`、`LIGHT`、`GRID`
- GRIDでは床Gridと簡易Shadow受けを表示
- スマートフォンでは既存方針どおりShadowを無効化して負荷を抑えます。

モデル本来のMaterialは書き換えません。読み込んだMeshへShadow設定だけを付与します。

## Animation

GLBにAnimation Clipがある場合、`THREE.AnimationMixer`で先頭Clipを自動再生します。

- Animation数と現在名を表示
- Animation選択
- PLAY / PAUSE
- `prefers-reduced-motion`環境では初期停止
- 端末傾きはCamera、Animationはモデル自身へ適用し、独立して更新

Animationを持たないGLBも静止モデルとして正常に表示します。

## MODEL INFO / Performance Warning

MODEL SETTINGSにModel Name、Dimensions、Animation Count、Mesh Count、Triangle Count、Material Count、Auto Scale、Camera Distanceを表示します。50万Triangles以上では「モバイル端末では重い可能性があります」と警告しますが、読み込み自体は禁止しません。

モデル差し替え時は旧AnimationMixerを停止・解除し、旧モデルのGeometry、Material、Textureを破棄します。Scene切替時にも同じResource解放を行います。

## View Calibration

Version 0.4.0の新規利用時および`RESET VIEW SETTINGS`の基準値は次の組み合わせです。

- Horizontal Direction: **NORMAL**
- Vertical Direction: **INVERT**
- View Mode: **LOOK AT**
- Master Sensitivity: 100%（25〜400%）
- Horizontal / Vertical Gain: 各100%（0〜300%）
- FOV: 42°（35〜80°）

既に`localStorage`へ保存された設定は上書きしません。WINDOW / LOOK AT、軸別NORMAL / INVERT / OFF、Smoothing、最終入力±3.5 Clampも維持しています。端末傾きを視点位置として利用するため、自然に感じる方向には端末・持ち方・ユーザー差があります。

## Scene一覧

- **AQUARIUM**: 魚、泡、水面、海底、Fogを持つ水中世界
- **NEON**: Gridと発光立体で構成したSF展示空間
- **CRYSTAL**: 透明結晶と前景・背景の重なりを確認する空間
- **MODEL**: GLB読込、自動フレーミング、照明・背景・Animation設定を持つモデルビューアー

シーン切替やGLTF AnimationのためにRAFを増やさず、入力平滑化・カメラ・シーン・Mixer・描画を単一RAFで処理します。

## DEBUG

既存情報に加えてMODEL時は次を表示します。

- Model Loaded / Model Name
- Bounding Box X/Y/Z、Model Center、Model Scale
- Base Camera Distance、現在Camera X/Y/Z、Target X/Y/Z
- Mesh / Triangle / Material Count
- Animation Count、Current Animation、Mixer State
- Loader State、GLTF Load Time、詳細Error Code

## ローカル実行

```powershell
cd 07_スマホ傾き疑似3Dツール
py -3 -m http.server 8080
```

`http://localhost:8080`を開きます。PCでは3D画面内のマウス位置で端末傾きをシミュレーションできます。

## iPhone / Android

DeviceOrientationにはHTTPSが必要です。縦向きで「モーション開始」を押して許可し、自然な姿勢で「現在位置を中央にする」を実行してください。横向きでは描画を停止して縦向き案内を表示し、portraitへ戻ると自動復帰します。

## Error Handling

拡張子不正、空ファイル、GLB Header不正、Parse失敗、Meshなし、WebGL非対応を区別します。読込失敗後も現在モデルを維持し、別GLBを再選択できます。

## Version 0.4.0の制限

- Draco、KTX2、Meshopt、HDRI、Post Processing、Bloomは未対応です。
- 外部ファイル参照を持つローカル`.gltf`一式の複数選択には未対応です。
- 非常に巨大なGLBは端末メモリやGPU性能により読み込めない場合があります。
- Auto RotateとOrbitControlsは主操作を端末傾きに保つため導入していません。

## Phase 5候補

**DEPTH PHOTO** — 写真とDepth情報を使い、端末を傾けて写真の奥を覗く体験。
