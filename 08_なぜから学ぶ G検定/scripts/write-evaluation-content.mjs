import { writeFile } from "node:fs/promises";
import {
  sortingA,
  sortingB,
  evaluationQuestions,
  evaluationLesson,
} from "../src/data/evaluation.ts";
import { summarizeInspection, percent } from "../src/engine/evaluation.ts";
const a = summarizeInspection(sortingA),
  b = summarizeInspection(sortingB);
const lines = [
  "# L004 教材・判定データ・独自3問",
  "",
  `L004「${evaluationLesson.title}」／正解率99％なのに、不良品を見逃した。要件に基づく独自教材で、公式試験問題の転載ではない。`,
  "",
  "## 物語と照合",
  "",
  "同じ工場の翌朝。AIに仕分けを任せる前に、見本に使っていない100箱で試運転する。人の検査結果は照合用であり、見本へ追加しない。第1話を未読でも、導入だけで工場とAIによる良品・不良の仕分けを理解できる。",
  "導入→100箱を流す→Aの見逃しを発見→同じ100箱でBを比較→何を避けたいかを振り返る→試験での呼び方→任意3問／ここで終える。",
  "",
  "## データからの集計",
  "",
  "データはsrc/data/evaluation.tsの100件。BOX-001〜099が人の検査で良品、BOX-100が不良。Aは全箱を良品判定。BはBOX-001〜097を良品、BOX-098〜100を不良判定とする。再学習を行わず、固定判定の比較を行う。",
  "",
  "| 項目 | 仕分けA | 仕分けB |",
  "| --- | --- | --- |",
  `| 評価用の箱 | ${a.total} | ${b.total} |`,
  `| 人の検査：良品／不良 | ${a.actualGood}／${a.actualDefects} | ${b.actualGood}／${b.actualDefects} |`,
  `| 判定一致 | ${a.matched} | ${b.matched} |`,
  `| 正解率 | ${percent(a.accuracy)} | ${percent(b.accuracy)} |`,
  `| 不良品の見逃し | ${a.falseNegative} | ${b.falseNegative} |`,
  `| 良品の止めすぎ | ${a.falsePositive} | ${b.falsePositive} |`,
  `| 再現率（不良品を見つけたい対象とする） | ${a.truePositive}/${a.actualDefects}＝${percent(a.recall)} | ${b.truePositive}/${b.actualDefects}＝${percent(b.recall)} |`,
  "",
  "混同行列は行が人の検査結果（良品／不良）、列がAI判定（良品として通す／不良として止める）。",
  `Aは [[${a.trueNegative}, ${a.falsePositive}], [${a.falseNegative}, ${a.truePositive}]]。Bは [[${b.trueNegative}, ${b.falsePositive}], [${b.falseNegative}, ${b.truePositive}]]。`,
  "",
  "## 結末と用語",
  "",
  "この工場では見逃しを減らしたいので、試運転ではBを候補とする。止まった良品2箱は人が再確認する。Bが常に優れているとも、この100箱だけで本番の安全が保証されるとも説明しない。",
  "結果後の『試験での呼び方』で正解率・再現率を説明する。混同行列は『詳しく見る』に配置。",
  "",
  "## 独自3問と全選択肢の解説",
  "",
];
for (const q of evaluationQuestions)
  lines.push(
    `### ${q.id} / v${q.version}`,
    "",
    q.text,
    "",
    ...q.options.map(
      (o, i) =>
        `- ${"ABCD"[i]} ${i === q.answer ? "正解" : "不正解"}：${o.text}\n  解説：${o.explanation}`,
    ),
    "",
    `判断の決め手：${q.clue}`,
    "",
  );
await writeFile("docs/CONTENT_L004.md", lines.join("\n") + "\n");
