import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const appUrl = process.env.GCARD_QA_URL ?? 'http://127.0.0.1:5173/';
const cdpUrl = process.env.GCARD_CDP_URL ?? 'http://127.0.0.1:9223';
const pages = await fetch(`${cdpUrl}/json`).then((response) => response.json());
const page = pages.find((item) => item.type === 'page');
if (!page) throw new Error('Chromeのページがありません');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let serial = 0;
let introSeen = 0;
let revealShotTaken = false;
let settingsReset = false;
const pending = new Map();
socket.addEventListener('message', (message) => {
  const data = JSON.parse(message.data);
  if (!data.id) return;
  const promise = pending.get(data.id);
  if (!promise) return;
  pending.delete(data.id);
  if (data.error) promise.reject(new Error(data.error.message));
  else promise.resolve(data.result);
});
function send(method, params = {}) {
  const id = ++serial;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(text, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`画面に「${text}」が見つかりません: ${String(await evaluate('document.body.innerText')).slice(0, 400)}`);
}
async function clickText(text) {
  const clicked = await evaluate(`(() => { const el = [...document.querySelectorAll('button,a')].find((node) => node.textContent.trim().includes(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);
  if (!clicked) throw new Error(`ボタン「${text}」がありません`);
}
async function waitForEnabled(text, timeout = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(`[...document.querySelectorAll('button')].some((node) => node.textContent.includes(${JSON.stringify(text)}) && !node.disabled)`)) return;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`ボタン「${text}」が有効になりません`);
}
async function revealAndResolve() {
  await waitFor('CARD REVEAL', 13000);
  const count = await evaluate('window.__gcardIntroCount ?? 0');
  if (count <= introSeen) throw new Error('ラウンド番号の演出が表示されませんでした');
  introSeen = count;
  const stages = await evaluate('window.__gcardIntroStages?.slice(-2) ?? []');
  if (stages.join(',') !== 'title,suspense') throw new Error(`公開前の演出順が違います: ${stages}`);
  if (await evaluate('window.__gcardEarlyCards')) throw new Error('ドキドキ演出中にカードが表示されました');
  if (await evaluate(`/よっしゃ|うわー/.test(document.body.innerText)`)) throw new Error('不要なリアクション文が残っています');
  if (await evaluate(`Boolean(document.querySelector('.flip-card.is-flipped'))`)) throw new Error('勝敗を読む前にカードがめくられました');
  await waitForEnabled('カードをめくる');
  if (!revealShotTaken) await screenshot('reveal-backs');
  await clickText('カードをめくる');
  await waitForEnabled('効果を見る');
  if (!revealShotTaken) { await new Promise((resolve) => setTimeout(resolve, 1000)); await screenshot('reveal-fronts'); revealShotTaken = true; }
  await clickText('効果を見る');
}
async function clickSelector(selector) {
  const clicked = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
  if (!clicked) throw new Error(`要素「${selector}」がありません`);
}
async function clickCardName(name) {
  const clicked = await evaluate(`(() => { const el = [...document.querySelectorAll('.select-card')].find((node) => node.textContent.includes(${JSON.stringify(name)})); if (!el) return false; el.click(); return true; })()`);
  if (!clicked) throw new Error(`選択カード「${name}」がありません`);
}
async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const path = join(tmpdir(), `gcard-${name}.png`);
  await writeFile(path, Buffer.from(result.data, 'base64'));
  return path;
}
async function navigate() {
  const url = new URL(appUrl);
  url.searchParams.set('qa', String(Date.now()));
  url.hash = '/battle';
  await send('Page.navigate', { url: url.href });
  await waitFor('対戦モードを選ぶ');
  await waitForEnabled('カードセットを見る');
  if (!settingsReset) {
    await evaluate(`localStorage.removeItem('g-card-stage3-tuning')`);
    await send('Page.reload');
    await waitFor('対戦モードを選ぶ');
    await waitForEnabled('カードセットを見る');
    settingsReset = true;
  }
  introSeen = 0;
  await evaluate(`(() => { window.__gcardIntroCount = 0; window.__gcardIntroStages = []; window.__gcardEarlyCards = false; let active = false; let lastStage = ''; new MutationObserver(() => { const intro = document.querySelector('.round-intro'); const stage = intro?.dataset.stage ?? ''; if (intro && !active) window.__gcardIntroCount++; if (stage && stage !== lastStage) window.__gcardIntroStages.push(stage); if (intro && document.querySelector('.reveal-entry')) window.__gcardEarlyCards = true; active = Boolean(intro); lastStage = stage; }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-stage'] }); })()`);
}

try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false });
  await navigate();
  await clickText('カードセットを見る');
  await waitFor('カードを4枚選ぶ');
  await clickText('救急箱');
  await clickText('キック');
  await clickText('キック');
  await clickText('救急箱');
  if (!(await evaluate(`document.querySelector('.deck-card[aria-pressed="true"]')?.textContent.includes('救急箱') || [...document.querySelectorAll('.deck-card[aria-pressed="true"]')].some((node) => node.textContent.includes('救急箱'))`))) throw new Error('救急箱をデッキに戻せません');
  const deckShot = await screenshot('deck');
  await clickText('対戦を始める');
  await waitFor('ラウンド 1');
  const decksDiffer = await evaluate(`(() => { const cpu = [...document.querySelectorAll('.back-card > span')].map((node) => node.textContent.split('・')[0]).sort().join(','); const player = [...document.querySelectorAll('.select-card > span')].map((node) => node.textContent.split(' · ')[0].split('（')[0]).sort().join(','); return cpu.length > 0 && player.length > 0 && cpu !== player; })()`);
  if (!decksDiffer) throw new Error('CPUのカード種類構成がプレイヤーと同じです');
  const battleShot = await screenshot('battle');
  let rounds = 0;
  while (!(await evaluate(`document.body.innerText.includes('BATTLE RESULT')`)) && rounds < 4) {
    if (await evaluate(`Boolean(document.querySelector('.select-card'))`)) await clickSelector('.select-card');
    else await clickText('オープン！');
    await revealAndResolve();
    if (await evaluate(`document.body.innerText.includes('MAGIC EFFECT')`)) {
      await clickSelector('.target-card');
      await clickText('このカードを変える');
    }
    await waitFor('RESULT');
    rounds++;
    if (await evaluate(`document.body.innerText.includes('結果を見る')`)) await clickText('結果を見る');
    else await clickText('次のラウンドへ');
  }
  await waitFor('BATTLE RESULT');
  console.log(`CPU対戦: ${rounds}ラウンドで結果画面まで完了`);

  await navigate();
  await clickText('この端末で対戦');
  await clickText('カードセットを見る');
  await clickText('対戦を始める');
  let localRounds = 0;
  while (!(await evaluate(`document.body.innerText.includes('BATTLE RESULT')`)) && localRounds < 4) {
    await waitFor('プレイヤー1の番です');
    await clickText('準備できた');
    if (await evaluate(`Boolean(document.querySelector('.select-card'))`)) await clickSelector('.select-card');
    else await clickText('オープン！');
    await waitFor('プレイヤー2の番です');
    await clickText('準備できた');
    if (await evaluate(`Boolean(document.querySelector('.select-card'))`)) await clickSelector('.select-card');
    else await clickText('オープン！');
    await revealAndResolve();
    if (await evaluate(`document.body.innerText.includes('MAGIC EFFECT')`)) {
      await clickSelector('.target-card');
      await clickText('このカードを変える');
    }
    await waitFor('RESULT');
    localRounds++;
    if (await evaluate(`document.body.innerText.includes('結果を見る')`)) await clickText('結果を見る');
    else await clickText('次のラウンドへ');
  }
  await waitFor('BATTLE RESULT');
  console.log(`端末内2人対戦: ${localRounds}ラウンド、目隠し交代から結果まで完了`);

  await navigate();
  await clickText('この端末で対戦');
  await clickText('カードセットを見る');
  await clickText('対戦を始める');
  await clickText('準備できた');
  await clickCardName('手品');
  await clickText('準備できた');
  await clickCardName('パンチ');
  await revealAndResolve();
  await waitFor('MAGIC EFFECT');
  const scissorsTarget = await evaluate(`(() => { const el = [...document.querySelectorAll('.target-card')].find((node) => node.textContent.includes('チョキ')); if (!el) return false; el.click(); return true; })()`);
  if (!scissorsTarget) throw new Error('チョキの対象がありません');
  await clickText('このカードを変える');
  await waitFor('手品！');
  await clickText('次のラウンドへ');
  await clickText('準備できた');
  await waitFor('グー・変化');
  console.log('手品: 対象選択、種類変更、次ラウンドの裏面更新を確認');

  await navigate();
  await clickText('この端末で対戦');
  await clickText('カードセットを見る');
  await clickText('対戦を始める');
  await clickText('準備できた');
  await clickCardName('手品');
  await clickText('準備できた');
  await clickCardName('火縄銃');
  await revealAndResolve();
  await clickText('次のラウンドへ');
  await clickText('準備できた');
  await clickCardName('救急箱');
  await clickText('準備できた');
  await clickCardName('パンチ');
  await revealAndResolve();
  await waitFor('30 回復！');
  await waitFor('80 / 100');
  console.log('救急箱: 勝利時に30回復し、ライフ表示へ反映されることを確認');

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate();
  const overflow = await evaluate('document.documentElement.scrollWidth > window.innerWidth');
  if (overflow) throw new Error('390px幅で横スクロールが発生しています');
  const mobileShot = await screenshot('mobile');
  await clickText('カードセットを見る');
  await waitFor('カードを4枚選ぶ');
  if (await evaluate('document.documentElement.scrollWidth > window.innerWidth')) throw new Error('390px幅のカード選択で横スクロールが発生しています');
  const mobileDeckShot = await screenshot('mobile-deck');
  console.log(`狭い画面: カード選択も横スクロールなし。画像: ${deckShot}, ${battleShot}, ${mobileShot}, ${mobileDeckShot}`);

  const tuningUrl = new URL(appUrl);
  tuningUrl.searchParams.set('qa', String(Date.now()));
  tuningUrl.hash = '/dev/tuning';
  await send('Page.navigate', { url: tuningUrl.href });
  await waitFor('試作用の調整');
  await evaluate(`(() => { const input = document.querySelector('input[type=number]'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, '120'); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const saved = await evaluate(`JSON.parse(localStorage.getItem('g-card-stage3-tuning')).initialLife`);
  if (saved !== 120) throw new Error(`調整値が保存されていません: ${saved}`);
  await send('Page.reload');
  await waitFor('試作用の調整');
  const restored = await evaluate(`Number(document.querySelector('input[type=number]').value)`);
  if (restored !== 120) throw new Error(`調整値が復元されていません: ${restored}`);
  await evaluate(`(() => { const label = [...document.querySelectorAll('label')].find((node) => node.textContent.includes('救急箱の回復量')); const input = label?.querySelector('input'); if (!input) throw new Error('救急箱の回復量がありません'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, '40'); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const savedHeal = await evaluate(`JSON.parse(localStorage.getItem('g-card-stage3-tuning')).heals.P003`);
  if (savedHeal !== 40) throw new Error(`救急箱の回復量が保存されていません: ${savedHeal}`);
  console.log('試作用の調整: ライフと救急箱の回復量の保存を確認');
} finally {
  socket.close();
}
