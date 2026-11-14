import type { Lesson, Question } from "../types";
export type BoxLabel = "良品" | "不良";
export interface InspectionRecord { id:string; actual:BoxLabel; predicted:BoxLabel }
// These 100 inspected boxes are evaluation data, never training examples.
export const evaluationBoxes = Array.from({length:100},(_,i)=>({id:`BOX-${String(i+1).padStart(3,"0")}`,actual:(i===99?"不良":"良品") as BoxLabel}));
export const sortingA:InspectionRecord[]=evaluationBoxes.map(box=>({...box,predicted:"良品"}));
export const sortingB:InspectionRecord[]=evaluationBoxes.map((box,i)=>({...box,predicted:i>=97?"不良":"良品"}));
export const evaluationLesson:Lesson={id:"L004",title:"モデル評価",courseId:"C01",sceneIds:["L004-S01","L004-S02","L004-S03","L004-S04"],syllabusIds:["SY-ML"]};
export const evaluationTitles={intro:"翌朝、出荷ラインで試運転。",discovery:"99％正解。でも、通してはいけない箱が通った。",comparison:"別の仕分け設定で試す。",ending:"数字を見る前に、何を避けたいか。",quiz:"試験問題で確認する。"};
export const evaluationQuestions:Question[]=[
 {id:"L004-Q01",version:1,text:"仕分けAは100箱中99箱で一致。それでも、この工場で困ったのはなぜ？",answer:1,
 options:[
 {text:"99％という計算が間違っていたから",explanation:"99箱の良品で一致し、不良1箱で不一致なので99％は正しい計算です。全体の割合だけでは、何を間違えたかが分かりません。"},
 {text:"止めたかった不良品1箱を、良品として通したから",explanation:"Aは良品99箱を正しく通しましたが、人が不良と確認した1箱も通しました。見逃した箱の種類が、この工場の目的に合いませんでした。"},
 {text:"良品99箱をすべて止めたから",explanation:"Aは良品99箱を通しています。良品の止めすぎは0箱で、問題は不良品の見逃し1箱でした。"},
 {text:"人の検査結果をAIの見本に加えなかったから",explanation:"今回の100箱は、仕分けを確かめるための別データです。人の検査結果を照合に使い、学習用の見本へ加えないことは誤りではありません。"}],
 clue:"99％が正しくても、止めたい不良品を見逃した事実は残る。",conceptIds:["generalization"],sourceIds:["SY-ML"]},
 {id:"L004-Q02",version:1,text:"この工場で不良品の見逃しを減らしたい。まず確かめたい数字は？",answer:2,
 options:[
 {text:"全体の正解率だけ",explanation:"正解率は全体で一致した割合です。Aは99％でも不良1箱を見逃したため、正解率だけでは目的を確かめられません。"},
 {text:"流した箱の総数だけ",explanation:"AもBも同じ100箱で確かめました。総数だけでは、不良品を止められたかが分かりません。"},
 {text:"実際の不良品をどれだけ止められたかという再現率",explanation:"不良品を見つけたい対象とすると、再現率は実際の不良品のうち止められた割合です。この話ではAが0/1、Bが1/1でした。"},
 {text:"AIが良品と判定した箱の数だけ",explanation:"良品判定が多くても、Aのように不良品が混じることがあります。人の検査結果と照合し、不良品の見逃しを確認する必要があります。"}],
 clue:"何を避けたいかに合わせて数字を選ぶ。この話では実際の不良品を止めた割合。",conceptIds:["generalization"],sourceIds:["SY-ML"]},
 {id:"L004-Q03",version:1,text:"Bは不良品を見逃さなかった一方、良品2箱も止めた。どんな影響に気を配る？",answer:0,
 options:[
 {text:"人の再確認が増え、出荷の手間や遅れにつながること",explanation:"この工場では止まった良品2箱を人が再確認します。見逃しを減らす目的とともに、確認の手間や搬送の遅れにも気を配ります。"},
 {text:"Bは必ずどの工場でも優れていること",explanation:"避けたい間違いや再確認の負担は現場で違います。今回の工場で候補にしたことと、常に優れていることは別です。"},
 {text:"今回の100箱だけで本番の安全が保証されたこと",explanation:"試運転Bの結果はこの100箱での結果です。別の箱や条件でも同じ成績になるという保証ではありません。"},
 {text:"正解率が下がるので、Bは検討できないこと",explanation:"Bの一致は98％でAより低い一方、不良品の見逃しは0箱でした。全体の割合と避けたい間違いの両方を見て検討します。"}],
 clue:"Bを候補にしても、止まった良品の再確認とその負担は残る。",conceptIds:["generalization"],sourceIds:["SY-ML"]},
];
