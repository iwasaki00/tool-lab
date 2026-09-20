# 3D空間実験室 — Common 3D Framework 1.2.0

Babylon.jsのプリミティブ形状とTypeScriptだけで構築した、一人称視点の3D実験フィールド／プロシージャル街です。Ver.6では道路、広場、公園、建物入口、部屋、廊下、階段へ意味情報と接続関係を付与し、Seedから鍵、カードキー、Goal、Enemy/NPC Spawnとミッションを配置します。外部3Dモデルや外部AI APIは使用していません。

DEBUGを開くと、現在Area、Type、Tags、Building、Floor、Room、World統計、Mission Seed、経路検証結果を確認できます。描画テストを有効にすると、START、鍵、カードキー、Enemy/NPC Spawn、Goalの候補位置が発光マーカーで表示されます。

MISSION GUIDEは`OFF / NORMAL / DEBUG`を切り替えられます。DEBUGでは現在Objectiveの対象をWorldRegistryから解決し、距離・高低差付きの3D矢印とBillboard、画面外方向ガイドを表示します。鍵取得やドア解錠に合わせて、案内先は次のMission Targetへ自動的に切り替わります。

## 起動

リポジトリのルートで次を実行します。

```sh
npm install
npm run dev
```

本番ビルドは `npm run build` です。静的ホスティング用ファイルは `06_3D空間実験室/app/` に生成され、TOOL LABトップページからもこの公開用ページを開きます。

## 操作

- `W` `A` `S` `D`: 移動
- マウス: 視点移動（画面クリックでPointer Lock）
- `Space`: ジャンプ
- `Shift`: 低速移動（通常移動の1/3）
- `Esc`: Pointer Lock解除
- `E`: 正面の対象を操作
- `I`: Inventoryを開閉

スマートフォンでは左下の仮想スティックで移動、右画面のドラッグで視点移動、右下のボタンでジャンプ／ダッシュします。

操作可能な対象を画面中央で捉えると、PCでは操作ガイド、スマートフォンでは「操作」ボタンが表示されます。スポーン地点から鍵、INTERIOR LAB、1Fのカードキー、階段、2F CONTROL ROOM、屋外ゲート、Goal Zoneの順に進むデモミッションを確認できます。

## 街生成

起動時は街生成モードです。`MENU`から街スタイル、街のイメージ、Seed、街サイズ、建物密度、高さ構成を指定できます。「住宅」「高層」「狭い」「公園」「路地」「工場」「未来」「暗い」「海」などを組み合わせると、プリセットを基準に生成ルールを補正します。最後に使用した設定は端末内へ保存されます。従来の実験フィールドへも切り替えられます。

生成処理は `src/world`、街の小物は `src/objects`、Seed乱数は `src/random`、シーン構成は `src/scene`、プレイヤー操作は `src/player`、画面UIは `src/ui` に分割しています。

## World Map System

Framework VersionとMap Format Versionは`src/core/version.ts`で一元管理します。MapはBabylon.js Meshではなく、再構築可能なObject／Semantic／ChunkパラメータをJSONとして保存します。

- `PROCEDURAL`: SeedとChunk座標から実行時生成
- `PREBUILT`: 保存済みChunkを読み込み
- `HYBRID`: 保存Mapを起点に不足Chunkを自動生成

MENUの`WORLD MAP SYSTEM`からAuto Expansion、Chunk Unload、JSON Import／Export、LocalStorage保存・読込を操作できます。

## Version運用

- Framework API互換性を壊す変更ではSemVerのMAJORを上げます。
- 機能追加ではMINOR、不具合修正ではPATCHを上げます。
- 保存Map互換性を壊す変更では`MAP_FORMAT_VERSION`を上げ、`migrateMapData()`へ順次Migrationを追加します。
- Framework Version更新時は動作確認とCHANGELOG更新後、`v1.2.0`のようなGit Tagを付けます。

Git Tagは作業ツリーと対象コミットを確認してから作成し、未コミット変更がある状態では自動作成しません。

## Visual System

`src/visual` がLighting、Sky、Cloud、Fog、Material、Quality、LODをゲームモードから独立して管理します。`CLEAR_DAY / CLOUDY / SUNSET / NIGHT / FOGGY`と`AUTO / LOW / MEDIUM / HIGH`をMENUまたはFramework APIから変更できます。外部Skyboxや画像テクスチャは使用せず、共有Materialとコード生成の軽量表現を使用しています。
