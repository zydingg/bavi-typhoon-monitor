import { once } from 'node:events';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from 'vitest';
import { createApp } from './app.js';
import type { Typhoon } from './domain.js';
import { TyphoonService } from './typhoon-service.js';

const storm: Typhoon = {
  id: '2601',
  name: 'Storm 2601',
  level: 'Typhoon',
  current: {
    observedAt: '2026-07-10T08:00:00Z',
    longitude: 122.3,
    latitude: 24.7,
    pressureHpa: 960,
    windMps: 35,
    forecast: false,
  },
  history: [],
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

test('serves the current typhoon snapshot as JSON', async () => {
  const service = new TyphoonService(async () => [storm]);
  await service.refresh();
  const server = createApp(service).listen(0);

  try {
    await once(server, 'listening');
    const address = server.address() as AddressInfo;
    const response = await getJson(address.port);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      status: 'live',
      selected: { id: '2601' },
      storms: [{ id: '2601' }],
      source: 'Zhejiang Typhoon Portal',
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
