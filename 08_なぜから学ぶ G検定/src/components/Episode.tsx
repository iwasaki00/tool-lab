import type { EpisodeProgress, LearningProgress } from "../types";
import { ShippingIllustration } from "./ShippingIllustration";
import { Unsupervised } from "./Simulations";
import {
  groupTransport,
  transportRecords,
  compareTransport,
  episodeRewards,
} from "../engine/episode";
export const episodeTitles = {
  sorting: "良品が、不良品レーンへ。",
  records: "仕分けた箱が、なかなか届かない。",
  routes: "速い近道と、箱が揺れにくい遠回り。",
  ending: "トラックが来た。",
};
function Inspector({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="inspector-line">
      <span>検査員</span>
      <p>「{children}」</p>
    </blockquote>
  );
}
export function EpisodeScene({
  progress,
  speed,
  onChange,
  onFinish,
  onQuiz,
  onReference,
  onNext,
}: {
  progress: LearningProgress;
  speed: number;
  onChange: (value: EpisodeProgress) => void;
  onFinish: () => void;
  onQuiz: () => void;
  onReference: (scene: number) => void;
  onNext: () => void;
}) {
  const e = progress.episode!;
  const change = (value: Partial<EpisodeProgress>) =>
    onChange({ ...e, ...value });
  if (e.stage === "records") {
    const result = e.grouped ? groupTransport() : null;
    return (
      <div className="episode-scene episode-records">
        <p className="episode-purpose">
          16時の集荷へ、検査を終えた箱を運ぼう。
        </p>
        <ShippingIllustration mode="records" />
        <Inspector>
          仕分けはできた。でも出荷口に届くのが遅い箱がある。記録は残ってるけど、遅れた理由までは書いてないな
        </Inspector>
        <p>
          点1つが搬送記録1件。待ち時間と停止の多さが似ている記録を探します。遅れの原因や正解のグループは書かれていません。
        </p>
        {!result ? (
          <>
            <div
              className="record-cloud"
              aria-label="まだグループ分けしていない12件の搬送記録"
            >
              {transportRecords.map((r) => (
                <span key={r.id}>
                  <i /> {r.id}
                </span>
              ))}
            </div>
            <button
              className="primary story-action"
              onClick={() => change({ grouped: true })}
            >
              似た搬送記録をまとめる
            </button>
          </>
        ) : (
          <>
            <div
              className="episode-groups"
              aria-label="計算でまとまった搬送記録"
            >
              {result.groups.map((g) => (
                <section
                  className={`record-group group-${g.id}`}
                  key={g.id}
                  data-group={g.id}
                >
                  <h2>
                    グループ{g.id}・{g.records.length}件
                  </h2>
                  <p>{g.description}</p>
                  <div className="record-cloud">
                    {g.records.map((r) => (
                      <span key={r.id}>
                        <i />
                        {r.id}
                      </span>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="episode-result" role="status">
              <p>
                待ち時間が長く、停止も多い記録がまとまりました。まず、このグループの箱が通った場所を調べましょう。原因は、現場で確かめます。
              </p>
              <p>
                正解が付いていないデータから、似たパターンを見つける。これは
                <strong>教師なし学習</strong>の例です
              </p>
            </div>
            <button
              className="primary story-action"
              onClick={() => change({ stage: "routes" })}
            >
              別の搬送経路を試す
            </button>
            <details className="episode-details">
              <summary>仕組みを詳しく見る</summary>
              <p>
                架空の搬送記録です。横軸は平均待ち時間（秒）、縦軸は停止回数（100箱あたり）。同じ0〜100の尺度で距離を比べています。まとまりは原因や正解を示しません。
              </p>
              <Unsupervised
                speed={speed}
                points={transportRecords}
                axes={["平均待ち時間（秒）", "停止回数／100箱"]}
              />
              <div className="episode-table">
                <table>
                  <caption>本編で計算した最終割当て</caption>
                  <thead>
                    <tr>
                      <th>記録</th>
                      <th>待ち時間（秒）</th>
                      <th>停止回数／100箱</th>
                      <th>グループ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transportRecords.map((r, i) => (
                      <tr key={r.id}>
                        <td>{r.id}</td>
                        <td>{r.x}</td>
                        <td>{r.y}</td>
                        <td>{result.state.assignments[i] + 1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </div>
    );
  }
  if (e.stage === "routes") {
    const scores = compareTransport(e.priority),
      best = scores[0].total > scores[1].total ? 0 : 1;
    return (
      <div className="episode-scene episode-routes">
        <p className="episode-purpose">
          調べる場所が見えたら、別の運び方も試してみよう。
        </p>
        <ShippingIllustration mode="routes" />
        <p>記録を手がかりに現場を見ると、近道には段差がありました。</p>
        <Inspector>
          近道は速いけれど、段差で一度止まって箱が揺れやすい。遠回りなら、そこを避けられるね。どちらをよい運び方とするか、点数で比べてみよう
        </Inspector>
        {!e.compared ? (
          <button
            className="primary story-action"
            onClick={() => change({ compared: true })}
          >
            2つの運び方を比べる
          </button>
        ) : (
          <>
            <div
              className="priority-switch"
              role="group"
              aria-label="重視する条件"
            >
              <button
                aria-pressed={e.priority === "speed"}
                onClick={() => change({ priority: "speed" })}
              >
                早く届ける
              </button>
              <button
                aria-pressed={e.priority === "care"}
                onClick={() => change({ priority: "care" })}
              >
                箱を丁寧に運ぶ
              </button>
            </div>
            <div className="route-scores">
              {scores.map((score, i) => (
                <section
                  className="route-score"
                  key={i}
                  data-route={i === 0 ? "A" : "B"}
                >
                  <h2>
                    {i === 0 ? "A：近道" : "B：遠回り"}
                    {i === best && <span>合計点が高い</span>}
                  </h2>
                  <strong className="route-total">{score.total}点</strong>
                  <p>
                    {score.steps}行動の移動：{score.movement}点<br />
                    段差での停止・揺れ {score.stops}回：{score.shaking}点<br />
                    出荷口に到着：+{score.arrival}点
                  </p>
                </section>
              ))}
            </div>
            <div className="episode-result" role="status">
              <p>
                {e.priority === "speed"
                  ? "移動にかかる行動数を重く見ると、近道Aの合計点が高くなりました。"
                  : "停止・揺れの減点を大きくすると、遠回りBの合計点が高くなりました。"}{" "}
                条件を切り替えて、順位の変化を見てみましょう。
              </p>
              <p>
                ロボットが行動し、その結果の点数を手がかりに、次からの行動を改善していくのが
                <strong>強化学習</strong>です
              </p>
            </div>
            <p className="episode-demo">
              今回は報酬の考え方を示す概念デモです。用意した2経路の点数を比較しており、ロボットが学習した結果ではありません。
            </p>
            <button
              className="primary story-action"
              onClick={() => change({ stage: "ending" })}
            >
              出荷を見届ける
            </button>
            <details className="episode-details">
              <summary>仕組みを詳しく見る</summary>
              <p>
                既存のevaluateRouteで、同じ行動列を毎回計算します。段差で止まる行動をマップ上の障害物判定で表現し、停止・揺れに追加の減点を付けています。移動先を変える学習は行いません。
              </p>
              <p>
                1行動 {episodeRewards[e.priority].step}点／停止・揺れ{" "}
                {episodeRewards[e.priority].wall}点追加／到着 +
                {episodeRewards[e.priority].goal}
                点追加。各行の点数はこれらの合計です。
              </p>
              {scores.map((s, i) => (
                <div className="episode-table" key={i}>
                  <table>
                    <caption>経路{i === 0 ? "A" : "B"}の行動と点数</caption>
                    <thead>
                      <tr>
                        <th>順</th>
                        <th>結果</th>
                        <th>今回</th>
                        <th>累計</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.frames.map((f, n) => (
                        <tr key={n}>
                          <td>{n}</td>
                          <td>
                            {f.event === "障害物・壁"
                              ? "段差で停止・揺れ"
                              : f.event === "ゴール"
                                ? "出荷口に到着"
                                : f.event}
                          </td>
                          <td>{f.reward}</td>
                          <td>{f.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </details>
          </>
        )}
      </div>
    );
  }
  return (
    <div className="episode-scene episode-ending">
      <ShippingIllustration mode="ending" />
      <Inspector>
        見本を増やして箱の判定を直し、記録をまとめて調べる場所を絞り、運び方の点数も比べられた。16時のトラックに間に合ったよ。ありがとう！
      </Inspector>
      <h2>3つの方法は、何を手がかりにした？</h2>
      <div className="episode-recap">
        <section>
          <span>答え付きの見本</span>
          <h3>教師あり学習</h3>
          <p>
            検査員が答えを付けた別の箱を見本に加え、新しい箱Qを判定しました。
          </p>
        </section>
        <section>
          <span>答えのない記録</span>
          <h3>教師なし学習</h3>
          <p>似た搬送記録をまとめ、現場で調べる手がかりを見つけました。</p>
        </section>
        <section>
          <span>行動の結果に付く点数</span>
          <h3>強化学習</h3>
          <p>
            運び方の重視する条件と点数を比べました。行動を改善していく学習の手がかりになるのが報酬です。
          </p>
        </section>
      </div>
      <p>今日はここまで。試験問題は、あとから演習メニューでも解けます。</p>
      <div className="episode-end-actions">
        <button onClick={onQuiz}>試験問題で確認する</button>
        <button className="primary" onClick={onFinish}>
          ここで終える
        </button>
      </div>
      <section className="evaluation-entry">
        <h2>第2話：モデル評価</h2>
        <p>
          正解率99％なのに、不良品を見逃した。翌朝の試運転で、見るべき数字を確かめます。
        </p>
        <button onClick={onNext}>第2話を開く</button>
      </section>
      {progress.completed && (
        <p className="notice">このレッスンを最後まで学習した記録があります。</p>
      )}
      <details className="episode-details">
        <summary>詳しい教材・比較・知識マップを見る</summary>
        <p>本編の続きとして、気になるところを開けます。</p>
        <div className="reference-actions">
          {[
            "教師あり学習の詳細",
            "教師なし学習の詳細",
            "強化学習の詳細",
            "3方式の比較",
            "応用チャレンジ",
            "知識マップ",
          ].map((name, i) => (
            <button key={name} onClick={() => onReference(i + 1)}>
              {name}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
