import { expect, test } from 'vitest';
import type { TrackPoint, Typhoon } from './domain.js';
import { TyphoonService } from './typhoon-service.js';

const point: TrackPoint = { observedAt: '2026-07-10T08:00:00Z', longitude: 122.3, latitude: 24.7, pressureHpa: 960, windMps: 35, forecast: false };

function typhoon(id: string, observedAt = point.observedAt, fxLink?: string): Typhoon {
  const current = { ...point, observedAt };
  return { id, name: `Storm ${id}`, level: 'Typhoon', current, history: [current], forecast: [], movementDirection: 'Northwest', fxLink };
}

test('reports live QWeather data and selected attribution', async () => {
  const service = new TyphoonService(async () => [typhoon('older', '2026-07-10T07:00:00Z'), typhoon('newer', point.observedAt, 'https://www.qweather.com/')]);
  await service.refresh();

  expect(service.snapshot()).toMatchObject({
    status: 'live', selected: { id: 'newer' }, storms: [{ id: 'older' }, { id: 'newer' }],
    source: 'QWeather Tropical Cyclone API', fxLink: 'https://www.qweather.com/',
  });
  expect(service.snapshot().updatedAt).toEqual(expect.any(String));
});

test('reports an empty successful response without a selected typhoon', async () => {
  const service = new TyphoonService(async () => []);
  await service.refresh();
  expect(service.snapshot()).toMatchObject({ status: 'empty', selected: null, storms: [], source: 'QWeather Tropical Cyclone API' });
});

test('keeps the last successful response when a refresh fails', async () => {
  const service = new TyphoonService(async () => [typhoon('2601')]);
  await service.refresh();
  const successfulSnapshot = service.snapshot();
  service.setLoaderForTest(async () => { throw new Error('upstream timeout'); });
  await service.refresh();
  expect(service.snapshot()).toMatchObject({ status: 'stale', selected: { id: '2601' } });
  expect(service.snapshot().storms).toEqual(successfulSnapshot.storms);
});

test('reports an error when the first refresh fails', async () => {
  const service = new TyphoonService(async () => { throw new Error('upstream timeout'); });
  await service.refresh();
  expect(service.snapshot()).toMatchObject({ status: 'error', selected: null, storms: [] });
});
