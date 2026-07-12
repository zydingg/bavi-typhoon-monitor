import { expect, test } from 'vitest';
import { TyphoonSchema } from './domain.js';

const validTyphoon = {
  id: 'NP2026',
  name: 'Test storm',
  current: { observedAt: '2026-07-11T08:00:00Z', longitude: 122.3, latitude: 24.7, forecast: false },
  history: [],
  forecast: [],
};

test('accepts only HTTPS typhoon attribution links', () => {
  expect(TyphoonSchema.safeParse({ ...validTyphoon, fxLink: 'https://www.qweather.com/storm' }).success).toBe(true);
  expect(TyphoonSchema.safeParse({ ...validTyphoon, fxLink: 'javascript:alert(1)' }).success).toBe(false);
  expect(TyphoonSchema.safeParse({ ...validTyphoon, fxLink: 'data:text/html,unsafe' }).success).toBe(false);
});
