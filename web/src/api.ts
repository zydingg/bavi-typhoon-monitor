import type { TyphoonSnapshot } from './types.js';

export async function getCurrentTyphoon(): Promise<TyphoonSnapshot> {
  const response = await fetch('/api/typhoon/current');

  if (!response.ok) {
    throw new Error(`台风数据请求失败（${response.status}）`);
  }

  return response.json() as Promise<TyphoonSnapshot>;
}
