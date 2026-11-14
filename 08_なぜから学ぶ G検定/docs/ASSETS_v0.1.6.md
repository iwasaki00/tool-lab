# v0.1.6 挿絵の制作記録

制作方法：組み込み image_gen。3点を別々に新規生成し、出力を目視確認後、PNGのままプロジェクトへコピーした。CLI・外部画像取得・実行時の画像生成APIは使用していない。全画像1536×1024 px。日本語、判定状態、矢印は画像へ焼き込まずHTMLで補う。

| ファイル | 用途・構図 | サイズ |
| --- | --- | --- |
| `public/illustrations/rules-vs-examples.png` | AI節のルール深掘り。規格がそろう箱と多様な損傷の箱を2コマで対比 | 1,888,705 bytes |
| `public/illustrations/ml-inspected-samples.png` | 機械学習概要。左の検査済み見本と右の別の未判定箱。L003のAI試行導入・ホームにも転用 | 1,287,150 bytes |
| `public/illustrations/dl-box-feature.png` | ディープラーニング概要。撮影カメラと、箱全体・へこみ拡大が映るモニター | 1,659,935 bytes |

緑の帽子と作業着、黒髪の検査員、茶色の段ボール、灰緑のコンベア、クリーム色の背景を共通指定。既存SVGの人物・箱の配色に合わせた。新画像内の検査員の造形はピクセル表現で再制作しており、既存SVGと完全同一の線画ではない。既存の状態変化・散布図・100箱の集計図はデータ描画を保持し、静的なAI試行の挿絵だけを新しい見本の絵に置換した。

## 最終プロンプト：rules-vs-examples.png

Create an original educational pixel-art illustration, wide landscape 3:2, crisp intentional square pixels, muted sage green, warm cream, cardboard ochre and charcoal palette. Quiet Japanese factory setting, friendly inspector with dark short hair, sage green cap and work shirt, warm skin and expressive face, brown cardboard boxes and a grey-green conveyor. TWO clearly separated equal panels side by side, large subjects legible at 320px. Left panel: inspector calmly checking two identical neat undamaged cubic boxes against one simple clipboard with blank checkbox squares. Right panel: same inspector puzzled, several boxes with clearly different visible scratches and dents, one clipboard insufficient, holding it and looking across varied damage. Keep uncluttered, warm explanatory story illustration rather than infographic icons. No text, letters, numerals, labels, arrows, logos, watermarks, speech bubbles or question marks anywhere. Labels will be HTML outside image. Opaque cream background. Must clearly show regular standardized boxes contrasted with varied real-world damage; no futuristic robots.

## 最終プロンプト：ml-inspected-samples.png

Original educational pixel-art illustration, landscape 3:2, intentional crisp square pixels with simple broad shapes. Muted sage green, warm cream, cardboard ochre, charcoal outlines. Same friendly factory inspector: short dark hair, sage green cap and work shirt, warm skin, slight smile. Grey-green conveyor and cardboard boxes. Composition LEFT third: inspector beside TWO previously inspected sample boxes on a raised shelf, one intact box and one visibly dented box, each with a small blank inspection tag attached. RIGHT half: ONE DIFFERENT new box alone on the conveyor, physically separated by empty space, clearly larger front-facing box with different tape placement and a small corner crease, no inspection tag. Inspector gestures from shelf toward separate new box. Make sample boxes and separate target unambiguously distinct objects, large and readable on 320px mobile. Calm factory background extremely sparse, opaque cream. Do not draw any text, letters, numbers, arrows, symbols, checkmarks, logos, watermarks or speech bubbles. We will place exact inspected-good/inspected-defective/new-unjudged labels in HTML outside image. This illustrates using inspected examples to judge another box, not examining the same box twice.

## 最終プロンプト：dl-box-feature.png

Original educational pixel-art illustration landscape 3:2, crisp intentional square pixels, muted sage green warm cream cardboard ochre charcoal palette, opaque cream background. Calm factory matching friendly inspector with short dark hair, sage green cap and work shirt, warm skin, thoughtful pleasant expression. Large brown cardboard box with a visible concave crushed corner on a grey-green conveyor at center-left. A recognizable industrial inspection camera above it points down at the box. RIGHT: large monitor visibly shows two simple image panes: the WHOLE same box, and a MUCH enlarged closeup of its dented cardboard corner. Inspector stands small at far left looking at monitor. Main subjects camera box monitor must remain distinct readable at320px. Picture explains photographing a box and looking for visual clues, not an exact neural-network pipeline. No drawn network, no arrows, text, numbers, labels, logos, watermarks or speech bubbles anywhere. Sparse setting, chunky pixel shapes, expressive warm character, no photorealism.

