import { existsSync } from 'node:fs';
import type { Server } from 'node:http';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import { createApp as createTyphoonApp } from './app.js';
import { createSeniverseLoader } from './seniverse-weather.js';
import { createPortalLoader, TyphoonService } from './typhoon-service.js';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

const defaultPort = 8787;
const defaultRefreshSeconds = 600;

export function createApp(service = new TyphoonService(createPortalLoader(), createSeniverseLoader())): Express {
  return createTyphoonApp(service);
}

export function startServer(app: Express = createApp(), port = Number(process.env.PORT ?? defaultPort)): Server {
  return app.listen(port, () => {
    console.log(`Typhoon monitor server listening on http://localhost:${port}`);
  });
}

export function getRefreshSeconds(value = process.env.TYPHOON_REFRESH_SECONDS): number {
  const seconds = Number(value ?? defaultRefreshSeconds);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : defaultRefreshSeconds;
}

export async function startTyphoonServer(
  port = Number(process.env.PORT ?? defaultPort),
  service = new TyphoonService(createPortalLoader(), createSeniverseLoader()),
): Promise<Server> {
  let refreshInFlight = false;
  const refresh = async () => {
    if (refreshInFlight) return;

    refreshInFlight = true;
    try {
      await service.refresh();
    } finally {
      refreshInFlight = false;
    }
  };

  await refresh();
  const server = startServer(createApp(service), port);
  const refreshTimer = setInterval(() => void refresh(), getRefreshSeconds() * 1_000);
  server.once('close', () => clearInterval(refreshTimer));

  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void startTyphoonServer();
}
