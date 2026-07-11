import { existsSync } from 'node:fs';
import type { Server } from 'node:http';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import { createApp as createTyphoonApp } from './app.js';
import { createPortalLoader, TyphoonService } from './typhoon-service.js';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

const defaultPort = 8787;

export function createApp(service = new TyphoonService(createPortalLoader())): Express {
  return createTyphoonApp(service);
}

export function startServer(app: Express = createApp(), port = Number(process.env.PORT ?? defaultPort)): Server {
  return app.listen(port, () => {
    console.log(`Typhoon monitor server listening on http://localhost:${port}`);
  });
}

export async function startTyphoonServer(port = Number(process.env.PORT ?? defaultPort)): Promise<Server> {
  const service = new TyphoonService(createPortalLoader());
  await service.refresh();
  return startServer(createApp(service), port);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void startTyphoonServer();
}
