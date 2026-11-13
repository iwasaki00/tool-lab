import { describe, it, expect } from "vitest";
import {
  classify,
  samples,
  initializeK,
  kStep,
  clusterPoints,
  evaluateRoute,
  routes,
} from "./simulations";
import { questions } from "../data/content";
import {
  emptyBackup,
  grade,
  reviewFor,
  validateBackup,
  mergeBackups,
} from "./learning";
import "fake-indexeddb/auto";
import { loadState, saveState } from "./storage";
describe("分類", () => {
  it("最近傍とラベル変更を計算", () => {
    expect(classify(samples, { x: 20, y: 21 }).label).toBe("良品");
    expect(
      classify(
        samples.map((p) => ({ ...p, label: "不良" })),
        { x: 20, y: 21 },
      ).label,
    ).toBe("不良");
  });
});
describe("K-means", () => {
  for (const k of [2, 3, 4])
    it(`${k}群の割当て・平均・収束と再現性`, () => {
      let s = initializeK(k);
      expect(s).toEqual(initializeK(k));
      s = kStep(clusterPoints, s);
      expect(s.assignments).toHaveLength(12);
      const before = s;
      s = kStep(clusterPoints, s);
      s.centers.forEach((c, i) => {
        const group = clusterPoints.filter(
          (_, j) => before.assignments[j] === i,
        );
        if (group.length)
          expect(c.x).toBeCloseTo(
            group.reduce((t, p) => t + p.x, 0) / group.length,
          );
      });
      for (let i = 0; i < 100 && !s.converged; i++) s = kStep(clusterPoints, s);
      expect(s.converged).toBe(true);
      expect(kStep(clusterPoints, s)).toEqual(s);
    });
});
it("報酬は移動・衝突・ゴールを積算しゴール後停止", () => {
  expect(
    evaluateRoute(routes[0], { step: -1, wall: -5, goal: 20 }).at(-1)?.total,
  ).toBe(12);
  expect(
    evaluateRoute(["上"], { step: -1, wall: -5, goal: 20 }).at(-1)?.total,
  ).toBe(-6);
  expect(
    evaluateRoute([...routes[0], "左"], { step: -1, wall: -5, goal: 20 }),
  ).toHaveLength(9);
});
describe("12問", () => {
  for (const q of questions)
    it(`${q.id}全4選択肢を採点・解説を検査`, () => {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options.map((o) => o.text)).size).toBe(4);
      for (let i = 0; i < 4; i++) {
        expect(grade(q.id, i, "test").correct).toBe(i === q.answer);
        expect(q.options[i].explanation.length).toBeGreaterThan(10);
      }
      expect(q.clue).toBeTruthy();
      expect(q.sourceIds).toEqual(["SY-ML"]);
    });
});
it("正誤別の候補日と履歴の保持", () => {
  const a = grade(questions[0].id, 0, "test"),
    b = grade(questions[0].id, 1, "test");
  expect(Date.parse(reviewFor(a).dueAt) - Date.parse(a.answeredAt)).toBe(
    3 * 86400000,
  );
  expect(Date.parse(reviewFor(b).dueAt) - Date.parse(b.answeredAt)).toBe(
    86400000,
  );
  expect(a.id).not.toBe(b.id);
});
it("置換、重複なし統合、破損拒否、競合拒否", () => {
  const a = emptyBackup();
  a.attempts = [grade(questions[0].id, 0, a.progress.sessionId)];
  a.reviews = [reviewFor(a.attempts[0])];
  expect(validateBackup(JSON.parse(JSON.stringify(a)))).toEqual(a);
  expect(mergeBackups(a, a).attempts).toHaveLength(1);
  const b = emptyBackup();
  b.attempts = [grade(questions[1].id, 1, b.progress.sessionId)];
  expect(mergeBackups(a, b).attempts).toHaveLength(2);
  for (const broken of [
    { ...a, formatVersion: 2 },
    { ...a, progress: { ...a.progress, scene: 9 } },
    { ...a, attempts: [{ ...a.attempts[0], correct: false }] },
    { ...a, reviews: [{ ...a.reviews[0], dueAt: "bad" }] },
  ])
    expect(() => validateBackup(broken)).toThrow();
  const conflict = structuredClone(a);
  conflict.attempts[0].answeredAt = "2025-01-01T00:00:00.000Z";
  expect(() => mergeBackups(a, conflict)).toThrow();
});
it("IndexedDBトランザクション完了後に再読込で復元", async () => {
  const a = emptyBackup();
  a.progress.scene = 2;
  a.progress.visited = [0, 1, 2];
  a.attempts = [grade(questions[0].id, 0, a.progress.sessionId)];
  a.reviews = [reviewFor(a.attempts[0])];
  await saveState(a);
  expect(await loadState()).toEqual(a);
  const bad = { ...a, formatVersion: 2 };
  await expect(saveState(bad as never)).rejects.toThrow();
  expect(await loadState()).toEqual(a);
});
