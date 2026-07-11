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

  const storms = await createQWeatherLoader({ apiKey: 'test-key', host: 'https://qweather.example.test', fetcher, now: () => new Date('2026-07-11') })();

  expect(storms[0]).toMatchObject({ id: 'NP2024', current: { latitude: 24.7 }, forecast: [{ forecast: true }] });
  expect(fetcher.mock.calls[0][0]).toContain('/v7/tropical/storm-list?basin=NP&year=2026');
  expect(fetcher.mock.calls[0][1]?.headers).toEqual({ 'X-QW-Api-Key': 'test-key' });
  expect(fetcher.mock.calls[0][1]?.headers).not.toHaveProperty('Authorization');
});

test('rejects a QWeather payload code other than 200', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(json({ code: '204', storm: [] }))
    .mockResolvedValueOnce(json({ code: '204', storm: [] }));
  const load = createQWeatherLoader({ apiKey: 'test-key', host: 'https://qweather.example.test', fetcher, now: () => new Date('2026-07-11') });

  await expect(load()).rejects.toThrow('QWeather request failed with code 204');
});

test('rejects a missing API key without making an upstream request', async () => {
  const fetcher = vi.fn();
  const load = createQWeatherLoader({ apiKey: '', host: 'https://qweather.example.test', fetcher });

  await expect(load()).rejects.toThrow('QWeather API key is not configured');
  expect(fetcher).not.toHaveBeenCalled();
});

test('aborts a hung QWeather request after the configured timeout', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn((_url: Parameters<typeof fetch>[0], options?: RequestInit) => new Promise<never>((_, reject) => {
    options?.signal?.addEventListener('abort', () => reject(options.signal?.reason));
  }));
  const load = createQWeatherLoader({ apiKey: 'test-key', host: 'https://qweather.example.test', fetcher, timeoutMs: 10 });

  const pending = load();
  const rejected = expect(pending).rejects.toThrow('QWeather request timed out after 10ms');
  await vi.advanceTimersByTimeAsync(10);

  await rejected;
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringContaining('/v7/tropical/storm-list'),
    expect.objectContaining({ signal: expect.any(AbortSignal), headers: { 'X-QW-Api-Key': 'test-key' } }),
  );
  vi.useRealTimers();
});

test('uses the injected QWeather host with the API-key header', async () => {
  const host = 'https://qweather.example.test/custom';
  const fetcher = vi.fn()
    .mockResolvedValueOnce(json({ code: '200', storm: [] }))
    .mockResolvedValueOnce(json({ code: '200', storm: [] }));

  await createQWeatherLoader({ apiKey: 'test-key', host, fetcher })();

  expect(fetcher).toHaveBeenCalledWith(
    `${host}/v7/tropical/storm-list?basin=NP&year=${new Date().getUTCFullYear()}`,
    expect.objectContaining({ headers: { 'X-QW-Api-Key': 'test-key' } }),
  );
});

test('rejects an empty QWeather API host without making an upstream request', async () => {
  const fetcher = vi.fn();
  const load = createQWeatherLoader({ apiKey: 'test-key', host: '', fetcher });

  await expect(load()).rejects.toThrow('QWeather API host is not configured');
  expect(fetcher).not.toHaveBeenCalled();
});
