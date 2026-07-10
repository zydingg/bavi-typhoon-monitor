import { TyphoonSchema, type Typhoon } from './domain.js';

export function parsePortalPayload(text: string): any {
  const json = text.trim().replace(/^[^(]*\(/, '').replace(/\);?$/, '');
  return JSON.parse(json);
}

export function normalizePortalTyphoon(raw: any): Typhoon {
  const rawId = raw.tfbh ?? raw.id;
  if (typeof rawId !== 'string' && typeof rawId !== 'number') {
    throw new TypeError('A typhoon identifier is required');
  }

  const id = String(rawId).trim();
  if (!id) {
    throw new TypeError('A typhoon identifier is required');
  }

  const rows = raw.points ?? raw.path ?? [];
  const points = rows.map((point: any) => ({
    observedAt: String(point[0]),
    longitude: Number(point[1]),
    latitude: Number(point[2]),
    pressureHpa: Number(point[3]) || undefined,
    windMps: Number(point[4]) || undefined,
    forecast: Boolean(point[5]),
  }));
  const current = points.findLast((point: any) => !point.forecast) ?? points.at(-1);

  return TyphoonSchema.parse({
    id,
    name: String(raw.name ?? raw.ename ?? '未命名台风'),
    level: String(raw.level ?? '鏈煡'),
    current,
    history: points.filter((point: any) => !point.forecast),
    forecast: points.filter((point: any) => point.forecast),
    movementDirection: String(raw.moveDir ?? '鏈煡'),
    movementSpeedKph: Number(raw.moveSpeed) || undefined,
    radiusKm: Number(raw.radius) || undefined,
    warning: raw.warning ? String(raw.warning) : undefined,
  });
}
