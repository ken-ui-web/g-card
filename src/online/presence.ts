export const FORFEIT_AFTER_MS = 30_000;
export const HEARTBEAT_INTERVAL_MS = 5_000;

export function opponentTimedOut(lastSeen: number | undefined, now: number): boolean {
  return typeof lastSeen === 'number' && lastSeen > 0 && now - lastSeen >= FORFEIT_AFTER_MS;
}

export type PhaseClock = { key: string; since: number; pausedAt: number | null };

export function phaseSeconds(clock: PhaseClock, key: string, now: number, paused: boolean): number {
  if (clock.key !== key) {
    clock.key = key;
    clock.since = now;
    clock.pausedAt = null;
  }
  if (paused) {
    clock.pausedAt ??= now;
    return 0;
  }
  if (clock.pausedAt !== null) {
    clock.since += now - clock.pausedAt;
    clock.pausedAt = null;
  }
  return (now - clock.since) / 1000;
}
