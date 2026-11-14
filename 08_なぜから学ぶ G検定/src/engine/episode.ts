import type { Action, Rewards } from "./simulations";
import { initializeK, kStep, evaluateRoute } from "./simulations";

// Fictional records: average waiting seconds and stops per 100 boxes.
export const transportRecords = [
  [16, 12],
  [23, 18],
  [20, 22],
  [28, 16],
  [44, 40],
  [50, 48],
  [55, 42],
  [48, 54],
  [76, 72],
  [84, 82],
  [90, 76],
  [80, 88],
].map(([x, y], i) => ({ id: `R${i + 1}`, x, y }));
export function groupTransport() {
  let state = initializeK(3, 1, transportRecords);
  for (let n = 0; n < 100 && !state.converged; n++)
    state = kStep(transportRecords, state);
  if (!state.converged) throw Error("搬送記録の分類が収束しませんでした");
  const groups = state.centers.map((center, i) => ({
    id: i + 1,
    center,
    records: transportRecords.filter((_, j) => state.assignments[j] === i),
    description:
      center.x >= 65 && center.y >= 65
        ? "待ち時間が長く、停止も多め"
        : center.x < 35 && center.y < 35
          ? "待ち時間も停止も少なめ"
          : "待ち時間と停止が中くらい",
  }));
  return { state, groups };
}
export type Priority = "speed" | "care";
export const episodeRoutes: Action[][] = [
  ["右", "右", "下", "右", "右", "下", "下", "下", "下"],
  ["下", "下", "右", "上", "上", "右", "右", "右", "下", "下", "下", "下"],
];
export const episodeRewards: Record<Priority, Rewards> = {
  speed: { step: -3, wall: -1, goal: 50 },
  care: { step: -1, wall: -15, goal: 50 },
};
export function compareTransport(priority: Priority) {
  const rewards = episodeRewards[priority];
  return episodeRoutes.map((actions) => {
    const frames = evaluateRoute(actions, rewards);
    const stops = frames.filter((f) => f.event === "障害物・壁").length;
    const reached = frames.at(-1)?.event === "ゴール";
    return {
      frames,
      total: frames.at(-1)!.total,
      steps: frames.length - 1,
      stops,
      movement: (frames.length - 1) * rewards.step,
      shaking: stops * rewards.wall,
      arrival: reached ? rewards.goal : 0,
      reached,
    };
  });
}
// Coordinates for the illustrated comparison use the same evaluated frames.
export const routeDrawing = (frames: ReturnType<typeof evaluateRoute>) =>
  frames
    .map((f) => `${270 + f.position.x * 60},${115 + f.position.y * 32}`)
    .join(" ");
