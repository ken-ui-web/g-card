# 段階1の画像生成記録

生成方法：imagegen built-in。各画像を個別に生成し、アプリ用に WebP または透過PNGへ変換した。**最初の試作の表面は採用されず、以下の旧プロンプトは履歴として残す。グーの裏面は採用済み。新しい表面3案は後半に記録する。**

## 共通方針

- 中学生向けのカードゲーム。明るい色、太くはっきりした輪郭、セル調の塗り、技術・歯車のモチーフ。
- 台紙・裏面・小物の質感は金色エナメル、濃紺の縁、真鍮の立体感、左上からの光でそろえる。
- 初回試作では画像内に文字・数字を入れなかった。チェック1後は、完成した表面画像に正確な日本語を焼き込む。けが・流血・残酷な表現、実在人物や既存キャラクターを入れない。
- 透過画像は生成時に透明背景を指定した。カードイラストは768×1024、台紙・枠・裏面は1024×1365、小物は仕様書の寸法へ変換した。

## 使用したプロンプト

### パンチ・初回試作（`design-source/old-front/G001-girl.webp`）

> Use case: illustration-story. Asset type: Gカード G001 パンチのカードイラスト。Trading card game illustration for junior high school students, vibrant and cool, bold clean outlines, cel shading, dynamic composition, bright saturated colors, subtle technology and engineering motifs, centered subject, kid-friendly, portrait 3:4. A sporty junior high school student of ambiguous gender in simple athletic clothing throwing a powerful straight punch toward the viewer, impact burst. Warm yellow and orange radial energy background. A confident lively expression; hand and face clear even when downscaled. Full illustration only, no trading card border or UI. No blood, no gore, no violence injury, no text, no letters, no numbers, no logos, no watermark, no real person or existing character.

### グーの台紙・初回試作（`design-source/old-front/base-rock.webp`）

> Use case: product-mockup. Asset type: 3:4 background image for a junior high trading card game. A warm yellow and amber card base with polished enamel and technology/gear ornaments, bold clean outlines, cel-shaded game UI style. Empty name plate across top, large empty rectangular illustration window in middle, empty round attack badge recess at top right, empty rarity/training strip under art, empty readable effect text box at bottom. These must be visibly blank and light enough for dark app-rendered Japanese text. Flat front view, exact symmetric alignment, safe inset margins. No picture, no hand icon, no text, no letters, no numbers, no logos, no watermark.

### N枠・初回試作（`design-source/old-front/frame-n.png`）

> Use case: product-mockup. Asset type: transparent overlay frame for a 3:4 Japanese trading card. N (normal) rarity: sturdy polished warm graphite and antique brass border with clean bevel, subtle engineering engravings, thick readable outline and four reinforced corners, consistent top-left lighting, bold cel-shaded game UI look. Flat straight-on front view, aligned to full canvas edge, large completely transparent rectangular center so card art and text beneath remain visible. No background fill, no picture, no text, no letters, no numbers, no logos, no watermark.

### グーの裏面（`public/images/card-parts/back-rock.webp`）

> Use case: product-mockup. Asset type: complete reverse side of a 3:4 junior high trading card. Warm yellow and amber polished enamel, rich navy and bronze details, symmetrical gear and circuit ornament, a large unmistakable clenched fist emblem centered inside a gear-shaped medallion, a geometric gear-shaped G emblem impression as shape only. Bold clean outlines, cel-shaded game UI, subtle top-left glow, high contrast at small size, flat front-on view. No text, no letters, no numbers, no watermark.

### グーの手アイコン（`design-source/hand-rock.png`）

> Use case: stylized-concept. Asset type: transparent game UI icon for rock hand type on a junior high trading card. Single bold clenched fist facing viewer, golden yellow enamel with navy outline and subtle bronze metallic bevel, clean silhouette legible at 32 pixels, consistent top-left lighting, cel-shaded, centered square composition. No background, no circle plate, no text, no letters, no numbers, no watermark.

### 攻撃力バッジ・初回試作（`design-source/old-front/badge-power.png`）

> Use case: stylized-concept. Asset type: transparent round attack power badge for a junior high trading card. Polished bronze and gold enamel round emblem with a tiny crossed sword and fist motif subtly at top edge, large completely EMPTY light center for a number drawn later by app, bold navy outline, soft bevel, top-left lighting, clear at small size, centered square. No background, no text, no letters, no numbers, no watermark.

### レア度の星（`design-source/star.png`）

> Use case: stylized-concept. Asset type: transparent rarity star icon for a junior high trading card. One shiny five-point gold star, thick navy outline, polished enamel, top-left lighting, highly legible at 32 pixels, isolated centered square. No background, no other shapes, no text, no letters, no numbers, no watermark.

### 筋トレバッジ（`design-source/badge-muscle.png`）

> Use case: stylized-concept. Asset type: transparent training badge for a junior high trading card. Polished golden yellow enamel round emblem with simple flexed arm symbol, a small clean EMPTY lower plate where the app can show a number, bold navy outline, soft bevel, top-left lighting, clear at small size, centered square. No background, no text, no letters, no numbers, no watermark.

## チェック1後：表面の再提案

- 裏面：`public/images/card-parts/back-rock.webp` を採用確定。画像とプロンプトを変更しない。
- 共通イラスト：`design-source/G001-boy.webp`。以前の絵を編集し、短い黒髪の男の子に変更。同じ絵を3案すべてに使用。
- 表面：`public/images/cards/G001-front-a.webp`、`G001-front-b.webp`、`G001-front-c.webp`。背景デザインの生成素材は `design-source/front-a-base.webp` などに保存。
- 各表面は `npm run build:card-fronts` で1枚のWebPにする。生成素材と男の子の絵に、種類アイコン・星・筋トレアイコン、カード名「パンチ」、レア度「N」、種類「グー」、基本攻撃力「20」、効果「20のダメージを与える」、筋トレ欄の見出しを焼き込む。ブラウザ側で描画するのは筋トレ後の `+n` だけ。

### 共通イラスト（男の子）

> Use case: precise-object-edit. Edit target: the attached G001 punch illustration. Replace the central student with a clearly male junior high school boy, short sporty dark hair, boyish face, athletic shirt, energetic confident expression. Keep the strong straight punch toward viewer, the orange and yellow impact burst, vivid cel-shaded trading-card illustration style, bold outlines, composition and 3:4 portrait framing. Keep the punch silhouette and dramatic light. No card border or UI. No text, no letters, no numbers, no logos, no watermark, no injury or gore. Output one clean illustration to reuse identically in three card front proposals.

### 案A：王道バトル

> Use case: product-mockup. Asset type: 3:4 complete blank front design template for a Japanese junior-high trading card, proposal A classic martial arts. Straight-on flat card, warm golden yellow and polished brass with dark navy outline, bold cel-shaded game UI, thick sturdy corners, symmetrical geometric ornaments. Reserve an empty wide title bar at y 4-14% and an empty large image rectangle at x 8-92%, y 18-72%, plus an empty cream effect panel at y 76-94%. Clear small reserved power circle near upper right and blank training number cartouche near lower right. These regions must be clean, flat, and unobstructed because exact illustration and Japanese text will be composited later. No person, no illustration, no icons, no writing, no text, no letters, no numbers, no logos, no watermark. Flat orthographic view, no perspective, full bleed card art.

### 案B：マンガの勢い

> Use case: product-mockup. Asset type: 3:4 complete blank front design template for a Japanese junior-high trading card, proposal B energetic manga action. Flat straight-on card, vivid golden yellow and orange with navy-black angular armor, bold comic impact lines and dynamic diagonal border pieces, fun cel-shaded game style, top-left lighting. Reserve a clean dark navy title band at y 3-16%, an empty large image window x 6-94% y 18-73%, and an empty pale yellow slanted but readable effect panel y 78-94%; blank attack medallion at top right, blank small training number inset at lower right. Keep these reserved regions unobstructed for exact inserted art and Japanese text. No person, no illustration, no icons, no writing, no text, no letters, no numbers, no logos, no watermark. Flat orthographic view, no perspective.

### 案C：技術・機械

> Use case: product-mockup. Asset type: 3:4 complete blank front design template for a Japanese junior-high trading card, proposal C technology workshop. Flat straight-on card, deep navy metal and sunny yellow enamel, subtle gears, circuits and precise engineering ticks, cleaner and calmer than a comic design, sharp rectangular geometry, bold accessible contrast, top-left lighting. Reserve a clean light yellow name band at y 3-17%, an empty large rectangular illustration screen x 8-92% y 20-69%, and an empty light cream lower information panel y 74-94%. Blank attack circle at upper right, blank training number recess at bottom right. All reserved regions clean and unobstructed for exact art and Japanese text. No person, no illustration, no icons, no writing, no text, no letters, no numbers, no logos, no watermark. Flat orthographic view, no perspective.

上記3案からB案を採用。2026-10-03に、既存のB案を参照して次の1枚を編集生成した。採用ファイルは `public/images/cards/G001-front.webp`（1024×1365）。右上の円は空欄で、最終ダメージを画面で表示する。裏面は変更しない。

> Precise edit of the attached B proposal card front. Preserve the exact dynamic manga layout, warm yellow-orange and navy palette, energetic boy punching illustration, clenched fist icon, title パンチ, and effect text 20のダメージを与える. Remove all rarity symbols and labels, the literal グー text, and the entire training badge and labels including 筋トレ and +0. Erase the number 20 from the upper-right damage medallion, leaving a clean blank yellow circle where the app can overlay only the final damage number. Keep the title and effect legible and baked into this single complete card image. Do not add any other text or numbers.

## 確定版：表面全体を一体生成（2026-10-03）

上の編集画像は部品合成によるB案が元だったため、以下のプロンプトで全体を改めて画像生成した。入力のB案画像は**デザインの参考**であり、枠・人物・文字を別素材として合成していない。出力した1枚をWebPへ変換し、`public/images/cards/G001-front.webp` に保存した。今後のカード表面も一体生成する。`tools/build-card-fronts.cjs` は過去の試作記録であり、使わない。

> Use case: illustration-story. Asset type: a finished Japanese trading card FRONT, one single cohesive raster illustration, portrait 3:4. Use the attached B-design card ONLY as visual direction for the energetic manga composition, warm golden yellow/orange with dark navy angular frame, and the same concept of a sporty short-haired junior-high boy punching toward the viewer. REGENERATE AND REDRAW THE ENTIRE CARD AS ONE UNIFIED IMAGE from edge to edge: the border, title panel, fist symbol, boy, action burst, effect panel and lettering must look created together with consistent brushwork, perspective, lighting and texture. Do not paste, inset, composite, overlay, or frame a separately made character illustration or any separate asset. This must not look like an illustration laid into a preexisting card template. Integrate the figure naturally with the dramatic speed lines and frame; keep the boy's face, fist and dynamic punch clear. At upper left, incorporate a small golden clenched-fist symbol as the card-type indication. At the top, write the card name exactly and legibly: 『パンチ』. In the lower effect area, write exactly and legibly: 『20のダメージを与える』. These two phrases and the fist symbol are intrinsic parts of the generated image. At upper right, include a clean bright yellow circular medallion with absolutely no text or number inside; the application will later overlay the final damage there. Do not show rarity, stars, N, the word グー, the word 筋トレ, +0, training symbols or badges, other captions, additional digits, logos, watermarks, blood or injury. Flat straight-on full-bleed card front, polished and readable at small card size. Generate just ONE complete image.

## チョキとパーの裏面（2026-10-03）

種類色は仕様書どおりチョキ＝青、パー＝緑。採用済みのグーの裏面を各生成の参考画像として使い、歯車と回路の対称的な構図をそろえた。出力はそれぞれ1枚の画像で、1024×1365のWebPに変換した。表面の一体生成方針も第一弾の基準としてオーナーに承認された。

### チョキ（`public/images/card-parts/back-scissors.webp`）

> Use case: precise-object-edit. Asset type: complete back side of a Japanese junior-high trading card, portrait 3:4. The attached image is the approved ROCK card back and is a style/layout reference. Create the SCISSORS (チョキ) back as one cohesive full-bleed image in the same family: preserve the exact symmetrical framing language, central gear medallion size and position, polished enamel, circuit traces, small gears, bevels, bold clean cel-shaded outlines and premium lighting. Change the dominant type color from gold/yellow to a vivid COOL BLUE palette: royal blue and cyan enamel, metallic silver-blue highlights, deep navy shadows. The central emblem must be a single unmistakable human hand showing the scissors/peace V sign, palm toward viewer: index and middle fingers raised and clearly separated, ring and little fingers folded down under the thumb. Give it crisp, readable silhouette at thumbnail size and fit it fully inside the central medallion. Re-render all surfaces and emblem harmoniously as one illustration; no pasted-on icon. Flat straight-on view, symmetric ornamental card back, no perspective, no words, no letters, no numbers, no watermark, no extra icons, no fist, no open palm, no weapons, no injury. One image only.

### パー（`public/images/card-parts/back-paper.webp`）

> Use case: precise-object-edit. Asset type: complete back side of a Japanese junior-high trading card, portrait 3:4. The attached image is the approved ROCK card back and is a style/layout reference. Create the PAPER (パー) back as one cohesive full-bleed image in the same family: preserve the exact symmetrical framing language, central gear medallion size and position, polished enamel, circuit traces, small gears, bevels, bold clean cel-shaded outlines and premium lighting. Change the dominant type color from gold/yellow to a vivid GREEN palette: emerald and jade enamel, bright lime-green highlights, deep forest-green and navy shadows, subtle silver accents. The central emblem must be a single unmistakable human OPEN PALM facing viewer with all FIVE fingers extended and visibly separated, thumb clearly projecting to one side, complete palm fully inside the medallion. Crisp readable silhouette at thumbnail size. Re-render all surfaces and emblem harmoniously as one illustration; no pasted-on icon. Flat straight-on view, symmetric ornamental card back, no perspective, no words, no letters, no numbers, no watermark, no extra icons, no fist, no V sign, no weapons, no injury. One image only.

## 火縄銃（C008）表面・提案画像（2026-10-03）

`public/images/cards/C008-front.webp` に保存。パンチの一体生成表面をレイアウトの参考、チョキの裏面を配色と種類マークの参考に使った。枠・火縄銃・煙・文字を一体生成した1枚の画像。カード名「火縄銃」、効果文「50のダメージを与える」は画像内。右上の最終ダメージ欄のみ空白。採用判断はオーナーの確認待ち。

> Use case: illustration-story. Asset type: ONE finished Japanese trading card FRONT for card C008 火縄銃, portrait 3:4 full bleed. Image 1 is the approved first-wave パンチ front: use it only as the design-family reference for the unified dynamic manga composition, angular metallic card border, integrated title band, central action illustration, lower effect panel, and empty circular damage medallion at the upper right. Image 2 is the blue チョキ card back: use its royal blue, cyan, silver-blue and navy palette and its V-sign type symbol as references. Generate the ENTIRE 火縄銃 front as one new coherent illustration from edge to edge. The border, title, type symbol, illustrated subject, smoke, speed lines and effect lettering must share consistent light, brushwork and texture; do not paste or inset a separately illustrated object or use layered asset composition. In the central art, depict a historically recognizable Japanese matchlock rifle (hinawajū / tanegashima): elegant long wooden stock, dark iron barrel and visible traditional matchlock hardware, dramatically displayed diagonally against stylized blue-cyan light and curling smoke, Sengoku-era and technology-history mood. The rifle is on display, not held by anyone, not aimed at any person, with no victim, injury or gore. Use a clear small blue/silver scissors V-sign hand emblem at upper left as the card-type icon. In the top title band write EXACTLY 『火縄銃』, with the three Japanese characters 火・縄・銃 rendered correctly, bold and legible. In the bottom effect band write EXACTLY 『50のダメージを与える』, clear Japanese lettering. The ONLY visible number is 50 in that bottom sentence. Leave the upper-right circular damage medallion completely blank and clean yellow-blue/light silver so the app can overlay the final damage later. No rarity mark, stars, R, word チョキ, 筋トレ, +0, extra labels, extra digits, logo or watermark. Card-sized readability. Produce a single complete image, not separate character, frame, text or icon layers.

火縄銃の表面は、次の依頼の冒頭でオーナーが「とてもいい」と評価したため採用。

## 手品（P001）表面・提案画像（2026-10-03）

`public/images/cards/P001-front.webp` に保存。パンチの一体生成表面を構図の参考、パーの裏面を配色と種類マークの参考に使用。効果文は2行で画像内に含む。ダメージを与えないカードなので、右上の円は星の装飾にした。後に初期4枚の一部として採用された。

> Use case: illustration-story. Asset type: ONE finished Japanese trading card FRONT for card P001 手品, portrait 3:4 full bleed. Image 1 is the approved first-wave パンチ front: use ONLY as a design-family reference for the energetic unified manga composition, angular metallic border, integrated title band, large central action image and lower effect panel. Image 2 is the green パー back: use its emerald, jade, bright lime, forest green and deep navy palette and its OPEN-PALM type icon as references. Generate the ENTIRE 手品 front as ONE new cohesive illustration from edge to edge. All border, icon, central illustration, sparkles, swirls, title and effect lettering must be created together with consistent light, brushwork and texture; do not paste or inset a separately made picture into a card template. Central subject: a theatrical magician's white-gloved open hand emerging from a dark top hat, a wand tracing luminous emerald magic arcs, floating blank playing cards and sparkling particles; a playful, clever school-friendly magic trick, with a sense of transforming an opponent's card. No human face required. Make the central artwork vivid and readable at small size. At upper left, include a small clear green/silver OPEN-PALM hand emblem as the card-type indicator. Top title text must be exactly 『手品』, bold and legible. Bottom effect text must be exactly TWO lines, first line 『相手のカードを1枚選び、』 and second line 『種類を【グー】に変える』; together they read 相手のカードを1枚選び、種類を【グー】に変える. Render every Japanese character, digit 1, brackets and punctuation accurately, with ample space and strong contrast. This is a non-damage special-effect card: there should be NO damage number. At upper right, retain a decorative circular medallion consistent with the card family but fill it with a simple intrinsic green magical sparkle motif, not a blank damage-number placeholder. No rarity mark, stars, N, word パー as a label, 筋トレ, +0, extra text, additional digits, logos or watermark. One complete image only.

## キック（G002）表面・提案画像（2026-10-03）

`public/images/cards/G002-front.webp` に保存。採用済みパンチの一体生成表面をデザインの参考にし、同じ種類色・こぶしマーク・文字配置で、蹴りの構図を新しく生成した。カード名「キック」、効果文「20のダメージを与える」は画像内。右上は最終ダメージ用に空欄。蹴り脚を修正した後、初期4枚の一部として採用された。

> Use case: illustration-story. Asset type: ONE finished Japanese trading card FRONT for G002 キック, portrait 3:4 full bleed. The attached approved パンチ front is a design-family reference ONLY. Create a completely NEW single cohesive card illustration from edge to edge, preserving the energetic manga action quality, warm gold/yellow/orange palette, dark navy angular metallic accents, title banner, central action field, lower effect banner, small clenched-fist type icon at upper left, and empty circular damage medallion at upper right. The border, figure, speed lines, impact burst, icon, title and effect lettering must be generated as one integrated image with consistent brushwork and lighting; do not paste a separate character picture into a frame, do not composite independent assets. Central art: a sporty junior-high school BOY with short dark hair in simple blue-and-white athletic clothes performs a powerful high roundhouse kick. Show his full dynamic kicking leg and sneaker sweeping diagonally across the foreground, a bright warm impact burst and bold curved motion lines; his face is clear, confident and energetic. Distinguish the pose unmistakably from a punch: no large punching fist toward the viewer. School-friendly training/action scene, no target person, no injury, blood or gore. Top title text must be EXACTLY 『キック』 in large bold legible Japanese. Bottom effect text must be EXACTLY 『20のダメージを与える』, clear and legible. The ONLY visible number is 20 in the effect sentence. The top-right round medallion must be clean and completely BLANK so the application can later overlay the final damage. Do not add rarity symbols, stars, N, the word グー, 筋トレ, +0, extra captions, extra digits, logos or watermark. Readable at small trading-card size. Produce one complete image only.

### キックの足と靴の修正

最初の画像は蹴り脚と靴のかかとのつながりが不自然との指摘を受けた。蹴り脚全体を一体画像として描き直し、靴を横から見える構図に変更した。`G002-front.webp` は修正版に差し替え済みで、オーナーが採用した。

> Use case: precise-object-edit. Edit target: the attached unified キック trading-card front. Repair the kicking boy's LOWER BODY AND SHOE ANATOMY, especially the impossible heel. Redraw the entire kicking leg and sneaker as a coherent single limb with a clearly connected hip, thigh, knee, shin, ankle, heel, shoe upper, toe and sole. Use a physically believable high roundhouse-kick pose for a junior-high athletic boy. Show the kicking sneaker in a clear three-quarter SIDE VIEW rather than an extreme sole-first view: toe points toward the left foreground, heel is on the right near the ankle, the heel cup and back of the sole align naturally with the ankle and calf, and the sole follows the shoe. There must be exactly two legs and two feet, no twisted or duplicated joints, no extra shoe parts. Preserve the dynamic scale, impact burst, boy's face/hair/shirt and card-family gold-orange/navy style. Preserve EXACTLY the existing top-left clenched-fist icon, title 『キック』, lower effect text 『20のダメージを与える』, and totally blank upper-right circular damage medallion. Keep all text correct, no new labels or numbers. Re-render the card as one cohesive finished raster image; no pasted or separately composited limb. One corrected full card image only.

## 救急箱（P003）表面・提案画像（2026-10-03）

imagegenの組み込みツールで1枚生成。`P001-front.webp` は表面のデザインファミリー、`back-paper.webp` は緑の配色とパーの手の参考として入力した。生成元は `design-source/P003-front-source.png`、アプリ用WebPは `public/images/cards/P003-front.webp`（1024×1365）。カード名「救急箱」、効果文「ライフを30回復」は画像内。オーナーが採用した。

> Use case: illustration-story. Asset type: ONE finished Japanese trading card FRONT for P003 救急箱, portrait 3:4 full bleed. The two input images are STYLE REFERENCES ONLY: Image 1 is the approved パー card front 手品, showing the unified energetic manga card composition, angular metallic frame, title band, central illustration, lower effect panel, small open-palm type symbol, and a decorative upper-right medallion; Image 2 is the approved パー card back, showing the emerald/jade/lime and deep navy palette and the open-palm symbol. Create a completely NEW, ONE-PIECE integrated card image from edge to edge, not a collage, not layered pieces, not the original card with an object pasted over it. Central art: an OPEN FIRST-AID KIT with a clear green medical cross and neatly arranged bandages, illustrated school-friendly, radiating warm green-gold healing light and soft sparkles; no injured person, no blood, no syringes. Make the first-aid kit the unmistakable hero subject. Render the frame, healing light, illustration, icon, Japanese lettering, and effect panel as one cohesive image with consistent manga brushwork and lighting. At upper left include the small green/silver OPEN-PALM hand emblem indicating the card type. Top title must read EXACTLY 『救急箱』 with the three kanji 救・急・箱 clearly correct and legible. Bottom effect text must read EXACTLY 『ライフを30回復』. The ONLY visible number is 30 in that sentence. This is a non-damage healing card: NO floating damage number and NO blank yellow damage circle. At upper right use an intrinsic decorative circular medallion containing a simple green healing sparkle/medical cross, with no digits. Do not show rarity marks, stars, N, the word パー as a label, 筋トレ, +0, extra words, extra numbers, logos or watermark. Flat straight-on full-bleed front, polished and readable at small trading-card size. Output one completed card image.

## Gカード・ロゴ（2026-10-03）

imagegenの組み込みツールで透過PNGを1枚生成。歯車形のG、金色と紺色、青と緑のアクセントで既存カードの雰囲気に合わせた。文字「Gカード」の形と透過背景を確認し、オーナーが採用。正式画像は `public/images/brand/logo.png`（1962×801）。

## 段階10・ホーム背景（2026-10-04、採用）

`design-source/stage10/home-background-sample.png` を組み込み画像生成で1枚作り、確認用に `home-background-sample.webp`（2048×1536）も保存した。オーナーが採用。カード表面とロゴは画風・配色の参考のみ。正式画像は `public/images/bg/home.webp`。ホーム画面の文字と操作部が読めるよう、画面側で濃紺の半透明グラデーションを重ねる。

> A landscape 4:3 background for the Gカード home screen: a welcoming futuristic school workshop at warm sunset, with safe tools, small gears and classroom engineering projects at the edges and a school courtyard beyond the windows. Bold clean manga/cel-shaded outlines, polished navy and antique brass, warm gold light, small electric blue and emerald accents matching the approved card and logo. Interesting architecture near the edges and upper third; broad calm dark-navy center and lower middle for legible overlaid UI. Crop-safe on landscape and portrait iPad. No people, cards, UI panels, logo, letters, numbers or watermark. One cohesive image.

## 段階10・バトル背景（2026-10-04、採用）

ホーム背景の画風を基準に1枚生成し、オーナーが採用した。元画像は `design-source/stage10/battle-background-sample.png`、確認用WebPは同名の `.webp`（2048×1536）。正式画像は `public/images/bg/battle.webp`。カードを表示する中央から手前は紺色の低詳細領域とし、黄・青・緑の照明と歯車は周辺に配置した。CPU対戦・端末内対戦・オンライン対戦では、画面側で濃紺の半透明グラデーションを重ねる。

> Original landscape 4:3 battle-screen environment: a dramatic but friendly futuristic school tournament arena, with an empty circular stage, brass-and-navy engineering architecture, gears at the perimeter and yellow, blue and green spotlights. Match the approved home environment's cel-shaded materials and the card's bold outlines. Keep the central 60% and lower middle dark navy and low detail for overlaid cards and white UI; put lights and gears on the upper and side edges. Crop-safe on landscape and portrait iPad. No characters, playing cards, UI, letters, numbers, logos or watermark.

## 段階10・ショップ背景（2026-10-04、採用）

金色・紺色のカードショップを1枚生成し、オーナーが採用した。元画像は `design-source/stage10/shop-background-sample.png`、確認用WebPは同名の `.webp`（2048×1536）。正式画像は `public/images/bg/shop.webp`。黄・青・緑のパックは棚とショーケースに並べ、中央手前を画面の表示用に落ち着いた色とした。ショップ画面では濃紺の半透明グラデーションを重ねる。

> Original landscape 4:3 shop-screen environment: a welcoming futuristic school card shop, antique-brass and deep-navy counter, glass cases and shelves of softly glowing golden-yellow, electric-blue and emerald-green sealed booster packs. Calm dark-navy low-detail central and lower-middle space for app text, buttons and cards; brighter merchandise and gears on the upper and side edges. Bold clean anime cel-shaded outlines, polished enamel and brass, warm light. Crop-safe on landscape and portrait iPad. No characters, readable packaging, card fronts, UI, letters, numbers, logos or watermark.

## 段階10・トレーニング背景（2026-10-04、採用）

学校の体育館と屋外のトラックを一体の場面として1枚生成し、オーナーが採用した。元画像は `design-source/stage10/training-background-sample.png`、確認用WebPは同名の `.webp`（2048×1536）。正式画像は `public/images/bg/training.webp`。筋トレ器具を左右に、走る場所を奥に置き、中央手前は画面表示のため紺色の低詳細領域とした。トレーニング画面では濃紺の半透明グラデーションを重ねる。

> Original landscape 4:3 training-screen environment: a welcoming school gym with age-appropriate dumbbells, ropes and simple exercise stations along the sides, opening toward a visible school running track in warm daylight. Lightly futuristic engineering details in antique brass and deep navy, subtle gears, bold clean anime cel-shaded outlines. Keep center and lower middle calm and moderately dark for overlaid UI. Crop-safe on landscape and portrait iPad. No people, cards, UI, words, letters, numbers, logos, injuries or watermark.

## 段階10・テスト背景サンプル（2026-10-04、確認待ち）

放課後の教室を1枚生成した。元画像は `design-source/stage10/test-background-sample.png`、確認用WebPは同名の `.webp`（2048×1536）。窓から柔らかな光が入り、手前の机の右側に無地のノートと鉛筆を置いた。設問と入力欄を読みやすくするため、中央は濃紺の低詳細領域とした。アプリにはまだ適用していない。

> Original landscape 4:3 quiz-screen environment: calm after-school classroom from a seated student's viewpoint, tidy wooden desk, blank notebook and pencil off to one side, soft warm daylight through windows. Restrained deep-navy metal and antique-brass trim with a small gear motif, polished anime cel-shaded environment art. Keep the central and lower-middle area dark and low detail for question text and controls; place the brightest window light toward an edge. Crop-safe on landscape and portrait iPad. No people, writing, answer symbols, cards, UI, letters, numbers, logos or watermark.
