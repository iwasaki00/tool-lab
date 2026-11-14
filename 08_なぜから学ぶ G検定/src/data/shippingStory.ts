import type { LabelledPoint, Point } from "../engine/simulations";

// The target remains unlabelled in the classifier. The inspector has checked it,
// but we teach with a different box, never with the target's own answer.
export const shippingTarget: Point & { id: string } = {
  id: "BOX-Q",
  x: 60,
  y: 60,
};
export const inspectedSample: LabelledPoint = {
  id: "BOX-W",
  x: 58,
  y: 57,
  label: "良品",
};
export const shippingStory = {
  title: "良品が、不良品レーンへ。",
  before: "あれ？ この箱、検査では合格だったのに",
  after: "よかった。今度は、良品のレーンに流れたね",
  action: "検査済みの箱を見本に加える",
  explanation:
    "検査で確かめた『良品』という答えを見本に加えたら、よく似た箱の判定が変わりました。こうした、答え付きの見本から学ぶ方法を教師あり学習と呼びます。",
};

export const shippingPrologue = {
  panels: [
    {
      mode: "usual",
      title: "いつもの出荷",
      line: "トラックは毎日16時に来る。それまでに、検査に通った箱を出荷口へ。不合格の箱は別のレーンへ回すんだ。いつもなら、午後の早いうちに仕分けを始められるよ",
    },
    {
      mode: "stopped",
      title: "午前、包装機が止まる",
      narration: "午前中、包装機が止まった。仕分けを始めたくても、箱が来ない。",
    },
    {
      mode: "arrivals",
      title: "15時、箱が一気に届く",
      line: "ようやく箱が来た。でも、もう15時か。トラックが来るまで、あと1時間しかない",
    },
  ] as const,
  action: "仕分け台へ行く",
};
export const shippingTrial = {
  title: "AIで、仕分けを手伝えるかな。",
  line: "前に検査した箱を見本にして、AIで仕分けを手伝えないか試していたんだ。まず一箱だけ流してみよう。判定が合っているかは私が確かめるよ",
  action: "最初の箱を流す",
};
