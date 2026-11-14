import { describe, it, expect } from "vitest";
import {
  groupTransport,
  transportRecords,
  compareTransport,
  episodeRoutes,
  episodeRewards,
} from "./episode";
import { distance, kStep, initializeK, evaluateRoute } from "./simulations";
import {
  emptyBackup,
  validateBackup,
  restartLesson,
  completeLesson,
  storyVisited,
  grade,
  reviewFor,
} from "./learning";
import "fake-indexeddb/auto";
import { saveState, loadState } from "./storage";
describe("搬送記録の実計算", () => {
  it("12件の割当てが最近傍中心と一致し、中心は各群の平均", () => {
    const { state, groups } = groupTransport();
    expect(state.converged).toBe(true);
    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.records.length > 0)).toBe(true);
    expect(groups.flatMap((g) => g.records)).toHaveLength(12);
    for (const g of groups) {
      expect(g.center.x).toBeCloseTo(
        g.records.reduce((n, r) => n + r.x, 0) / g.records.length,
      );
      expect(g.center.y).toBeCloseTo(
        g.records.reduce((n, r) => n + r.y, 0) / g.records.length,
      );
    }
    transportRecords.forEach((r, i) =>
      expect(distance(r, state.centers[state.assignments[i]])).toBe(
        Math.min(...state.centers.map((c) => distance(r, c))),
      ),
    );
    const delayed = groups.find((g) => g.center.x >= 65 && g.center.y >= 65)!;
    expect(delayed.records.map((r) => r.id).sort()).toEqual(
      ["R9", "R10", "R11", "R12"].sort(),
    );
    expect(transportRecords.every((r) => !("label" in r))).toBe(true);
  });
  it("本編と詳細の同じ初期値・同じK-meansで同じ結果", () => {
    let state = initializeK(3, 1, transportRecords);
    for (let n = 0; n < 100 && !state.converged; n++)
      state = kStep(transportRecords, state);
    expect(state).toEqual(groupTransport().state);
  });
});
describe("同じ経路の報酬比較", () => {
  it("両経路が出荷口へ到着し、重視する条件だけで順位が反転する", () => {
    const speed = compareTransport("speed"),
      care = compareTransport("care");
    expect(speed.map((s) => s.reached)).toEqual([true, true]);
    expect(speed.map((s) => s.steps)).toEqual([9, 12]);
    expect(speed.map((s) => s.stops)).toEqual([1, 0]);
    expect(speed.map((s) => s.total)).toEqual([22, 14]);
    expect(care.map((s) => s.total)).toEqual([26, 38]);
    expect(speed[0].total).toBeGreaterThan(speed[1].total);
    expect(care[0].total).toBeLessThan(care[1].total);
    for (const priority of ["speed", "care"] as const) {
      compareTransport(priority).forEach((s, i) => {
        expect(s.frames).toEqual(
          evaluateRoute(episodeRoutes[i], episodeRewards[priority]),
        );
        expect(s.total).toBe(s.movement + s.shaking + s.arrival);
      });
    }
  });
});
it("本編の進行・結果を保存し、詳細を見ずに完了、再開始で履歴を保持", async () => {
  let b = emptyBackup();
  b.attempts = [grade("L003-Q01", 0, b.progress.sessionId)];
  b.reviews = [reviewFor(b.attempts[0])];
  b.settings.speed = 2;
  b.progress.episode = {
    stage: "ending",
    grouped: true,
    compared: true,
    priority: "care",
  };
  b.progress.storySampleAdded = true;
  expect(b.progress.visited).toEqual([0]);
  expect(storyVisited(b.progress)).toBe(true);
  b = completeLesson(b);
  await saveState(b);
  expect(await loadState()).toEqual(b);
  expect(validateBackup(JSON.parse(JSON.stringify(b)))).toEqual(b);
  const restarted = restartLesson(b);
  expect(restarted.progress.episode).toEqual({
    stage: "sorting",
    grouped: false,
    compared: false,
    priority: "speed",
  });
  expect(restarted.progress.storySampleAdded).toBe(false);
  expect(restarted.attempts).toEqual(b.attempts);
  expect(restarted.reviews).toEqual(b.reviews);
  expect(restarted.settings).toEqual(b.settings);
  expect(restarted.completions).toHaveLength(1);
  expect(() => completeLesson(restarted)).toThrow();
});
it("不正な本編状態の復元を拒否し、旧データの場面を変更しない", () => {
  const b = emptyBackup();
  b.progress.scene = 2;
  b.progress.visited = [0, 2];
  expect(validateBackup(b).progress.scene).toBe(2);
  expect(validateBackup(b).progress.episode).toBeUndefined();
  for (const episode of [
    null,
    {},
    { stage: "ending", grouped: false, compared: false, priority: "speed" },
    { stage: "invalid", grouped: true, compared: true, priority: "care" },
    { stage: "records", grouped: 1, compared: false, priority: "speed" },
    { stage: "routes", grouped: true, compared: false, priority: "other" },
  ]) {
    expect(() =>
      validateBackup({ ...b, progress: { ...b.progress, episode } }),
    ).toThrow();
  }
});
