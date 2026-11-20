export function requireMatchingOnlineMode(roomGuestBattle: boolean | undefined, guestBattle: boolean): void {
  if (Boolean(roomGuestBattle) !== guestBattle) {
    throw new Error(guestBattle ? 'この部屋は学校アカウント用です。ゲスト同士で部屋を作ってください。' : 'この部屋はゲスト用です。学校アカウント同士の部屋に参加してください。');
  }
}
