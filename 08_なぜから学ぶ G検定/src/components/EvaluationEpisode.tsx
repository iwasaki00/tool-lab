import { useEffect, useRef } from "react";
import type { EvaluationProgress, QuestionAttempt } from "../types";
import {
  evaluationTitles,
  evaluationQuestions,
  sortingA,
  sortingB,
} from "../data/evaluation";
import type { InspectionRecord } from "../data/evaluation";
import { summarizeInspection, percent } from "../engine/evaluation";
import { ShippingIllustration } from "./ShippingIllustration";
import { Quiz } from "./Learning";
function Inspector({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="inspector-line">
      <span>検査員</span>
      <p>「{children}」</p>
    </blockquote>
  );
}
function Batch({
  records,
  name,
}: {
  records: InspectionRecord[];
  name: string;
}) {
  const s = summarizeInspection(records);
  return (
    <section className="evaluation-batch">
      <h3>仕分け{name}</h3>
      <div
        className="evaluation-box-grid"
        role="img"
        aria-label={`${name}の${s.total}箱。一致${s.matched}箱、見逃し${s.falseNegative}箱、止めすぎ${s.falsePositive}箱。`}
      >
        {records.map((r) => {
          const kind =
            r.actual === r.predicted
              ? "matched"
              : r.actual === "不良"
                ? "missed"
                : "overstopped";
          return (
            <span
              key={r.id}
              aria-hidden="true"
              className={kind}
              title={`${r.id} 人：${r.actual}／AI：${r.predicted}`}
            >
              {kind === "missed" ? "!" : kind === "overstopped" ? "Ⅱ" : "○"}
            </span>
          );
        })}
      </div>
    </section>
  );
}
function Matrix({
  name,
  records,
}: {
  name: string;
  records: InspectionRecord[];
}) {
  const s = summarizeInspection(records);
  return (
    <table className="evaluation-matrix">
      <caption>仕分け{name}の混同行列</caption>
      <thead>
        <tr>
          <th scope="col">人の検査結果</th>
          <th scope="col">
            AI：良品
            <br />
            通す
          </th>
          <th scope="col">
            AI：不良
            <br />
            止める
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">良品</th>
          <td>{s.trueNegative}箱</td>
          <td>{s.falsePositive}箱</td>
        </tr>
        <tr>
          <th scope="row">不良</th>
          <td>{s.falseNegative}箱</td>
          <td>{s.truePositive}箱</td>
        </tr>
      </tbody>
    </table>
  );
}
export function EvaluationEpisode({
  progress,
  attempts,
  onMove,
  onIndex,
  onAnswer,
  onFinish,
  busy,
  onGuide,
}: {
  progress: EvaluationProgress;
  attempts: QuestionAttempt[];
  onMove: (stage: EvaluationProgress["stage"]) => void;
  onIndex: (index: number) => void;
  onAnswer: (choice: number) => void;
  onFinish: () => void;
  busy: boolean;
  onGuide: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null),
    a = summarizeInspection(sortingA),
    b = summarizeInspection(sortingB);
  const p = progress,
    missed = sortingA.find(
      (r) => r.actual === "不良" && r.predicted === "良品",
    )!;
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [p.stage]);
  const title =
    p.stage === "discovery"
      ? `${percent(a.accuracy)}正解。でも、通してはいけない箱が通った。`
      : evaluationTitles[p.stage];
  return (
    <div
      className="lesson-wrap story-intro evaluation-lesson"
      data-lesson="L004"
    >
      <button className="guide-link" onClick={onGuide}>
        第0章で用語を確認
      </button>
      <p className="eyebrow">第2話 · L004 モデル評価</p>
      <h1 ref={heading} tabIndex={-1}>
        {title}
      </h1>
      <section className="card scene-body">
        {p.stage === "intro" && (
          <>
            <ShippingIllustration
              mode="evaluation"
              evaluationState="intro"
              evaluationRecords={sortingA}
            />
            <p>
              この工場では、AIで良品と不良品を仕分けています。仕分けを任せる前に、見本に使っていない別の箱で確かめましょう。
            </p>
            <Inspector>
              昨日は、見本を足したらあの箱の判定が変わったね。でも、ほかの箱もうまく分けられるかな。今日は、AIにまだ見せていない
              {a.total}箱で試してみよう
            </Inspector>
            <p className="evaluation-note">
              {a.total}
              箱は、人が事前に検査済みです。その結果は学習用の見本には加えず、試運転後にAIの判定と照らし合わせます。
            </p>
            <button
              className="primary story-action"
              onClick={() => onMove("discovery")}
            >
              {a.total}箱を流す
            </button>
          </>
        )}
        {p.stage === "discovery" && (
          <>
            <div className="evaluation-headline">
              <strong>
                {a.total}箱中{a.matched}箱
              </strong>
              <span>で判定が一致 · {percent(a.accuracy)}</span>
            </div>
            <ShippingIllustration
              mode="evaluation"
              evaluationState="result"
              evaluationRecords={sortingA}
            />
            <div className="evaluation-verdicts">
              <strong>{missed.id} · 見逃し</strong>
              <span>人の検査結果：{missed.actual}</span>
              <span>AIの判定：{missed.predicted}として通した</span>
            </div>
            <Inspector>
              {a.matched}箱も合っていた。でも、止めたかった{a.falseNegative}
              箱を通してしまったんだ
            </Inspector>
            <p>
              一致した箱の多さだけでは、何を間違えたかまでは分かりません。別の設定でも、同じ箱を確かめてみます。
            </p>
            <button
              className="primary story-action"
              onClick={() => onMove("comparison")}
            >
              別の仕分け設定で試す
            </button>
          </>
        )}
        {p.stage === "comparison" && (
          <>
            <ShippingIllustration
              mode="evaluation"
              evaluationState="result"
              evaluationRecords={sortingB}
            />
            <p>
              同じ{a.total}箱を設定Bで試しました。人の検査結果は、良品
              {a.actualGood}箱・不良品{a.actualDefects}箱です。
            </p>
            <table className="evaluation-comparison">
              <caption>同じ箱で、AとBを見比べる</caption>
              <thead>
                <tr>
                  <th scope="col">見るところ</th>
                  <th scope="col">仕分けA</th>
                  <th scope="col">仕分けB</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">全体で判定が合った</th>
                  <td>
                    {a.matched}箱<br />
                    {percent(a.accuracy)}
                  </td>
                  <td>
                    {b.matched}箱<br />
                    {percent(b.accuracy)}
                  </td>
                </tr>
                <tr>
                  <th scope="row">不良品の見逃し</th>
                  <td>{a.falseNegative}箱</td>
                  <td>{b.falseNegative}箱</td>
                </tr>
                <tr>
                  <th scope="row">良品の止めすぎ</th>
                  <td>{a.falsePositive}箱</td>
                  <td>{b.falsePositive}箱</td>
                </tr>
              </tbody>
            </table>
            <div className="evaluation-batches">
              <Batch records={sortingA} name="A" />
              <Batch records={sortingB} name="B" />
            </div>
            <p className="evaluation-legend">
              ○ 一致 ／ ! 不良品の見逃し ／ Ⅱ 良品の止めすぎ
              <br />
              小さな四角1つが1箱です。
            </p>
            <Inspector>
              Bでは、不良品{b.truePositive}箱を止められた。その一方で、良品
              {b.falsePositive}箱も止めているね
            </Inspector>
            <button
              className="primary story-action"
              onClick={() => onMove("ending")}
            >
              見るべき数字を振り返る
            </button>
          </>
        )}
        {p.stage === "ending" && (
          <>
            <ShippingIllustration
              mode="evaluation"
              evaluationState="ending"
              evaluationRecords={sortingB}
            />
            <Inspector>
              この工場では、不良品の見逃しを減らしたい。試運転ではBを候補にしよう。止まった良品
              {b.falsePositive}箱は、私がもう一度確かめるよ
            </Inspector>
            <div className="episode-result">
              <p>
                全体の正解率はAのほうが高かった。でも、不良品を見逃さなかったのはB。何を避けたいかで、見るべき数字が変わります。
              </p>
            </div>
            <p>
              Bが常に優れているわけではありません。この{a.total}
              箱の結果だけで、本番の安全が保証されるわけでもありません。
            </p>
            <section className="evaluation-terms">
              <h2>試験での呼び方</h2>
              <article>
                <h3>正解率</h3>
                <p>全体のうち、判定が合った割合。</p>
                <p>
                  A：{a.matched}/{a.total}＝{percent(a.accuracy)}
                  <br />
                  B：{b.matched}/{b.total}＝{percent(b.accuracy)}
                </p>
              </article>
              <article>
                <h3>再現率</h3>
                <p>
                  実際の不良品のうち、不良として止められた割合。この話では「不良品」を見つけたい対象にしています。
                </p>
                <p>
                  A：{a.truePositive}/{a.actualDefects}＝{percent(a.recall)}
                  <br />
                  B：{b.truePositive}/{b.actualDefects}＝{percent(b.recall)}
                </p>
              </article>
            </section>
            <details className="episode-details">
              <summary>詳しく見る：混同行列</summary>
              <p>
                人の検査結果とAIの判定を組み合わせ、件数を4つに整理した表です。どの間違いがあったかを確かめられます。
              </p>
              <Matrix name="A" records={sortingA} />
              <Matrix name="B" records={sortingB} />
              <p>
                固定された教材の判定データを比較しています。ここでAIを再学習させているわけではありません。
              </p>
            </details>
            <p>
              演習は任意です。今日はここで終えても、最後まで学習した記録が残ります。
            </p>
            <div className="episode-end-actions">
              <button onClick={() => onMove("quiz")}>試験問題で確認する</button>
              <button className="primary" onClick={onFinish}>
                ここで終える
              </button>
            </div>
            {p.completed && (
              <p className="notice">L004を最後まで学習した記録があります。</p>
            )}
          </>
        )}
        {p.stage === "quiz" && (
          <>
            <p>第2話の場面を思い出して、理由を確かめるオリジナル3問です。</p>
            <Quiz
              key={p.sessionId}
              index={p.questionIndex}
              attempts={attempts}
              sessionId={p.sessionId}
              onAnswer={onAnswer}
              onIndex={onIndex}
              busy={busy}
              items={evaluationQuestions}
              relatedLabel="モデル評価・正解率・再現率"
              sourceLabel="本アプリ第2話「モデル評価」"
            />
            <button className="story-action" onClick={() => onMove("ending")}>
              物語の結末に戻る
            </button>
          </>
        )}
      </section>
      {p.stage !== "intro" && (
        <button
          className="evaluation-back"
          onClick={() =>
            onMove(
              p.stage === "quiz"
                ? "ending"
                : p.stage === "ending"
                  ? "comparison"
                  : p.stage === "comparison"
                    ? "discovery"
                    : "intro",
            )
          }
        >
          ← 前の場面へ
        </button>
      )}
    </div>
  );
}
