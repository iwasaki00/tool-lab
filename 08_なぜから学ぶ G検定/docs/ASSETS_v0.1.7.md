# v0.1.7 挿絵の制作記録

組み込みimage_genで5点を別々に制作。第0章の実画像をview_imageで確認し、画像生成にも参照画像として渡した。既存の第0章画像は上書きしていない。

基準：`public/illustrations/ml-inspected-samples.png`、`public/illustrations/dl-box-feature.png`。深緑の帽子・作業着、黒髪と顔、段ボール・テープ、くすんだ緑のコンベア、クリーム色の内装、階段状の輪郭と陰影を共通化した。

| 新規画像 | 使用場面 | 構造 |
| --- | --- | --- |
| `public/illustrations/l003/usual-shipping.png` | いつもの出荷 | 作業を教えて札を指す検査員と少数の箱。札の文字はHTML |
| `public/illustrations/l003/packaging-stopped.png` | 午前、包装機が止まる | 警告灯と空のベルト。集荷札の文字はHTML |
| `public/illustrations/l003/boxes-arriving.png` | 15時、箱が一気に届く | 復旧した同じ包装機と箱の列。現在時刻・集荷時刻はHTML、時計の針はSVG |
| `public/illustrations/l003/sorting-background.png` | AI試行、誤判定、再判定 | 検査員・モニター・空の分岐ベルトを描いた固定背景。箱も判定も焼き込まない |
| `public/illustrations/l003/box-sprite.png` | 見本・箱Q・箱W | 透明PNGの箱部品。箱IDはSVG文字、Q/Wの位置はアプリの状態で指定 |

3コマは直前にできた同じ工場の絵も参照し、建物・札・時計・包装機をそろえた。AI試行と誤判定・再判定は同じ固定背景を使用し、対象Qと別の見本Wを独立した要素にした。生成した箱PNGには正解や箱IDを描かせていない。最終画像を確認してプロジェクトへコピーし、実際の画面で使用している。

以下は最終生成プロンプト。usualとsortingとboxは第0章の2画像、stoppedはusualと第0章DL、arrivalsはstoppedと第0章MLを参照。boxだけ透明背景を指定し、それ以外は不透明。

## usual

Use the two supplied images ONLY as character, palette and pixel-art style references. Create a NEW single wide landscape 3:2 educational story panel in this exact factory. The SAME friendly young inspector: deep muted green baseball cap, short dark side-swept hair, same warm face and big dark eyes, deep sage work shirt, brown cardboard boxes with cream tape, muted green conveyor, cream factory interior, stepped pixel outlines and square-pixel shading. Scene: NORMAL SHIPPING. Inspector at left teaches a new helper (only helper's shoulder visible at bottom-left) and clearly points up toward a LARGE BLANK pickup sign at upper right. Only two boxes calmly spaced on the belt. Packaging machine at rear left, ordinary green status lamp. Sparse readable composition, main subjects large at mobile size. A blank wall clock near sign may be included. No text, numbers, letters, box IDs, arrows, labels, speech bubbles or watermark anywhere; exact pickup time will be overlaid in HTML. Opaque cream background, not photorealistic, not vector art. Do not simply copy either reference composition.

## stopped

Use the first reference as the established SAME factory layout, inspector identity, clothing, sign, clock, conveyor and pixel rendering. Second reference reinforces the exact character style. Create a NEW single 3:2 landscape panel: MORNING PACKAGING MACHINE STOPPED. Same friendly young inspector with deep sage cap and shirt, short dark hair, big dark eyes, now concerned, inspecting the stopped packaging machine at left. Make the packaging machine recognizable as a roller wrapping unit with a roll of packing film and a box-shaped enclosure, muted green casing. A bright orange warning lamp atop it is ON. Conveyor to the sorting area on the right is completely EMPTY, no boxes arriving; no action lines implying motion. Same cream interior, blank green-framed pickup sign upper right, blank round clock near top center. Generous clear empty belt makes contrast with next crowded scene obvious. Large readable pixel-art subjects, stepped outlines and square shading, calm muted palette. No text, letters, digits, symbols, box IDs, arrows or speech bubbles anywhere. All exact labels and times will be HTML. Do not copy reference image unchanged.

## arrivals

Create a NEW 3:2 landscape pixel-art story panel continuing reference1: EXACT same factory, green packaging film-roll machine, blank green-framed pickup sign upper-right, blank round wall clock upper-center, cream wall, dark sage conveyor and SAME inspector with deep green cap/shirt, short dark hair and warm expressive face. Now machine RECOVERED, green status lamp lit instead of orange. Machine feeds a long queue of brown cardboard boxes with cream tape onto conveyor toward right, several boxes waiting in a stack near belt. Inspector on left looks relieved but worried about time, glances up toward clock. Strong contrast with reference1's empty belt: boxes arrive in a rush, but no speed arrows, text or labels. Keep large simple subjects, stepped dark pixel outlines, square pixel shading and muted palette identical to references. Clock face and pickup sign MUST be blank: no hands, digits, letters, IDs or baked-in time. App will overlay exact current/pickup times and clock hands as HTML/SVG. Do not repeat reference unchanged. No speech bubbles, symbols, watermark.

## sorting

Use both supplied illustrations as visual references ONLY, and make a NEW landscape 3:2 pixel-art BACKGROUND LAYER for interactive factory sorting. Same exact inspector identity: friendly young warm face, dark eyes, short side-swept black hair, deep green cap and sage work shirt. Same cream factory interior, brown wood/cream tape palette, dark stepped pixel outlines, square shading. IMPORTANT layout: inspector occupies UPPER LEFT quarter, pointing toward a small BLANK monitor at UPPER CENTER on a shelf; leave space on shelf for sample boxes which the app will add. LOWER TWO THIRDS is an EMPTY sage-green conveyor junction: inlet from left at mid-height branches toward UPPER RIGHT and LOWER RIGHT, two clearly separated outgoing belts with rollers. Render belt surfaces nearly top-down for easy sprite placement. No cardboard boxes ANYWHERE: all boxes are separate movable app sprites. No labels, digits, text, arrows, colored verdict lights, checkmarks, symbols or speech bubbles. No box permanently depicted on monitor. Both outgoing lanes empty and neutral. No extra people, no robot. This is the same fixed background before and after AI changes its decision; do not imply a specific verdict. Large readable inspector, monitor and belts at320px. Opaque background, pixel illustration not vector.

## box

Create ONE isolated cardboard box sprite with a genuine transparent background, using the supplied factory illustrations as pixel-art style references. Match their ochre brown cardboard, cream packing tape, dark stepped outlines and square-pixel shading. Box seen three-quarter front view with visible top and right face, broad simple shapes, closed with one strip of cream tape across top and down front. Subtle tiny corner crease only, no large damage. Large sprite centered with small transparent margins, no floor, no cast shadow, no conveyor, no person, no extra objects. No text, letters, digits, ID, symbols or labels; Q/W and inspection status are app text drawn separately. This sprite will be positioned by live classification calculations, not swapped as a pre-labelled verdict image.
