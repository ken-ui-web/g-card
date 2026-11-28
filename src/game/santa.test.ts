import { describe, expect, it } from 'vitest';
import { beginRound, choiceRequests, createBattle, finishRound, type BattleState } from './battle';
import { chooseCpuCard, toCpuView } from './cpu';
import { santaDecision, santaPublicState, santaTargets } from './santa';
const config={initialLife:120,cpuMaxLife:120,cpuTraining:0,damages:{}};
describe('サンタCPUの公開情報と思考',()=>{
  it('相手の未公開のカード名・筋トレ値を受け取らず、同じ裏面なら同じ判断になる',()=>{
    const state=createBattle('cpu',config,7,[['G001','G002','C008','P003'],['G023','G010','G007','P010']]);
    const other=structuredClone(state);for(const card of other.players[0].hand){if(card.originalType==='rock'){card.cardId='G009';card.trainLevel=20;}}
    expect(santaPublicState(state)).toEqual(santaPublicState(other));
    expect(santaDecision(santaPublicState(state),7)).toEqual(santaDecision(santaPublicState(other),7));
  });
  it('Lv3との同条件の対戦を完走し、思考時間を計測する',()=>{
    let wins=0,losses=0,draws=0,maxMs=0;
    for(let seed=1;seed<=12;seed++){
      let state:BattleState=createBattle('cpu',config,seed,[['G023','G010','G007','P010'],['G023','G010','G007','P010']]);
      while(state.outcome===null){
        const view=toCpuView({...state,players:[state.players[1],state.players[0]]});
        const old=chooseCpuCard(view,3,seed),started=performance.now(),santa=santaDecision(santaPublicState(state),seed);
        maxMs=Math.max(maxMs,performance.now()-started);
        const revealed=beginRound(state,[old.id,santa.id]);
        const choices=santaTargets(revealed,seed);
        // Match the current Lv3 target policy (first target); Santa evaluates its effects.
        state=finishRound(revealed,choiceRequests(revealed).map((request,i)=>request.actor===1?choices[i]:({targetId:request.options[0]?.instanceId,to:'rock'})));
      }
      if(state.outcome==='draw')draws++;else if(state.outcome===1)wins++;else losses++;
    }
    console.info(`Santa / Lv3, equal deck & life: ${wins}W ${losses}L ${draws}D; maximum decision ${Math.round(maxMs)}ms`);
    expect(wins+losses+draws).toBe(12);expect(wins).toBeGreaterThan(losses);expect(maxMs).toBeLessThan(2000);
  },30000);
});
