import type { InspectionRecord } from "../data/evaluation";
import type { EvaluationProgress } from "../types";
export function summarizeInspection(records: readonly InspectionRecord[]) {
  const counts = {
    truePositive: 0,
    falseNegative: 0,
    falsePositive: 0,
    trueNegative: 0,
  };
  for (const row of records) {
    if (row.actual === "不良")
      row.predicted === "不良" ? counts.truePositive++ : counts.falseNegative++;
    else
      row.predicted === "不良" ? counts.falsePositive++ : counts.trueNegative++;
  }
  const actualDefects = counts.truePositive + counts.falseNegative;
  const matched = counts.truePositive + counts.trueNegative;
  return {
    ...counts,
    total: records.length,
    matched,
    actualDefects,
    actualGood: counts.trueNegative + counts.falsePositive,
    accuracy: records.length ? matched / records.length : null,
    recall: actualDefects ? counts.truePositive / actualDefects : null,
  };
}
export const percent = (ratio: number | null) =>
  ratio === null ? "対象なし" : `${Math.round(ratio * 100)}％`;
export const newEvaluationProgress = (): EvaluationProgress => ({
  id: "progress-L004",
  lessonId: "L004",
  stage: "intro",
  visited: ["intro"],
  questionIndex: 0,
  sessionId: crypto.randomUUID(),
  updatedAt: new Date().toISOString(),
  completed: false,
});
export const evaluationFinished = (p: EvaluationProgress) =>
  ["intro", "discovery", "comparison", "ending"].every((stage) =>
    p.visited.includes(stage as EvaluationProgress["stage"]),
  );
