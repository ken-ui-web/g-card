import { expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { deriveView as browserView, type OnlineRoom, type OnlineView } from './protocol';

const gasContext = createContext({ Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'UTF-8' }, computeDigest: (_: string, value: string) => [...createHash('sha256').update(value).digest()] } });
runInContext(readFileSync('gas/OnlineEngine.gs', 'utf8'), gasContext);

// All protocol scenarios compare the generated synchronous GAS adapter too.
export async function deriveView(room: OnlineRoom): Promise<OnlineView> {
  const view = await browserView(room);
  expect(JSON.parse(JSON.stringify(gasContext.GC_ONLINE_ENGINE.deriveView(room)))).toEqual(JSON.parse(JSON.stringify(view)));
  return view;
}
