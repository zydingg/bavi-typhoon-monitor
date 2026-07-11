import { once } from 'node:events';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test, vi } from 'vitest';
import { createApp, startServer, startTyphoonServer } from './index';
import { createPortalLoader, type PortalFetcher, TyphoonService } from './typhoon-service.js';

const point = {
  observedAt: '2026-07-10T08:00:00Z',
  longitude: 122.3,
  latitude: 24.7,
  forecast: false,
};

const storm = {
  id: '2601',
  name: 'Storm 2601',
  level: 'Typhoon',
  current: point,
  history: [point],
  forecast: [],
  movementDirection: 'Northwest',
};

function getJson(port: number): Promise<{ statusCode: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const client = request({ host: '127.0.0.1', port, path: '/api/typhoon/current' }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        body += chunk;
      });
      response.once('end', () => {
        try {
          resolve({ statusCode: response.statusCode ?? 0, body: JSON.parse(body) });
        } catch (error) {
          reject(error);
        }
      });
    });

    client.once('error', reject);
    client.end();
  });
}

test('starts the application on the requested port', async () => {
  const server = startServer(createApp(), 0);

  await once(server, 'listening');

  expect((server.address() as AddressInfo).port).toBeGreaterThan(0);

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('wires a supplied service to the current typhoon endpoint', async () => {
  const service = new TyphoonService(async () => []);
  await service.refresh();
  const server = startServer(createApp(service), 0);

  try {
    await once(server, 'listening');
    const address = server.address() as AddressInfo;
    const response = await getJson(address.port);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ status: 'empty', selected: null, storms: [] });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('refreshes upstream on the server interval and returns a stale snapshot after a failed follow-up', async () => {
  vi.useFakeTimers();
  vi.stubEnv('TYPHOON_REFRESH_SECONDS', '600');
  const loader = vi.fn()
    .mockResolvedValueOnce([storm])
    .mockRejectedValueOnce(new Error('upstream unavailable'));
  const service = new TyphoonService(loader);
  const server = await startTyphoonServer(0, service);

  try {
    expect(loader).toHaveBeenCalledTimes(1);
    expect(service.snapshot()).toMatchObject({ status: 'live', selected: { id: '2601' } });

    await vi.advanceTimersByTimeAsync(600_000);

    expect(loader).toHaveBeenCalledTimes(2);
    expect(service.snapshot()).toMatchObject({ status: 'stale', selected: { id: '2601' } });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    vi.useRealTimers();
    vi.unstubAllEnvs();
  }
});

test('does not overlap scheduled refreshes and clears the refresh timer when the server closes', async () => {
  vi.useFakeTimers();
  vi.stubEnv('TYPHOON_REFRESH_SECONDS', '1');
  let completeRefresh: (() => void) | undefined;
  const loader = vi.fn()
    .mockResolvedValueOnce([storm])
    .mockImplementationOnce(() => new Promise<typeof storm[]>((resolve) => {
      completeRefresh = () => resolve([storm]);
    }));
  const service = new TyphoonService(loader);
  const server = await startTyphoonServer(0, service);

  try {
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(loader).toHaveBeenCalledTimes(2);

    completeRefresh?.();
    await vi.advanceTimersByTimeAsync(0);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(loader).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  }
});

test('starts and exposes an error snapshot after the initial loader fails', async () => {
  const service = new TyphoonService(async () => {
    throw new Error('upstream timed out');
  });
  const server = await startTyphoonServer(0, service);

  try {
    const address = server.address() as AddressInfo;
    const response = await getJson(address.port);
    expect(response.body).toMatchObject({ status: 'error', selected: null, storms: [] });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('starts with an error snapshot when the upstream response body times out', async () => {
  const fetcher: PortalFetcher = vi.fn(async (_url, options) => ({
    ok: true,
    status: 200,
    text: () => new Promise<never>((_, reject) => {
      options?.signal?.addEventListener('abort', () => reject(options.signal?.reason));
    }),
  }));
  const service = new TyphoonService(createPortalLoader('https://portal.example.test/current', fetcher, 10));
  const server = await startTyphoonServer(0, service);

  try {
    const address = server.address() as AddressInfo;
    const response = await getJson(address.port);
    expect(response.body).toMatchObject({ status: 'error', selected: null, storms: [] });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
