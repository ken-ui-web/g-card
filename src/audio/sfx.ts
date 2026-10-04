export type SoundEffect = 'select' | 'round' | 'flip' | 'win' | 'damage' | 'heal' | 'pack' | 'rare' | 'point';

const KEY = 'g-card:sound-effects';
let context: AudioContext | null = null;

export function soundEnabled(): boolean {
  try { return window.localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setSoundEnabled(enabled: boolean): void {
  try { window.localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* private browsing */ }
  window.dispatchEvent(new Event('g-card-sound-change'));
}

const patterns: Record<SoundEffect, [number, number, number][]> = {
  select: [[440, 0, .06], [660, .06, .09]],
  round: [[196, 0, .12], [294, .15, .12], [392, .3, .18]],
  flip: [[520, 0, .07], [780, .09, .13]],
  win: [[392, 0, .1], [494, .11, .1], [587, .22, .12], [784, .35, .27]],
  damage: [[160, 0, .12], [110, .1, .21]],
  heal: [[392, 0, .11], [523, .1, .12], [659, .22, .2]],
  pack: [[330, 0, .1], [440, .13, .1], [660, .27, .24]],
  rare: [[523, 0, .12], [659, .12, .12], [784, .24, .12], [1047, .38, .35]],
  point: [[660, 0, .07], [880, .09, .14]],
};

export function playSfx(effect: SoundEffect): void {
  if (!soundEnabled()) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const start = context.currentTime + .005;
    for (const [frequency, offset, duration] of patterns[effect]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = effect === 'damage' ? 'sawtooth' : effect === 'round' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start + offset);
      gain.gain.setValueAtTime(.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(effect === 'damage' ? .075 : .055, start + offset + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, start + offset + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + duration + .01);
    }
  } catch { /* Audio is optional on restricted devices. */ }
}
