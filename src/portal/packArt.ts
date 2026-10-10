import type { PackMaster } from './api';

export const packArtOptions = [
  { key: 'starter', label: 'スタートパック' },
  { key: 'first-wave', label: '第１弾パック' },
  { key: 'all-cards', label: '全カードパック' },
  { key: 'limited', label: '期間限定パック' },
  { key: 'rare', label: 'レアパック' },
  { key: 'ssr-guaranteed', label: 'SSR確定パック' },
] as const;

export type PackArtKey = typeof packArtOptions[number]['key'];

export function packArtKey(pack: Pick<PackMaster, 'packId' | 'imageKey'>): PackArtKey {
  if (packArtOptions.some((option) => option.key === pack.imageKey)) return pack.imageKey as PackArtKey;
  if (packArtOptions.some((option) => option.key === pack.packId)) return pack.packId as PackArtKey;
  return 'starter';
}

export function packArtUrl(key: PackArtKey): string {
  return `${import.meta.env.BASE_URL}images/packs/${key}.webp?v=${import.meta.env.VITE_BUILD_VERSION || 'dev'}`;
}
