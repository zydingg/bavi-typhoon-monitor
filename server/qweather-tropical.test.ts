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

test('rejects when a successful QWeather response never finishes decoding JSON', async () => {
  vi.useFakeTimers();
  const response = new Response(JSON.stringify({ code: '200', storm: [] }), { status: 200 });
  vi.spyOn(response, 'json').mockImplementation(() => new Promise(() => {}));
  const fetcher = vi.fn().mockResolvedValue(response);
  const load = createQWeatherLoader({ apiKey: 'test-key', host: 'https://qweather.example.test', fetcher, timeoutMs: 10 });

  const outcome = load().then(
    () => 'resolved',
    (error: Error) => error.message,
  );
  await vi.advanceTimersByTimeAsync(10);

  await expect(Promise.race([outcome, Promise.resolve('request stayed pending')]))
    .resolves.toBe('QWeather request timed out after 10ms');
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

test.each(['http://www.qweather.com/storm', 'not a URL'])('omits an invalid upstream fxLink without dropping the storm', async (fxLink) => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(json({ code: '200', storm: [{ id: 'NP2024', name: 'Test', isActive: '1' }] }))
    .mockResolvedValueOnce(json({ code: '200', storm: [] }))
    .mockResolvedValueOnce(json({ code: '200', fxLink, track: [{ time: '2026-07-11T08:00+08:00', lat: '24.7', lon: '122.3', type: 'TS' }] }))
    .mockResolvedValueOnce(json({ code: '200', forecast: [] }));

  const storms = await createQWeatherLoader({ apiKey: 'test-key', host: 'https://qweather.example.test', fetcher, now: () => new Date('2026-07-11') })();

  expect(storms).toHaveLength(1);
  expect(storms[0]).not.toHaveProperty('fxLink');
});

test('preserves a valid QWeather HTTPS fxLink', async () => {
  const fxLink = 'https://www.qweather.com/en/weather/typhoon';
  const fetcher = vi.fn()
    .mockResolvedValueOnce(json({ code: '200', storm: [{ id: 'NP2024', name: 'Test', isActive: '1' }] }))
    .mockResolvedValueOnce(json({ code: '200', storm: [] }))
    .mockResolvedValueOnce(json({ code: '200', fxLink, track: [{ time: '2026-07-11T08:00+08:00', lat: '24.7', lon: '122.3', type: 'TS' }] }))
    .mockResolvedValueOnce(json({ code: '200', forecast: [] }));

  const storms = await createQWeatherLoader({ apiKey: 'test-key', host: 'https://qweather.example.test', fetcher, now: () => new Date('2026-07-11') })();

  expect(storms[0].fxLink).toBe(fxLink);
});

test('rejects an empty QWeather API host without making an upstream request', async () => {
  const fetcher = vi.fn();
  const load = createQWeatherLoader({ apiKey: 'test-key', host: '', fetcher });

  await expect(load()).rejects.toThrow('QWeather API host is not configured');
  expect(fetcher).not.toHaveBeenCalled();
});

test.each(['http://qweather.example.test', 'not a URL'])('rejects a non-HTTPS or invalid QWeather API host without making an upstream request', async (host) => {
  const fetcher = vi.fn();
  const load = createQWeatherLoader({ apiKey: 'test-key', host, fetcher });

  await expect(load()).rejects.toThrow('QWeather API host must be a valid HTTPS URL');
  expect(fetcher).not.toHaveBeenCalled();
});
