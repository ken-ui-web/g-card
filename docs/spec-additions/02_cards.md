# Gカード 追加仕様書 No.02：カード一覧の改訂（40枚）

作成日：2026-10-03
対象：`docs/SPEC.md`（Gカード仕様書 v1.2）＋ 追加仕様書 No.01（SSR）への追加・変更

---

## 0. この追加仕様書の扱い（Codex への指示）

- この文書は、Gカード仕様書 v1.2（`docs/SPEC.md`）と追加仕様書 No.01 に対する**追加・変更**である。内容が食い違う場合は、**この追加仕様書を優先する**。
- 受け取ったら、まず次の3つを行うこと。
  1. この文書を `docs/spec-additions/02_cards.md` として保存する。
  2. 「8. SPEC.md の修正箇所」に従って `docs/SPEC.md` を更新する。
  3. `docs/DECISIONS.md` に、変更の内容と理由を記録する。
- **SPEC.md 8章の「カード候補一覧（47枚）」は、この文書の40枚に置き換える。** 候補から外したカードは「保留」とし、実装しない（7章）。
- **実装の進め方は、これまでどおり「★ 開発の進め方」に従う。** カードの追加は段階4で、5章の順番に少しずつ行う。この文書のために先の段階を前倒ししてはいけない。
- 初期カード4枚（パンチ・キック・火縄銃・手品）は変更なし。
- 数値はすべて【仮】。段階4で遊びながらオーナーと調整し、その後も管理者画面で変更できること。

---

## 1. 背景と方針

カード一覧を「このゲームが面白くなるか」という観点だけで見直し、**グー14枚・チョキ13枚・パー13枚の合計40枚**にした。

**方針**
1. **種類ごとの個性をはっきりさせる**
   - グー：育つ（筋トレ）・逆転する。主役なので1枚多い。
   - チョキ：強い・道具ならではの仕掛け（時間差、継続ダメージ、貫通、組み合わせ）。
   - パー：相手の手を変える・情報を握る・守る。
2. **「見えている情報」をめぐる読み合いを深める**（手の種類が見える、SSRは裏面が光る）。
3. **どんな強いカードにも止め方がある**（SSR、シールド、同じ種類だけのデッキなど）。
4. **似たカードを減らし、1枚1枚に役割を持たせる。**
5. **技術科らしいカード**（歯車、てこの原理、人力発電、電動アシスト、パワードスーツ、くぎ、ドローン、暗号化など）を取り入れる。

**この構成で組めるデッキの例**

| 戦い方 | デッキの例 | 特徴 |
|---|---|---|
| 筋トレ型 | 連続パンチ、電動アシスト、パワードスーツ、手品 | 育てたグーで押し切る |
| 高火力型 | 火縄銃、チェーンソー、レーザーカッター、電動ドリル | 一撃が重い。グーで読まれると弱い |
| 鉄壁型 | 受け身、バリア、鏡、吸収（＋走り込み） | 耐えてライフ差で勝つ |
| 操作型 | 催眠術、プログラミング、刀、のこぎり | 相手の手を操ってから確実に勝つ |
| コンボ型 | げんのう、くぎ、歯車、正拳突き | つないで大ダメージ |

**強いカードへの止め方**

| 相手の強み | 止め方 |
|---|---|
| 光るSSR | 封印、ベアハッグ（効果なし）、入れ替え（奪う）、鏡（跳ね返す） |
| シールド | 電動ドリル（貫通）、手裏剣・連続パンチ（複数回当てて消す） |
| 同じ種類だけのデッキ | 手品・催眠術・おりがみ、ハッキング |
| 情報を握られる | 暗号化、変身 |
| ライフ差をつけられた | てこの原理、吸収、捨て身タックル |

---

## 2. カード一覧（40枚）

- IDは、前の候補一覧から残ったカードは**元のIDのまま**、新しいカードには新しいIDを付けた（すでに生成した画像のファイル名を変えずに済むようにするため）。
- 入手：N・R はショップとパック。SR は「ショップ」と書いたものだけショップでも買え、それ以外はパック限定。SSR はパック限定。
- 価格【仮】：N 50G／R 150G／SR 400G。

### 2-1. 【グー】14枚（N4・R5・SR3・SSR2）筋トレ可

| ID | 名前 | レア | 効果 | 入手 | 前の候補からの変更 |
|---|---|---|---|---|---|
| G001 | パンチ | N | 20ダメージ | 初期／ショップ | なし |
| G002 | キック | N | 20ダメージ | 初期／ショップ | なし |
| G018 | 人力発電 | N | 15ダメージ＋10回復 | ショップ | **新規** |
| G019 | 歯車 | N | 10ダメージ＋次のラウンドの自分のカードのダメージ＋10 | ショップ | **新規** |
| G006 | 正拳突き | R | 30ダメージ | ショップ | なし |
| G007 | 連続パンチ | R | 10ダメージ×3回（筋トレ効果も3回のる） | ショップ | なし |
| G020 | てこの原理 | R | 15ダメージ。自分のライフが相手より少なければ2倍 | ショップ | **新規** |
| G017 | 受け身 | R | 15ダメージ＋次に受けるダメージを10減らす | ショップ | **新規** |
| G021 | 電動アシスト | R | 15ダメージ。筋トレ効果が2倍 | ショップ | **新規** |
| G009 | ぶち切れパンチ | SR | 40ダメージ | ショップ | なし |
| G010 | 捨て身タックル | SR | 60ダメージ。自分も25ダメージ | ショップ | 反動 30→25 |
| G012 | ベアハッグ | SR | 25ダメージ＋相手の残りカード1枚を「効果なし」にする | ショップ | 20→25 |
| G022 | パワードスーツ | SSR | 30ダメージ。筋トレ値を＋20して計算する | パック限定 | **新規** |
| G015 | ジャイアントスイング | SSR | 30ダメージ＋相手は以降、自分の残りカードが見えなくなり、ランダムに出す | パック限定 | 40→30 |

### 2-2. 【チョキ】13枚（N4・R4・SR3・SSR2）

| ID | 名前 | レア | 効果 | 入手 | 前の候補からの変更 |
|---|---|---|---|---|---|
| C002 | のこぎり | N | 30ダメージ | ショップ | なし |
| C003 | げんのう | N | 25ダメージ | ショップ | 30→25（くぎとの組み合わせ役） |
| C016 | くぎ | N | 15ダメージ。デッキに「げんのう」があれば＋15 | ショップ | **新規** |
| C004 | 手裏剣 | N | 15ダメージ×2回 | ショップ | なし |
| C008 | 火縄銃 | R | 50ダメージ | 初期／ショップ | なし |
| C006 | 刀 | R | 40ダメージ | ショップ | なし |
| C007 | 毒矢 | R | 10ダメージ＋このラウンドから毎ラウンドの終わりに10ダメージ | ショップ | なし |
| C017 | ドローン | R | 20ダメージ＋相手の残りカード1枚の中身を見る | ショップ | **新規** |
| C010 | 電動ドリル | SR | 40ダメージ。シールドを貫通する | ショップ | 35→40 |
| C011 | チェーンソー | SR | 55ダメージ | ショップ | 45→55 |
| C013 | 投石器 | SR | 次のラウンドの終わりに60ダメージ（時間差） | パック限定 | なし |
| C014 | レーザーカッター | SSR | 60ダメージ | パック限定 | 80→60 |
| C015 | ロボットアーム | SSR | 相手の残りカードの枚数×20ダメージ | パック限定 | なし |

### 2-3. 【パー】13枚（N4・R4・SR3・SSR2）

| ID | 名前 | レア | 効果 | 入手 | 前の候補からの変更 |
|---|---|---|---|---|---|
| P001 | 手品 | N | 相手のカードを1枚選び、【グー】に変える | 初期／ショップ | なし |
| P002 | 催眠術 | N | 相手のカードを1枚選び、【チョキ】に変える | ショップ | なし |
| P017 | おりがみ | N | 相手のカードを1枚選び、【パー】に変える | ショップ | **新規** |
| P003 | 救急箱 | N | 30回復 | ショップ | なし |
| P005 | バリア | R | 次に受けるダメージを半分にする | ショップ | なし |
| P007 | 封印 | R | 相手の残りカード1枚を「効果なし」にする | ショップ | なし |
| P004 | 変身 | R | 自分の残りカード1枚を好きな種類に変える | ショップ | なし |
| P008 | 吸収 | R | 20ダメージを与え、与えた分だけ回復 | ショップ | なし |
| P010 | 鏡 | SR | 次に受けるダメージをそのまま相手に返す | パック限定 | なし |
| P009 | 入れ替え | SR | 自分の残りカード1枚と相手の残りカード1枚を交換 | ショップ | なし |
| P018 | 暗号化 | SR | 以降、自分の残りカードの種類が相手から見えなくなる。さらに、自分の残りカード1枚の種類を、相手に知られずに変えられる | パック限定 | **新規** |
| P015 | ハッキング | SSR | 相手の残りカードをすべて【パー】に変える | パック限定 | なし |
| P014 | プログラミング | SSR | 相手の残りカードから1枚選び、次のラウンドで出させる | パック限定 | なし |

### 2-4. 内訳

| | N | R | SR | SSR | 合計 |
|---|---|---|---|---|---|
| グー | 4 | 5 | 3 | 2 | 14 |
| チョキ | 4 | 4 | 3 | 2 | 13 |
| パー | 4 | 4 | 3 | 2 | 13 |
| 合計 | 12 | 13 | 9 | 6 | **40** |

---

## 3. 新しいカードのルール詳細

### 3-1. 受け身（G017）：ダメージを減らすシールド
- 「次に受けるダメージを10減らす」シールドを得る。SPEC.md 7-3 の `shield` に `mode: "reduce", amount: 10` を追加する。
- 相手から受ける次の1ヒットを10減らし（0未満にはならない）、そこで消費される。ほかのシールドと同じく、付与された順に1つずつ使う。
- 貫通（電動ドリル）では無視される。

### 3-2. 人力発電（G018）・歯車（G019）
- 既存の部品の組み合わせで表せる（`damage`＋`heal`、`damage`＋`nextRoundModifier`）。
- 歯車の「＋10」は、次のラウンドで出すカードの種類を問わない。ダメージのないカードには影響しない。

### 3-3. てこの原理（G020）：負けているときに2倍
- 効果を解決する時点で、**自分のライフが相手のライフより少なければ**、ダメージが2倍になる（同じなら2倍にならない）。
- 計算の順番：（基本15＋筋トレ値）× 2 → ほかの補正 → シールド（SPEC.md 6-6 の②の倍率として扱う）。
- 新しい部品：`damage` に条件付きの倍率を持たせる（例：`"condition": "selfLifeLower", "multiplierIfCondition": 2`）。

### 3-4. 電動アシスト（G021）
- `trainingMultiplier: 2`（筋トレ値1につき＋2）。既存の仕組みで表せる。

### 3-5. パワードスーツ（G022）：筋トレ値に＋20
- ダメージ計算で、**このカードの筋トレ値に20を足した値**を使う：`30 ＋（筋トレ値＋20）`。
- サンプルカードセット（筋トレ値0扱い）で使っても、＋20は効く（カード自身の効果のため）。筋トレしていない生徒でも強く使える。
- 新しい項目：カードマスタに `trainingBonus`（初期0。パワードスーツは20）を追加する。

### 3-6. くぎ（C016）：げんのうとの組み合わせ
- **バトル開始時のデッキに「げんのう（C003）」が入っていれば**、ダメージが＋15になる（15→30）。げんのうをすでに使ったかどうかは関係ない。
- バトル中の「入れ替え」でげんのうを手に入れたり失ったりしても、判定は変わらない（バトル開始時のデッキで判定する）。
- カードの表示：条件を満たしているときは、くぎのダメージ表示を「30」にし、「げんのうコンボ！」のマークを付ける。
- 新しい部品：`damage` に組み合わせボーナスを持たせる（例：`"comboBonus": {"requiresCardInDeck": "C003", "add": 15}`）。

### 3-7. ドローン（C017）：1枚だけ中身を見る
- 勝った側が、相手の残りカードから1枚を位置で選び、その中身（名前・効果・数値）を見る。以降のバトル中も見え続ける。
- SPEC.md 7-3 の `revealOpponent` に `count`（見る枚数。省略時は全部）を追加する。

### 3-8. おりがみ（P017）
- 手品・催眠術と同じ仕組みで、変える先が【パー】。

### 3-9. 暗号化（P018）：種類を隠し、こっそり変える
- 効果が発動すると、以降のバトル中、**自分の残りカードの種類は相手から「？」で表示される**。
- 発動時に、**自分の残りカード1枚の種類を、好きな種類に変えてよい**（変えなくてもよい）。この変更は相手に知らされない。
  - 理由：相手はそれまでに種類を見ているので、ただ隠すだけでは意味が薄い。「1枚こっそり変えたかもしれない」という疑いが読み合いを生む。
- SSRの裏面の光は、暗号化していても見える（SSRであることはわかるが、種類はわからない）。
- 相手が効果で自分のカードの種類を変えた場合（手品など）、そのカードの変更後の種類は相手に見える（相手自身が変えたため）。
- 場に出して公開されたカードは、通常どおり見える。
- CPU：見えなくなった種類は、残りの種類の可能性から推測して判断する（ズルをして本当の種類を参照しない）。
- オンライン対戦：暗号化した側は、残りカードの種類を相手に送らない。カードを出すときの公開（リビール）で、そのときの種類と、こっそり変えた内容を含めて照合する。両方の端末で状態を一致させる仕組みは、Codexが20章の方式を拡張して設計する。
- 新しい部品：`encrypt`（パラメータ：`secretTypeChange: 1`）。

---

## 4. シードデータ（effects JSON）

`seed/cards.json` を以下の40枚に置き換える。`text`（説明文）は2章の表の「効果」を使う。`image` は `{cardId}.webp`。

```json
[
  {"cardId":"G001","name":"パンチ","type":"rock","rarity":"N","trainingMultiplier":1,"trainingBonus":0,"shopPrice":50,"inPack":true,"effects":[{"type":"damage","amount":20}]},
  {"cardId":"G002","name":"キック","type":"rock","rarity":"N","trainingMultiplier":1,"trainingBonus":0,"shopPrice":50,"inPack":true,"effects":[{"type":"damage","amount":20}]},
  {"cardId":"G018","name":"人力発電","type":"rock","rarity":"N","trainingMultiplier":1,"trainingBonus":0,"shopPrice":50,"inPack":true,"effects":[{"type":"damage","amount":15},{"type":"heal","amount":10}]},
  {"cardId":"G019","name":"歯車","type":"rock","rarity":"N","trainingMultiplier":1,"trainingBonus":0,"shopPrice":50,"inPack":true,"effects":[{"type":"damage","amount":10},{"type":"nextRoundModifier","target":"self","add":10}]},
  {"cardId":"G006","name":"正拳突き","type":"rock","rarity":"R","trainingMultiplier":1,"trainingBonus":0,"shopPrice":150,"inPack":true,"effects":[{"type":"damage","amount":30}]},
  {"cardId":"G007","name":"連続パンチ","type":"rock","rarity":"R","trainingMultiplier":1,"trainingBonus":0,"shopPrice":150,"inPack":true,"effects":[{"type":"damage","amount":10,"hits":3}]},
  {"cardId":"G020","name":"てこの原理","type":"rock","rarity":"R","trainingMultiplier":1,"trainingBonus":0,"shopPrice":150,"inPack":true,"effects":[{"type":"damage","amount":15,"condition":"selfLifeLower","multiplierIfCondition":2}]},
  {"cardId":"G017","name":"受け身","type":"rock","rarity":"R","trainingMultiplier":1,"trainingBonus":0,"shopPrice":150,"inPack":true,"effects":[{"type":"damage","amount":15},{"type":"shield","mode":"reduce","amount":10}]},
  {"cardId":"G021","name":"電動アシスト","type":"rock","rarity":"R","trainingMultiplier":2,"trainingBonus":0,"shopPrice":150,"inPack":true,"effects":[{"type":"damage","amount":15}]},
  {"cardId":"G009","name":"ぶち切れパンチ","type":"rock","rarity":"SR","trainingMultiplier":1,"trainingBonus":0,"shopPrice":400,"inPack":true,"effects":[{"type":"damage","amount":40}]},
  {"cardId":"G010","name":"捨て身タックル","type":"rock","rarity":"SR","trainingMultiplier":1,"trainingBonus":0,"shopPrice":400,"inPack":true,"effects":[{"type":"damage","amount":60},{"type":"selfDamage","amount":25}]},
  {"cardId":"G012","name":"ベアハッグ","type":"rock","rarity":"SR","trainingMultiplier":1,"trainingBonus":0,"shopPrice":400,"inPack":true,"effects":[{"type":"damage","amount":25},{"type":"nullifyOpponentCard","count":1}]},
  {"cardId":"G022","name":"パワードスーツ","type":"rock","rarity":"SSR","trainingMultiplier":1,"trainingBonus":20,"shopPrice":null,"inPack":true,"effects":[{"type":"damage","amount":30}]},
  {"cardId":"G015","name":"ジャイアントスイング","type":"rock","rarity":"SSR","trainingMultiplier":1,"trainingBonus":0,"shopPrice":null,"inPack":true,"effects":[{"type":"damage","amount":30},{"type":"blindOpponent"}]},

  {"cardId":"C002","name":"のこぎり","type":"scissors","rarity":"N","trainingMultiplier":0,"trainingBonus":0,"shopPrice":50,"inPack":true,"effects":[{"type":"damage","amount":30}]},
  {"cardId":"C003","name":"げんのう","type":"scissors","rarity":"N","trainingMultiplier":0,"trainingBonus":0,"shopPrice":50,"inPack":true,"effects":[{"type":"damage","amount":25}]},
  {"cardId":"C016","name":"くぎ","type":"scissors","rarity":"N","trainingMultiplier":0,"trainingBonus":0,"shopPrice":50,"inPack":true,"effects":[{"type":"damage","amount":15,"comboBonus":{"requiresCardInDeck":"C003","add":15}}]},
  {"cardId":"C004","name":"手裏剣","type":"scissors","rarity":"N","trainingMultiplier":0,"trainingBonus":0,"shopPrice":50,"inPack":true,"effects":[{"type":"damage","amount":15,"hits":2}]},
  {"cardId":"C008","name":"火縄銃","type":"scissors","rarity":"R","trainingMultiplier":0,"trainingBonus":0,"shopPrice":150,"inPack":true,"effects":[{"type":"damage","amount":50}]},
  {"cardId":"C006","name":"刀","type":"scissors","rarity":"R","trainingMultiplier":0,"trainingBonus":0,"shopPrice":150,"inPack":true,"effects":[{"type":"damage","amount":40}]},
  {"cardId":"C007","name":"毒矢","type":"scissors","rarity":"R","trainingMultiplier":0,"trainingBonus":0,"shopPrice":150,"inPack":true,"effects":[{"type":"damage","amount":10},{"type":"poison","amount":10}]},
  {"cardId":"C017","name":"ドローン","type":"scissors","rarity":"R","trainingMultiplier":0,"trainingBonus":0,"shopPrice":150,"inPack":true,"effects":[{"type":"damage","amount":20},{"type":"revealOpponent","count":1}]},
  {"cardId":"C010","name":"電動ドリル","type":"scissors","rarity":"SR","trainingMultiplier":0,"trainingBonus":0,"shopPrice":400,"inPack":true,"effects":[{"type":"damage","amount":40,"pierce":true}]},
  {"cardId":"C011","name":"チェーンソー","type":"scissors","rarity":"SR","trainingMultiplier":0,"trainingBonus":0,"shopPrice":400,"inPack":true,"effects":[{"type":"damage","amount":55}]},
  {"cardId":"C013","name":"投石器","type":"scissors","rarity":"SR","trainingMultiplier":0,"trainingBonus":0,"shopPrice":null,"inPack":true,"effects":[{"type":"delayedDamage","amount":60,"afterRounds":1}]},
  {"cardId":"C014","name":"レーザーカッター","type":"scissors","rarity":"SSR","trainingMultiplier":0,"trainingBonus":0,"shopPrice":null,"inPack":true,"effects":[{"type":"damage","amount":60}]},
  {"cardId":"C015","name":"ロボットアーム","type":"scissors","rarity":"SSR","trainingMultiplier":0,"trainingBonus":0,"shopPrice":null,"inPack":true,"effects":[{"type":"damagePerOpponentRemaining","per":20}]},

  {"cardId":"P001","name":"手品","type":"paper","rarity":"N","trainingMultiplier":0,"trainingBonus":0,"shopPrice":50,"inPack":true,"effects":[{"type":"changeOpponentType","to":"rock","count":1}]},
  {"cardId":"P002","name":"催眠術","type":"paper","rarity":"N","trainingMultiplier":0,"trainingBonus":0,"shopPrice":50,"inPack":true,"effects":[{"type":"changeOpponentType","to":"scissors","count":1}]},
  {"cardId":"P017","name":"おりがみ","type":"paper","rarity":"N","trainingMultiplier":0,"trainingBonus":0,"shopPrice":50,"inPack":true,"effects":[{"type":"changeOpponentType","to":"paper","count":1}]},
  {"cardId":"P003","name":"救急箱","type":"paper","rarity":"N","trainingMultiplier":0,"trainingBonus":0,"shopPrice":50,"inPack":true,"effects":[{"type":"heal","amount":30}]},
  {"cardId":"P005","name":"バリア","type":"paper","rarity":"R","trainingMultiplier":0,"trainingBonus":0,"shopPrice":150,"inPack":true,"effects":[{"type":"shield","mode":"half"}]},
  {"cardId":"P007","name":"封印","type":"paper","rarity":"R","trainingMultiplier":0,"trainingBonus":0,"shopPrice":150,"inPack":true,"effects":[{"type":"nullifyOpponentCard","count":1}]},
  {"cardId":"P004","name":"変身","type":"paper","rarity":"R","trainingMultiplier":0,"trainingBonus":0,"shopPrice":150,"inPack":true,"effects":[{"type":"changeOwnType","count":1}]},
  {"cardId":"P008","name":"吸収","type":"paper","rarity":"R","trainingMultiplier":0,"trainingBonus":0,"shopPrice":150,"inPack":true,"effects":[{"type":"drain","amount":20}]},
  {"cardId":"P010","name":"鏡","type":"paper","rarity":"SR","trainingMultiplier":0,"trainingBonus":0,"shopPrice":null,"inPack":true,"effects":[{"type":"shield","mode":"reflect"}]},
  {"cardId":"P009","name":"入れ替え","type":"paper","rarity":"SR","trainingMultiplier":0,"trainingBonus":0,"shopPrice":400,"inPack":true,"effects":[{"type":"swapCards"}]},
  {"cardId":"P018","name":"暗号化","type":"paper","rarity":"SR","trainingMultiplier":0,"trainingBonus":0,"shopPrice":null,"inPack":true,"effects":[{"type":"encrypt","secretTypeChange":1}]},
  {"cardId":"P015","name":"ハッキング","type":"paper","rarity":"SSR","trainingMultiplier":0,"trainingBonus":0,"shopPrice":null,"inPack":true,"effects":[{"type":"changeAllOpponentType","to":"paper"}]},
  {"cardId":"P014","name":"プログラミング","type":"paper","rarity":"SSR","trainingMultiplier":0,"trainingBonus":0,"shopPrice":null,"inPack":true,"effects":[{"type":"forceOpponentNext"}]}
]
```

---

## 5. 段階4で追加する順番

一度に全部入れず、遊びながら少しずつ増やす。弾ごとにオーナーのチェックを受ける（画像は5枚程度ずつ生成してチェック）。

| 弾 | 追加するカード | ねらい |
|---|---|---|
| 第1弾 | 正拳突き、のこぎり、救急箱、催眠術、おりがみ、レーザーカッター（SSR） | 3種類の基本、種類を変えるカード、SSRのルールを試す |
| 第2弾 | バリア、封印、ベアハッグ、刀、毒矢、吸収 | シールド、SSR対策、継続ダメージ、回復を試す |
| 第3弾 | 人力発電、歯車、げんのう、くぎ、手裏剣、受け身、てこの原理、電動アシスト、連続パンチ、ドローン、変身 | 技術らしいカード、組み合わせ、逆転、筋トレとの相性 |
| 第4弾 | ぶち切れパンチ、捨て身タックル、電動ドリル、チェーンソー、投石器、鏡、入れ替え、暗号化、パワードスーツ、ジャイアントスイング、ロボットアーム、ハッキング、プログラミング | パックの目玉（SR・SSR） |

- 追加仕様書 No.01 の「試作用の仮SSRカード」（調整画面のスイッチ）は、第1弾でレーザーカッター（60ダメージ）を正式に追加した時点で役目を終える。

---

## 6. 新しいカードの画像プロンプト（たたき台）

共通スタイルと進め方は SPEC.md 23章（およびチェック1で確定したスタイル）に従う。題材は以下を使う。

| ID | 名前 | 題材 |
|---|---|---|
| G017 | 受け身 | a student performing a judo breakfall roll, safely absorbing impact, swirl of motion |
| G018 | 人力発電 | a student punching a glowing hand-crank generator that lights up bulbs, electric sparks |
| G019 | 歯車 | a fist surrounded by large interlocking spinning gears transmitting power |
| G020 | てこの原理 | a student using a long lever to lift a huge boulder with a small push, fulcrum visible |
| G021 | 電動アシスト | a student wearing a motorized arm brace with glowing motors, powerful punch |
| G022 | パワードスーツ | a student inside a sleek high-tech powered exoskeleton suit, heroic pose, glowing joints |
| C016 | くぎ | a shiny steel nail being driven into wood, sharp sparks, close-up dynamic angle |
| C017 | ドローン | a quadcopter drone with a camera scanning with a blue light beam |
| P017 | おりがみ | colorful origami cranes and paper shapes folding themselves in the air |
| P018 | 暗号化 | a glowing padlock made of digital code with scrambled light symbols, mysterious |

残ったカードの題材は、SPEC.md 23-3 のものを使う。

---

## 7. 保留にしたカード（実装しない）

以下は今回の40枚から外した。弱いからではなく、役割がほかのカードと重なったため。**実装しない。** 将来、拡張パックや期間限定パックの候補として、SPEC.md の付録に名前と効果だけ残しておく。

| ID | 名前 | 外した理由（役割を引き継いだカード） |
|---|---|---|
| G003 | 頭突き | 反動つきの一撃 → 捨て身タックル |
| G004 | 張り手 | 相手の弱体化 → 受け身・バリア |
| G005 | タックル | 強いグー → 正拳突き・ぶち切れパンチ |
| G008 | 気合いため | 次への強化 → 歯車 |
| G011 | 根性パンチ | 逆転 → てこの原理 |
| G013 | マッスルポーズ | 筋トレで化ける → 連続パンチ・電動アシスト |
| G014 | 百裂拳 | 重い一撃 → 捨て身タックル |
| G016 | 伝説の拳 | 筋トレ×SSR → パワードスーツ |
| C001 | パチンコ | Nの素直なダメージ → のこぎり |
| C005 | 弓矢 | 時間差 → 投石器・毒矢 |
| C009 | ブーメラン | 印象が弱い |
| C012 | 大砲 | 重い一撃 → チェーンソー |
| P006 | のぞき見 | 情報 → ドローン |
| P011 | 応援団 | 次への強化 → 歯車 |
| P012 | 太陽光パネル | 回復 → 救急箱・吸収 |
| P013 | ファイアウォール | 強い守り → 鏡 |
| P016 | AI | あいこ操作 → SSRのルールと重なる |

---

## 8. SPEC.md の修正箇所

| SPEC.md の場所 | 修正内容 |
|---|---|
| 8章 カード候補一覧 | 2章の40枚に置き換える。前の候補は付録「保留カード」に移す |
| 8-4 シードデータ | 4章のJSONに置き換える |
| 7-1 カードマスタの項目 | `trainingBonus`（筋トレ値への上乗せ。初期0）を追加 |
| 7-3 効果プリミティブ | `shield` の `mode: "reduce"`、`damage` の条件付き倍率（`condition`/`multiplierIfCondition`）、`damage` の組み合わせボーナス（`comboBonus`）、`revealOpponent` の `count`、`encrypt` を追加 |
| 6-6 ダメージ計算 | ①を「基本値＋（筋トレ値＋trainingBonus）×筋トレ倍率」にする。てこの原理の倍率は②で扱う |
| 9章 サンプルカードセット・CPUデッキ（仮） | CPU Lv1 のパチンコ（保留）をげんのうに変更。そのほかは変更なし（すべて40枚に含まれる） |
| 10章 CPUの思考 | 暗号化で見えなくなった種類は、可能性から推測する（本当の種類を参照しない）ことを追記 |
| 20章 オンライン対戦 | 暗号化（種類を隠す・こっそり変える）に対応した公開・照合の方式を追記 |
| 23-3 画像の題材 | 6章の新しいカードを追加し、保留カードを外す |
| ★-4 段階4 | 5章の追加順を追記 |
