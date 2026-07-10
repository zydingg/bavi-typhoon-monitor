import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, test } from 'vitest';
import { createApp, startServer } from './index';

test('starts the application on the requested port', async () => {
  const server = startServer(createApp(), 0);

  await once(server, 'listening');

  expect((server.address() as AddressInfo).port).toBeGreaterThan(0);

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});
