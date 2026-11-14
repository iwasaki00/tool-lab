import { it, expect } from "vitest";
import "fake-indexeddb/auto";
import {
  emptyBackup,
  restartLesson,
  completeLesson,
  completionRecords,
  validateBackup,
  mergeBackups,
  grade,
  reviewFor,
} from "./learning";
import { loadState, saveState } from "./storage";
import legacy from "../../tests/fixtures/v0.1.1-backup.json";
it("今回の進行・操作だけを初期化し、回答・復習・設定・他の状態を保持", async () => {
  const b = emptyBackup();
  b.progress = {
    ...b.progress,
    scene: 5,
    visited: [0, 1, 2, 3, 4, 5],
    questionIndex: 3,
    storySampleAdded: true,
    introStage: "sorting",
    predictions: [1, 2, 0],
    challenge: 2,
    challengeLabelled: false,
  };
  b.attempts = [grade("L003-Q01", 0, b.progress.sessionId)];
  b.reviews = [reviewFor(b.attempts[0])];
  b.settings.speed = 2;
  const withOther = {
    ...b,
    otherLessons: { L999: { scene: 4, completed: true } },
  };
  const next = restartLesson(withOther);
  expect(next.progress).toMatchObject({
    scene: 0,
    questionIndex: 0,
    visited: [0],
    started: true,
    introStage: "prologue",
    completed: false,
    storySampleAdded: false,
    predictions: [-1, -1, -1],
    challenge: null,
    challengeLabelled: true,
  });
  expect(next.progress.sessionId).not.toBe(b.progress.sessionId);
  expect(next.attempts).toEqual(b.attempts);
  expect(next.reviews).toEqual(b.reviews);
  expect(next.settings).toEqual(b.settings);
  expect((next as typeof withOther).otherLessons).toEqual(
    withOther.otherLessons,
  );
  expect(b.progress.storySampleAdded).toBe(true);
  await saveState(next);
  expect(await loadState()).toEqual(next);
});
it("完了後の再開始を繰り返しても完了記録を重複・消去せず新しい完了も追加", () => {
  let b = emptyBackup();
  b.progress.visited = [0, 1, 2, 3, 4, 5, 6, 8];
  b.progress.scene = 8;
  b = completeLesson(b);
  const first = b.progress.sessionId;
  expect(completionRecords(b)).toHaveLength(1);
  expect(completionRecords(completeLesson(b))).toHaveLength(1);
  b = restartLesson(b);
  expect(b.progress.completed).toBe(false);
  expect(b.completions?.[0].sessionId).toBe(first);
  b.progress.episode = {
    stage: "ending",
    grouped: true,
    compared: true,
    priority: "care",
  };
  b.progress.storySampleAdded = true;
  b.progress.visited = [0, 1, 2, 3, 4, 5, 6, 8];
  b.progress.scene = 8;
  b = completeLesson(b);
  expect(b.completions).toHaveLength(2);
  expect(restartLesson(b).completions).toHaveLength(2);
});
it("旧版の完了フラグを別の完了記録に退避し、旧途中データを勝手にプロローグへ変えない", () => {
  const old = validateBackup(legacy);
  expect(old.progress.introStage).toBeUndefined();
  expect(old.progress.storySampleAdded).toBe(true);
  expect(old.progress.scene).toBe(0);
  const done = {
    ...old,
    progress: {
      ...old.progress,
      scene: 8,
      completed: true,
      visited: [0, 1, 2, 3, 4, 5, 6, 8],
    },
  };
  const next = restartLesson(done);
  expect(next.completions).toEqual([
    {
      id: `completion-L003-${done.progress.sessionId}`,
      lessonId: "L003",
      sessionId: done.progress.sessionId,
      recordedAt: done.progress.updatedAt,
    },
  ]);
  expect(next.attempts).toEqual(done.attempts);
});
it("完了記録のバックアップ検証・置換・統合・重複排除を行う", async () => {
  const a = emptyBackup();
  a.progress.visited = [0, 1, 2, 3, 4, 5, 6, 8];
  a.progress.scene = 8;
  const done = completeLesson(a),
    reset = restartLesson(done);
  expect(validateBackup(JSON.parse(JSON.stringify(reset)))).toEqual(reset);
  expect(mergeBackups(done, reset).completions).toHaveLength(1);
  await saveState(reset);
  expect((await loadState()).completions).toEqual(done.completions);
  expect(() =>
    validateBackup({
      ...reset,
      completions: [...reset.completions!, ...reset.completions!],
    }),
  ).toThrow();
  expect(() =>
    validateBackup({
      ...reset,
      progress: { ...reset.progress, introStage: "invalid" },
    }),
  ).toThrow();
});
it("プロローグに新IDを追加し既存9場面の添字とIDを維持", async () => {
  const { lesson, scenes, prologueScene } = await import("../data/content");
  expect(prologueScene.id).toBe("L003-P00");
  expect(lesson.sceneIds).toEqual(["L003-P00", ...scenes.map((s) => s.id)]);
  expect(scenes.map((s) => s.id)).toEqual(
    Array.from({ length: 9 }, (_, i) => `L003-S0${i + 1}`),
  );
});

it("漫画の読書位置とAI試行段階の保存・バックアップ・再開始", async () => {
  const b = emptyBackup();
  b.progress.introStage = "ai-trial";
  b.progress.prologueScroll = 570;
  expect(validateBackup(JSON.parse(JSON.stringify(b)))).toEqual(b);
  await saveState(b);
  expect((await loadState()).progress.introStage).toBe("ai-trial");
  const reset = restartLesson(b);
  expect(reset.progress.introStage).toBe("prologue");
  expect(reset.progress.prologueScroll).toBe(0);
  for (const invalid of [-1, NaN, Infinity, "200", null]) {
    expect(() =>
      validateBackup({
        ...b,
        progress: { ...b.progress, prologueScroll: invalid },
      }),
    ).toThrow();
  }
});
