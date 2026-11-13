export interface Course {
  id: string;
  title: string;
  lessonIds: string[];
}
export interface Lesson {
  id: string;
  title: string;
  courseId: string;
  sceneIds: string[];
  syllabusIds: string[];
}
export interface Scene {
  id: string;
  title: string;
  eyebrow: string;
  prompt: string;
}
export interface Concept {
  id: string;
  name: string;
  description: string;
}
export interface Relationship {
  id: string;
  from: string;
  to: string;
  type: "前提知識" | "比較" | "応用" | "関連";
}
export interface SyllabusItem {
  id: string;
  title: string;
  source: string;
  version: string;
  checkedAt: string;
}
export interface Question {
  id: string;
  version: number;
  text: string;
  options: { text: string; explanation: string }[];
  answer: number;
  clue: string;
  conceptIds: string[];
  sourceIds: string[];
}
export interface QuestionAttempt {
  id: string;
  questionId: string;
  version: number;
  selected: number;
  correct: boolean;
  answeredAt: string;
  sessionId: string;
}
export interface LearningProgress {
  id: string;
  lessonId: string;
  scene: number;
  questionIndex: number;
  completed: boolean;
  visited: number[];
  updatedAt: string;
  sessionId: string;
  /** Kept for v0.1.0 backups; the prediction form is no longer shown. */
  predictions: number[];
  started?: boolean;
  storySampleAdded?: boolean;
  introStage?: "prologue" | "sorting";
  challenge: number | null;
  challengeLabelled: boolean;
}
export interface ReviewState {
  id: string;
  questionId: string;
  dueAt: string;
  reason: "correct" | "incorrect" | "manual";
  updatedAt: string;
}
export interface Settings {
  id: "settings";
  speed: number;
}
export interface LessonCompletion {
  id: string;
  lessonId: string;
  sessionId: string;
  recordedAt: string;
}
export interface Backup {
  completions?: LessonCompletion[];
  formatVersion: 1;
  exportedAt: string;
  attempts: QuestionAttempt[];
  progress: LearningProgress;
  reviews: ReviewState[];
  settings: Settings;
}
