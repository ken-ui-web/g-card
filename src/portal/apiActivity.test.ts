import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('GAS通信の進行表示', () => {
  it('通信中だけ操作を通知し、並行する通信をそれぞれ終了まで追う', async () => {
    vi.stubEnv('VITE_GAS_URL', 'https://example.invalid/gas');
    vi.resetModules();
    const { callApi, getApiActivity } = await import('./api');
    const replies: ((response: Response) => void)[] = [];
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { replies.push(resolve); })));

    const selling = callApi('sellCard', 'school-session');
    const loading = callApi('adminDashboard', 'school-session');
    expect(getApiActivity().map((request) => request.action)).toEqual(['sellCard', 'adminDashboard']);

    replies[0](new Response(JSON.stringify({ ok: true, data: { gPoint: 100 } }), { status: 200 }));
    await selling;
    expect(getApiActivity().map((request) => request.action)).toEqual(['adminDashboard']);

    replies[1](new Response(JSON.stringify({ ok: true, data: { students: 35 } }), { status: 200 }));
    await loading;
    expect(getApiActivity()).toEqual([]);
  });
});
