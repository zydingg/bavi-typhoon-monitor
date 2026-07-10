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

test('keeps a multi-row track without forecast flags entirely in history', () => {
  const typhoon = normalizePortalTyphoon({
    tfbh: '2602',
    name: 'History only',
    points: [
      ['2026-07-10 02:00', 120, 20],
      ['2026-07-10 05:00', 121, 21],
      ['2026-07-10 08:00', 122, 22],
      ['2026-07-10 11:00', 123, 23],
    ],
  });

  expect(typhoon.history).toHaveLength(4);
  expect(typhoon.forecast).toHaveLength(0);
  expect(typhoon.current.observedAt).toBe('2026-07-10 11:00');
});

test('puts only an explicitly forecast-marked row in the forecast track', () => {
  const typhoon = normalizePortalTyphoon({
    tfbh: '2603',
    name: 'Explicit forecast',
    points: [
      ['2026-07-10 02:00', 120, 20, undefined, undefined, false],
      ['2026-07-10 05:00', 121, 21, undefined, undefined, false],
      ['2026-07-10 08:00', 122, 22, undefined, undefined, true],
    ],
  });

  expect(typhoon.history).toHaveLength(2);
  expect(typhoon.forecast).toHaveLength(1);
  expect(typhoon.current.observedAt).toBe('2026-07-10 05:00');
});

test('rejects typhoons with missing or blank identifiers', () => {
  expect(() => normalizePortalTyphoon({ name: 'Missing ID', points: [['2026-07-10', 120, 20]] })).toThrow();
  expect(() => normalizePortalTyphoon({ tfbh: ' ', name: 'Blank ID', points: [['2026-07-10', 120, 20]] })).toThrow();
});

test('rejects track points with coordinates outside the domain bounds', () => {
  expect(() =>
    normalizePortalTyphoon({
      tfbh: '2604',
      name: 'Invalid coordinate',
      points: [['2026-07-10', 99, 20]],
    }),
  ).toThrow();
});
