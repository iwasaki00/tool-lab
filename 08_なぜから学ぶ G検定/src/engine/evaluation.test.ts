import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import {
  evaluationBoxes,
  sortingA,
  sortingB,
  evaluationQuestions,
} from "../data/evaluation";
import { summarizeInspection, percent } from "./evaluation";
import {
  beginEvaluation,
  completeEvaluation,
  completionRecords,
  emptyBackup,
  grade,
  reviewFor,
  mergeBackups,
  restartLesson,
  validateBackup,
  hasLearningRecord,
} from "./learning";
import type { Backup } from "../types";
import { loadState, saveState } from "./storage";
import { samples } from "./simulations";
const finish = (b: Backup): Backup => ({
  ...b,
  evaluation: {
    ...b.evaluation!,
    stage: "ending",
    visited: ["intro", "discovery", "comparison", "ending"],
  },
});
describe("L004の判定データから集計", () => {
  it("同じ未使用100箱の人の検査結果を固定し、設定だけを比較", () => {
    expect(evaluationBoxes).toHaveLength(100);
    expect(new Set(evaluationBoxes.map((r) => r.id)).size).toBe(100);
    expect(evaluationBoxes.filter((r) => r.actual === "不良")).toHaveLength(1);
    expect(sortingA.map(({ id, actual }) => ({ id, actual }))).toEqual(
      evaluationBoxes,
    );
    expect(sortingB.map(({ id, actual }) => ({ id, actual }))).toEqual(
      evaluationBoxes,
    );
    const original = structuredClone(samples);
    summarizeInspection(sortingA);
    summarizeInspection(sortingB);
    expect(samples).toEqual(original);
    expect(
      samples.some((r) => evaluationBoxes.some((b) => b.id === r.id)),
    ).toBe(false);
  });
  it("Aは99％・再現率0/1、見逃し1・止めすぎ0", () => {
    expect(summarizeInspection(sortingA)).toEqual({
      total: 100,
      matched: 99,
      actualGood: 99,
      actualDefects: 1,
      truePositive: 0,
      falseNegative: 1,
      falsePositive: 0,
      trueNegative: 99,
      accuracy: 0.99,
      recall: 0,
    });
  });
  it("Bは98％・再現率1/1、見逃し0・止めすぎ2", () => {
    const b = summarizeInspection(sortingB);
    expect(b).toEqual({
      total: 100,
      matched: 98,
      actualGood: 99,
      actualDefects: 1,
      truePositive: 1,
      falseNegative: 0,
      falsePositive: 2,
      trueNegative: 97,
      accuracy: 0.98,
      recall: 1,
    });
    expect(
      b.truePositive + b.falseNegative + b.falsePositive + b.trueNegative,
    ).toBe(b.total);
  });
  it("データを変えれば集計も変わり、対象0件を誤って100％にしない", () => {
    const changed = sortingA.map((r, i) =>
      i === 0 ? { ...r, predicted: "不良" as const } : r,
    );
    expect(summarizeInspection(changed).accuracy).toBe(0.98);
    expect(summarizeInspection(changed).falsePositive).toBe(1);
    expect(summarizeInspection([]).accuracy).toBeNull();
    expect(summarizeInspection(sortingA.slice(0, 99)).recall).toBeNull();
    expect(percent(null)).toBe("対象なし");
    expect(percent(0.99)).toBe("99％");
  });
  it("独自3問は全選択肢を正しく採点し、場面に結び付く解説を持つ", () => {
    expect(evaluationQuestions.map((q) => q.id)).toEqual([
      "L004-Q01",
      "L004-Q02",
      "L004-Q03",
    ]);
    for (const q of evaluationQuestions) {
      expect(q.options).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        expect(grade(q.id, i, "L004-test", evaluationQuestions).correct).toBe(
          i === q.answer,
        );
        expect(q.options[i].explanation.length).toBeGreaterThan(20);
      }
    }
  });
});
it("L004の完了・再開始とL003の再開始が互いの進行・回答・過去完了を変更しない", async () => {
  const old = emptyBackup();
  old.progress.scene = 2;
  old.progress.visited = [0, 1, 2];
  old.settings.speed = 2;
  old.attempts = [grade("L003-Q01", 0, old.progress.sessionId)];
  old.reviews = [reviewFor(old.attempts[0])];
  let b = beginEvaluation(old);
  expect(b.progress).toEqual(old.progress);
  expect(b.attempts).toEqual(old.attempts);
  expect(() => completeEvaluation(b)).toThrow();
  b = completeEvaluation(finish(b));
  b.evaluationAttempts = [
    grade("L004-Q01", 1, b.evaluation!.sessionId, evaluationQuestions),
  ];
  await saveState(b);
  expect(await loadState()).toEqual(b);
  expect(validateBackup(JSON.parse(JSON.stringify(b)))).toEqual(b);
  expect(
    completionRecords(b).filter((c) => c.lessonId === "L004"),
  ).toHaveLength(1);
  const restarted = beginEvaluation(b, true);
  expect(restarted.evaluation!.stage).toBe("intro");
  expect(restarted.evaluation!.sessionId).not.toBe(b.evaluation!.sessionId);
  expect(restarted.progress).toEqual(old.progress);
  expect(restarted.attempts).toEqual(old.attempts);
  expect(restarted.reviews).toEqual(old.reviews);
  expect(restarted.settings).toEqual(old.settings);
  expect(restarted.evaluationAttempts).toEqual(b.evaluationAttempts);
  expect(restarted.completions).toEqual(b.completions);
  const l003 = restartLesson(restarted);
  expect(l003.evaluation).toEqual(restarted.evaluation);
  expect(l003.evaluationAttempts).toEqual(restarted.evaluationAttempts);
  const completedOnlyL004 = completeEvaluation(
    finish(beginEvaluation(emptyBackup())),
  );
  expect(hasLearningRecord(completedOnlyL004)).toBe(false);
});
it("旧版バックアップとの統合は2レッスンの位置を独立に選び、履歴も保持", () => {
  const old = emptyBackup();
  old.progress.updatedAt = "2026-11-14T00:00:00.000Z";
  const withEval = beginEvaluation(old);
  withEval.evaluation!.updatedAt = "2026-11-14T01:00:00.000Z";
  withEval.evaluationAttempts = [
    grade("L004-Q02", 2, withEval.evaluation!.sessionId, evaluationQuestions),
  ];
  const newerL003 = structuredClone(old);
  newerL003.progress.scene = 2;
  newerL003.progress.visited = [0, 2];
  newerL003.progress.updatedAt = "2026-11-14T02:00:00.000Z";
  for (const merged of [
    mergeBackups(withEval, newerL003),
    mergeBackups(newerL003, withEval),
  ]) {
    expect(merged.progress).toEqual(newerL003.progress);
    expect(merged.evaluation).toEqual(withEval.evaluation);
    expect(merged.evaluationAttempts).toEqual(withEval.evaluationAttempts);
  }
  const current = structuredClone(withEval);
  current.evaluation!.stage = "discovery";
  current.evaluation!.visited = ["intro", "discovery"];
  current.evaluation!.updatedAt = "2026-11-14T03:00:00.000Z";
  expect(mergeBackups(current, withEval).evaluation).toEqual(
    current.evaluation,
  );
  expect(mergeBackups(withEval, current).evaluation).toEqual(
    current.evaluation,
  );
  const conflict = structuredClone(withEval);
  conflict.evaluationAttempts![0].selected = 0;
  conflict.evaluationAttempts![0].correct = false;
  expect(() => mergeBackups(withEval, conflict)).toThrow("異なる内容");
});
it("不正なL004の進行・回答を拒否し、旧版の省略フィールドは追加しない", () => {
  const old = emptyBackup();
  expect(validateBackup(old)).toEqual(old);
  expect(validateBackup(old).evaluation).toBeUndefined();
  const b = beginEvaluation(old);
  for (const evaluation of [
    null,
    {},
    { ...b.evaluation, stage: "other" },
    { ...b.evaluation, stage: "comparison" },
    { ...b.evaluation, questionIndex: 3 },
    { ...b.evaluation, completed: true },
  ])
    expect(() => validateBackup({ ...b, evaluation })).toThrow();
  const attempt = grade(
    "L004-Q01",
    1,
    b.evaluation!.sessionId,
    evaluationQuestions,
  );
  for (const evaluationAttempts of [
    null,
    [{ ...attempt, correct: false }],
    [{ ...attempt, questionId: "L003-Q01" }],
    [attempt, attempt],
  ])
    expect(() => validateBackup({ ...b, evaluationAttempts })).toThrow();
});

it("L003とL004の完了を両方保持し、再開始・再完了・統合で消失や重複を起こさない", async () => {
  const { completeLesson } = await import("./learning");
  let b = emptyBackup();
  b.progress.scene = 8;
  b.progress.visited = [0, 1, 2, 3, 4, 5, 6, 8];
  b = completeLesson(b);
  const l003Record = structuredClone(b.completions![0]);
  b = completeEvaluation(finish(beginEvaluation(b)));
  expect(b.completions!.map((c) => c.lessonId)).toEqual(["L003", "L004"]);
  const l004Record = structuredClone(b.completions![1]);
  let again = restartLesson(beginEvaluation(b, true));
  expect(again.completions).toEqual([l003Record, l004Record]);
  again = completeEvaluation(finish(again));
  expect(again.completions).toHaveLength(3);
  expect(again.completions).toContainEqual(l003Record);
  expect(again.completions).toContainEqual(l004Record);
  const merged = mergeBackups(again, b);
  expect(merged.completions).toHaveLength(3);
  expect(merged.completions).toContainEqual(l003Record);
  expect(merged.completions).toContainEqual(l004Record);
  await saveState(merged);
  expect((await loadState()).completions).toEqual(merged.completions);
});
