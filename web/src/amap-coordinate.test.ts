import { expect, test } from 'vitest';
import { toAmapCoordinate } from './amap-coordinate.js';

test('converts a mainland WGS84 coordinate to GCJ-02', () => {
  const [longitude, latitude] = toAmapCoordinate(121.4737, 31.2304);

  expect(longitude).toBeCloseTo(121.4782, 3);
  expect(latitude).toBeCloseTo(31.2285, 3);
});

test('keeps an ocean coordinate outside mainland China unchanged', () => {
  expect(toAmapCoordinate(140, 20)).toEqual([140, 20]);
});
