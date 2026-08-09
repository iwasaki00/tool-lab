# HamoLab

iPhone Safariで使える、ハモリ感覚と「主旋律につられない耳」を育てるWebアプリです。単音の3度上・下、短いフレーズ、つられ耐性、フリーハモリ、録音、履歴に対応します。音声は端末内だけで処理します。

## 起動方法

マイクとService WorkerにはHTTPSまたはlocalhostが必要です。リポジトリ直下で次を実行し、`http://127.0.0.1:8042/harmony-trainer/` を開いてください。

```powershell
py -3 -m http.server 8042 --bind 127.0.0.1
```

## iPhoneでの使い方

SafariでHTTPS配信されたURLを開き、「今日の練習を始める」を押します。マイクの確認が出たら「許可」を選びます。拒否後に変更する場合は、アドレスバー左側のページ設定から「マイク」を許可してください。スピーカー音がマイクへ回り込むため、フレーズ練習とつられ耐性練習ではイヤホンを推奨します。

ホーム画面へ追加するには、Safariの共有ボタンから「ホーム画面に追加」を選びます。一度読み込んだ基本画面と問題はオフラインでも開けますが、初回はオンラインで開いてください。

## ファイル構成

- `index.html`：画面構造
- `css/style.css`：モバイル優先の表示とダークモード
- `js/audio.js`：Web Audio、マイク、録音
- `js/pitchDetector.js`：YIN系の音程検出、周波数・MIDI・cent変換
- `js/trainer.js`：正解維持、採点、つられ判定
- `js/storage.js`：設定と履歴のlocalStorage保存
- `js/ui.js` / `js/app.js`：表示と画面進行
- `data/exercises.js`：練習問題
- `manifest.json` / `service-worker.js`：PWA構成

## 音程検出

時間波形の差分関数と累積平均正規化を使うYIN系の方法で基本周期を求め、放物線補間で周波数を滑らかにします。A4=440Hzを基準にMIDIノートへ変換し、目標周波数との差をcentで計算します。小音量、周期性の弱い音、揺れが大きい瞬間は判定から外し、目標±40centを500ms保ったときに正解とします。

## 問題の追加

`data/exercises.js` の `PHRASE_EXERCISES` に、`id`、`name`、`melody`、`harmony`、`tempo` を持つオブジェクトを追加します。音名は `C4`、`F#4` の形式です。主旋律とハモリは同じ音数にしてください。

## 今後の拡張候補

コード構成音に基づくハモリ生成、メロディ手入力、MIDI・MusicXML読込、鼻歌からのハモリ候補生成、2人練習、片耳再生に拡張できる構成です。
