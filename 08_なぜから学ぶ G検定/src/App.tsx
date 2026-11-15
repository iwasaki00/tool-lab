import { useEffect, useRef, useState } from "react";
import type { Backup, LearningProgress, EvaluationProgress } from "./types";
import {
  course,
  lesson,
  scenes,
  prologueScene,
  questions,
  comparisons,
  syllabus,
} from "./data/content";
import {
  emptyBackup,
  beginEvaluation,
  completeEvaluation,
  grade,
  reviewFor,
  validateBackup,
  mergeBackups,
  hasLearningRecord,
  storyVisited,
  restartLesson,
  completeLesson,
  completionRecords,
} from "./engine/learning";
import { loadState, saveState } from "./engine/storage";
import {
  Supervised,
  Unsupervised,
  Reinforcement,
} from "./components/Simulations";
import { KnowledgeMap, Quiz } from "./components/Learning";
import { ShippingStory } from "./components/ShippingStory";
import { EpisodeScene, episodeTitles } from "./components/Episode";
import { ShippingTrial, ShippingPrologue } from "./components/ShippingPrologue";
import { shippingTrial } from "./data/shippingStory";
import { EvaluationEpisode } from "./components/EvaluationEpisode";
import { evaluationQuestions } from "./data/evaluation";
import { BeginnerGuide } from "./components/BeginnerGuide";
const nav = [
  ["⌂", "ホーム"],
  ["▤", "コース"],
  ["✎", "演習"],
  ["⌘", "知識マップ"],
  ["◷", "記録"],
];
export default function App() {
  const [snapshot, setSnapshot] = useState<Backup>(() => emptyBackup()),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState("記録を読み込み中"),
    [loadError, setLoadError] = useState(false),
    [tab, setTab] = useState(0),
    [inLesson, setInLesson] = useState(false),
    [guideOpen, setGuideOpen] = useState(false),
    [activeLesson, setActiveLesson] = useState<"L003" | "L004">("L003"),
    [origin, setOrigin] = useState(0),
    [online, setOnline] = useState(navigator.onLine),
    [offlineReady, setOfflineReady] = useState(false),
    [pending, setPending] = useState<Backup | null>(null),
    [mode, setMode] = useState("merge"),
    [importMessage, setImportMessage] = useState(""),
    [saving, setSaving] = useState(false);
  const guideReturn = useRef({
    scroll: 0,
    element: null as HTMLElement | null,
  });
  function openGuide(event?: { currentTarget: EventTarget | null }) {
    guideReturn.current = {
      scroll: window.scrollY,
      element:
        event?.currentTarget instanceof HTMLElement
          ? event.currentTarget
          : (document.activeElement as HTMLElement),
    };
    setGuideOpen(true);
  }
  function closeGuide() {
    setGuideOpen(false);
    requestAnimationFrame(() => {
      window.scrollTo({ top: guideReturn.current.scroll, behavior: "instant" });
      guideReturn.current.element?.focus({ preventScroll: true });
    });
  }
  function guideLesson(id: "L003" | "L004") {
    if (inLesson && activeLesson === id) {
      closeGuide();
      return;
    }
    setGuideOpen(false);
    if (id === "L003") enter();
    else enterEvaluation();
  }
  const ref = useRef(snapshot),
    queue = useRef(Promise.resolve()),
    writeId = useRef(0),
    heading = useRef<HTMLHeadingElement>(null);
  async function load() {
    setLoadError(false);
    try {
      const data = await loadState();
      ref.current = data;
      setSnapshot(data);
      setReady(true);
      setStatus("記録を読み込みました");
    } catch {
      setLoadError(true);
      setStatus("記録を読み込めません。保存を再試行してください。");
    }
  }
  useEffect(() => {
    void load();
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    let disposed = false;
    const check = async () => {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.active && "caches" in window) {
          const keys = await caches.keys();
          if (!disposed)
            setOfflineReady(keys.some((k) => k.startsWith("why-g-")));
        }
      }
    };
    void check();
    const t = setInterval(() => void check(), 3000);
    return () => {
      disposed = true;
      clearInterval(t);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  const totalAttempts =
    snapshot.attempts.length + (snapshot.evaluationAttempts?.length ?? 0);
  const p = snapshot.progress;
  const resumeEvaluation =
    !!snapshot.evaluation &&
    (!hasLearningRecord(snapshot) ||
      snapshot.evaluation.updatedAt > p.updatedAt);
  const episodeCount =
    Number(!!p.storySampleAdded) +
    Number(!!p.episode?.grouped) +
    Number(!!p.episode?.compared);
  const isPrologue = p.scene === 0 && p.introStage === "prologue";
  const pastCompletions = completionRecords(snapshot);
  useEffect(() => {
    if (inLesson && activeLesson === "L003") {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({
        top: isPrologue ? (p.prologueScroll ?? 0) : 0,
        behavior: "instant",
      });
    }
  }, [inLesson, activeLesson, p.scene, p.introStage, p.episode?.stage]);
  useEffect(() => {
    if (guideOpen || !inLesson || activeLesson !== "L003" || !isPrologue)
      return;
    let timer: ReturnType<typeof setTimeout>;
    const savePosition = () => {
      clearTimeout(timer);
      const position = window.scrollY;
      timer = setTimeout(
        () => updateProgress({ prologueScroll: position }),
        180,
      );
    };
    window.addEventListener("scroll", savePosition);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", savePosition);
    };
  }, [inLesson, activeLesson, isPrologue, guideOpen]);
  function commit(next: Backup) {
    if (!ready) return;
    ref.current = next;
    setSnapshot(next);
    setSaving(true);
    setStatus("保存中…");
    const id = ++writeId.current;
    queue.current = queue.current
      .catch(() => {})
      .then(() => saveState(next))
      .then(() => {
        if (id === writeId.current) {
          setStatus("端末に保存済み");
          setSaving(false);
        }
      })
      .catch(() => {
        if (id === writeId.current) {
          setStatus(
            "保存に失敗しました。再試行またはバックアップを保存してください。",
          );
          setSaving(false);
        }
      });
  }
  function updateProgress(change: Partial<LearningProgress>) {
    const current = ref.current;
    commit({
      ...current,
      ...(current.progress.completed
        ? { completions: completionRecords(current) }
        : {}),
      progress: {
        ...current.progress,
        ...change,
        updatedAt: new Date().toISOString(),
      },
    });
  }
  function enter(scene?: number) {
    setActiveLesson("L003");
    setOrigin(tab);
    const current = ref.current.progress;
    updateProgress({
      started: true,
      ...(!hasLearningRecord(ref.current)
        ? {
            episode: {
              stage: "sorting",
              grouped: false,
              compared: false,
              priority: "speed",
            } as const,
          }
        : {}),
      ...(scene === undefined
        ? {}
        : { scene, visited: [...new Set([...current.visited, scene])] }),
    });
    setInLesson(true);
  }
  function startOver() {
    setActiveLesson("L003");
    commit(restartLesson(ref.current));
    setOrigin(tab);
    setInLesson(true);
  }
  function enterEvaluation(restart = false) {
    commit(beginEvaluation(ref.current, restart));
    setOrigin(tab);
    setActiveLesson("L004");
    setInLesson(true);
  }
  function updateEvaluation(change: Partial<EvaluationProgress>) {
    const current = ref.current;
    if (!current.evaluation) return;
    commit({
      ...current,
      completions: completionRecords(current),
      evaluation: {
        ...current.evaluation,
        ...change,
        updatedAt: new Date().toISOString(),
      },
    });
  }
  function moveEvaluation(stage: EvaluationProgress["stage"]) {
    const e = ref.current.evaluation!;
    updateEvaluation({ stage, visited: [...new Set([...e.visited, stage])] });
  }
  function answerEvaluation(choice: number) {
    const current = ref.current,
      e = current.evaluation!;
    const a = grade(
      evaluationQuestions[e.questionIndex].id,
      choice,
      e.sessionId,
      evaluationQuestions,
    );
    commit({
      ...current,
      completions: completionRecords(current),
      evaluationAttempts: [...(current.evaluationAttempts ?? []), a],
      evaluation: { ...e, updatedAt: a.answeredAt },
    });
  }
  function finishEvaluation() {
    if (!ref.current.evaluation?.completed)
      commit(completeEvaluation(ref.current));
    setInLesson(false);
    setTab(origin);
  }
  function move(scene: number) {
    updateProgress({
      scene,
      visited: [...new Set([...ref.current.progress.visited, scene])],
    });
  }
  function answer(choice: number) {
    const current = ref.current,
      a = grade(
        questions[current.progress.questionIndex].id,
        choice,
        current.progress.sessionId,
      ),
      review = reviewFor(a);
    commit({
      ...current,
      attempts: [...current.attempts, a],
      reviews: [...current.reviews.filter((r) => r.id !== review.id), review],
      progress: { ...current.progress, updatedAt: a.answeredAt },
    });
  }
  function manualReviews() {
    const current = ref.current,
      now = new Date().toISOString();
    commit({
      ...current,
      reviews: questions.map((q) => ({
        id: `review-${q.id}`,
        questionId: q.id,
        dueAt: now,
        reason: "manual",
        updatedAt: now,
      })),
    });
  }
  function exportBackup() {
    const data = { ...ref.current, exportedAt: new Date().toISOString() },
      blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `why-learn-g-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function readBackup(file?: File) {
    setPending(null);
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024)
        throw Error("10MB以下のバックアップを指定してください");
      const next = validateBackup(JSON.parse(await file.text()));
      setPending(next);
      setImportMessage(
        `${next.attempts.length}件の回答履歴、場面${next.progress.scene + 1}を読み込みました。まだ適用していません。`,
      );
    } catch (e) {
      setImportMessage(
        e instanceof Error ? e.message : "読み込みに失敗しました",
      );
    }
  }
  function applyBackup() {
    if (!pending) return;
    try {
      const next =
        mode === "merge" ? mergeBackups(ref.current, pending) : pending;
      if (
        mode === "replace" &&
        !window.confirm(
          "現在の端末の記録を、このバックアップで置き換えますか？",
        )
      )
        return;
      commit(next);
      setPending(null);
      setImportMessage(
        "復元内容を適用しました。上部の保存状態を確認し、ホームから再開できます。",
      );
    } catch (e) {
      setImportMessage((e as Error).message);
    }
  }
  const sessionAttempts = snapshot.attempts.filter(
      (a) => a.sessionId === p.sessionId,
    ),
    answered = questions.filter((q) =>
      sessionAttempts.some((a) => a.questionId === q.id),
    ).length,
    correct = questions.filter(
      (q) =>
        sessionAttempts.filter((a) => a.questionId === q.id).at(-1)?.correct,
    ).length;
  const due = snapshot.reviews.filter((r) => Date.parse(r.dueAt) <= Date.now());
  const startQuiz = () => {
    setActiveLesson("L003");
    const current = ref.current;
    commit({
      ...current,
      completions: completionRecords(current),
      progress: {
        ...current.progress,
        scene: 7,
        questionIndex: 0,
        sessionId: crypto.randomUUID(),
        completed: false,
        visited: [...new Set([...current.progress.visited, 7])],
        updatedAt: new Date().toISOString(),
      },
    });
    setOrigin(tab);
    setInLesson(true);
  };
  function comparison() {
    return (
      <>
        <table className="comparison-table">
          <caption className="sr-only">3方式の比較</caption>
          <thead>
            <tr>
              <th scope="col">比べる観点</th>
              {comparisons.map((c) => (
                <th scope="col" key={c.name}>
                  <h3>{c.name}</h3>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["必要なデータ", "data"],
                ["正解ラベル", "label"],
                ["仕組み", "mechanism"],
                ["代表的な用途", "use"],
                ["使い分けの決め手", "key"],
              ] as const
            ).map(([name, key]) => (
              <tr key={key}>
                <th scope="row">{name}</th>
                {comparisons.map((c) => (
                  <td key={c.name}>{c[key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="comparison comparison-cards">
          {comparisons.map((c, i) => (
            <article className="mini-card" key={c.name}>
              <span className="eyebrow">0{i + 1}</span>
              <h3>{c.name}</h3>
              <dl>
                <dt>必要なデータ</dt>
                <dd>{c.data}</dd>
                <dt>正解ラベル</dt>
                <dd>{c.label}</dd>
                <dt>仕組み</dt>
                <dd>{c.mechanism}</dd>
                <dt>用途</dt>
                <dd>{c.use}</dd>
                <dt>判断の決め手</dt>
                <dd>{c.key}</dd>
              </dl>
            </article>
          ))}
        </div>
      </>
    );
  }
  const sceneBody = () => {
    switch (p.scene) {
      case 0:
        if (p.episode && p.episode.stage !== "sorting")
          return (
            <EpisodeScene
              progress={p}
              speed={snapshot.settings.speed}
              onChange={(episode) => updateProgress({ episode })}
              onFinish={() => {
                if (!ref.current.progress.completed)
                  commit(completeLesson(ref.current));
                setInLesson(false);
                setTab(origin);
              }}
              onQuiz={() => move(7)}
              onReference={move}
              onNext={() => enterEvaluation()}
            />
          );
        if (isPrologue)
          return (
            <ShippingPrologue
              onContinue={() => updateProgress({ introStage: "ai-trial" })}
            />
          );
        if (p.introStage === "ai-trial")
          return (
            <ShippingTrial
              onContinue={() => updateProgress({ introStage: "sorting" })}
            />
          );
        return (
          <ShippingStory
            sampleAdded={!!p.storySampleAdded}
            onAdd={() => updateProgress({ storySampleAdded: true })}
            onContinue={() =>
              p.episode
                ? updateProgress({
                    episode: { ...p.episode, stage: "records" },
                  })
                : move(1)
            }
            continueLabel={p.episode ? "搬送の様子を見る" : undefined}
            details={
              p.episode ? (
                <details className="episode-details">
                  <summary>仕組みを詳しく見る</summary>
                  <Supervised withShippingSample />
                  <button onClick={() => move(1)}>詳しい分類教材へ</button>
                </details>
              ) : undefined
            }
          />
        );
      case 1:
        return <Supervised withShippingSample={!!p.storySampleAdded} />;
      case 2:
        return <Unsupervised speed={snapshot.settings.speed} />;
      case 3:
        return <Reinforcement speed={snapshot.settings.speed} />;
      case 4:
        return (
          <>
            {comparison()}
            <p className="notice">
              分類・回帰は教師あり学習の代表的な課題。クラスタリングは教師なし学習の代表例です。すべての学習がこの3つだけに収まるわけではありません。
            </p>
          </>
        );
      case 5:
        return (
          <>
            <p>
              製品の外観データが届きました。目的と検査結果の有無を切り替えて、方法を選んでください。
            </p>
            <label className="option">
              <input
                type="checkbox"
                checked={p.challengeLabelled}
                onChange={(e) =>
                  updateProgress({
                    challengeLabelled: e.target.checked,
                    challenge: null,
                  })
                }
              />
              検査結果あり・新しい製品の不良を予測したい
            </label>
            <div className="notice">
              {p.challengeLabelled
                ? "正解つきの過去データから、良品／不良を判定する。"
                : "正解ラベルなしで、似た外観の製品のまとまりを探したい。"}
            </div>
            <div className="controls">
              {comparisons.map((c, i) => (
                <button
                  className={p.challenge === i ? "active" : ""}
                  key={i}
                  onClick={() => updateProgress({ challenge: i })}
                >
                  {c.name}
                </button>
              ))}
            </div>
            {p.challenge !== null && (
              <div className="feedback" role="status">
                {p.challenge === (p.challengeLabelled ? 0 : 1)
                  ? "その判断で考えられます。"
                  : "手がかりをもう一度確認しましょう。"}{" "}
                {p.challengeLabelled
                  ? "正解の検査結果を使って、新しい入力のカテゴリを予測するので教師あり分類が候補です。"
                  : "正解を予測するのではなく、特徴のまとまりを発見するので教師なし学習が候補です。"}
                <p>
                  配送ロボットの行動を報酬から改善するなら、強化学習が候補です。
                </p>
              </div>
            )}
          </>
        );
      case 6:
        return (
          <>
            <KnowledgeMap />
            <div className="optional-exam">
              <p>
                ここまでの体験を、試験形式でも確かめられます。演習はあとからでも取り組めます。
              </p>
              <button onClick={() => move(7)}>試験問題で確認する</button>
            </div>
          </>
        );
      case 7:
        return (
          <Quiz
            key={p.sessionId}
            index={p.questionIndex}
            attempts={snapshot.attempts}
            sessionId={p.sessionId}
            onAnswer={answer}
            onIndex={(questionIndex) => updateProgress({ questionIndex })}
            busy={saving}
          />
        );
      case 8:
        return (
          <>
            <div className="summary-score">
              {answered === 0 ? (
                <p>
                  ここまで、物語と体験をふり返りました。試験問題はあとからでも取り組めます。
                </p>
              ) : (
                <>
                  <strong>
                    {correct}
                    <span> / {answered}</span>
                  </strong>
                  <p>今回の正解数 / 回答済み問題数（全12問）</p>
                </>
              )}
            </div>
            {comparison()}
            <p>
              正答率だけでは習得の完了は判断できません。「どんな手がかりを使うか」を自分の言葉で説明し、未知の事例でも使い分けてみましょう。
            </p>
            <div className="controls">
              <button onClick={manualReviews}>12問を復習候補に登録</button>
              <button onClick={() => move(7)}>試験問題で確認する</button>
            </div>
            <div className="evaluation-entry">
              <h3>第2話：モデル評価</h3>
              <button onClick={() => enterEvaluation()}>第2話を開く</button>
            </div>
            {p.completed ? (
              <p className="notice">
                このレッスンを最後まで学習した記録があります。習得を保証する評価ではありません。
              </p>
            ) : (
              <>
                <button
                  className="primary"
                  disabled={!storyVisited(p)}
                  onClick={() => commit(completeLesson(ref.current))}
                >
                  レッスンを最後まで学習したと記録
                </button>
                {!storyVisited(p) && (
                  <p className="muted">
                    演習以外の8場面を閲覧すると記録できます。問題への回答は任意です。
                  </p>
                )}
              </>
            )}
          </>
        );
      default:
        return null;
    }
  };
  return (
    <div className={inLesson || guideOpen ? "app learning" : "app"}>
      {!inLesson && !guideOpen && (
        <aside className="sidebar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setTab(0);
            }}
          >
            <span className="brand-mark">
              w<span>?</span>
            </span>
            <strong>
              WHY LEARN G<small>なぜから学ぶ G検定</small>
            </strong>
          </a>
          <p className="sidebar-label">LEARNING SPACE</p>
          <nav aria-label="メインナビゲーション">
            {nav.map(([icon, name], i) => (
              <button
                aria-current={tab === i ? "page" : undefined}
                className={tab === i ? "active" : ""}
                key={name}
                onClick={() => setTab(i)}
              >
                <span aria-hidden="true">{icon}</span>
                {name}
              </button>
            ))}
          </nav>
          <div className="sidebar-foot">
            <span className="tag">BEGINNER GUIDE</span>
            <p>
              小さな「なぜ」が、
              <br />
              理解のはじまり。
            </p>
            <small>v0.1.6 · この端末に保存</small>
          </div>
        </aside>
      )}
      <main>
        <header className="topbar">
          {guideOpen ? (
            <button onClick={closeGuide}>← 第0章を閉じて戻る</button>
          ) : inLesson ? (
            <button
              onClick={() => {
                setInLesson(false);
                setTab(origin);
              }}
            >
              ← 戻る・途中終了
            </button>
          ) : (
            <span>
              なぜから学ぶ G検定 <small>/ 学びの研究所</small>
            </span>
          )}
          <span className="connection">
            <i className={online ? "" : "offline"} />
            {online ? "オンライン" : "オフライン"}
          </span>
        </header>
        <div className="savebar">
          <span role="status">{status}</span>
          {status.includes("失敗") && (
            <button onClick={() => commit(ref.current)}>保存を再試行</button>
          )}
          <span>
            {offlineReady
              ? "オフライン教材：準備済み"
              : "オフライン教材：初回取得中（本番ビルド時）"}
          </span>
        </div>
        {guideOpen && <BeginnerGuide onLesson={guideLesson} />}
        <div hidden={guideOpen}>
          {!ready ? (
            <section className="card">
              <h1>{loadError ? "記録を確認できません" : "学びの準備中…"}</h1>
              {loadError && (
                <button onClick={() => void load()}>読み込みを再試行</button>
              )}
            </section>
          ) : inLesson && activeLesson === "L004" && snapshot.evaluation ? (
            <EvaluationEpisode
              progress={snapshot.evaluation}
              attempts={snapshot.evaluationAttempts ?? []}
              onMove={moveEvaluation}
              onIndex={(questionIndex) => updateEvaluation({ questionIndex })}
              onAnswer={answerEvaluation}
              onFinish={finishEvaluation}
              busy={saving}
              onGuide={openGuide}
            />
          ) : inLesson ? (
            <div
              className={`lesson-wrap ${p.scene === 0 ? "story-intro" : ""}`}
            >
              <button className="guide-link" onClick={openGuide}>
                第0章で用語を確認
              </button>
              {p.scene !== 0 && p.episode && (
                <button className="episode-return" onClick={() => move(0)}>
                  出荷の物語に戻る
                </button>
              )}
              {p.scene !== 0 && (
                <div className="lesson-meta">
                  <span className="eyebrow">
                    LESSON 003 / {scenes[p.scene].eyebrow}
                  </span>
                  <label>
                    再生速度
                    <select
                      value={snapshot.settings.speed}
                      onChange={(e) =>
                        commit({
                          ...ref.current,
                          settings: { id: "settings", speed: +e.target.value },
                        })
                      }
                    >
                      <option value="0.5">0.5倍</option>
                      <option value="1">1倍</option>
                      <option value="2">2倍</option>
                    </select>
                  </label>
                </div>
              )}
              {p.scene !== 0 && (
                <div className="scene-progress" aria-label="レッスンの場面">
                  {scenes.map((s, i) => (
                    <button
                      aria-label={`場面${i + 1} ${s.title}`}
                      aria-current={p.scene === i ? "step" : undefined}
                      className={
                        p.scene === i
                          ? "active"
                          : p.visited.includes(i)
                            ? "visited"
                            : ""
                      }
                      key={s.id}
                      onClick={() => move(i)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
              <h1 ref={heading} tabIndex={-1}>
                {isPrologue
                  ? prologueScene.prompt
                  : p.scene === 0 && p.introStage === "ai-trial"
                    ? shippingTrial.title
                    : p.scene === 0 &&
                        p.episode &&
                        p.episode.stage !== "sorting"
                      ? episodeTitles[p.episode.stage]
                      : scenes[p.scene].prompt}
              </h1>
              <section className="card scene-body">{sceneBody()}</section>
              {p.scene !== 0 && (
                <footer className="lesson-footer">
                  <button
                    disabled={p.scene === 0}
                    onClick={() =>
                      move(
                        p.scene === 8 && !p.visited.includes(7)
                          ? 6
                          : p.scene - 1,
                      )
                    }
                  >
                    ← 前へ
                  </button>
                  <span>
                    {String(p.scene + 1).padStart(2, "0")} / 09 ·{" "}
                    {scenes[p.scene].title}
                  </span>
                  {p.scene < 8 ? (
                    <button
                      className="primary"
                      onClick={() => move(p.scene === 6 ? 8 : p.scene + 1)}
                    >
                      {p.scene === 6 ? "まとめへ →" : "次へ →"}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setInLesson(false);
                        setTab(origin);
                      }}
                    >
                      学習を閉じる
                    </button>
                  )}
                </footer>
              )}
            </div>
          ) : (
            <div className="content">
              <div className="page-heading">
                <span className="eyebrow">
                  {
                    [
                      "YOUR LEARNING JOURNEY",
                      "COURSE LIBRARY",
                      "PRACTICE ROOM",
                      "KNOWLEDGE CONNECTIONS",
                      "LEARNING RECORD",
                    ][tab]
                  }
                </span>
                <h1>
                  {
                    [
                      "「なぜ？」から、はじめよう。",
                      "コースを探す",
                      "理由から考える演習",
                      "理解を、つなげよう。",
                      "学びの足あと",
                    ][tab]
                  }
                </h1>
                <p>
                  {
                    [
                      "操作して、気づいて、自分の言葉に。今日も理解をひとつずつ。",
                      "まずは機械学習の3つの学び方を体験しましょう。",
                      "答えを選んだら、判断の決め手を確認しましょう。",
                      "用語を覚える、その先へ。概念どうしの関係をたどる。",
                      "このブラウザに保存した記録と、次の復習候補を確認できます。",
                    ][tab]
                  }
                </p>
              </div>
              {tab === 0 && (
                <>
                  <section className="hero">
                    <div>
                      <span className="hero-label">
                        BEGINNER GUIDE <span>第0章から</span>
                      </span>
                      <p className="lesson-number">
                        {resumeEvaluation
                          ? "再開する教材：第2話 · モデル評価"
                          : hasLearningRecord(snapshot)
                            ? "再開する教材：第1話 · AIの3つの学び方"
                            : "AIの入り口 · 2つの工場体験"}
                      </p>
                      <h2>
                        まずは、
                        <br />
                        AIの全体像から。
                      </h2>
                      <p>
                        G検定って何を学ぶ試験？
                        AI・機械学習・ディープラーニングの違いから見てみましょう
                      </p>
                      <div className="hero-bottom">
                        <button
                          className="cream"
                          onClick={(event) => {
                            if (resumeEvaluation) enterEvaluation();
                            else if (hasLearningRecord(snapshot)) enter();
                            else openGuide(event);
                          }}
                        >
                          {hasLearningRecord(snapshot) || snapshot.evaluation
                            ? "続きから学ぶ"
                            : "3分で全体像を見る"}{" "}
                          <span>↗</span>
                        </button>
                        <span>全体像 → 気になるところ → 工場で体験</span>
                        <button className="hero-revisit" onClick={openGuide}>
                          第0章を見る
                        </button>
                        {(hasLearningRecord(snapshot) ||
                          snapshot.evaluation) && (
                          <button
                            className="hero-revisit"
                            onClick={() =>
                              resumeEvaluation
                                ? enterEvaluation(true)
                                : startOver()
                            }
                          >
                            最初から学ぶ
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="hero-art guide-home-art" aria-hidden="true">
                      <img
                        src={`${import.meta.env.BASE_URL}illustrations/ml-inspected-samples.png`}
                        alt=""
                        width="1536"
                        height="1024"
                      />
                    </div>
                  </section>
                  <div className="stats-row">
                    <article>
                      <span>
                        {p.episode ? "体験した学び方" : "学習の進み具合"}
                      </span>
                      <strong>
                        {p.episode ? episodeCount : p.visited.length}
                        <small>{p.episode ? " / 3 方式" : " / 9 場面"}</small>
                      </strong>
                      <progress
                        value={p.episode ? episodeCount : p.visited.length}
                        max={p.episode ? 3 : 9}
                      />
                    </article>
                    <article>
                      <span>問題に向き合った回数</span>
                      <strong>
                        {totalAttempts}
                        <small> 回</small>
                      </strong>
                      <p>解き直しも履歴に残ります</p>
                    </article>
                    <article>
                      <span>今日までの復習候補</span>
                      <strong>
                        {due.length}
                        <small> 問</small>
                      </strong>
                      <button className="text-button" onClick={() => setTab(4)}>
                        記録を見る ↗
                      </button>
                    </article>
                  </div>
                  <div className="section-heading">
                    <h2>今日の学び方</h2>
                    <span className="muted">小さく試して、深く理解する</span>
                  </div>
                  <div className="three-col">
                    {[
                      [
                        "01",
                        "体験する",
                        "出荷現場の物語から、AIの学び方にふれる。",
                        0,
                      ],
                      [
                        "02",
                        "つなげる",
                        "知識マップで、概念の関係をたどる。",
                        6,
                      ],
                      [
                        "03",
                        "確かめる",
                        "事例を読み、使い分けの理由を考える。",
                        7,
                      ],
                    ].map(([n, title, desc, scene]) => (
                      <button
                        className="activity"
                        key={n}
                        onClick={() => enter(+scene)}
                      >
                        <span className="activity-number">{n}</span>
                        <h3>
                          {title}
                          <span>↗</span>
                        </h3>
                        <p>{desc}</p>
                      </button>
                    ))}
                  </div>
                  <div className="note-strip">
                    <span>✦</span>
                    <p>
                      <strong>暗記の前に、ひとつの疑問を。</strong>
                      <br />
                      「この方法は、何を手がかりに学ぶんだろう？」
                    </p>
                    <span className="eyebrow">THINK FIRST</span>
                  </div>
                </>
              )}
              {tab === 1 && (
                <>
                  <section className="card">
                    <span className="tag">推奨の入口 · 第0章</span>
                    <h2>G検定とAIの全体像</h2>
                    <p>
                      概要を知り、気になる項目を深掘りしてから、工場で体験します。第0章を読まなくても各話を始められます。
                    </p>
                    <button onClick={openGuide}>第0章を見る</button>
                  </section>
                  <section className="card">
                    <span className="tag">公開中 · 2レッスン</span>
                    <h2>{course.title}</h2>
                    <h3>L003 {lesson.title}</h3>
                    <p>教師あり学習 / 教師なし学習 / 強化学習</p>
                    <p>
                      {p.completed
                        ? "最後まで学習した記録あり"
                        : p.episode && p.scene === 0
                          ? `再開位置：${p.episode.stage === "sorting" ? (isPrologue ? "プロローグ" : p.introStage === "ai-trial" ? "AIを試す" : "箱の仕分け") : episodeTitles[p.episode.stage]}`
                          : `再開位置：場面 ${p.scene + 1} ${scenes[p.scene].title}`}
                    </p>
                    <button className="primary" onClick={() => enter()}>
                      レッスンを開く →
                    </button>
                  </section>
                  <section
                    className="card evaluation-course"
                    data-lesson="L004"
                  >
                    <span className="tag">第2話 · L004 モデル評価</span>
                    <h2>正解率99％なのに、不良品を見逃した</h2>
                    <p>
                      同じ100箱を2つの設定で確かめ、何を間違えたかを見比べます。第1話を読んでいなくても始められます。
                    </p>
                    <p>
                      {snapshot.evaluation?.completed
                        ? "最後まで学習した記録あり"
                        : snapshot.evaluation
                          ? "途中の場面から再開できます。"
                          : "演習は最後に選べます。"}
                    </p>
                    <div className="controls">
                      <button
                        className="primary"
                        onClick={() => enterEvaluation()}
                      >
                        {snapshot.evaluation ? "続きから学ぶ" : "第2話を始める"}
                      </button>
                      {snapshot.evaluation && (
                        <button onClick={() => enterEvaluation(true)}>
                          最初から学ぶ
                        </button>
                      )}
                    </div>
                  </section>
                  <section className="card">
                    <h3>これからの教材</h3>
                    <p>
                      ニューラルネットワーク <span className="tag">準備中</span>
                    </p>
                  </section>
                </>
              )}
              {tab === 2 && (
                <section className="card">
                  <span className="tag">L003 / オリジナル12問</span>
                  <h2>学習方式を使い分けよう</h2>
                  <p>
                    理由理解・比較判断・事例応用の12問。各選択肢に解説を用意しました。新しい演習を始めても過去の回答履歴は残ります。
                  </p>
                  <div className="controls">
                    <button className="primary" onClick={startQuiz}>
                      新しい演習を始める
                    </button>
                    <button onClick={() => enter(7)}>現在の演習を続ける</button>
                  </div>
                  <p>
                    今回の回答：{answered} / 12問 · 正解 {correct}問
                  </p>
                </section>
              )}
              {tab === 3 && (
                <section className="card">
                  <KnowledgeMap />
                </section>
              )}
              {tab === 4 && (
                <>
                  <div className="stats-row">
                    <article>
                      <span>全回答履歴</span>
                      <strong>
                        {totalAttempts}
                        <small>件</small>
                      </strong>
                    </article>
                    <article>
                      <span>復習候補</span>
                      <strong>
                        {snapshot.reviews.length}
                        <small>問</small>
                      </strong>
                    </article>
                    <article>
                      <span>L003の記録</span>
                      <strong className="status-label">
                        {p.completed ? "最後まで学習" : "学習中"}
                      </strong>
                    </article>
                  </div>
                  <section className="card completion-history">
                    <h2>これまでの完了記録</h2>
                    {pastCompletions.length ? (
                      <ul>
                        {pastCompletions.map((c) => (
                          <li key={c.id}>
                            {c.lessonId} 完了 ·{" "}
                            {new Date(c.recordedAt).toLocaleString("ja-JP")}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>完了した記録はまだありません。</p>
                    )}
                  </section>
                  <section className="card">
                    <h2>復習の候補</h2>
                    <p className="muted">
                      正解は3日後、不正解は翌日を候補日にします。習得を判定する仕組みではありません。
                    </p>
                    {snapshot.reviews.length === 0 ? (
                      <p>問題に回答すると、ここに候補が表示されます。</p>
                    ) : (
                      <ul className="record-list">
                        {snapshot.reviews.map((r) => (
                          <li key={r.id}>
                            <div>
                              <strong>{r.questionId}</strong>
                              <small>
                                {r.reason === "manual"
                                  ? "自分で登録"
                                  : r.reason === "correct"
                                    ? "正解からの振り返り"
                                    : "もう一度確かめたい問題"}{" "}
                                ·{" "}
                                {new Date(r.dueAt).toLocaleDateString("ja-JP")}
                              </small>
                            </div>
                            <button
                              onClick={() => {
                                updateProgress({
                                  questionIndex: questions.findIndex(
                                    (q) => q.id === r.questionId,
                                  ),
                                });
                                enter(7);
                              }}
                            >
                              問題を見る
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <section className="card evaluation-history">
                    <h2>L004の記録</h2>
                    <p>
                      {snapshot.evaluation?.completed
                        ? "最後まで学習"
                        : snapshot.evaluation
                          ? "学習中"
                          : "未開始"}{" "}
                      · 回答履歴 {(snapshot.evaluationAttempts ?? []).length}件
                    </p>
                    <ul>
                      {[...(snapshot.evaluationAttempts ?? [])]
                        .reverse()
                        .map((a) => (
                          <li key={a.id}>
                            {a.questionId} v{a.version} · {"ABCD"[a.selected]} ·{" "}
                            {a.correct ? "正解" : "不正解"} ·{" "}
                            {new Date(a.answeredAt).toLocaleString("ja-JP")}
                          </li>
                        ))}
                    </ul>
                  </section>
                  <section className="card">
                    <h2>バックアップ</h2>
                    <p>
                      記録はこのブラウザ内に保存されます。ブラウザのデータ消去などで失われることがあるため、定期的にJSONを保存してください。
                    </p>
                    <button onClick={exportBackup}>JSONをエクスポート</button>
                    <label>
                      JSONから復元
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={(e) => void readBackup(e.target.files?.[0])}
                      />
                    </label>
                    <p role="status">{importMessage}</p>
                    {pending && (
                      <div className="notice">
                        <label>
                          復元方法
                          <select
                            value={mode}
                            onChange={(e) => setMode(e.target.value)}
                          >
                            <option value="merge">
                              統合（履歴IDで重複を除く）
                            </option>
                            <option value="replace">
                              置換（確認後に上書き）
                            </option>
                          </select>
                        </label>
                        <button disabled={saving} onClick={applyBackup}>
                          この内容を復元
                        </button>
                        <button onClick={() => setPending(null)}>
                          キャンセル
                        </button>
                      </div>
                    )}
                  </section>
                  <details className="card">
                    <summary>
                      L003の回答履歴（{snapshot.attempts.length}件）
                    </summary>
                    <ul className="history">
                      {[...snapshot.attempts].reverse().map((a) => (
                        <li key={a.id}>
                          {a.questionId} v{a.version} · {"ABCD"[a.selected]} ·{" "}
                          {a.correct ? "正解" : "不正解"} ·{" "}
                          {new Date(a.answeredAt).toLocaleString("ja-JP")}
                        </li>
                      ))}
                    </ul>
                  </details>
                </>
              )}
              <footer className="page-footer">
                <span>WHY LEARN G · v0.1.6</span>
                <details>
                  <summary>教材の参照情報</summary>
                  <p>
                    JDLA公式シラバスの機械学習の概要を参照。
                    {syllabus[0].checkedAt}
                    確認。本アプリは独自教材で、JDLA公式教材ではありません。
                  </p>
                  <a href={syllabus[0].source} target="_blank" rel="noreferrer">
                    JDLA公式シラバス ↗（オンライン）
                  </a>
                </details>
              </footer>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
