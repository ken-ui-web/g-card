import { availableCards, getCard, ssrCount, type CardType } from '../data/cards';
import { trainingCap } from '../data/trainingCaps';
import { beginRound, choiceRequests, finishRound, requiredPick, type BattleCard, type BattleState, type PlayerIndex, type RoundChoice } from './battle';
import { nextRandom } from './cpu';

// The worker receives a deliberately redacted state: unseen enemy faces/training
// never cross this boundary. Determinizations are hypotheses, not hidden knowledge.
export function santaPublicState(state: BattleState): BattleState {
  const copy = structuredClone(state);
  copy.players[0].startingCardIds = [];
  copy.players[0].hand = copy.players[0].hand.map((card) => card.revealedTo?.includes(1) ? card : {
    ...card, cardId: '', trainLevel: 0, currentType: copy.players[0].encrypted && !card.publicType ? 'rock' : card.currentType,
  });
  return copy;
}
const strength = (card: BattleCard) => {
  if (!card.cardId || card.nullified) return 0;
  return getCard(card.cardId).effects.reduce((sum,e) => sum + (e.type === 'damage' ? (e.amount + card.trainLevel * getCard(card.cardId).trainingMultiplier) * (e.hits ?? 1) : e.type === 'heal' ? e.amount * .7 : e.type === 'poison' ? 28 : e.type === 'changeAllOpponentType' ? 36 : e.type === 'shield' ? 18 : 14),0) + (getCard(card.cardId).rarity === 'SSR' ? 18 : 0);
};
function value(state: BattleState): number {
  if (state.outcome !== null) return state.outcome === 'draw' ? 0 : state.outcome === 1 ? 2000 + state.players[1].life : -2000 - state.players[0].life;
  const score = (side: PlayerIndex) => {
    const p = state.players[side];
    return p.life + p.hand.reduce((sum,card) => sum+strength(card),0)*.18 + p.shields.length*9 - p.poison*(5-state.round)*.8 + p.nextDamage*.4 - p.delayed.reduce((sum,e) => sum+e.amount,0)*.8;
  };
  return score(1)-score(0);
}
function choicesFor(state: BattleState): RoundChoice[] {
  const requests = choiceRequests(state);
  let choices: RoundChoice[] = [];
  // Beam search keeps paired swaps and optional transformations together.
  let beam: RoundChoice[][] = [[]];
  for (const request of requests) {
    const candidates: RoundChoice[] = request.kind === 'allOpponent' ? [{}] : request.options.flatMap((card) => request.kind === 'own' || request.kind === 'encrypt' ? (['rock','scissors','paper'] as CardType[]).map((to) => ({ targetId:card.instanceId,to })) : [{ targetId:card.instanceId }]);
    if (request.optional) candidates.push({});
    const extended = beam.flatMap((partial) => candidates.map((choice) => [...partial,choice]));
    // Requests are in effect order. Use each acting side's perspective.
    extended.sort((a,b) => {
      const evaluate = (c: RoundChoice[]) => { try { return value(finishRound(state,c)); } catch { return 0; } };
      return (request.actor === 1 ? -1 : 1)*(evaluate(a)-evaluate(b));
    });
    beam = extended.slice(0,8);
  }
  if (beam.length) choices = beam[0];
  return choices;
}
function resolve(state: BattleState, a: string, b: string): BattleState {
  const reveal = beginRound(state,[a,b]);
  return finishRound(reveal,choicesFor(reveal));
}
function options(state: BattleState, side: PlayerIndex): BattleCard[] {
  const forced = requiredPick(state,side);
  return state.players[side].hand.filter((card) => !forced || card.instanceId === forced);
}
function solve(matrix: number[][]): { policy:number[]; value:number } {
  const n=matrix.length,m=matrix[0].length, ar=Array(n).fill(0),br=Array(m).fill(0),average=Array(n).fill(0);
  const policy = (regret:number[]) => { const positive=regret.map((r) => Math.max(0,r)),sum=positive.reduce((a,b)=>a+b,0); return positive.map((r)=>sum?r/sum:1/positive.length); };
  for(let step=0;step<180;step++) {
    const a=policy(ar),b=policy(br), av=matrix.map((row)=>row.reduce((sum,v,j)=>sum+v*b[j],0)),bv=Array.from({length:m},(_,j)=>matrix.reduce((sum,row,i)=>sum+row[j]*a[i],0));
    const v=av.reduce((sum,x,i)=>sum+x*a[i],0);
    for(let i=0;i<n;i++){ar[i]+=av[i]-v;average[i]+=a[i];}
    for(let j=0;j<m;j++)br[j]+=v-bv[j];
  }
  const a=average.map((x)=>x/180);
  return { policy:a,value:Math.min(...Array.from({length:m},(_,j)=>matrix.reduce((sum,row,i)=>sum+row[j]*a[i],0))) };
}
function forecast(state: BattleState, depth:number): number {
  if (state.outcome !== null || depth === 0) return value(state);
  return solve(options(state,1).map((own)=>options(state,0).map((enemy)=>forecast(resolve(state,enemy.instanceId,own.instanceId),depth-1)))).value;
}
function hypothesize(redacted: BattleState, seed:number): BattleState {
  const state=structuredClone(redacted);
  for (const card of state.players[0].hand) {
    if (card.cardId) continue;
    const pool=availableCards.filter((definition)=>definition.type===card.originalType && (definition.rarity==='SSR')===(card.rarity==='SSR') && definition.cardId!=='G023');
    seed=nextRandom(seed).seed;
    const definition=pool[seed%pool.length]; card.cardId=definition.cardId;
    card.trainLevel=definition.type==='rock'?Math.min(10,trainingCap(definition.cardId)):0;
    if(state.players[0].encrypted&&!card.publicType)card.currentType=(['rock','scissors','paper'] as const)[(seed>>>8)%3];
  }
  state.players[0].startingCardIds=state.players[0].hand.map((card)=>card.cardId);
  return state;
}
export function santaDecision(redacted: BattleState, seed:number): { id:string; seed:number } {
  const own=options(redacted,1),enemy=options(redacted,0);
  if(own.length===1)return { id:own[0].instanceId,seed };
  const matrix=own.map(()=>enemy.map(()=>0)),samples=12;
  for(let sample=0;sample<samples;sample++) {
    seed=nextRandom(seed).seed;
    const state=hypothesize(redacted,seed);
    own.forEach((card,i)=>enemy.forEach((back,j)=>{ matrix[i][j]+=forecast(resolve(state,back.instanceId,card.instanceId),1)/samples; }));
  }
  const mix=solve(matrix),draw=nextRandom(seed); let x=draw.value,index=own.length-1;
  for(let i=0;i<own.length;i++){x-=mix.policy[i];if(x<=0){index=i;break;}}
  return {id:own[index].instanceId,seed:draw.seed};
}
export function santaTargets(state:BattleState,seed:number):RoundChoice[] {
  return choicesFor(hypothesize(santaPublicState(state),seed));
}
export function santaDeck(pool:string[],seed:number):{ids:string[];seed:number} {
  const unique=[...new Set(pool)]; let best:string[]=[],bestScore=-Infinity;
  for(let trial=0;trial<200;trial++) {
    const shuffled=[...unique];
    for(let i=shuffled.length-1;i>0;i--){seed=nextRandom(seed).seed;const j=seed%(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
    const ids=shuffled.slice(0,4);if(ssrCount(ids)>1)continue;
    const score=ids.reduce((sum,cardId)=>sum+strength({cardId,trainLevel:Math.min(20,trainingCap(cardId))} as BattleCard),0)+new Set(ids.map((id)=>getCard(id).type)).size*25;
    if(score>bestScore){best=ids;bestScore=score;}
  }
  if(best.length!==4)throw new Error('サンタCPUの候補カードを確認してください');
  return { ids:best,seed };
}
