import express, { type Express } from 'express';
import { TyphoonService } from './typhoon-service.js';

export function createApp(service: TyphoonService): Express {
  const app = express();

  app.get('/api/typhoon/current', (_request, response) => {
    response.json(service.snapshot());
  });

  return app;
}
