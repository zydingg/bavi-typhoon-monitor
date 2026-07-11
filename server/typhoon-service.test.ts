import { expect, test, vi } from 'vitest';
import type { TrackPoint, Typhoon } from './domain.js';
import { createPortalLoader, type PortalFetcher, TyphoonService } from './typhoon-service.js';

const point: TrackPoint = {
  observedAt: '2026-07-10T08:00:00Z',
  longitude: 122.3,
  latitude: 24.7,
  pressureHpa: 960,
  windMps: 35,
  forecast: false,
};

function typhoon(id: string, observedAt = point.observedAt): Typhoon {
  const current = { ...point, observedAt };

  return {
    id,
    name: `Storm ${id}`,
    level: 'Typhoon',
    current,
    history: [current],
    forecast: [],
    movementDirection: 'Northwest',
  };
}

test('reports live data and selects the most recently observed typhoon', async () => {
  const service = new TyphoonService(async () => [typhoon('older', '2026-07-10T07:00:00Z'), typhoon('newer')]);

  await service.refresh();

  expect(service.snapshot()).toMatchObject({
    status: 'live',
    selected: { id: 'newer' },
    storms: [{ id: 'older' }, { id: 'newer' }],
    source: 'Zhejiang Typhoon Portal',
  });
  expect(service.snapshot().updatedAt).toEqual(expect.any(String));
});

test('reports an empty successful response without a selected typhoon', async () => {
  const service = new TyphoonService(async () => []);

  await service.refresh();

  expect(service.snapshot()).toMatchObject({
    status: 'empty',
    selected: null,
    storms: [],
  });
  expect(service.snapshot().updatedAt).toEqual(expect.any(String));
});

test('marks weather as not applicable for an empty successful response', async () => {
  const weatherLoader = vi.fn();
  const service = new TyphoonService(async () => [], weatherLoader);

  await service.refresh();

  expect(service.snapshot()).toMatchObject({ weather: null, weatherStatus: 'not_applicable' });
  expect(weatherLoader).not.toHaveBeenCalled();
});

test('keeps a live typhoon snapshot when Seniverse fails', async () => {
  const service = new TyphoonService(
    async () => [typhoon('2601')],
    async () => { throw new Error('weather unavailable'); },
  );

  await service.refresh();

  expect(service.snapshot()).toMatchObject({ status: 'live', weather: null, weatherStatus: 'unavailable' });
});

test('loads weather only for the selected typhoon from the successful refresh', async () => {
  const weatherLoader = vi.fn(async () => ({
    locationName: 'Typhoon center nearby',
    text: 'Cloudy',
    code: '4',
    temperatureC: 28,
    windDirection: 'Southeast',
    windSpeedKph: 25,
    pressureMb: 990,
    observedAt: '2026-07-11T08:00:00+08:00',
  }));
  const service = new TyphoonService(
    async () => [typhoon('older', '2026-07-10T07:00:00Z'), typhoon('newer')],
    weatherLoader,
  );

  await service.refresh();

  expect(weatherLoader).toHaveBeenCalledWith({ latitude: 24.7, longitude: 122.3 });
  expect(service.snapshot()).toMatchObject({
    status: 'live',
    weatherStatus: 'available',
    weather: { temperatureC: 28 },
  });
});

test('reports an error when the first refresh fails', async () => {
  const service = new TyphoonService(async () => {
    throw new Error('upstream timeout');
  });

  await service.refresh();

  expect(service.snapshot()).toMatchObject({ status: 'error', selected: null, storms: [] });
  expect(service.snapshot().updatedAt).toBeUndefined();
});

test('keeps the last successful response when a refresh fails', async () => {
  const service = new TyphoonService(async () => [typhoon('2601')]);

  await service.refresh();
  const successfulSnapshot = service.snapshot();
  service.setLoaderForTest(async () => {
    throw new Error('upstream timeout');
  });
  await service.refresh();

  expect(service.snapshot()).toMatchObject({ status: 'stale', selected: { id: '2601' } });
  expect(service.snapshot().storms).toEqual(successfulSnapshot.storms);
  expect(service.snapshot().updatedAt).toBe(successfulSnapshot.updatedAt);
});

test('loads and normalizes portal data through an injected fetcher', async () => {
  const fetcher: PortalFetcher = vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () =>
      'callback({"data":[{"tfbh":"2601","name":"Storm","points":[["2026-07-10T08:00:00Z",122.3,24.7,960,35]]}]})',
  }));
  const loader = createPortalLoader('https://portal.example.test/current', fetcher);

  await expect(loader()).resolves.toMatchObject([
    { id: '2601', current: { longitude: 122.3, latitude: 24.7 } },
  ]);
  expect(fetcher).toHaveBeenCalledWith(
    'https://portal.example.test/current',
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});

test('rejects non-successful portal responses', async () => {
  const loader = createPortalLoader('https://portal.example.test/current', async () => ({
    ok: false,
    status: 503,
    text: async () => '',
  }));

  await expect(loader()).rejects.toThrow('Portal request failed with status 503');
});

test('aborts an upstream fetch that exceeds the configured timeout', async () => {
  const fetcher: PortalFetcher = vi.fn((_url, options) => new Promise<never>((_, reject) => {
    options?.signal?.addEventListener('abort', () => reject(options.signal?.reason));
  }));
  const loader = createPortalLoader('https://portal.example.test/current', fetcher, 10);

  await expect(loader()).rejects.toThrow('Typhoon portal request timed out after 10ms');
  expect(fetcher).toHaveBeenCalledWith('https://portal.example.test/current', expect.objectContaining({ signal: expect.any(AbortSignal) }));
});
