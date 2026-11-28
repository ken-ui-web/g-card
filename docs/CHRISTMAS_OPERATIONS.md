# クリスマスイベントの運用

## 公開前の準備

1. 通常の「テスト」機能で知識テストを作成・公開する。配点のある採点問題を入れる。
2. もう1つ、振り返りと抱負を問うテストを作成・公開する。「長文記述」を必須にし、配点は0にする。自由記述の本文は保存せず、提出済みかだけを判定する。
3. 「管理者」→「イベント」を開く。開始・終了日時（日本時間）、2つのテスト、必要勝利数、サンタCPUと限定パックを設定する。
4. 「準備中の設定を保存」→「先生用プレビュー」で確認する。プレビューの対戦では勝敗・G・ミッションを記録しない。
5. 「この設定でまとめて公開」を押す。開催期間になるとホーム・ショップの冬仕様、ミッション、サンタCPU、限定パックが一緒に有効になる。生徒のホームは既存キャッシュの更新時（通常2分以内）に公開設定を取得する。

既存の学校用Apps Scriptと公開URLを利用する。新しいFirebaseルールや認証設定は不要。授業時間帯のログイン確認は、時間割画像の受領待ちのため今回には含めない。

## 達成と報酬

- 知識テストで満点・必須記述の提出・サンタCPUの指定勝利数・オンラインの指定勝利数の4つを集計する。開催期間中の操作だけが対象。
- オンラインはサーバーが確定した通常勝利を集計する。不戦勝、ゲスト対戦、管理者テスト対戦は対象外。
- サンタCPUのG報酬はLv3相当で、通常CPUと共通の日次上限がある。日次G上限後もイベント勝利数は進む。
- 4つ達成すると学校アカウントに白銀フレームを1つ付与。Gボーナスや有料交換は不要。未確認の獲得案内は次の取得時にも返し、確認するまで保持する。
- 「デッキ・図鑑」→「フレーム」で保存済みデッキ4枚のうち1枚を選んで装着する。無料で付け替えできる。装着先を売却した場合はフレームだけ手元に残る。
- 装着カードの効果が発動すると追加でHP＋10。最大HPを超えてよい。通常カードのあいこ、敗北、封印されて発動しない場合には回復しない。SSRはあいこでも発動する。
- 「入れ替え」で交換した場合は、フレームが物理カードと一緒に移る。対戦中だけの移動で、試合後の所持者・装着設定は変わらない。初期デッキはフレーム1枚まで。
- 通常の回復は最大HPまで。ただし、フレームで最大HPを超えている場合にHPを減らす処理にはしない。

## 終了・停止・再公開

開催終了時には限定販売とミッション集計を止める。取得済みサンタアッパーと白銀フレームの見た目・効果・装着は残る。「公開を停止」でも進捗と報酬は消さない。下書きの保存は公開中設定を変更しない。開催中の変更を反映する場合は再び公開する。

## 記録と二重処理対策

`Settings.christmasConfig` に下書きと公開設定を分けて保存。`EventProgress` に個人の達成状態と勝利試合ID、`PlayerFrames` に恒久所持・装着先・獲得案内の確認状態を保存する。試合IDで再送を照合し、同じ勝利は二重集計しない。既存の結果記録後にイベント処理が中断しても、再送時に進捗を補完できる。フレーム付与・装着処理は学校側のロック内で行う。

学校側の初期値は非公開。対象テストや開催日時が未設定のまま公開できない。限定パックは通常の40枚パックから独立し、初期SSR枠はサンタアッパーのみ（変更可能）。イベント設定は同時編集による上書きも検出する。

## 検証

`npm test` と `npm run build`。イベントの公開・停止・期間、テスト提出、限定パック、勝利再送、1回だけのフレーム付与、権限、終了後の装着をGASのテスト環境で検証。ブラウザーとGASのオンライン処理が、フレームの回復や公開情報の不一致を同じように解決することを照合する。既存のフレームなし対戦のコミットと状態ハッシュは維持。

ローカルのAPI代替データで1366px・768px・390px幅の画面と装着操作、獲得案内、サンタ対戦開始を確認。学校アカウント2つを用いた実対戦は、実際の授業運用で確認が必要。

サンタの思考は未公開の相手カード名・筋トレ値を受け取らず、裏面から候補を仮定し、本物の対戦エンジンで2ラウンドを先読みして混合戦略を計算する。Web Workerで画面の動きを保つ。等しいデッキとHPでの固定12試合では既存Lv3に10勝2敗（一般的な最強保証ではない）。

## 画像

白銀フレームは了承済み見本から `public/images/frames/snow-silver.webp` に採用。サンタアッパーはCPUサンタの顔・衣装を参照して再生成した `G023-front.webp` を使用。限定パックの絵は既存の期間限定パックを利用。新しく生成したCPUサンタは内蔵image_genを使い、原本 `design-source/christmas/cpu-santa.png`、表示用 `public/images/cpu/santa.webp` に保存した。

CPU画像の生成プロンプト：

```text
Use case: stylized-concept. Create one production game character sprite for Gカード, transparent background, full body centered with generous margin, no text no border no UI. A powerful friendly elderly Santa Claus, clearly an older man with flowing white beard and moustache, warm confident smile, scarlet fur-trimmed coat with elegant silver snowflake embroidery, red Santa hat, boots, sturdy imposing heroic stance. One hand confidently holds four dark navy and gold collectible cards fanned out, other hand on belt. Japanese high quality anime fantasy card game illustration, crisp painted contours, intricate festive costume, glossy clean highlights matching the existing G-card CPU character art. Visually strong expert rival, benevolent and exciting, not a boy, no robot, no background scene, no floating detached props. Truly transparent alpha background.
```
