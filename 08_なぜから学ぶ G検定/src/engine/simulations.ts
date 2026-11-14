export interface Point {
  x: number;
  y: number;
}
export interface LabelledPoint extends Point {
  id: string;
  label: "良品" | "不良";
}
export const samples: LabelledPoint[] = [
  { id: "P1", x: 18, y: 20, label: "良品" },
  { id: "P2", x: 30, y: 32, label: "良品" },
  { id: "P3", x: 24, y: 45, label: "良品" },
  { id: "P4", x: 68, y: 65, label: "不良" },
  { id: "P5", x: 82, y: 78, label: "不良" },
  { id: "P6", x: 72, y: 45, label: "不良" },
];
export const distance = (a: Point, b: Point) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export function classify(data: LabelledPoint[], point: Point) {
  if (!data.length) throw new Error("見本が必要です");
  const nearest = data.reduce(
    (best, p) => (distance(p, point) < distance(best, point) ? p : best),
    data[0],
  );
  return {
    label: nearest.label,
    nearestId: nearest.id,
    distance: Math.sqrt(distance(nearest, point)),
  };
}
export const clusterPoints: Point[] = [
  { x: 15, y: 20 },
  { x: 23, y: 26 },
  { x: 30, y: 16 },
  { x: 17, y: 34 },
  { x: 42, y: 72 },
  { x: 51, y: 80 },
  { x: 57, y: 65 },
  { x: 46, y: 61 },
  { x: 75, y: 24 },
  { x: 86, y: 35 },
  { x: 72, y: 40 },
  { x: 88, y: 19 },
];
export interface KState {
  centers: Point[];
  assignments: number[];
  phase: "assign" | "update";
  iteration: number;
  converged: boolean;
}
export function initializeK(
  k: number,
  seed: number = 1,
  data: Point[] = clusterPoints,
): KState {
  let n = seed >>> 0;
  const random = () => {
    n = (1664525 * n + 1013904223) >>> 0;
    return n / 4294967296;
  };
  const points = [...data];
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [points[i], points[j]] = [points[j], points[i]];
  }
  return {
    centers: points.slice(0, k).map((p) => ({ ...p })),
    assignments: [],
    phase: "assign",
    iteration: 0,
    converged: false,
  };
}
export function kStep(points: Point[], state: KState): KState {
  if (state.converged) return state;
  if (state.phase === "assign")
    return {
      ...state,
      assignments: points.map((p) =>
        state.centers.reduce(
          (best, c, i) =>
            distance(p, c) < distance(p, state.centers[best]) ? i : best,
          0,
        ),
      ),
      phase: "update",
    };
  const centers = state.centers.map((old, i) => {
    const group = points.filter((_, j) => state.assignments[j] === i);
    return group.length
      ? {
          x: group.reduce((s, p) => s + p.x, 0) / group.length,
          y: group.reduce((s, p) => s + p.y, 0) / group.length,
        }
      : old;
  });
  return {
    ...state,
    centers,
    iteration: state.iteration + 1,
    phase: "assign",
    converged: centers.every((c, i) => distance(c, state.centers[i]) < 1e-10),
  };
}
export type Action = "右" | "左" | "上" | "下";
export interface Rewards {
  step: number;
  goal: number;
  wall: number;
}
export const obstacles: Point[] = [
  { x: 2, y: 1 },
  { x: 2, y: 2 },
  { x: 1, y: 3 },
];
export const routes: Action[][] = [
  ["右", "右", "右", "右", "下", "下", "下", "下"],
  ["下", "右", "右", "上", "上", "右", "右", "下", "下", "下", "下"],
];
export function evaluateRoute(actions: Action[], rewards: Rewards) {
  let position: Point = { x: 0, y: 0 };
  let total = 0;
  let done = false;
  const frames: {
    position: Point;
    reward: number;
    total: number;
    event: string;
  }[] = [{ position, reward: 0, total, event: "スタート" }];
  for (const action of actions) {
    if (done) break;
    const delta = { 右: [1, 0], 左: [-1, 0], 上: [0, -1], 下: [0, 1] }[action];
    const next = { x: position.x + delta[0], y: position.y + delta[1] };
    const blocked =
      next.x < 0 ||
      next.x > 4 ||
      next.y < 0 ||
      next.y > 4 ||
      obstacles.some((p) => distance(p, next) === 0);
    if (!blocked) position = next;
    done = position.x === 4 && position.y === 4;
    const reward =
      rewards.step + (blocked ? rewards.wall : 0) + (done ? rewards.goal : 0);
    total += reward;
    frames.push({
      position: { ...position },
      reward,
      total,
      event: blocked ? "障害物・壁" : done ? "ゴール" : action,
    });
  }
  return frames;
}
