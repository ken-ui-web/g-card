import { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { BrandIdentity } from '../components/BrandIdentity';
import { LoadingState } from '../components/LoadingState';
import { getCard } from '../data/cards';
import { CHRISTMAS_FRAME_ID } from '../data/frames';
import { callApi, isGuest, savedSession, type ChristmasEvent } from './api';
import './christmas.css';

export const christmasActive = (event?: ChristmasEvent | null) => !!event && (event.preview || event.published && Date.parse(event.startAt) <= Date.now() && Date.now() <= Date.parse(event.endAt));
export const eventDate = (value: string) => value ? new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit' }) : '未設定';
export function ChristmasBanner({ event }: { event?: ChristmasEvent | null }) {
  if (!event?.published) return null;
  return <a className="christmas-banner panel" href="#/christmas"><span aria-hidden="true">❄</span><div><small>{christmasActive(event) ? '開催中' : Date.now() < Date.parse(event.startAt) ? 'まもなく開催' : 'イベント終了'}</small><strong>{event.title}</strong><p>サンタに挑戦。4つのミッションで白銀のフレームを手に入れよう。</p></div><b>イベントを見る →</b></a>;
}
export function ChristmasPage() {
  const session = savedSession(), guest = !session || isGuest(session);
  const preview = new URLSearchParams(location.hash.split('?')[1]).get('preview') === '1';
  const [event, setEvent] = useState<ChristmasEvent | null | undefined>();
  const [error, setError] = useState('');
  useEffect(() => { callApi<{ event: ChristmasEvent | null }>(preview ? 'previewChristmas' : guest ? 'getPublicChristmas' : 'getChristmas', guest ? null : session).then((result) => setEvent(result.event)).catch((failure: Error) => setError(failure.message)); }, [session, guest, preview]);
  const active = christmasActive(event), p = event?.progress;
  return <main className="app-shell christmas-page"><header className="app-header"><BrandIdentity href="#/home" /><a className="text-link" href="#/home">ホームへ</a></header>{error ? <p className="portal-error" role="alert">{error}</p> : event === undefined ? <LoadingState text="イベントを読み込み中" /> : !event ? <section className="panel"><h1>イベントは準備中です</h1></section> : <>
    {preview && <p className="christmas-preview">先生用プレビュー · 進捗や報酬は記録されません</p>}
    <section className="christmas-hero panel"><div><p className="eyebrow">SNOW & SILVER · CHRISTMAS</p><h1>{event.title}</h1><p>{eventDate(event.startAt)} 〜 {eventDate(event.endAt)}（日本時間）</p><h2>この冬、特別な1枚を。</h2><p>サンタと対戦し、学びのミッションにも挑戦。<br />4つの達成で、ずっと使える白銀のフレームをプレゼント！</p><a className="button button--primary" href="#christmas-missions" onClick={(e) => { e.preventDefault(); document.getElementById('christmas-missions')?.scrollIntoView({ behavior:'smooth' }); }}>ミッションを見る ↓</a></div><Card card={getCard('G023')} /></section>
    <section className="christmas-rewards"><article className="panel"><p className="eyebrow">ALL CLEAR REWARD</p><h2>白銀のクリスマスフレーム</h2><Card card={getCard('G006')} frameId={CHRISTMAS_FRAME_ID} width={210} /><p><b>装着カードの効果発動でHP＋10。</b><br />最大HPを超えて回復できます。</p><p>「デッキ・図鑑」の「フレーム」から、デッキの1枚に装着。無料で付け替えでき、使ってもなくなりません。イベント終了後も使えます。</p></article><article className="panel"><p className="eyebrow">LIMITED SSR CARD</p><h2>サンタパンチ</h2><Card card={getCard('G023')} width={210} /><p><b>30ダメージ＋自分のHPを10回復。</b><br />グー・SSR。あいこでも発動！</p><p>筋トレで最大50ダメージ。SSRはデッキに1枚まで。開催期間中、クリスマス限定パックに登場します。</p><a className="button button--ghost" href="#/shop?tab=pack">限定パックを見る →</a></article></section>
    <section className="panel christmas-missions" id="christmas-missions"><h2>クリスマス特別ミッション</h2>{guest && <p>ミッションとフレーム報酬は学校アカウントで参加できます。</p>}{!active && <p>{Date.now() < Date.parse(event.startAt) ? '開始までお待ちください。' : '開催期間が終了しました。獲得済みフレームは引き続き使えます。'}</p>}<div>{[
      {title:'特別テストで満点',done:p?.knowledgeDone,count:p?.knowledgeDone?1:0,total:1,href:`#/tests?testId=${encodeURIComponent(event.knowledgeTestId)}`,label:'テストに挑戦'},
      {title:'今年の振り返り・来年の抱負を提出',done:p?.reflectionDone,count:p?.reflectionDone?1:0,total:1,href:`#/tests?testId=${encodeURIComponent(event.reflectionTestId)}`,label:'振り返りを提出'},
      {title:'最強サンタに勝つ',done:(p?.cpuWins??0)>=event.cpuWins,count:p?.cpuWins??0,total:event.cpuWins,href:preview?'#/battle?santa=1&preview=1':'#/battle?santa=1',label:'サンタに挑戦'},
      {title:'オンライン対戦で勝つ',done:(p?.onlineWins??0)>=event.onlineWins,count:p?.onlineWins??0,total:event.onlineWins,href:'#/online',label:'友達と対戦'},
    ].map((mission) => <article className={mission.done?'is-complete':''} key={mission.title}><strong>{mission.done?'✓ ':''}{mission.title}</strong><span>{mission.count} / {mission.total}</span><progress value={mission.count} max={mission.total} aria-label={mission.title} />{mission.done?<b>達成済み</b>:active&&!guest?<a className="button button--ghost" href={mission.href}>{mission.label} →</a>:null}</article>)}</div><p>通常の勝利を集計します。不戦勝・管理者テスト対戦は対象外です。必須の自由記述を入力して提出すると、振り返りミッション達成となります。</p>{p?.frameAwarded && <a className="button button--primary" href="#/collection">フレーム獲得済み · 装着する →</a>}</section>
    <section className="christmas-santa panel"><img src={`${import.meta.env.BASE_URL}images/cpu/santa.webp`} alt="対戦相手のサンタクロース" /><div><p className="eyebrow">SANTA CHALLENGE</p><h2>サンタからの挑戦状</h2><p>ライフ {event.cpuLife}・筋トレ＋{event.cpuTraining}（カードごとの上限まで）。<br />残りカードと効果を読み、先のラウンドまで考える特別なCPUです。</p>{active && <a className="button button--primary" href={preview?'#/battle?santa=1&preview=1':'#/battle?santa=1'}>自分のデッキで挑戦 →</a>}</div></section>
  </>}</main>;
}
