# クリスマスページと画像の改訂（2026-11-28）

- 内蔵image_genで、サンタアッパーの突き上げる拳・指・手首を局所修正。顔・衣装・カード名・効果・カードIDは保持。
- 赤・深緑・白・シルバーのクリスマス限定パックを新規生成。文字を入れず、雪の結晶、ヒイラギ、リボンを採用。透過背景を保持してWebPに変換した。
- イベントページ全体を赤・緑・白のテーマに変更。ガーランド、穏やかな照明、オーナメント、雪を追加。動きを減らす設定では雪と照明のアニメーションを停止する。
- 冒頭のカード・パック・フレーム単体の3点紹介を維持し、ページ内ナビゲーション、ミッション、報酬、価格と枚数を示す限定パック紹介、サンタ対戦の順に構成。
- 進捗判定、カード性能、購入処理、イベントの公開状態・開催設定は変更しない。

## 保存先

- 修正カード原本：`design-source/christmas/santa-upper-hand-fixed.png`
- アプリ用カード：`public/images/cards/G023-front.webp`（1024×1365）
- 限定パック原本：`design-source/christmas/christmas-pack.png`
- アプリ用パック：`public/images/packs/christmas.webp`（768×1152、アルファ付き）
- 過去の原本は履歴として保持。

## 確認

`npm run build` が完了。APIを代替データにしたローカルChromeで1366px・768px・390px幅を確認し、3画像の読み込み、横方向のはみ出し、ページ内リンク、動きを減らす設定で雪と照明が停止することを確認した。カード・パックの性能や開催設定に変更はない。

## 拳の修正プロンプト

編集対象：修正前の `public/images/cards/G023-front.webp`。

```text
Use case: precise-object-edit / anatomy correction. Edit the provided G-card サンタアッパー image. Make a localized correction to the RAISED UPPERCUT HAND and its wrist/forearm ONLY, preserving the rest of the finished card as closely as possible. The current raised fist appears twisted and anatomically unnatural. Redraw it as a convincing anatomically correct closed white-gloved human fist: four naturally curled fingers with four coherent knuckles, exactly one thumb folded securely OUTSIDE the curled fingers on the anatomically correct side, no extra digits, no fused fingers, no backward hand, no thumb tucked inside the fist. Align the fist and wrist naturally with the forearm, no broken or excessively bent wrist; make the elbow-to-forearm-to-wrist connection physically plausible in a powerful upward uppercut. The upward strike must remain obvious, dynamic and full power, but natural anatomy takes priority. Preserve Santa's exact existing elderly face, white flowing beard, smile, scarlet silver-embroidered coat and hat, other hand, gold/snow energy arc and Christmas background. Keep the gold rock-card border, top-left gold fist emblem, top-right gold circle, SSR badge, all positions, premium holographic finish, card proportions and all card typography unchanged. Exact title remains サンタアッパー. Bottom Japanese text remains two lines: 30ダメージを与え、 / 自分のHPを10回復する (slash is a line break, do not print slash). Portrait 3:4 edge-to-edge card, no outside mockup background.
```

## 新規パックの生成プロンプト

```text
Use case: stylized-concept / product-mockup. Create ONE premium Christmas-exclusive collectible card booster PACK asset for the Japanese fantasy game Gカード. Portrait 2:3 composition, front-facing unopened metallic foil pouch, straight-on with believable foil folds, crimped sealed top and bottom and neat serrated edges, entire pack visible with a small transparent margin. Truly transparent alpha background, no floor, no cast shadow outside the pack, no hands or people, not a gift box and not a game card. Main Christmas palette: rich scarlet RED and deep evergreen GREEN, frosty snow WHITE and SILVER, with elegant thin gold jewelry-like accents. Bold readable silhouette at thumbnail size. Red metallic foil body, deep emerald side panels, graceful white snowflake patterns and frosted silver filigree, evergreen holly leaves and red berries. A luxurious central Christmas star gem within a silver snowflake/wreath crest, a rich red ribbon and ornate small bow as printed/embossed packaging decoration. Magical glitter, icy light and premium prismatic foil shimmer, festive, exciting and coherent with an ornate high-quality anime trading-card game. Keep a clear central emblem and balanced craftsmanship, festive without clutter. Absolutely NO TEXT: no Japanese, no letters, no numbers, no rarity labels, no logos, no watermarks. Avoid purple hourglasses, clocks or crescent moon motifs. Output a polished isolated pack illustration ready to place on the game event page and shop.
```
