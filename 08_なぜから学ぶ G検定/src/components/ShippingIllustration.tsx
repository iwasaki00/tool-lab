import { useId } from "react";
function Box({ x, y, name }: { x: number; y: number; name: string }) {
  return (
    <g data-box={name} transform={`translate(${x} ${y})`}>
      <path
        d="M0 12 32 0 66 12 34 26Z"
        fill="#f0cf94"
        stroke="#806b4c"
        strokeWidth="2"
      />
      <path
        d="M0 12v40l34 14V26Z"
        fill="#dfb67b"
        stroke="#806b4c"
        strokeWidth="2"
      />
      <path
        d="M34 26v40l32-14V12Z"
        fill="#eac58d"
        stroke="#806b4c"
        strokeWidth="2"
      />
      <path d="M25 3 56 17v16l-11 4V22L15 8" fill="#faf0d2" />
      <text x="9" y="44" fontSize="18" fontWeight="700" fill="#4e493a">
        {name}
      </text>
    </g>
  );
}

export function ShippingIllustration({
  mode = "sorting",
  label = "不良",
  sampleAdded = false,
}: {
  mode?: "prologue" | "sorting";
  label?: "良品" | "不良";
  sampleAdded?: boolean;
}) {
  const titleId = useId(),
    good = label === "良品",
    prologue = mode === "prologue";
  return (
    <svg
      className="shipping-illustration"
      viewBox="0 0 600 310"
      role="img"
      aria-labelledby={titleId}
    >
      <title id={titleId}>
        {prologue
          ? "出荷口に仕分け待ちの箱がたまり、一人の検査員がコンベアで確認している。時計は出荷まであと1時間を示す。"
          : `出荷ライン。箱Qの検査員の確認は合格。AIの現在の判定は${label}で、${label}レーンにあります。${sampleAdded ? "別の検査済みの箱Wが良品の見本に加わりました。" : ""}`}
      </title>
      <rect width="600" height="310" rx="24" fill="#f1f4e8" />
      <path
        d="M35 147h205l145-70h170M240 147l145 87h170"
        stroke="#b3bcb2"
        strokeWidth="61"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M35 147h205l145-70h170M240 147l145 87h170"
        stroke="#e3e8de"
        strokeWidth="45"
        fill="none"
        strokeLinejoin="round"
      />
      {[55, 90, 125, 160, 195].map((x) => (
        <path key={x} d={`M${x} 128v38`} stroke="#bac7b8" strokeWidth="3" />
      ))}
      {[395, 430, 465, 500, 535].map((x) => (
        <g key={x}>
          <path
            d={`M${x} 58v38M${x} 215v38`}
            stroke="#bac7b8"
            strokeWidth="3"
          />
        </g>
      ))}
      {!prologue && (
        <>
          {" "}
          <rect x="376" y="10" width="190" height="34" rx="12" fill="#d4e7d5" />
          <text
            x="471"
            y="34"
            textAnchor="middle"
            fontSize="21"
            fontWeight="700"
            fill="#215b49"
          >
            良品レーン
          </text>
          <rect
            x="376"
            y="264"
            width="190"
            height="34"
            rx="12"
            fill="#f1dcc8"
          />
          <text
            x="471"
            y="288"
            textAnchor="middle"
            fontSize="21"
            fontWeight="700"
            fill="#805337"
          >
            不良品レーン
          </text>
        </>
      )}{" "}
      <g transform="translate(118 17)">
        <path d="M-29 65q0-35 29-35t29 35v30h-58Z" fill="#829e83" />
        <circle cy="20" r="23" fill="#f3d9bb" />
        <path d="M-24 16q0-30 25-26 23 4 23 26" fill="#596858" />
        <circle cx="-7" cy="20" r="2" fill="#354e40" />
        <circle cx="8" cy="20" r="2" fill="#354e40" />
        <path
          d="M-4 31h9M23 62l56 23 34-10"
          stroke="#4d705c"
          strokeWidth="12"
          strokeLinecap="round"
          fill="none"
        />
        <text x="0" y="88" textAnchor="middle" fontSize="16" fill="white">
          検査員
        </text>
      </g>
      {prologue ? (
        <g>
          <rect
            x="433"
            y="124"
            width="132"
            height="133"
            rx="9"
            fill="#dae5d8"
            stroke="#829884"
            strokeWidth="3"
          />
          <path
            d="M449 146h99v102h-99ZM449 172h99M449 197h99M449 222h99"
            stroke="#a6b7a2"
            fill="none"
          />
          <text
            x="499"
            y="117"
            textAnchor="middle"
            fontSize="21"
            fill="#385d46"
          >
            出荷口
          </text>
          <circle
            cx="504"
            cy="45"
            r="29"
            fill="#fffaf0"
            stroke="#829884"
            strokeWidth="3"
          />
          <path
            d="M504 24v21l14 10"
            stroke="#4d705c"
            strokeWidth="4"
            fill="none"
          />
          <text x="504" y="94" textAnchor="middle" fontSize="18" fill="#385d46">
            出荷まで1時間
          </text>
          <Box x={40} y={120} name="W" />
          <Box x={116} y={120} name="A" />
          <Box x={192} y={120} name="Q" />
          <Box x={269} y={148} name="B" />
          <Box x={344} y={188} name="C" />
          <text x="40" y="286" fontSize="21" fill="#385d46">
            仕分けを待つ箱が、次々に。
          </text>
        </g>
      ) : (
        <>
          {" "}
          <Box x={427} y={good ? 48 : 193} name="Q" />
          <g transform={`translate(290 ${good ? 99 : 178})`}>
            <rect
              width="126"
              height="43"
              rx="10"
              fill="white"
              stroke={good ? "#4b8060" : "#ab7653"}
              strokeWidth="2"
            />
            <text
              x="63"
              y="28"
              textAnchor="middle"
              fontSize="20"
              fontWeight="700"
              fill="#354e40"
            >
              AI：{label}
            </text>
          </g>
          <text x="272" y="151" fontSize="18" fill="#425e48">
            箱Q／検査員：合格
          </text>
          <g transform="translate(38 211)">
            <rect
              x="-9"
              y="-12"
              width="212"
              height="88"
              rx="14"
              fill={sampleAdded ? "#e0edd7" : "#fffaf0"}
              stroke="#c1ceb7"
              strokeWidth="2"
            />
            <Box x={0} y={0} name="W" />
            <text x="83" y="18" fontSize="18" fontWeight="700" fill="#385d46">
              検査済み：良品
            </text>
            <text x="83" y="47" fontSize="16" fill="#385d46">
              {sampleAdded ? "見本に追加済み" : "見本に加える箱"}
            </text>
          </g>
        </>
      )}
    </svg>
  );
}
