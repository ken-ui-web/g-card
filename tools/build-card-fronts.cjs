// 生成した台紙・男の子の絵・正確な日本語を、表用の1枚のWebPに焼き込む。
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const width = 1024;
const height = 1365;
const boy = path.join(root, 'design-source/G001-boy.webp');
const hand = path.join(root, 'design-source/hand-rock.png');
const star = path.join(root, 'design-source/star.png');
const muscle = path.join(root, 'design-source/badge-muscle.png');
const outputDir = path.join(root, 'public/images/cards');

const designs = [
  {
    id: 'a',
    base: 'front-a-base.webp',
    art: { left: 81, top: 232, width: 862, height: 702 },
    title: { x: 226, y: 156, color: '#15243e' },
    power: { x: 880, y: 151, color: '#15243e' },
    rarityY: 1088,
    effectY: 1184,
    training: { iconX: 752, iconY: 1216, labelX: 819, labelY: 1258 },
    type: { x: 300, y: 1088 },
  },
  {
    id: 'b',
    base: 'front-b-base.webp',
    art: { left: 89, top: 225, width: 846, height: 770 },
    title: { x: 207, y: 155, color: '#fff8dd' },
    power: { x: 884, y: 153, color: '#17213c' },
    rarityY: 1105,
    effectY: 1198,
    training: { iconX: 754, iconY: 1212, labelX: 821, labelY: 1256 },
    type: { x: 300, y: 1105 },
  },
  {
    id: 'c',
    base: 'front-c-base.webp',
    art: { left: 84, top: 248, width: 856, height: 692 },
    title: { x: 217, y: 164, color: '#14243e' },
    power: { x: 882, y: 152, color: '#14243e' },
    rarityY: 1066,
    effectY: 1170,
    training: { iconX: 764, iconY: 1218, labelX: 831, labelY: 1260 },
    type: { x: 300, y: 1066 },
  },
];

function textOverlay(design) {
  const { art, title, power, rarityY, effectY, training, type } = design;
  const artBorder = `<rect x="${art.left}" y="${art.top}" width="${art.width}" height="${art.height}" rx="9" fill="none" stroke="#0c1730" stroke-width="10"/><rect x="${art.left + 5}" y="${art.top + 5}" width="${art.width - 10}" height="${art.height - 10}" rx="5" fill="none" stroke="#ffd14f" stroke-width="4"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${artBorder}
    <g font-family="Noto Sans JP, Yu Gothic, Meiryo, sans-serif" font-weight="900" stroke-linejoin="round">
      <text x="${title.x}" y="${title.y}" fill="${title.color}" font-size="77" letter-spacing="3">パンチ</text>
      <text x="${power.x}" y="${power.y}" text-anchor="middle" fill="${power.color}" font-size="69">20</text>
      <text x="180" y="${rarityY}" fill="#14213c" font-size="51">N</text>
      <text x="${type.x}" y="${type.y}" fill="#14213c" font-size="42">グー</text>
      <text x="512" y="${effectY}" text-anchor="middle" fill="#14213c" font-size="51">20のダメージを与える</text>
      <text x="${training.labelX}" y="${training.labelY}" fill="#14213c" font-size="27">筋トレ</text>
    </g>
  </svg>`);
}

async function makeDesign(design) {
  const art = await sharp(boy).resize(design.art.width, design.art.height, { fit: 'cover', position: 'centre' }).toBuffer();
  const icon = async (file, size) => sharp(file).resize(size, size).png().toBuffer();
  const [handIcon, starIcon, muscleIcon] = await Promise.all([
    icon(hand, 72),
    icon(star, 58),
    icon(muscle, 60),
  ]);
  const layers = [
    { input: art, left: design.art.left, top: design.art.top },
    { input: handIcon, left: 111, top: 86 },
    { input: starIcon, left: 107, top: design.rarityY - 49 },
    { input: muscleIcon, left: design.training.iconX, top: design.training.iconY },
    { input: textOverlay(design), left: 0, top: 0 },
  ];
  const dest = path.join(outputDir, `G001-front-${design.id}.webp`);
  await sharp(path.join(root, 'design-source', design.base))
    .composite(layers)
    .webp({ quality: 86 })
    .toFile(dest);
  console.log(dest);
}

fs.mkdirSync(outputDir, { recursive: true });
Promise.all(designs.map(makeDesign)).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
