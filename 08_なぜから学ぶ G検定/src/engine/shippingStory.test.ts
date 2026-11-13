import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import legacy from "../../tests/fixtures/v0.1.0-backup.json";
import { shippingPrediction } from "./shippingStory";
import { classify, samples, distance } from "./simulations";
import { inspectedSample, shippingTarget } from "../data/shippingStory";
import {
  emptyBackup,
  hasLearningRecord,
  storyVisited,
  validateBackup,
  mergeBackups,
} from "./learning";
import { loadState, saveState } from "./storage";

describe("STORY FIRST", () => {
  it("別の見本を1個追加するだけで最近傍の実計算が不良から良品へ変わる", () => {
    expect(inspectedSample.id).not.toBe(shippingTarget.id);
    expect(distance(inspectedSample, shippingTarget)).toBeGreaterThan(0);
    expect(samples.some((p) => distance(p, shippingTarget) === 0)).toBe(false);
    const before = classify(samples, shippingTarget),
      after = classify([...samples, inspectedSample], shippingTarget);
    expect(shippingPrediction(false)).toEqual(before);
    expect(shippingPrediction(true)).toEqual(after);
    expect(before.label).toBe("不良");
    expect(after.label).toBe("良品");
    expect(after.nearestId).toBe(inspectedSample.id);
    expect(after.distance).toBeCloseTo(Math.sqrt(13));
    expect(before.distance).toBeCloseTo(Math.sqrt(89));
    expect(samples).toHaveLength(6);
  });
  it("旧版の保存形式を進行・予想・履歴・復習・設定を変更せず読み書き・統合できる", async () => {
    expect(validateBackup(legacy)).toEqual(legacy);
    await saveState(validateBackup(legacy));
    expect(await loadState()).toEqual(legacy);
    expect(
      mergeBackups(validateBackup(legacy), validateBackup(legacy)),
    ).toEqual({ ...legacy, exportedAt: expect.any(String) });
  });
  it("試験問題を解かずに物語を完了し、新しい導入状態もバックアップ・復元できる", async () => {
    const b = emptyBackup();
    b.progress = {
      ...b.progress,
      scene: 8,
      visited: [0, 1, 2, 3, 4, 5, 6, 8],
      storySampleAdded: true,
      started: true,
      completed: true,
    };
    expect(storyVisited(b.progress)).toBe(true);
    expect(validateBackup(b).attempts).toHaveLength(0);
    await saveState(b);
    expect(await loadState()).toEqual(b);
    expect(() =>
      validateBackup({
        ...b,
        progress: { ...b.progress, storySampleAdded: "yes" },
      }),
    ).toThrow();
    expect(() =>
      validateBackup({ ...b, progress: { ...b.progress, visited: [0, 8] } }),
    ).toThrow();
  });
  it("新規・冒頭中断・旧版の予想のみの記録を区別し、再開ボタンを優先する", () => {
    const fresh = emptyBackup();
    expect(hasLearningRecord(fresh)).toBe(false);
    expect(
      hasLearningRecord({
        ...fresh,
        progress: { ...fresh.progress, started: true },
      }),
    ).toBe(true);
    expect(
      hasLearningRecord({
        ...fresh,
        progress: { ...fresh.progress, predictions: [-1, 0, -1] },
      }),
    ).toBe(true);
    expect(hasLearningRecord(validateBackup(legacy))).toBe(true);
  });
});

it("既存9場面のIDと12問・48解説を変更しない", async () => {
  const { scenes, questions } = await import("../data/content");
  const { default: baseline } =
    await import("../../tests/fixtures/v0.1.0-questions.json");
  expect(scenes.map((s) => s.id)).toEqual(
    Array.from({ length: 9 }, (_, i) => `L003-S0${i + 1}`),
  );
  expect(questions).toEqual(baseline);
});
