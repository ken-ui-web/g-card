import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
await mkdir('public/images/card-tips', { recursive: true });
for (const id of ['G015', 'C014', 'P015']) {
  await sharp(`public/images/cards/${id}-front.webp`).resize({ width: 160 }).webp({ quality: 78 }).toFile(`public/images/card-tips/${id}-front.webp`);
}
