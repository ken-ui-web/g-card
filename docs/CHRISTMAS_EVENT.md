# クリスマスイベント：合意した仕様

本番機能を実装済み。初期状態は非公開です。準備・公開手順と検証内容は [運用手順](CHRISTMAS_OPERATIONS.md) を参照してください。

## サンタアッパー

- グー / SSR。30ダメージ＋自分のHPを10回復。通常の回復は最大HPまで。
- 筋トレ上限＋20。筋トレ最大時は50ダメージ。SSRはデッキに1枚までで、あいこでも発動する。
- カードID：G023。カードマスターに登録し、開催期間中の限定パックだけに排出する。通常40枚のパックには混ぜない。
- 採用画像は、サンタCPUと同じ顔・衣装のサンタクロースが全力でアッパーするカード。
- [カード画像](../public/images/cards/G023-front.webp) / [拳を修正した原本](../design-source/christmas/santa-upper-hand-fixed.png) / [最新のデザイン・生成記録](CHRISTMAS_FESTIVAL_DESIGN.md)

## 全ミッション達成報酬：クリスマスフレーム

- デッキのカード1枚に装着。そのカードの効果発動時に、自分のHPを追加で10回復する。
- この追加回復は最大HPを超えられる。元のカードの回復上限とは分けて処理する。
- 獲得したフレームは、イベント終了後も見た目・回復効果とも引き続き利用できる。今後のフレームも扱える仕組みとして設計する。
- 白銀の見た目・隙間のない装着表示・強めの雪ときらめきは了承済み。保存済みデッキから装着先を直接選ぶ。
- 獲得時にアニメーションで知らせ、効果・使い方を説明して装着画面へ案内する。
- 使用済みカードは手札から外れ、入れ替えの対象も残りカードだけなので、同じカードを再使用する仕組みはない。「1対戦につき1回」という追加説明は付けない。
- ダメージ＋10は採用しない。

## ミッション候補

- 先生が既存のテスト作成機能で用意した特別テストで満点を取る。
- 先生が既存のテスト作成機能で用意した、今年の技術の授業の振り返りと今後の抱負を問う自由記述テストで、必須記述を入力して提出する（採点は不要）。
- イベント用の学習ミッションはこの2つのテストIDで判定し、別アプリの振り返り提出とは連携しない。通常の振り返り報酬機能は従来どおり。
- クリスマス限定CPUに指定回数勝つ。
- オンライン対戦で指定回数勝つ。

## 限定CPU

- キャラクターはサンタクロース。通常のレベル3を超える専用の最上位AIを目指す。
- カード効果、残りラウンド、ライフ、公開情報から先読みし、勝率を重視して行動する設計。既存CPUとの対戦などで強さと端末の応答時間を検証する。

## 管理画面とイベント案内

- 開催期間・必要勝利数・対象テスト・振り返り課題・限定パックの設定を管理画面で変更できるようにする。
- 準備中は先生用プレビューで確認し、設定不足を検査してから公開ボタンひとつで背景・ミッション・限定CPU・限定パックをまとめて公開する。
- イベント説明画面には、参加方法、4種類のミッション、サンタアッパーの画像・効果・入手方法、フレームの効果・装着方法・終了後も使えることを載せる。
- イベント終了時は限定販売とミッションを終了し、獲得済みのカード・フレームは保持する。停止や再公開で進捗を初期化しない。
- 特別ミッションとフレーム報酬は学校アカウントを対象とする想定。

課題は2つとも先生が作成し、達成条件は「知識テストは満点・自由記述テストは必須記述を入力して提出」で確定。限定パックのSSR枠に通常SSRも含めるかは未決定。具体的な開催日時・必要勝利数・対象テスト・パック価格・収録カード・排出率は管理画面で設定する。イベント画面・限定CPU・フレーム機能は実装済み。授業時間帯のログイン確認も、学校の時間割画像の受領後に対応する。

## フレームの確認用見本（2026-11-28）

- 金・リースの旧2案は不採用。雪の白とシルバーの新フレームと、カードにフィットする表示は先生の了承済み。
- 装着カードのイラスト部分に雪が降り、枠の結晶がきらめく見本を追加。カード名・種類・効果欄を避ける。動きを減らす端末設定にも対応。
- フレームとカードの間の隙間をなくすため、カードを拡大してフレームの裏へ重ねる表示に調整。枠の内側がカードへ侵入してよいという先生の指示に合わせた確認用表示。
- 了承後、雪ときらめきをさらに分かりやすくする指示に合わせ、粒・結晶の大きさ、明るさ、量、きらめきの頻度を強化。
- 操作A：デッキ4枚から直接装着先を選ぶ。操作B：フレームを開いてから装着先の選択画面を開く。
- 本番は操作Aを採用。フレームタブで保存済みデッキの1枚を直接選び、付け替えを保存する。
- 獲得アニメーション、使い方の案内、イベント紹介画面も確認用に作成。当時の見本はメモリーだけで管理し、学校データを変更しなかった。本番は学校側に所持・装着状態を保存する。
- 最新見本の出力先：`outputs/christmas-frame-brighter-preview/`。HTMLは画像も埋め込んだ1ファイルで開ける。3種類のカードでの見本、操作案の画面、降雪・きらめきGIFも同じフォルダー。隙間調整時は `outputs/christmas-frame-fitted-preview/`、隙間調整前の白銀案は `outputs/christmas-frame-silver-preview/`、旧2案は `outputs/christmas-frame-preview/` に保持。
- ソース保存先：ローカルブランチ `prototype/christmas-frame-20261128`、作業ツリー `.tmp/christmas-frame-preview/`。最新の詳細・生成プロンプトは同ブランチの `docs/CHRISTMAS_FRAME_SILVER_REVISION.md`、旧見本は `docs/CHRISTMAS_FRAME_PROTOTYPE.md`。

## 画像生成記録（旧サンタパンチの履歴）

内蔵 image_gen を使用。正拳突き（G006）を枠・エンブレムの参照、ジャイアントスイング（G015）をSSRの質感の参照として生成。アプリ用WebPは原本を1024×1365にリサイズして保存。

プロンプト全文：

```text
Use case: stylized-concept. Create ONE finished Japanese collectible game card, portrait 3:4, edge to edge, matching the Gカード reference images. Image 1 (正拳突き) defines the exact visual language: top-left circular GOLD FIST emblem, black/navy title plaque with bold white Japanese text, top-right glowing gold circle same diameter/position, white jagged effect panel at the bottom. Image 2 defines SSR rainbow holographic foil quality. New Christmas exclusive SSR card name サンタパンチ. Main illustration: a confident youthful anime hero in a richly detailed scarlet Santa coat with white fur, gold embroidery, winter cape, delivering a spectacular foreshortened punch with a red-and-gold festive gauntlet toward camera; warm cheerful determination, dynamic composition clearly distinct from reference; snowflakes, radiant gold starbursts, crystalline ornaments, luxurious red/emerald/gold festive magic and layered prismatic foil. Make a highly desirable premium event collectible, astonishing craftsmanship, readable at thumbnail size. Keep the established gold rock-card jagged border and coherent UI, but adorn with subtle holly and jewel details. Top title text verbatim: サンタパンチ. Add a small tasteful SSR mark. Bottom effect text verbatim on two balanced lines: 30ダメージを与え、 / 自分のHPを10回復する . The slash means line break and must NOT be printed. No extra rules text, no watermark, no mockup, no surrounding background, all corners visible. Retain circular gold top-right circle, not a Christmas icon in place of it.
```
