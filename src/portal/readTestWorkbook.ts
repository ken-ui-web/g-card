import type { ImportRow } from './testAuthoring';

export async function readTestWorkbook(file: File, capacity: number, signal: AbortSignal): Promise<ImportRow[]> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('.xlsx形式のExcelファイルを選択してください。');
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('5MB以内のExcelファイルを選択してください。');
  const buffer = await file.arrayBuffer();
  if (signal.aborted) throw new DOMException('読み込みを中止しました', 'AbortError');
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./testWorkbook.worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => {
      worker.terminate();
      window.clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    };
    const abort = () => { cleanup(); reject(new DOMException('読み込みを中止しました', 'AbortError')); };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('読み込みに時間がかかっています。ファイルの内容とサイズを確認してください。'));
    }, 30000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ rows?: ImportRow[]; error?: string }>) => {
      cleanup();
      if (event.data.rows) resolve(event.data.rows);
      else reject(new Error(event.data.error || 'ファイルを読み込めませんでした。'));
    };
    worker.onerror = (event) => {
      event.preventDefault();
      cleanup();
      reject(new Error('Excelの読み込み処理を開始できません。ページを再読み込みしてお試しください。'));
    };
    worker.postMessage({ buffer, capacity }, [buffer]);
  });
}
