import { useEffect, useRef } from "react";

const descriptions = {
  "rules-vs-examples":
    "左は規格のそろった箱をチェック表で確かめる検査員。右は傷やへこみの異なる箱を前に、同じ表だけでは難しいと考える検査員。",
  "ml-inspected-samples":
    "左の棚に検査済みの良品と不良の見本箱。右のコンベアに、それらとは別の未判定の箱。検査員が見本から別の箱へ手を向けている。",
  "dl-box-feature":
    "カメラがコンベア上の箱を撮影。モニターには箱全体と、へこんだ角の拡大が並び、検査員が確認している。",
};
export function GuideIllustration({
  name,
}: {
  name: keyof typeof descriptions;
}) {
  return (
    <figure className="guide-illustration">
      <img
        src={`${import.meta.env.BASE_URL}illustrations/${name}.png`}
        alt={descriptions[name]}
        width="1536"
        height="1024"
      />
      <figcaption>
        {name === "rules-vs-examples" ? (
          <div className="image-labels">
            <span>左：規格がそろう → チェック表が役立つ</span>
            <span>右：傷・へこみが多様 → 条件を書き切りにくい</span>
          </div>
        ) : name === "ml-inspected-samples" ? (
          <div className="image-labels">
            <span>
              左の見本：検査済み
              <br />
              良品・不良という答えあり
            </span>
            <span>
              右の別の箱：これから判定
              <br />
              見本そのものではない
            </span>
          </div>
        ) : (
          <span>
            カメラで撮った箱の写真から、へこみなどの手がかりを学ぶイメージ。
          </span>
        )}
      </figcaption>
    </figure>
  );
}
function DeepDive({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const position = useRef(0);
  function close() {
    details.current!.open = false;
    requestAnimationFrame(() => {
      window.scrollTo({ top: position.current, behavior: "instant" });
      details.current?.querySelector("summary")?.focus({ preventScroll: true });
    });
  }
  return (
    <details
      className="guide-detail"
      ref={details}
      onToggle={() => {
        if (!details.current?.open)
          requestAnimationFrame(() =>
            window.scrollTo({ top: position.current, behavior: "instant" }),
          );
      }}
    >
      <summary
        onClick={() => {
          if (!details.current?.open) position.current = window.scrollY;
        }}
      >
        {title}
        <span>もう少し詳しく</span>
      </summary>
      <div className="guide-detail-body">
        {children}
        <button onClick={close}>解説を閉じて元の項目に戻る</button>
      </div>
    </details>
  );
}
export function BeginnerGuide({
  onLesson,
}: {
  onLesson: (lesson: "L003" | "L004") => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  return (
    <article className="lesson-wrap beginner-guide">
      <p className="eyebrow">BEGINNER GUIDE · 第0章 · 約3分</p>
      <h1 ref={heading} tabIndex={-1}>
        G検定とAIの全体像
      </h1>
      <p className="guide-lead">
        まず全体像を知り、気になったところだけ深掘り。そのあと、工場で試してみましょう。
      </p>
      <section className="card guide-section" id="guide-exam">
        <span className="eyebrow">01 · 学ぶ範囲</span>
        <h2>G検定って、何を学ぶ試験？</h2>
        <p>
          G検定は、AIやディープラーニングの仕組みと、どう役立てるかを学ぶ検定です。技術だけでなく、AIの歴史、性能の確かめ方、数理・統計、法律や倫理も扱います。コードを書く実技試験ではありませんが、技術や数理の基礎知識は問われます。
        </p>
        <DeepDive title="G検定の出題範囲を見る">
          <ul className="guide-topics">
            <li>
              <strong>AIの基礎・歴史</strong>
              ：AIとは何か、どのような考え方が研究されてきたか。
            </li>
            <li>
              <strong>機械学習・評価</strong>
              ：データから学ぶ方法と、性能の確かめ方。
            </li>
            <li>
              <strong>ディープラーニングと応用</strong>
              ：ニューラルネットワークと画像・言語などへの活用。
            </li>
            <li>
              <strong>社会実装</strong>
              ：課題を見つけ、データを用意し、運用につなげる考え方。
            </li>
            <li>
              <strong>数理・統計</strong>
              ：学習や評価を理解するための数学・統計の基礎。
            </li>
            <li>
              <strong>法律・倫理</strong>
              ：個人情報、著作権、公平性など、使うときの責任。
            </li>
          </ul>
          <p>
            本アプリで現在体験できるのは、第0章の道案内、第1話（L003）の機械学習の3方式、第2話（L004）のモデル評価です。G検定の全範囲を網羅する教材ではありません。
          </p>
          <p>
            出典：
            <a
              href="https://www.jdla.org/certificate/general/#general_No03"
              target="_blank"
              rel="noreferrer"
            >
              JDLA「G検定とは・公式シラバス」（オンライン）
            </a>
          </p>
        </DeepDive>
      </section>
      <section className="card guide-section" id="guide-ai">
        <span className="eyebrow">02 · いちばん広い言葉</span>
        <h2>AIって、何？</h2>
        <p>
          この教材では、画像を見分けたり、文章を作ったり、人が知能を使うような作業をコンピューターに行わせる技術を、広くAIと呼びます。AIには、人が決めたルールを使う方法も、データから学ぶ方法もあります。
        </p>
        <div
          className="ai-containment"
          aria-label="包含関係：AIの中に機械学習、その中にディープラーニング"
        >
          <strong>AI</strong>
          <p>人が決めたルールを使う方法も含む</p>
          <div className="ml-containment">
            <strong>機械学習</strong>
            <p>データからパターンを学ぶ</p>
            <div className="dl-containment">
              <strong>ディープラーニング</strong>
              <p>何層も重ねたニューラルネットワークで学ぶ</p>
            </div>
          </div>
        </div>
        <p className="guide-note">
          大きな枠の中に小さな枠が入る関係です。すべてのAIが機械学習ではなく、すべての機械学習がディープラーニングでもありません。時代順を表す図ではありません。
        </p>
        <DeepDive title="なぜ、ルールを書く以外の方法が必要だった？">
          <GuideIllustration name="rules-vs-examples" />
          <p>
            工場で「何を不良とするか」が明確なら、人が書いたルールも役に立ちます。一方、傷の位置・形・照明の違いが増えると、すべての条件を人が書き出すのは難しくなります。そこで、事例から判定の手がかりを得る、と考えます。
          </p>
          <p className="guide-note">
            この工場の話は理解のための例です。歴史上の出来事を描いたものではありません。
          </p>
          <h3>史実では、ゲームを使った研究も</h3>
          <p>
            1959年、アーサー・サミュエルはチェッカーを題材に、経験を使って対局の仕方を改善するプログラムを報告しました。機械学習の初期の研究の一例であり、この研究だけで機械学習が生まれたという意味ではありません。
          </p>
          <p>
            出典：
            <a
              href="https://doi.org/10.1147/rd.33.0210"
              target="_blank"
              rel="noreferrer"
            >
              A. L. Samuel（1959）チェッカーを使った機械学習の研究（オンライン）
            </a>
          </p>
        </DeepDive>
      </section>
      <section className="card guide-section" id="guide-ml">
        <span className="eyebrow">03 · データから学ぶ</span>
        <h2>機械学習って、何？</h2>
        <p>
          人が判定ルールを一つずつ書く代わりに、データから、判定や予測に使えるパターンを見つける方法です。たとえば、検査済みの箱を見本にして、初めて見る箱の状態を判定します。答え付きの見本を使うのは一例で、機械学習にはほかの学び方もあります。
        </p>
        <GuideIllustration name="ml-inspected-samples" />
        <DeepDive title="見本の答えがないときは、どう学ぶ？">
          <p>
            答えの付いていない搬送記録から、似たパターンをまとめる方法もあります。また、運ぶ行動の結果に付く点数を手がかりに、次の行動を改善する方法もあります。第1話では、これらを含む3つの学び方を順に体験します。
          </p>
        </DeepDive>
      </section>
      <section className="card guide-section" id="guide-dl">
        <span className="eyebrow">04 · 機械学習の一種</span>
        <h2>ディープラーニングって、何？</h2>
        <p>
          機械学習の一種です。ニューラルネットワークという仕組みを何層も重ね、画像などのデータから、見分けるための手がかりも学びます。たとえば、箱の写真から、へこみを見分ける手がかりを学ぶときに使えます。
        </p>
        <GuideIllustration name="dl-box-feature" />
        <DeepDive title="なぜ、何層も重ねるの？">
          <p>
            箱の画像なら、輪郭などの単純な手がかりを組み合わせ、より複雑な模様や形を捉えていく、とイメージできます。何段階もの表現を、データから学びます。
          </p>
          <figure className="feature-schematic">
            <figcaption>理解のための模式図</figcaption>
            <ol>
              <li>箱の写真</li>
              <li>輪郭などの単純な手がかり</li>
              <li>模様や形などを組み合わせた手がかり</li>
              <li>へこみの判定に役立てる</li>
            </ol>
          </figure>
          <p>
            各層が必ず特定の手がかりだけを担当するわけではありません。上の挿絵のモニターも、厳密なネットワーク内部の処理を表すものではありません。
          </p>
          <p>
            出典：
            <a
              href="https://doi.org/10.1038/nature14539"
              target="_blank"
              rel="noreferrer"
            >
              LeCun・Bengio・Hinton（2015）「Deep learning」（オンライン）
            </a>
          </p>
        </DeepDive>
      </section>
      <section className="card guide-section guide-destination">
        <span className="eyebrow">NEXT · 工場で体験する</span>
        <h2>知った言葉を、動かしてみよう。</h2>
        <p>
          第0章は道案内です。ここからは、工場の出荷を手伝いながら機械学習を体験します。深掘りや試験問題を読まなくても進めます。
        </p>
        <p>
          第1話：検査済みの見本を足すと、なぜ別の箱の判定が変わるのか。似た記録の整理や、運び方の点数も試します。
        </p>
        <button className="primary" onClick={() => onLesson("L003")}>
          第1話で、AIの学び方を試す
        </button>
        <p>
          第2話：正解率99％でも、なぜ見逃しが起きるのか。同じ100箱の判定を見比べます。
        </p>
        <button onClick={() => onLesson("L004")}>
          第2話で、AIの性能を確かめる
        </button>
        <p className="guide-note">
          どちらからでも始められます。学習中なら、保存された位置から続けられます。第0章と2話だけでG検定全体を網羅するものではありません。
        </p>
      </section>
    </article>
  );
}
