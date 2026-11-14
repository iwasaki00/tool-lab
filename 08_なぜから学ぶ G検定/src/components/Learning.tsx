import { useState } from "react";
import { concepts, relationships, questions } from "../data/content";
import type { Question, QuestionAttempt } from "../types";
export function KnowledgeMap() {
  const [id, setId] = useState("supervised");
  const current = concepts.find((c) => c.id === id)!;
  return (
    <>
      <p className="muted">
        概念を選ぶと、その概念につながる項目を表示します。
      </p>
      <label>
        中心にする概念
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {concepts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="concept-center">
        <span className="eyebrow">いま見ている概念</span>
        <h3>{current.name}</h3>
        <p>{current.description}</p>
      </div>
      <div className="map-links">
        {relationships
          .filter((r) => r.from === id || r.to === id)
          .map((r) => {
            const c = concepts.find(
              (c) => c.id === (r.from === id ? r.to : r.from),
            )!;
            return (
              <button key={r.id} onClick={() => setId(c.id)}>
                <span className="tag">
                  {r.type}
                  {r.type === "前提知識"
                    ? r.to === id
                      ? " → この概念の前提"
                      : " ← この概念が前提"
                    : ""}
                </span>
                <strong>{c.name} ↗</strong>
                <small>{c.description}</small>
              </button>
            );
          })}
      </div>
    </>
  );
}
export function Quiz({
  index,
  attempts,
  sessionId,
  onAnswer,
  onIndex,
  busy,
  items = questions,
  relatedLabel,
  sourceLabel = "機械学習の概要",
}: {
  index: number;
  attempts: QuestionAttempt[];
  sessionId: string;
  onAnswer: (choice: number) => void;
  onIndex: (index: number) => void;
  busy: boolean;
  items?: Question[];
  relatedLabel?: string;
  sourceLabel?: string;
}) {
  const q = items[index];
  const attempt = attempts
    .filter((a) => a.questionId === q.id && a.sessionId === sessionId)
    .at(-1);
  const [choice, setChoice] = useState<number | null>(null),
    [retake, setRetake] = useState(false);
  const visible = retake ? undefined : attempt;
  const selected = visible?.selected ?? choice;
  function move(i: number) {
    setChoice(null);
    setRetake(false);
    onIndex(i);
  }
  return (
    <>
      <div className="quiz-top">
        <span className="tag">
          独自問題 / {index + 1} of {items.length}
        </span>
        <span className="muted">
          {q.id} · v{q.version}
        </span>
      </div>
      <progress
        max={items.length}
        value={
          attempts
            .filter((a) => a.sessionId === sessionId)
            .map((a) => a.questionId)
            .filter((v, i, a) => a.indexOf(v) === i).length
        }
      />
      <h3 className="question">{q.text}</h3>
      <fieldset>
        <legend className="sr-only">回答を選択</legend>
        {q.options.map((o, i) => (
          <label
            className={`option ${selected === i ? "selected" : ""} ${visible && q.answer === i ? "correct" : ""}`}
            key={i}
          >
            <input
              type="radio"
              name={q.id}
              checked={selected === i}
              disabled={!!visible || busy}
              onChange={() => setChoice(i)}
            />
            <span className="option-letter">{"ABCD"[i]}</span>
            <span>{o.text}</span>
          </label>
        ))}
      </fieldset>
      {!visible ? (
        <button
          className="primary"
          disabled={choice === null || busy}
          onClick={() => {
            if (choice !== null) {
              onAnswer(choice);
              setRetake(false);
              setChoice(null);
            }
          }}
        >
          回答を確定
        </button>
      ) : (
        <>
          <div
            className={`feedback ${visible.correct ? "" : "incorrect"}`}
            role="status"
          >
            <strong>
              {visible.correct ? "正解" : "もう一度、理由を確かめよう"}
            </strong>
            <p>判断の決め手：{q.clue}</p>
            <p>
              選んだ {"ABCD"[visible.selected]}：
              {q.options[visible.selected].explanation}
            </p>
            <p>
              正解：{"ABCD"[q.answer]} {q.options[q.answer].text}
            </p>
          </div>
          <details>
            <summary>すべての選択肢の解説</summary>
            {q.options.map((o, i) => (
              <p key={i}>
                <strong>
                  {"ABCD"[i]} {i === q.answer ? "○" : "×"} {o.text}
                </strong>
                <br />
                {o.explanation}
              </p>
            ))}
            <p>
              関連知識：
              {relatedLabel ??
                q.conceptIds
                  .map((id) => concepts.find((c) => c.id === id)?.name)
                  .join("・")}
            </p>
            <p>
              根拠範囲：{sourceLabel} /
              本アプリの独自問題。公式試験問題ではありません。
            </p>
          </details>
          <button
            onClick={() => {
              setRetake(true);
              setChoice(null);
            }}
          >
            この問題を解き直す
          </button>
        </>
      )}
      <div className="quiz-nav">
        <button disabled={index === 0 || busy} onClick={() => move(index - 1)}>
          前の問題
        </button>
        <button
          disabled={index === items.length - 1 || busy}
          onClick={() => move(index + 1)}
        >
          次の問題
        </button>
      </div>
      <div className="question-dots" aria-label="問題を選ぶ">
        {items.map((q, i) => (
          <button
            className={i === index ? "active" : ""}
            aria-label={`問題${i + 1}`}
            aria-current={i === index ? "step" : undefined}
            key={q.id}
            onClick={() => move(i)}
          >
            {i + 1}
            {attempts.some(
              (a) => a.questionId === q.id && a.sessionId === sessionId,
            )
              ? " ✓"
              : ""}
          </button>
        ))}
      </div>
    </>
  );
}
