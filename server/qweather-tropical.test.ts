import { expect, test, vi } from 'vitest';
import { createQWeatherLoader } from './qweather-tropical.js';

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('maps active NP list, track, and forecast', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(json({ code: '200', storm: [{ id: 'NP2024', name: 'Test', isActive: '1' }] }))
    .mockResolvedValueOnce(json({ code: '200', storm: [] }))
    .mockResolvedValueOnce(json({ code: '200', track: [{ time: '2026-07-11T08:00+08:00', lat: '24.7', lon: '122.3', pressure: '990', windSpeed: '25', type: 'TS' }] }))
    .mockResolvedValueOnce(json({ code: '200', forecast: [{ fxTime: '2026-07-12T08:00+08:00', lat: '25.0', lon: '121.9', pressure: '992', windSpeed: '20', type: 'TS' }] }));

  const storms = await createQWeatherLoader({ credentialId: 'id', apiKey: 'secret', fetcher, now: new Date('2026-07-11') })();

  expect(storms[0]).toMatchObject({ id: 'NP2024', current: { latitude: 24.7 }, forecast: [{ forecast: true }] });
  expect(fetcher.mock.calls[0][0]).toContain('/v7/tropical/storm-list?basin=NP&year=2026');
  expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ Authorization: expect.stringMatching(/^Bearer /) });
});

test('rejects a QWeather payload code other than 200', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(json({ code: '204', storm: [] }))
    .mockResolvedValueOnce(json({ code: '204', storm: [] }));
  const load = createQWeatherLoader({ credentialId: 'id', apiKey: 'secret', fetcher, now: new Date('2026-07-11') });

  await expect(load()).rejects.toThrow('QWeather request failed with code 204');
});

test('rejects missing credentials without making an upstream request', async () => {
  const fetcher = vi.fn();
  const load = createQWeatherLoader({ credentialId: '', apiKey: '', fetcher });

  await expect(load()).rejects.toThrow('QWeather credentials are not configured');
  expect(fetcher).not.toHaveBeenCalled();
});
