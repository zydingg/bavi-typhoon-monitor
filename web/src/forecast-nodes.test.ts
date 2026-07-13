import { expect, test } from 'vitest';
import { buildForecastNodes, nearestCoastalCity } from './forecast-nodes.js';

const current = { observedAt: '2026-07-13T00:00:00+08:00', longitude: 121, latitude: 24, forecast: false };
const point = (hours: number) => ({
  observedAt: new Date(Date.parse(current.observedAt) + hours * 3_600_000).toISOString(),
  longitude: 121 + hours / 100,
  latitude: 24 + hours / 100,
  forecast: true,
});

test('builds each fixed target from the nearest point no more than six hours away', () => {
  expect(buildForecastNodes(current, [point(11), point(25), point(96)])).toEqual([
    expect.objectContaining({ hoursAhead: 12, point: point(11) }),
    expect.objectContaining({ hoursAhead: 24, point: point(25) }),
    expect.objectContaining({ hoursAhead: 36, point: undefined }),
    expect.objectContaining({ hoursAhead: 48, point: undefined }),
    expect.objectContaining({ hoursAhead: 60, point: undefined }),
    expect.objectContaining({ hoursAhead: 72, point: undefined }),
    expect.objectContaining({ hoursAhead: 96, point: point(96) }),
  ]);
});

test('chooses a stable nearest coastal fallback for an ocean coordinate', () => {
  expect(nearestCoastalCity(122.5, 23.6)).toBe('台北');
});
