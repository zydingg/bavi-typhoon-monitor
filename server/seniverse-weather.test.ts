import { expect, test, vi } from 'vitest';
import { createSeniverseLoader } from './seniverse-weather.js';

test('calls Seniverse with typhoon latitude/longitude and keeps the key server-side', async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      results: [{
        location: { name: 'Typhoon center nearby' },
        now: {
          text: 'Cloudy',
          code: '4',
          temperature: '28',
          wind_direction: 'Southeast',
          wind_speed: '25',
          pressure: '990',
          last_update: '2026-07-11T08:00:00+08:00',
        },
      }],
    }),
  });
  const load = createSeniverseLoader('private-key', fetcher);

  await expect(load({ latitude: 24.7, longitude: 122.3 })).resolves.toMatchObject({
    locationName: 'Typhoon center nearby',
    text: 'Cloudy',
    temperatureC: 28,
    windSpeedKph: 25,
  });

  expect(fetcher.mock.calls[0]?.[0].toString()).toContain('location=24.7%3A122.3');
  expect(fetcher.mock.calls[0]?.[0].toString()).toContain('key=private-key');
});

test('rejects a missing API key without calling Seniverse', async () => {
  const fetcher = vi.fn();
  const load = createSeniverseLoader('', fetcher);

  await expect(load({ latitude: 24.7, longitude: 122.3 })).rejects.toThrow('SENIVERSE_API_KEY is not configured');
  expect(fetcher).not.toHaveBeenCalled();
});

test('rejects a Seniverse response without a current-weather record', async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ results: [] }),
  });
  const load = createSeniverseLoader('private-key', fetcher);

  await expect(load({ latitude: 24.7, longitude: 122.3 })).rejects.toThrow(
    'Seniverse response has no current-weather record',
  );
});
