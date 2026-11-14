import { useEffect, useState } from "react";
import {
  classify,
  samples,
  clusterPoints,
  initializeK,
  kStep,
  evaluateRoute,
  routes,
  obstacles,
} from "../engine/simulations";
import type { Point } from "../engine/simulations";
import { inspectedSample, shippingTarget } from "../data/shippingStory";
const colors = ["#187b69", "#c75a35", "#6755a3", "#b27e16"];
function Plot({
  points,
  centers = [],
  labels = [],
  query,
  axes = ["大きさ", "重さ"],
}: {
  points: Point[];
  centers?: Point[];
  labels?: number[];
  query?: Point;
  axes?: [string, string];
}) {
  return (
    <svg
      viewBox="0 0 340 270"
      role="img"
      aria-label={`特徴量の散布図。横軸は${axes[0]}、縦軸は${axes[1]}。点の番号とグループは下の一覧でも確認できます。`}
    >
      <rect x="28" y="10" width="290" height="225" rx="10" fill="#f3f5ef" />
      {[25, 50, 75].map((v) => (
        <g key={v}>
          <path
            d={`M28 ${235 - v * 2.1}H318 M${28 + v * 2.8} 10V235`}
            stroke="#dde3d9"
            strokeDasharray="3 4"
          />
        </g>
      ))}
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={28 + p.x * 2.8}
            cy={235 - p.y * 2.1}
            r="7"
            fill={colors[labels[i]] || "#82938e"}
          />
          <text x={28 + p.x * 2.8 + 8} y={235 - p.y * 2.1 - 5} fontSize="10">
            {i + 1}
          </text>
        </g>
      ))}
      {centers.map((p, i) => (
        <g
          key={i}
          transform={`translate(${28 + p.x * 2.8},${235 - p.y * 2.1})`}
        >
          <path d="M-9 -9L9 9M-9 9L9 -9" stroke={colors[i]} strokeWidth="4" />
          <text y="-14" fontSize="12">
            C{i + 1}
          </text>
        </g>
      ))}
      {query && (
        <g
          transform={`translate(${28 + query.x * 2.8},${235 - query.y * 2.1})`}
        >
          <circle r="12" fill="white" stroke="#182f2b" strokeWidth="2" />
          <text x="-4" y="4" fontSize="13">
            ?
          </text>
        </g>
      )}
      <text x="160" y="262" fontSize="12">
        {axes[0]} →
      </text>
      <text x="5" y="20" fontSize="12">
        {axes[1]}
      </text>
    </svg>
  );
}
export function Supervised({
  withShippingSample = false,
}: {
  withShippingSample?: boolean;
}) {
  const initialData = withShippingSample
    ? [...samples, inspectedSample]
    : samples;
  const initialQuery = withShippingSample
    ? { x: shippingTarget.x, y: shippingTarget.y }
    : { x: 45, y: 45 };
  const [data, setData] = useState(initialData),
    [query, setQuery] = useState(initialQuery),
    [selected, setSelected] = useState(0);
  const result = classify(data, query);
  return (
    <>
      <p>
        製品の「大きさ・重さ」と検査結果を見本に、新しい製品を判定します。点は学習用、?
        は未知の製品です。
      </p>
      <div className="simulation">
        <Plot
          points={data}
          labels={data.map((p) => (p.label === "良品" ? 0 : 1))}
          query={query}
        />
        <div>
          <span className="tag">1-最近傍法 / 実計算</span>
          <h3>いちばん近い見本の答えを使う</h3>
          <label>
            変更する見本
            <select
              value={selected}
              onChange={(e) => setSelected(+e.target.value)}
            >
              {data.map((p, i) => (
                <option key={p.id} value={i}>
                  {p.id}：({p.x}, {p.y}) {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            正解ラベル
            <select
              value={data[selected].label}
              onChange={(e) =>
                setData(
                  data.map((p, i) =>
                    i === selected
                      ? { ...p, label: e.target.value as "良品" | "不良" }
                      : p,
                  ),
                )
              }
            >
              <option>良品</option>
              <option>不良</option>
            </select>
          </label>
          <label>
            見本の大きさ：{data[selected].x}
            <input
              type="range"
              min="0"
              max="100"
              value={data[selected].x}
              onChange={(e) =>
                setData(
                  data.map((p, i) =>
                    i === selected ? { ...p, x: +e.target.value } : p,
                  ),
                )
              }
            />
          </label>
          <label>
            未知の製品の大きさ：{query.x}
            <input
              type="range"
              min="0"
              max="100"
              value={query.x}
              onChange={(e) => setQuery({ ...query, x: +e.target.value })}
            />
          </label>
          <label>
            未知の製品の重さ：{query.y}
            <input
              type="range"
              min="0"
              max="100"
              value={query.y}
              onChange={(e) => setQuery({ ...query, y: +e.target.value })}
            />
          </label>
          <div className="result" aria-live="polite">
            予測：<strong>{result.label}</strong>
            <small>
              最近傍 {result.nearestId} / 距離 {result.distance.toFixed(2)}
            </small>
          </div>
          <button
            onClick={() => {
              setData(initialData);
              setQuery(initialQuery);
            }}
          >
            見本をリセット
          </button>
        </div>
      </div>
      <details>
        <summary>どう計算している？</summary>
        <p>
          2特徴のユークリッド距離が最小の見本のラベルを採用します。同距離なら番号が先の見本を使います。両特徴は同じ0〜100の尺度です。ラベルや入力が変われば予測も変わります。この小さな見本の結果だけで未知の製品への性能は保証できません。
        </p>
        <p>
          良品／不良のカテゴリ予測は「分類」。価格のような連続値なら「回帰」です。
        </p>
      </details>
    </>
  );
}
export function Unsupervised({
  speed,
  points = clusterPoints,
  axes,
}: {
  speed: number;
  points?: Point[];
  axes?: [string, string];
}) {
  const [k, setK] = useState(3),
    [seed, setSeed] = useState(1),
    [state, setState] = useState(() => initializeK(3, 1, points)),
    [playing, setPlaying] = useState(false);
  function reset(nextK = k, nextSeed = seed) {
    setPlaying(false);
    setState(initializeK(nextK, nextSeed, points));
  }
  useEffect(() => {
    if (!playing || state.converged) return;
    const timer = setTimeout(
      () => setState((s) => kStep(points, s)),
      1000 / speed,
    );
    return () => clearTimeout(timer);
  }, [playing, state, speed]);
  return (
    <>
      <p>
        ラベルのない12点を、近さを使ってまとめます。色は正解ではなく、今の割当てです。×はクラスタ中心。
      </p>
      <div className="simulation">
        <Plot
          points={points}
          axes={axes}
          centers={state.centers}
          labels={state.assignments}
        />
        <div>
          <span className="tag">K-means / 実計算</span>
          <label>
            クラスタ数
            <select
              value={k}
              onChange={(e) => {
                setK(+e.target.value);
                reset(+e.target.value, seed);
              }}
            >
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            初期値（再現用シード）
            <select
              value={seed}
              onChange={(e) => {
                setSeed(+e.target.value);
                reset(k, +e.target.value);
              }}
            >
              {[1, 2, 3, 7, 42].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <div className="result" aria-live="polite">
            反復 {state.iteration} /{" "}
            {state.converged
              ? "収束"
              : state.phase === "assign"
                ? "次：近い中心へ割当て"
                : "次：平均へ中心を更新"}
          </div>
          <div className="controls">
            <button
              disabled={state.converged}
              onClick={() => {
                setPlaying(false);
                setState((s) => kStep(points, s));
              }}
            >
              1ステップ
            </button>
            <button
              disabled={state.converged}
              onClick={() => setPlaying((v) => !v)}
            >
              {playing && !state.converged ? "一時停止" : "連続再生"}
            </button>
            <button onClick={() => reset()}>リセット</button>
          </div>
          <p className="muted">
            同じシード・Kなら同じ初期条件になります。初期中心によって、結果が変わることがあります。
          </p>
        </div>
      </div>
      <details>
        <summary>割当てと中心の数値を見る</summary>
        <ul>
          {state.centers.map((c, i) => (
            <li key={i}>
              C{i + 1}：({c.x.toFixed(1)}, {c.y.toFixed(1)}) / 点{" "}
              {state.assignments
                .map((g, j) => (g === i ? j + 1 : null))
                .filter(Boolean)
                .join(", ") || "なし"}
            </li>
          ))}
        </ul>
        <p>
          割当て→中心更新の2操作で1反復。空のクラスタは中心を保持し、中心が動かなくなれば停止します。番号に優劣はなく、まとまりの意味は人が解釈します。
        </p>
      </details>
    </>
  );
}
export function Reinforcement({ speed }: { speed: number }) {
  const [rewards, setRewards] = useState({ step: -1, goal: 20, wall: -5 }),
    [route, setRoute] = useState(0),
    [frame, setFrame] = useState(0),
    [playing, setPlaying] = useState(false);
  const frames = evaluateRoute(routes[route], rewards),
    now = frames[Math.min(frame, frames.length - 1)];
  useEffect(() => {
    if (!playing || frame >= frames.length - 1) return;
    const timer = setTimeout(() => setFrame((f) => f + 1), 700 / speed);
    return () => clearTimeout(timer);
  }, [playing, frame, frames.length, speed]);
  function reset() {
    setPlaying(false);
    setFrame(0);
  }
  return (
    <>
      <p className="notice">
        概念デモ：用意した行動例を再生します。方策の学習・最適経路の探索は行っていません。
      </p>
      <div className="simulation">
        <div>
          <div
            className="grid-map"
            role="img"
            aria-label={`5×5のマップ。ロボット位置は列${now.position.x + 1}・行${now.position.y + 1}。ゴールは右下。`}
          >
            {Array.from({ length: 25 }, (_, i) => {
              const x = i % 5,
                y = Math.floor(i / 5);
              return (
                <div
                  key={i}
                  className={
                    obstacles.some((p) => p.x === x && p.y === y)
                      ? "obstacle"
                      : ""
                  }
                >
                  {now.position.x === x && now.position.y === y
                    ? "◆"
                    : x === 4 && y === 4
                      ? "⚑"
                      : x === 0 && y === 0
                        ? "S"
                        : ""}
                </div>
              );
            })}
          </div>
          <p className="muted">
            ◆ ロボット（エージェント） / ⚑ ゴール / ■ 障害物
          </p>
        </div>
        <div>
          <label>
            行動例
            <select
              value={route}
              onChange={(e) => {
                setRoute(+e.target.value);
                reset();
              }}
            >
              <option value="0">A：上辺から進む</option>
              <option value="1">B：衝突と寄り道を含む</option>
            </select>
          </label>
          {(["step", "goal", "wall"] as const).map((key, i) => (
            <label key={key}>
              {["1行動の報酬", "ゴール到達の追加報酬", "衝突時の追加報酬"][i]}
              <input
                type="number"
                min="-20"
                max="30"
                value={rewards[key]}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) {
                    setRewards({
                      ...rewards,
                      [key]: Math.max(-20, Math.min(30, n)),
                    });
                    reset();
                  }
                }}
              />
            </label>
          ))}
          <div className="result" aria-live="polite">
            {now.event} / 今回 {now.reward} / 累計 <strong>{now.total}</strong>
          </div>
          <div className="controls">
            <button
              onClick={() => {
                if (frame === frames.length - 1) setFrame(0);
                setPlaying((v) => !v);
              }}
            >
              {playing && frame < frames.length - 1 ? "停止" : "再生"}
            </button>
            <button
              disabled={frame === frames.length - 1}
              onClick={() => {
                setPlaying(false);
                setFrame((f) => f + 1);
              }}
            >
              1行動
            </button>
            <button onClick={reset}>リセット</button>
          </div>
        </div>
      </div>
      <div className="two-col">
        {routes.map((r, i) => {
          const result = evaluateRoute(r, rewards).at(-1)!;
          return (
            <div className="mini-card" key={i}>
              行動例 {i === 0 ? "A" : "B"}：合計 <strong>{result.total}</strong>
              <small>
                {r.join(" → ")} /{" "}
                {result.event === "ゴール" ? "到達" : "未到達"}
              </small>
            </div>
          );
        })}
      </div>
      <p>
        行動ごとの報酬に、衝突・ゴールの追加報酬を足します。移動への報酬を正に変え、寄り道の評価を比べてください。強化学習では、目先の得点だけでなく将来の累積報酬を高める行動の選び方（方策）を学びます。
      </p>
    </>
  );
}
