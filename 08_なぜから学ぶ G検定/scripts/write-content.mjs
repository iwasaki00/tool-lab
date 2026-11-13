import { writeFile } from "node:fs/promises";
import { scenes, questions, concepts, syllabus } from "../src/data/content.ts";
const lines = [
  "# L003 教材構成・問題・出典",
  "",
  "## 参照情報",
  "",
  "JDLA公式ページ「G検定の試験範囲（シラバス）」の「機械学習の概要」（教師あり学習、教師なし学習、強化学習、モデルの選択・評価）を範囲の参照に使用。G2024#6〜適用シラバスの案内を2026-11-13に確認。出典は学習範囲の対応を示し、問題文・操作例・解説は本アプリ独自に作成。公式試験問題・公式例題の転載はしていない。",
  `公式参照先：${syllabus[0].source}`,
  "",
  "## 9場面",
  "",
  ...scenes.map((s) => `- ${s.id} ${s.title}：${s.prompt}`),
  "",
  "## 概念",
  "",
  ...concepts.map((c) => `- ${c.id}：${c.name} — ${c.description}`),
  "",
  "## 独自問題12問",
  "",
  "各問題は版1。全選択肢の正誤・説明を以下に固定し、単体テストで4択すべての採点を確認する。意味の整合性は下記の原稿に基づきレビューする。",
  "",
];
for (const q of questions) {
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
    `関連知識：${q.conceptIds.join(", ")}`,
    `根拠範囲：${q.sourceIds.join(", ")}（機械学習の概要）`,
    "",
  );
}
lines.push(
  "## 内容レビュー",
  "",
  "12問の正解は A・B・C・D・A・B・C・D・A・B・C・D。Q02は連続値とカテゴリ、Q03は誤ラベルの影響、Q05は群の解釈、Q08は報酬設計と目的のずれ、Q10は汎化をそれぞれ区別する。Q11は条件と目的の変化を明記し、単にデータ名だけで方式を断定しない。全48選択肢について、正解のみを支持し、それ以外には条件に合わない理由を記述した。",
  "",
  "強化学習画面は方策を学習していないことを常時表示する。分類の予測は教材内の小規模データに対する計算であり、実務性能を保証しない。K-meansの群は正解ラベルではなく、初期値や特徴尺度の影響を受ける。",
);
await writeFile("docs/CONTENT_L003.md", lines.join("\n") + "\n");
