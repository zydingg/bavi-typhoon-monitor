import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';

const defaultPort = 8787;

export function createApp(): Express {
  return express();
}

export function startServer(app: Express = createApp(), port = Number(process.env.PORT ?? defaultPort)): Server {
  return app.listen(port, () => {
    console.log(`Typhoon monitor server listening on http://localhost:${port}`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer();
}
