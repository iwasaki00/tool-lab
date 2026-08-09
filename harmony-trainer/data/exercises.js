// 問題データは画面や再生処理から分離し、配列へ足すだけで拡張できます。
export const PHRASE_EXERCISES = [
  { id: "step-up", name: "はじめの上行", melody: ["C4", "D4", "E4", "G4"], harmony: ["E4", "F4", "G4", "B4"], tempo: 80 },
  { id: "gentle-arc", name: "ゆるやかな山", melody: ["G3", "A3", "C4", "B3", "G3"], harmony: ["B3", "C4", "E4", "D4", "B3"], tempo: 75 },
  { id: "hold-your-line", name: "つられず進む", melody: ["C4", "D4", "E4", "D4"], harmony: ["E4", "F4", "G4", "F4"], tempo: 70 },
  { id: "descending", name: "下行フレーズ", melody: ["A3", "G3", "E3", "D3"], harmony: ["C4", "B3", "G3", "F3"], tempo: 80 }
];

export const SINGLE_ROOTS = ["C4", "D4", "E4", "F4", "G4", "A3", "B3"];
