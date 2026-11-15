import { useId } from "react";
const asset = (name: string) =>
  `${import.meta.env.BASE_URL}illustrations/l003/${name}.png`;
const panels = {
  usual: {
    image: "usual-shipping",
    alt: "第0章と同じ緑の帽子の検査員が、集荷の札を指して作業を教える。普段のベルトに少数の箱が流れている。",
    status: "いつもの出荷・箱は少なめ",
  },
  stopped: {
    image: "packaging-stopped",
    alt: "同じ検査員が、警告灯の点いた包装機を確認する。仕分け場へ続くベルトは空で、箱が来ない。",
    status: "包装機：停止／仕分け場：箱が来ない",
  },
  arrivals: {
    image: "boxes-arriving",
    alt: "同じ包装機が復旧し、ベルトに仕分け待ちの箱が列になって届く。検査員が時計を見る。集荷の札は前の場面と同じ。",
    status: "包装機：復旧／仕分け場：箱が一気に到着",
  },
};
export function PrologueArtwork({ mode }: { mode: keyof typeof panels }) {
  const p = panels[mode];
  return (
    <figure className="pixel-prologue">
      <div className="pixel-prologue-frame">
        <img src={asset(p.image)} alt={p.alt} width="1536" height="1024" />
        <div className="pixel-pickup-sign">
          {mode === "arrivals" && <span>現在 15:00</span>}
          <strong>集荷 16:00</strong>
        </div>
        {mode === "arrivals" && (
          <svg className="pixel-clock" viewBox="0 0 100 100" aria-hidden="true">
            <path
              d="M50 17V50H78"
              fill="none"
              stroke="#354239"
              strokeWidth="7"
              strokeLinecap="square"
            />
            <circle cx="50" cy="50" r="5" fill="#354239" />
          </svg>
        )}
      </div>
      <figcaption>{p.status}</figcaption>
    </figure>
  );
}
function PixelBox({ id, x, y }: { id: string; x: number; y: number }) {
  return (
    <g data-box={id} transform={`translate(${x} ${y})`}>
      <image href={asset("box-sprite")} width="200" height="200" />
      <rect
        x="45"
        y="91"
        width="110"
        height="90"
        rx="4"
        fill="#fff8e8"
        stroke="#3d3c32"
        strokeWidth="4"
      />
      <text
        x="100"
        y="160"
        textAnchor="middle"
        fontSize="72"
        fontWeight="700"
        fill="#303f35"
      >
        {id}
      </text>
    </g>
  );
}
export function SortingArtwork({
  trial = false,
  label = "不良",
  sampleAdded = false,
}: {
  trial?: boolean;
  label?: "良品" | "不良";
  sampleAdded?: boolean;
}) {
  const title = useId();
  const good = label === "良品";
  // Only the classifier result determines Q's destination. W is always a different box.
  const destination = trial
    ? { x: 250, y: 490 }
    : { x: 770, y: good ? 300 : 630 };
  return (
    <figure className="pixel-sorting">
      <div className="pixel-sorting-frame">
        <svg
          className="shipping-illustration pixel-sorting-canvas"
          viewBox="0 0 1536 1024"
          role="img"
          aria-labelledby={title}
          data-verdict={trial ? "未判定" : label}
        >
          <title id={title}>
            {trial
              ? "同じ検査員と仕分け台。モニターに検査済みの良品・不良の見本。別の箱Qはベルト上で未判定。"
              : `出荷ライン。箱Qの人の検査は合格。AIの現在の判定は${label}で、${label}レーンにあります。${sampleAdded ? "別の検査済み箱Wが良品の見本に追加済み。" : "別の検査済み箱Wは、まだ見本に入っていません。"}`}
          </title>
          <image
            data-layer="background"
            href={asset("sorting-background")}
            width="1536"
            height="1024"
          />
          <g aria-hidden="true">
            <image
              href={asset("box-sprite")}
              x="500"
              y="94"
              width="100"
              height="100"
            />
            <image
              href={asset("box-sprite")}
              x="640"
              y="94"
              width="100"
              height="100"
            />
            <text
              x="550"
              y="228"
              textAnchor="middle"
              fontSize="38"
              fill="#33493c"
            >
              良品
            </text>
            <text
              x="690"
              y="228"
              textAnchor="middle"
              fontSize="38"
              fill="#33493c"
            >
              不良
            </text>
          </g>
          {!trial && (
            <PixelBox
              id="W"
              x={sampleAdded ? 1270 : 250}
              y={sampleAdded ? 140 : 780}
            />
          )}
          <PixelBox id="Q" x={destination.x} y={destination.y} />
        </svg>
        <span className="pixel-lane pixel-lane-good">良品レーン</span>
        <span className="pixel-lane pixel-lane-bad">不良品レーン</span>
      </div>
      <figcaption>
        {trial
          ? "見本：検査済みの良品・不良／箱Q：別の未判定箱"
          : `箱W：検査済みの良品／${sampleAdded ? "見本に追加済み" : "まだ見本に入っていない"}`}
      </figcaption>
    </figure>
  );
}
