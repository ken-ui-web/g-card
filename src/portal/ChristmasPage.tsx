import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react';
import { Card } from '../components/Card';
import { BrandIdentity } from '../components/BrandIdentity';
import { LoadingState } from '../components/LoadingState';
import { getCard } from '../data/cards';
import { CHRISTMAS_FRAME_ID } from '../data/frames';
import { callApi, isGuest, savedSession, type ChristmasEvent } from './api';
import { packArtUrl } from './packArt';
import './christmas.css';
import './ChristmasFestival.css';

export const christmasActive = (event?: ChristmasEvent | null) => !!event && (event.preview || event.published && Date.parse(event.startAt) <= Date.now() && Date.now() <= Date.parse(event.endAt));
export const eventDate = (value: string) => value ? new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit' }) : '未設定';

export function ChristmasBanner({ event }: { event?: ChristmasEvent | null }) {
  if (!event?.published) return null;
  return <a className="christmas-banner panel" href="#/christmas"><span aria-hidden="true">❄</span><div><small>{christmasActive(event) ? '開催中' : Date.now() < Date.parse(event.startAt) ? 'まもなく開催' : 'イベント終了'}</small><strong>{event.title}</strong><p>サンタに挑戦。4つのミッションで白銀のフレームを手に入れよう。</p></div><b>イベントを見る →</b></a>;
}

function HollySprig({ className = '' }: { className?: string }) {
  return <svg className={`christmas-holly ${className}`} viewBox="0 0 160 90" fill="none" aria-hidden="true" focusable="false">
    <path d="M77 66C49 61 21 43 7 15L30 17 32 3 49 24 65 17 65 38 86 42Z" fill="#397351" />
    <path d="M83 65C109 64 143 48 155 18L135 19 128 4 115 25 97 18 98 40 77 43Z" fill="#245d40" />
    <path d="M25 25 80 68 139 27" stroke="#d7c190" strokeWidth="2" />
    <circle cx="71" cy="64" r="12" fill="#b63243" /><circle cx="91" cy="64" r="12" fill="#cf4050" /><circle cx="81" cy="78" r="11" fill="#a92238" />
    <circle cx="68" cy="60" r="3" fill="#ffe3d3" /><circle cx="88" cy="60" r="3" fill="#ffe3d3" />
  </svg>;
}

function ChristmasAtmosphere() {
  return <div className="christmas-atmosphere" aria-hidden="true">
    <span className="christmas-bauble christmas-bauble--red" /><span className="christmas-bauble christmas-bauble--gold" />
    {Array.from({ length: 20 }, (_, i) => <i key={i} style={{ left:`${3 + i * 29 % 94}%`, top:`${i * 37 % 98}%`, '--snow-delay':`${-i * .7}s`, '--snow-duration':`${12 + i % 5 * 2}s` } as CSSProperties}>{i % 4 === 0 ? '❄' : '•'}</i>)}
  </div>;
}

function jumpTo(event: MouseEvent<HTMLAnchorElement>, id: string) {
  event.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

export function ChristmasPage() {
  const session = savedSession(), guest = !session || isGuest(session);
  const preview = new URLSearchParams(location.hash.split('?')[1]).get('preview') === '1';
  const [event, setEvent] = useState<ChristmasEvent | null | undefined>();
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    callApi<{ event: ChristmasEvent | null }>(preview ? 'previewChristmas' : guest ? 'getPublicChristmas' : 'getChristmas', guest ? null : session)
      .then((result) => { if (!cancelled) setEvent(result.event); }).catch((failure: Error) => { if (!cancelled) setError(failure.message); });
    return () => { cancelled = true; };
  }, [session, guest, preview]);
  const active = christmasActive(event), p = event?.progress;
  const missions = event ? [
    { title:'特別テストで満点', done:p?.knowledgeDone, count:p?.knowledgeDone?1:0, total:1, href:`#/tests?testId=${encodeURIComponent(event.knowledgeTestId)}`, label:'テストに挑戦' },
    { title:'今年の振り返り・来年の抱負を提出', done:p?.reflectionDone, count:p?.reflectionDone?1:0, total:1, href:`#/tests?testId=${encodeURIComponent(event.reflectionTestId)}`, label:'振り返りを提出' },
    { title:'最強サンタに勝つ', done:(p?.cpuWins??0)>=event.cpuWins, count:p?.cpuWins??0, total:event.cpuWins, href:preview?'#/battle?santa=1&preview=1':'#/battle?santa=1', label:'サンタに挑戦' },
    { title:'オンライン対戦で勝つ', done:(p?.onlineWins??0)>=event.onlineWins, count:p?.onlineWins??0, total:event.onlineWins, href:'#/online', label:'友達と対戦' },
  ] : [];
  const completed = missions.filter((mission) => mission.done).length;

  return <main className="app-shell christmas-page christmas-festival">
    <ChristmasAtmosphere />
    <header className="app-header"><BrandIdentity href="#/home" /><a className="text-link" href="#/home">ホームへ</a></header>
    <div className="christmas-garland" aria-hidden="true">{Array.from({ length:18 }, (_,i) => <i key={i} style={{ '--light-order':i } as CSSProperties} />)}</div>
    <div className="christmas-festival__content">
      {error ? <p className="portal-error" role="alert">{error}</p> : event === undefined ? <LoadingState text="イベントを読み込み中" /> : !event ? <section className="panel christmas-empty"><h1>イベントは準備中です</h1><p>クリスマスの特別なひとときを、お楽しみに。</p></section> : <>
        {preview && <p className="christmas-preview">先生用プレビュー · 進捗や報酬は記録されません</p>}
        <section className="christmas-hero panel">
          <HollySprig />
          <div className="christmas-hero__copy">
            <p className="eyebrow">G CARD · CHRISTMAS FESTIVAL</p>
            <h1>{event.title.split(/(クリスマス|イベント)/).map((word, i) => <span className={word === 'クリスマス' || word === 'イベント' ? 'christmas-title__word' : undefined} key={i}>{word}</span>)}</h1>
            <p className="christmas-dates"><span>{preview ? 'PREVIEW' : active ? '開催中' : Date.now() < Date.parse(event.startAt) ? 'まもなく開催' : '開催終了'}</span>{eventDate(event.startAt)} 〜 {eventDate(event.endAt)}<small>日本時間</small></p>
            <h2>学んで、遊んで、冬のごほうびを。</h2>
            <p>サンタと対戦し、学びのミッションにも挑戦。<br />4つの達成で、ずっと使える白銀のフレームをプレゼント！</p>
            <a className="button button--primary" href="#christmas-missions" onClick={(e) => jumpTo(e,'christmas-missions')}>ミッションを見る ↓</a>
          </div>
          <div className="christmas-showcase" aria-label="クリスマス限定アイテム">
            <figure className="christmas-showcase__item"><div className="christmas-showcase__art"><Card card={getCard('G023')} width={210} /></div><figcaption><small>限定SSRカード</small><strong>サンタアッパー</strong></figcaption></figure>
            <figure className="christmas-showcase__item"><div className="christmas-showcase__art"><img src={packArtUrl('christmas')} alt="クリスマス限定パック" /></div><figcaption><small>期間限定販売</small><strong>クリスマス限定パック</strong></figcaption></figure>
            <figure className="christmas-showcase__item"><div className="christmas-showcase__art"><img className="christmas-showcase__frame" src={`${import.meta.env.BASE_URL}images/frames/snow-silver.webp`} alt="白銀のクリスマスフレーム単体" /></div><figcaption><small>全ミッション達成報酬</small><strong>白銀のフレーム</strong></figcaption></figure>
          </div>
        </section>

        <nav className="christmas-section-nav" aria-label="イベントの案内">
          {[['christmas-missions','特別ミッション'],['christmas-rewards','カードとフレーム'],['christmas-pack','限定パック'],['christmas-santa','サンタに挑戦']].map(([id,label]) => <a key={id} href={`#${id}`} onClick={(e) => jumpTo(e,id)}>{label}<span aria-hidden="true">↓</span></a>)}
        </nav>

        <section className="panel christmas-missions" id="christmas-missions">
          <div className="christmas-section-heading"><div><p className="eyebrow">FOUR CHRISTMAS MISSIONS</p><h2>クリスマス特別ミッション</h2><p>4つクリアして、白銀のフレームを手に入れよう。</p></div><span className="christmas-completed-count">達成 <b>{completed}</b> / 4</span></div>
          {guest && <p>ミッションとフレーム報酬は学校アカウントで参加できます。</p>}
          {!active && <p>{Date.now() < Date.parse(event.startAt) ? '開始までお待ちください。' : '開催期間が終了しました。獲得済みフレームは引き続き使えます。'}</p>}
          <div>{missions.map((mission,index) => <article className={mission.done?'is-complete':''} key={mission.title}>
            <span className="christmas-mission__number" aria-hidden="true">{mission.done ? '✓' : `0${index+1}`}</span>
            <div className="christmas-mission__heading"><h3>{mission.title}</h3><span>{mission.count} / {mission.total}</span></div>
            <progress value={mission.count} max={mission.total} aria-label={mission.title} />
            <div className="christmas-mission__action">{mission.done ? <b>達成済み</b> : active && !guest ? <a className="button button--ghost" href={mission.href}>{mission.label} →</a> : null}</div>
          </article>)}</div>
          <p className="christmas-missions__note">通常の勝利を集計します。不戦勝・管理者テスト対戦は対象外です。必須の自由記述を入力して提出すると、振り返りミッション達成となります。</p>
          {p?.frameAwarded && <a className="button button--primary" href="#/collection">フレーム獲得済み · 装着する →</a>}
        </section>

        <section className="christmas-gifts" id="christmas-rewards" aria-labelledby="christmas-gifts-title">
          <div className="christmas-section-heading"><div><p className="eyebrow">SPECIAL WINTER GIFTS</p><h2 id="christmas-gifts-title">クリスマスだけの特別なアイテム</h2></div><HollySprig /></div>
          <div className="christmas-rewards">
            <article className="panel christmas-gift christmas-gift--silver"><p className="eyebrow">全ミッション達成報酬</p><h2>白銀のクリスマスフレーム</h2><Card card={getCard('G006')} frameId={CHRISTMAS_FRAME_ID} width={210} /><p><b>フレームを装着したカードの効果が発動すると、HP+10。</b><br />最大HPを超えて回復できます。</p><p>「デッキ・図鑑」の「フレーム」から、デッキの1枚に装着。無料で付け替えでき、使ってもなくなりません。イベント終了後も使えます。</p><span className="christmas-gift__tag">ずっと使える、冬の思い出をカードに。</span></article>
            <article className="panel christmas-gift christmas-gift--santa"><p className="eyebrow">クリスマス限定SSR</p><h2>サンタアッパー</h2><Card card={getCard('G023')} width={210} /><p><b>30ダメージ＋自分のHPを10回復。</b><br />グー・SSR。あいこでも発動！</p><p>筋トレで最大50ダメージ。SSRはデッキに1枚まで。開催期間中、クリスマス限定パックに登場します。</p><a className="button button--ghost" href="#christmas-pack" onClick={(e) => jumpTo(e,'christmas-pack')}>限定パックを見る ↓</a></article>
          </div>
        </section>

        <section className="panel christmas-pack-feature" id="christmas-pack">
          <div className="christmas-pack-feature__art"><img src={packArtUrl('christmas')} alt="赤と緑、雪の結晶とリボンをあしらったクリスマス限定パック" /></div>
          <div><p className="eyebrow">CHRISTMAS LIMITED PACK</p><h2>クリスマス限定パック</h2><p>サンタアッパーが登場する、冬だけの特別なパック。<br />赤と緑に輝く包みから、あなたの1枚を見つけよう。</p><dl className="christmas-pack-facts"><div><dt>1パック</dt><dd>{event.packPrice.toLocaleString()} G</dd></div><div><dt>カード枚数</dt><dd>{event.packSize} 枚入り</dd></div></dl>{active && !preview ? <a className="button button--primary" href="#/shop?tab=pack">ショップで限定パックを見る →</a> : <p className="christmas-pack-feature__availability">{preview ? '公開後、開催期間中にショップで購入できます。' : Date.now() < Date.parse(event.startAt) ? '開催期間になるとショップで購入できます。' : 'このパックの販売期間は終了しました。'}</p>}</div>
          <HollySprig />
        </section>

        <section className="christmas-santa panel" id="christmas-santa">
          <img src={`${import.meta.env.BASE_URL}images/cpu/santa.webp`} alt="対戦相手のサンタクロース" />
          <div><p className="eyebrow">SANTA CHALLENGE</p><h2>サンタからの挑戦状</h2><p>ライフ {event.cpuLife}・筋トレ＋{event.cpuTraining}（カードごとの上限まで）。</p>{active && <a className="button button--primary" href={preview?'#/battle?santa=1&preview=1':'#/battle?santa=1'}>自分のデッキで挑戦 →</a>}</div>
        </section>
        <footer className="christmas-festival__footer"><HollySprig /><p>この冬の思い出を、あなたのカードに。</p><a href="#/home">ホームへ戻る →</a></footer>
      </>}
    </div>
  </main>;
}
