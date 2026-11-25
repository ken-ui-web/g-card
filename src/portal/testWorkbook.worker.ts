import { parseQuestionWorkbook } from './testWorkbook';

addEventListener('message', async (event: MessageEvent<{ buffer: ArrayBuffer; capacity: number }>) => {
  try { postMessage({ rows: await parseQuestionWorkbook(event.data.buffer, event.data.capacity) }); }
  catch (failure) { postMessage({ error: (failure as Error).message || 'ファイルを読み込めませんでした。' }); }
});
