import { expect, test } from 'vitest';
import { parsePortalPayload, normalizePortalTyphoon } from './typhoon-source.js';

test('unwraps JSONP and normalizes a typhoon track', () => {
  const source = parsePortalPayload(
    'callback({"data":[{"tfbh":"2601","name":"绀轰緥","points":[["2026-07-10 08:00",122.3,24.7,960,35]]}]})',
  );

  expect(normalizePortalTyphoon(source.data[0])).toMatchObject({
    id: '2601',
    name: '绀轰緥',
    current: {
      longitude: 122.3,
      latitude: 24.7,
      pressureHpa: 960,
      windMps: 35,
    },
  });
});
