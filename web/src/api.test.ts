import { afterEach, expect, test, vi } from 'vitest';
import { getCurrentTyphoon } from './api.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('rejects a non-OK dashboard response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));

  await expect(getCurrentTyphoon()).rejects.toThrow('台风数据请求失败（503）');
});
