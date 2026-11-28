# クリスマスイベント：合意した仕様と準備状況

## サンタパンチ

- グー / SSR。30ダメージ＋自分のHPを10回復。通常の回復は最大HPまで。
- 筋トレ上限＋20。筋トレ最大時は50ダメージ。SSRはデッキに1枚までで、あいこでも発動する。
- カードID候補：G023。画像は完成。カードマスターへの登録・販売・排出はまだ有効にしていない。
- [カード画像](../public/images/cards/G023-front.webp) / [生成原本](../design-source/christmas/santa-punch.png)

## 全ミッション達成報酬：クリスマスフレーム

- デッキのカード1枚に装着。そのカードの効果発動時に、自分のHPを追加で10回復する。
- この追加回復は最大HPを超えられる。元のカードの回復上限とは分けて処理する。
- 使用済みカードは手札から外れ、入れ替えの対象も残りカードだけなので、同じカードを再使用する仕組みはない。「1対戦につき1回」という追加説明は付けない。
- ダメージ＋10は採用しない。

## ミッション候補

- 特別テストで満点を取る。
- 今年の技術の授業の振り返りと、今後の抱負を別の授業アプリから提出する。
- クリスマス限定CPUに指定回数勝つ。
- オンライン対戦で指定回数勝つ。

開催期間、対象テスト・授業ID、CPUの構成、必要勝利数、パック価格・排出設定は未確定。イベント画面・フレーム機能は未実装。授業時間帯のログイン確認も、学校の時間割画像の受領後に対応する。

## 画像生成記録

内蔵 image_gen を使用。正拳突き（G006）を枠・エンブレムの参照、ジャイアントスイング（G015）をSSRの質感の参照として生成。アプリ用WebPは原本を1024×1365にリサイズして保存。

プロンプト全文：

```text
Use case: stylized-concept. Create ONE finished Japanese collectible game card, portrait 3:4, edge to edge, matching the Gカード reference images. Image 1 (正拳突き) defines the exact visual language: top-left circular GOLD FIST emblem, black/navy title plaque with bold white Japanese text, top-right glowing gold circle same diameter/position, white jagged effect panel at the bottom. Image 2 defines SSR rainbow holographic foil quality. New Christmas exclusive SSR card name サンタパンチ. Main illustration: a confident youthful anime hero in a richly detailed scarlet Santa coat with white fur, gold embroidery, winter cape, delivering a spectacular foreshortened punch with a red-and-gold festive gauntlet toward camera; warm cheerful determination, dynamic composition clearly distinct from reference; snowflakes, radiant gold starbursts, crystalline ornaments, luxurious red/emerald/gold festive magic and layered prismatic foil. Make a highly desirable premium event collectible, astonishing craftsmanship, readable at thumbnail size. Keep the established gold rock-card jagged border and coherent UI, but adorn with subtle holly and jewel details. Top title text verbatim: サンタパンチ. Add a small tasteful SSR mark. Bottom effect text verbatim on two balanced lines: 30ダメージを与え、 / 自分のHPを10回復する . The slash means line break and must NOT be printed. No extra rules text, no watermark, no mockup, no surrounding background, all corners visible. Retain circular gold top-right circle, not a Christmas icon in place of it.
```
