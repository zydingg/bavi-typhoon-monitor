import { z } from 'zod';

export const TrackPointSchema = z.object({
  observedAt: z.string(),
  longitude: z.number().gte(100).lte(180),
  latitude: z.number().gte(-5).lte(60),
  pressureHpa: z.number().positive().optional(),
  windMps: z.number().positive().optional(),
  forecast: z.boolean(),
});

export type TrackPoint = z.infer<typeof TrackPointSchema>;

export const TyphoonSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  level: z.string().default('鏈煡'),
  current: TrackPointSchema,
  history: z.array(TrackPointSchema),
  forecast: z.array(TrackPointSchema),
  movementDirection: z.string().default('鏈煡'),
  movementSpeedKph: z.number().nonnegative().optional(),
  radiusKm: z.number().positive().optional(),
  warning: z.string().optional(),
  fxLink: z.string().url().refine((value) => new URL(value).protocol === 'https:', {
    message: 'fxLink must use HTTPS',
  }).optional(),
});

export type Typhoon = z.infer<typeof TyphoonSchema>;
