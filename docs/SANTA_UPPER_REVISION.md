# サンタアッパーへの変更（2026-11-28）

- G023は同じカードIDのまま「サンタアッパー」に改名。所持・筋トレ・デッキ・収録設定・30ダメージ＋10回復の性能は保持する。
- 内蔵image_genで既存G023を編集。CPUサンタの顔と衣装を参照し、全力で下から拳を突き上げるアッパーに変更した。
- 原本：`design-source/christmas/santa-upper.png`。アプリ用：`public/images/cards/G023-front.webp`（1024×1365）。旧画像の原本は履歴として保持。
- イベント冒頭に、カード・クリスマス限定パック・フレーム単体を並べて表示する。パックとフレームは既存画像を使用。
- 説明は「フレームを装着したカードの効果が発動すると、HP+10。」に統一。サンタCPUの先読み説明はイベント紹介から削除。
- 既存シートの旧名称もAPIでは新名称を返し、管理画面を開いたときに名称列だけ更新する。イベントの公開状態・開催設定は変更しない。

## 生成プロンプト

編集対象：`public/images/cards/G023-front.webp`（変更前）。人物の参照：`public/images/cpu/santa.webp`。

```text
Use case: compositing / stylized-concept game-card edit. Edit reference image 1 (the existing G023 サンタパンチ card) into a finished portrait 3:4 premium SSR card called サンタアッパー. Reference image 2 is the mandatory identity reference: use the EXACT same elderly Santa CPU character's face and clothing: mature warm confident face, long flowing white moustache and beard, thick white eyebrows, scarlet Santa hat, deep red fur-trimmed silver-snowflake-embroidered coat. NOT the boy from image 1. The action MUST be a spectacular FULL-POWER UPPERCUT, NOT a forward straight punch: low camera angle, bent elbow, fist driving forcefully UPWARD from below the waist toward the upper illustration area, powerful torso rotation, an unmistakable upward arcing trail of blazing gold and icy snow energy, coat and beard whipping upward with movement. Make the fist, face and uppercut silhouette readable at thumbnail size. Show one Santa only, no opponent, no cards held in his hands, no gloves holding cards. Keep anatomy coherent and recognizable as the Santa in image 2, with a powerful joyful determined expression. Preserve the G-card style and UI of image 1: gold fist emblem in top-left, navy/black name bar with white Japanese title, glowing GOLD circular damage area in top-right, similar sizes/positions; luxurious faceted GOLD rock-card border with holly, jewels, snowy Christmas sparkle and rainbow holographic SSR finish; SSR badge. Maintain clear separation between action illustration and text panels; leave all corners visible, no mockup or outside background. Exact title text: サンタアッパー . Exact bottom effect text on TWO balanced lines: 30ダメージを与え、 / 自分のHPを10回復する . The slash means a line break and must not be printed. Preserve these game mechanics and wording. Make it gorgeous, dynamic, festive, desirable as a Christmas exclusive.
```
