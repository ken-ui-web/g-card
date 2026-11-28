import { describe, expect, it } from 'vitest';
import { getCard } from '../data/cards';
import { CHRISTMAS_FRAME_ID } from '../data/frames';
import { deckCommit, pickCommit, stateDigest, stableDeck, type OnlineEntry, type OnlineRoom } from './protocol';
import { deriveView } from './protocolParity.testutil';

async function fixture() {
  const entries:OnlineEntry[][]=[['G023','G001','C008','P003'],['G001','G002','C008','P003']].map((ids,side)=>ids.map((cardId,i)=>({cardId,trainLevel:0,...(side===0&&i===0?{frameId:CHRISTMAS_FRAME_ID}:{})})));
  const room:OnlineRoom={meta:{battleId:'frames',protocolVersion:2,deckMode:'owned',hostUid:'a',guestUid:'b',seed:7,createdAt:1,expiresAt:9999999},players:{a:{nickname:'A',maxLife:100,connected:true,lastSeen:1},b:{nickname:'B',maxLife:100,connected:true,lastSeen:1}},decks:{},rounds:{}};
  for(const [side,uid] of ['a','b'].entries())room.decks![uid]={types:entries[side].map((e)=>getCard(e.cardId).type),ssr:entries[side].map((e)=>getCard(e.cardId).rarity==='SSR'),...(side===0?{frames:[CHRISTMAS_FRAME_ID,'','','']}:{}),commit:await deckCommit(entries[side],'salt')};
  room.rounds!['1']={commit:{a:await pickCommit('frames',1,0,'x'),b:await pickCommit('frames',1,0,'y')},reveal:{a:{index:0,salt:'x',card:entries[0][0]},b:{index:0,salt:'y',card:entries[1][0]}}};
  return room;
}
describe('オンラインの永続フレーム',()=>{
  it('SSRあいこ回復をブラウザとGASが同じ状態で確定する',async()=>{
    const room=await fixture(),view=await deriveView(room);expect(view.phase).toBe('verify');expect(view.life).toEqual([110,70]);
    const hash=await stateDigest(view);room.rounds!['1'].stateHash={a:hash,b:hash};expect((await deriveView(room)).phase).toBe('select');
  });
  it('公開していないフレームの後付け・効果偽装を拒否する',async()=>{
    const room=await fixture();delete room.decks!.a.frames;expect((await deriveView(room)).phase).toBe('invalid');
  });
  it('旧デッキのコミット表現を維持し、装着時だけ区別する',()=>{
    expect(stableDeck([{cardId:'G001',trainLevel:0}])).toBe('[["G001","",0]]');
    expect(stableDeck([{cardId:'G001',trainLevel:0,frameId:CHRISTMAS_FRAME_ID}])).toContain(CHRISTMAS_FRAME_ID);
  });
});
