import { useEffect, useState, useSyncExternalStore } from 'react';
import { getApiActivity, subscribeApiActivity } from '../portal/api';

const actionLabels: Record<string, string> = {
  login: '学校アカウントを確認中', setNickname: '名前を保存中', bootstrap: '学校の記録を読み込み中',
  getPublicShopConfig: 'ショップの設定を確認中', getBattleConfig: '対戦用カードを確認中', getPublicBattleConfig: '対戦用カードを確認中',
  buyCard: 'カードを購入中', openPack: 'パックを開封中', sellCard: 'カードを売却中', train: 'トレーニングを保存中', saveDeck: 'デッキを保存中', reportBattle: '対戦結果を保存中',
  listTests: 'テスト一覧を読み込み中', getTest: 'テストを読み込み中', submitTest: '回答を採点・保存中', getTestResult: 'テスト結果を読み込み中',
  listReflections: '振り返りを確認中', syncReflections: '提出記録を確認中',
  adminDashboard: '管理者画面を更新中', adminListStudents: '生徒一覧を読み込み中', adminStudentDetail: '生徒の記録を読み込み中',
  adminAdjustPoints: 'Gポイントを調整中', adminImportRoster: '名簿を保存中', adminExportData: 'データを書き出し中',
  adminGetEconomy: 'カードの設定を読み込み中', adminSaveSettings: 'ゲーム設定を保存中', adminSaveCard: 'カード設定を保存中',
  adminSavePack: 'パック設定を保存中', adminSaveMission: 'ミッションを保存中', adminSaveDeck: '対戦設定を保存中',
  adminListTests: 'テスト設定を読み込み中', adminGetTest: 'テストを読み込み中', adminSaveTest: 'テストを保存中',
  adminDeleteTest: 'テストを削除中', adminTestResponses: '受験結果を集計中',
  onlineJoin: '対戦の参加を確認中', onlineReport: '対戦結果を照合中', onlineResult: '対戦報酬を確認中', getRanking: 'ランキングを読み込み中',
};

export function ApiActivityIndicator() {
  const requests = useSyncExternalStore(subscribeApiActivity, getApiActivity, getApiActivity);
  const [visible, setVisible] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const foreground = requests.find((request) => !['bootstrap', 'onlineResult'].includes(request.action)) ?? requests[0];

  useEffect(() => {
    if (!requests.length) { setVisible(false); setSeconds(0); return; }
    const timer = window.setTimeout(() => setVisible(true), 250);
    return () => window.clearTimeout(timer);
  }, [requests]);
  useEffect(() => {
    if (!visible || !foreground) return;
    const update = () => setSeconds(Math.floor((Date.now() - foreground.startedAt) / 1000));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [visible, foreground]);

  if (!visible || !foreground) return null;
  return <div className="api-activity" role="status" aria-live="polite" aria-label={actionLabels[foreground.action] ?? '学校の記録と通信中'}>
    <span className="api-activity__spinner" aria-hidden="true" />
    <span><strong>{actionLabels[foreground.action] ?? '学校の記録と通信中'}</strong>{seconds >= 5 && <small>{seconds}秒経過 · 処理を続けています</small>}</span>
    <span className="api-activity__bar" aria-hidden="true" />
  </div>;
}
