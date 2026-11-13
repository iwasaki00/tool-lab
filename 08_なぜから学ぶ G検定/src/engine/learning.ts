import type {
  Backup,
  LearningProgress,
  LessonCompletion,
  QuestionAttempt,
  ReviewState,
} from "../types";
import { questions } from "../data/content";
export const newProgress = (): LearningProgress => ({
  id: "progress-L003",
  lessonId: "L003",
  scene: 0,
  questionIndex: 0,
  completed: false,
  visited: [0],
  updatedAt: new Date().toISOString(),
  sessionId: crypto.randomUUID(),
  predictions: [-1, -1, -1],
  started: false,
  storySampleAdded: false,
  introStage: "prologue",
  challenge: null,
  challengeLabelled: true,
});
export const emptyBackup = (): Backup => ({
  formatVersion: 1,
  exportedAt: new Date().toISOString(),
  attempts: [],
  progress: newProgress(),
  reviews: [],
  settings: { id: "settings", speed: 1 },
});
export function grade(
  questionId: string,
  selected: number,
  sessionId: string,
): QuestionAttempt {
  const q = questions.find((q) => q.id === questionId);
  if (!q || !Number.isInteger(selected) || selected < 0 || selected > 3)
    throw Error("回答が不正です");
  return {
    id: crypto.randomUUID(),
    questionId,
    version: q.version,
    selected,
    correct: q.answer === selected,
    answeredAt: new Date().toISOString(),
    sessionId,
  };
}
export function reviewFor(a: QuestionAttempt): ReviewState {
  return {
    id: `review-${a.questionId}`,
    questionId: a.questionId,
    dueAt: new Date(
      Date.parse(a.answeredAt) + (a.correct ? 3 : 1) * 86400000,
    ).toISOString(),
    reason: a.correct ? "correct" : "incorrect",
    updatedAt: a.answeredAt,
  };
}
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const date = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}T/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString() === v;
const int = (v: unknown, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;
const str = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 200;
export function validateBackup(input: unknown): Backup {
  const fail = (): never => {
    throw Error(
      "バックアップの形式または整合性が不正です。保存内容は変更していません。",
    );
  };
  if (
    !record(input) ||
    input.formatVersion !== 1 ||
    !date(input.exportedAt) ||
    !Array.isArray(input.attempts) ||
    !Array.isArray(input.reviews) ||
    !record(input.progress) ||
    !record(input.settings)
  )
    return fail();
  if (input.attempts.length > 100000 || input.reviews.length > questions.length)
    return fail();
  const p = input.progress,
    s = input.settings;
  if (
    (p.introStage !== undefined &&
      !["prologue", "sorting"].includes(p.introStage as string)) ||
    p.id !== "progress-L003" ||
    p.lessonId !== "L003" ||
    !int(p.scene, 8) ||
    !int(p.questionIndex, 11) ||
    typeof p.completed !== "boolean" ||
    (p.started !== undefined && typeof p.started !== "boolean") ||
    (p.storySampleAdded !== undefined &&
      typeof p.storySampleAdded !== "boolean") ||
    !date(p.updatedAt) ||
    !str(p.sessionId) ||
    !Array.isArray(p.visited) ||
    !p.visited.every((v) => int(v, 8)) ||
    new Set(p.visited).size !== p.visited.length ||
    !p.visited.includes(p.scene) ||
    !Array.isArray(p.predictions) ||
    p.predictions.length !== 3 ||
    !p.predictions.every((v) => v === -1 || int(v, 2)) ||
    !(p.challenge === null || int(p.challenge, 2)) ||
    typeof p.challengeLabelled !== "boolean" ||
    s.id !== "settings" ||
    ![0.5, 1, 2].includes(s.speed as number)
  )
    return fail();
  const ids = new Set<string>();
  for (const a of input.attempts) {
    if (
      !record(a) ||
      !str(a.id) ||
      ids.has(a.id) ||
      !str(a.sessionId) ||
      !date(a.answeredAt) ||
      !int(a.selected, 3)
    )
      return fail();
    const q = questions.find((q) => q.id === a.questionId);
    if (
      !q ||
      a.version !== q.version ||
      a.correct !== (a.selected === q.answer)
    )
      return fail();
    ids.add(a.id);
  }
  const reviewIds = new Set();
  for (const r of input.reviews) {
    if (
      !record(r) ||
      !questions.some((q) => q.id === r.questionId) ||
      r.id !== `review-${r.questionId}` ||
      reviewIds.has(r.id) ||
      !date(r.dueAt) ||
      !date(r.updatedAt) ||
      !["correct", "incorrect", "manual"].includes(r.reason as string)
    )
      return fail();
    reviewIds.add(r.id);
  }
  // Completing the story no longer requires taking the optional exam.
  if (
    p.completed &&
    ![0, 1, 2, 3, 4, 5, 6, 8].every((scene) =>
      (p.visited as number[]).includes(scene),
    )
  )
    return fail();
  if (input.completions !== undefined) {
    if (!Array.isArray(input.completions) || input.completions.length > 100000)
      return fail();
    const completionIds = new Set();
    for (const c of input.completions) {
      if (
        !record(c) ||
        !str(c.lessonId) ||
        !str(c.sessionId) ||
        c.id !== `completion-${c.lessonId}-${c.sessionId}` ||
        completionIds.has(c.id) ||
        !date(c.recordedAt)
      )
        return fail();
      completionIds.add(c.id);
    }
  }
  // Return a detached, validated snapshot; UI never mutates the imported object.
  return structuredClone(input) as unknown as Backup;
}
export function mergeBackups(current: Backup, incoming: Backup): Backup {
  const a = validateBackup(current),
    b = validateBackup(incoming);
  const attempts = new Map(a.attempts.map((v) => [v.id, v]));
  for (const item of b.attempts) {
    const old = attempts.get(item.id);
    if (
      old &&
      (
        [
          "id",
          "questionId",
          "version",
          "selected",
          "correct",
          "answeredAt",
          "sessionId",
        ] as const
      ).some((key) => old[key] !== item[key])
    )
      throw Error("同じ履歴IDに異なる内容があるため統合できません。");
    attempts.set(item.id, item);
  }
  const reviews = new Map(a.reviews.map((v) => [v.id, v]));
  for (const r of b.reviews) {
    const old = reviews.get(r.id);
    if (!old || r.updatedAt > old.updatedAt) reviews.set(r.id, r);
  }
  const completions = combineCompletions([
    ...completionRecords(a),
    ...completionRecords(b),
  ]);
  return validateBackup({
    ...a,
    ...(completions.length || a.completions || b.completions
      ? { completions }
      : {}),
    exportedAt: new Date().toISOString(),
    attempts: [...attempts.values()].sort((x, y) =>
      x.answeredAt.localeCompare(y.answeredAt),
    ),
    progress:
      b.progress.updatedAt > a.progress.updatedAt ? b.progress : a.progress,
    reviews: [...reviews.values()],
  });
}

export const storyVisited = (p: LearningProgress) =>
  [0, 1, 2, 3, 4, 5, 6, 8].every((scene) => p.visited.includes(scene));
export function hasLearningRecord(b: Backup): boolean {
  const p = b.progress;
  return (
    !!p.started ||
    !!p.storySampleAdded ||
    p.scene > 0 ||
    p.visited.length > 1 ||
    p.completed ||
    p.predictions.some((v) => v !== -1) ||
    b.attempts.length > 0 ||
    (b.completions?.length ?? 0) > 0
  );
}

function combineCompletions(items: LessonCompletion[]): LessonCompletion[] {
  const unique = new Map<string, LessonCompletion>();
  for (const c of items) {
    const old = unique.get(c.id);
    if (!old || c.recordedAt < old.recordedAt) unique.set(c.id, c);
  }
  return [...unique.values()].sort((a, b) =>
    a.recordedAt.localeCompare(b.recordedAt),
  );
}
export function completionRecords(b: Backup): LessonCompletion[] {
  const records = b.completions ?? [];
  if (!b.progress.completed) return records;
  const p = b.progress,
    id = `completion-${p.lessonId}-${p.sessionId}`;
  return records.some((c) => c.id === id)
    ? records
    : [
        ...records,
        {
          id,
          lessonId: p.lessonId,
          sessionId: p.sessionId,
          recordedAt: p.updatedAt,
        },
      ];
}
export function restartLesson(b: Backup): Backup {
  return {
    ...b,
    completions: completionRecords(b),
    progress: { ...newProgress(), started: true },
  };
}
export function completeLesson(b: Backup): Backup {
  if (!storyVisited(b.progress)) throw Error("本編を最後まで確認してください");
  const next = {
    ...b,
    progress: {
      ...b.progress,
      completed: true,
      updatedAt: new Date().toISOString(),
    },
  };
  return { ...next, completions: completionRecords(next) };
}
