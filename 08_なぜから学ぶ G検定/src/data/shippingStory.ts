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
  narration:
    "出荷前の工場。検査員が一箱ずつ確認しているが、仕分けが追いつかない。",
  line: "今日は、箱の仕分けをAIに手伝ってもらおう。判定が合っているかは、私が確かめるよ",
  action: "AIの仕分けを見てみる",
};
