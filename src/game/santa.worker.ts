import { santaDecision } from './santa';
import type { BattleState } from './battle';
self.onmessage = (event: MessageEvent<{ state: BattleState; seed:number }>) => {
  try { self.postMessage({ decision:santaDecision(event.data.state,event.data.seed) }); }
  catch { self.postMessage({ error:'サンタの思考を再開してください' }); }
};
