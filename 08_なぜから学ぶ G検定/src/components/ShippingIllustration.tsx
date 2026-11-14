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
  mode?: "usual" | "stopped" | "arrivals" | "ai-trial" | "sorting";
  label?: "良品" | "不良";
  sampleAdded?: boolean;
}) {
  const titleId = useId(),
    good = label === "良品",
    prologue = mode !== "sorting";
  return (
    <svg
      className="shipping-illustration"
      viewBox="0 0 600 310"
      role="img"
      aria-labelledby={titleId}
    >
      <title id={titleId}>
        {prologue
          ? {
              usual: "いつもの出荷。検査員が学習者に集荷16時の札を示す",
              stopped:
                "午前、包装機が停止。警告ランプが点滅し、ベルトに箱が届かない",
              arrivals: "15時に復旧。仕分け待ちの箱が次々に届く。集荷は16時",
              "ai-trial": "仕分け台のモニターに、過去の箱の良品と不良の見本",
            }[mode as "usual" | "stopped" | "arrivals" | "ai-trial"]
          : "出荷ライン。箱Qの検査員の確認は合格。AIの現在の判定は" +
            label +
            "で、" +
            label +
            "レーンにあります。" +
            (sampleAdded
              ? "別の検査済みの箱Wが良品の見本に加わりました。"
              : "")}
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
          {mode === "ai-trial" ? (
            <>
              <rect
                x="280"
                y="14"
                width="290"
                height="183"
                rx="14"
                fill="#426051"
              />
              <rect
                x="292"
                y="25"
                width="266"
                height="160"
                rx="8"
                fill="#fffaf0"
              />
              <text
                x="425"
                y="51"
                textAnchor="middle"
                fontSize="19"
                fill="#354e40"
              >
                前に検査した箱の見本
              </text>
              <Box x={316} y={64} name="P1" />
              <Box x={451} y={64} name="P4" />
              <text
                x="350"
                y="160"
                textAnchor="middle"
                fontSize="23"
                fill="#215b49"
              >
                良品
              </text>
              <text
                x="485"
                y="160"
                textAnchor="middle"
                fontSize="23"
                fill="#805337"
              >
                不良
              </text>
              <path d="M425 197v28m-45 0h90" stroke="#426051" strokeWidth="9" />
              <text x="300" y="281" fontSize="22" fill="#385d46">
                仕分け台で、まず一箱だけ。
              </text>
            </>
          ) : (
            <>
              <rect
                x="429"
                y="115"
                width="140"
                height="140"
                rx="9"
                fill="#dae5d8"
                stroke="#829884"
                strokeWidth="3"
              />
              <path
                d="M442 140h114M442 170h114M442 200h114M442 230h114"
                stroke="#a6b7a2"
              />
              <text
                x="499"
                y="246"
                textAnchor="middle"
                fontSize="21"
                fill="#385d46"
              >
                出荷口
              </text>
              <rect
                x="410"
                y="14"
                width="177"
                height="43"
                rx="7"
                fill="#fffaf0"
                stroke="#829884"
                strokeWidth="2"
              />
              <text
                x="498"
                y="43"
                textAnchor="middle"
                fontSize="24"
                fontWeight="700"
                fill="#385d46"
              >
                集荷 16:00
              </text>
              {mode === "usual" && (
                <>
                  <g transform="translate(45 198)">
                    <circle cy="12" r="19" fill="#f3d9bb" />
                    <path d="M-25 76V44q0-25 25-25t25 25v32" fill="#b4a0c3" />
                    <text
                      y="101"
                      textAnchor="middle"
                      fontSize="19"
                      fill="#354e40"
                    >
                      あなた
                    </text>
                  </g>
                  <Box x={252} y={113} name="A" />
                  <path
                    d="M239 81 405 39"
                    stroke="#4d705c"
                    strokeWidth="3"
                    strokeDasharray="7 6"
                  />
                </>
              )}
              {mode === "stopped" && (
                <>
                  <rect
                    x="18"
                    y="111"
                    width="198"
                    height="105"
                    rx="12"
                    fill="#c7d3c5"
                    stroke="#617d65"
                    strokeWidth="3"
                  />
                  <circle cx="181" cy="134" r="12" fill="#d58a51" />
                  <path
                    d="M181 112v-9m-21 17-8-7m42 7 8-7"
                    stroke="#a96534"
                    strokeWidth="4"
                  />
                  <rect
                    x="38"
                    y="148"
                    width="151"
                    height="49"
                    rx="7"
                    fill="#fffaf0"
                  />
                  <text
                    x="114"
                    y="179"
                    textAnchor="middle"
                    fontSize="24"
                    fill="#805337"
                  >
                    包装機 停止
                  </text>
                  <text
                    x="322"
                    y="220"
                    textAnchor="middle"
                    fontSize="23"
                    fill="#805337"
                  >
                    ベルト停止
                  </text>
                  <text
                    x="297"
                    y="280"
                    textAnchor="middle"
                    fontSize="22"
                    fill="#385d46"
                  >
                    仕分け場に、箱が来ない。
                  </text>
                </>
              )}
              {mode === "arrivals" && (
                <>
                  <circle
                    cx="310"
                    cy="48"
                    r="34"
                    fill="#fffaf0"
                    stroke="#829884"
                    strokeWidth="3"
                  />
                  <path
                    d="M310 22v26h23"
                    stroke="#4d705c"
                    strokeWidth="4"
                    fill="none"
                  />
                  <text
                    x="310"
                    y="103"
                    textAnchor="middle"
                    fontSize="21"
                    fill="#385d46"
                  >
                    15:00
                  </text>
                  <Box x={25} y={116} name="W" />
                  <Box x={99} y={116} name="A" />
                  <Box x={173} y={116} name="Q" />
                  <Box x={247} y={143} name="B" />
                  <Box x={321} y={181} name="C" />
                  <path
                    d="m20 208 35 0-10-8m10 8-10 8"
                    stroke="#4d705c"
                    strokeWidth="4"
                    fill="none"
                  />
                  <text
                    x="190"
                    y="282"
                    textAnchor="middle"
                    fontSize="22"
                    fill="#385d46"
                  >
                    包装機が復旧。箱が次々に！
                  </text>
                </>
              )}
            </>
          )}
        </g>
      ) : (
        <>
          {" "}
          <Box x={427} y={good ? 48 : 193} name="Q" />
          <g
            className="shipping-ai-verdict"
            transform={`translate(290 ${good ? 99 : 178})`}
          >
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
          <text
            className="shipping-human-check"
            x="272"
            y={good ? 175 : 151}
            fontSize="18"
            fill="#425e48"
          >
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
