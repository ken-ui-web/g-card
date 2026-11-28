export const CHRISTMAS_FRAME_ID = 'christmas-2026';
export const frames = {
  [CHRISTMAS_FRAME_ID]: { id: CHRISTMAS_FRAME_ID, name: '白銀のクリスマスフレーム', image: 'snow-silver.webp', heal: 10 },
} as const;
export type FrameId = keyof typeof frames;
export const isFrameId = (id: unknown): id is FrameId => typeof id === 'string' && Object.prototype.hasOwnProperty.call(frames, id);
export const frameHeal = (id: string | undefined): number => isFrameId(id) ? frames[id].heal : 0;
