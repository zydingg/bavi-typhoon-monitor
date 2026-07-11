import { TyphoonSchema, type TrackPoint, type Typhoon } from './domain.js';
import type { TyphoonLoader } from './typhoon-service.js';

type Fetcher = typeof fetch;

interface Options {
  credentialId?: string;
  apiKey?: string;
  fetcher?: Fetcher;
  host?: string;
  now?: Date;
}

interface StormSummary {
  id: string;
  name?: string;
  isActive?: string;
}

interface QWeatherPoint {
  time?: string;
  fxTime?: string;
  pubTime?: string;
  lat: string;
  lon: string;
  pressure?: string;
  windSpeed?: string;
  moveDir?: string;
  moveSpeed?: string;
  type?: string;
}

interface TrackPayload {
  code: string;
  fxLink?: string;
  now?: QWeatherPoint;
  track?: QWeatherPoint[];
}

const encoder = new TextEncoder();
const DEFAULT_HOST = 'https://devapi.qweather.com';
const TOKEN_TTL_SECONDS = 30 * 60;

export function createQWeatherLoader({
  credentialId = process.env.QWEATHER_CREDENTIAL_ID,
  apiKey = process.env.QWEATHER_API_KEY,
  fetcher = fetch,
  host = process.env.QWEATHER_API_HOST ?? DEFAULT_HOST,
  now = new Date(),
}: Options = {}): TyphoonLoader {
  if (!credentialId || !apiKey) {
    return async () => { throw new Error('QWeather credentials are not configured'); };
  }

  return async () => {
    const token = await createJwt(credentialId, apiKey, now);
    const years = [now.getUTCFullYear(), now.getUTCFullYear() - 1];
    const lists = await Promise.all(years.map((year) => getJson<{ code: string; storm?: StormSummary[] }>(
      fetcher, host, `/v7/tropical/storm-list?basin=NP&year=${year}`, token,
    )));
    const active = lists.flatMap((list) => list.storm ?? []).filter((storm) => storm.isActive === '1');

    return Promise.all(active.map(async (storm) => {
      const track = await getJson<TrackPayload>(fetcher, host, `/v7/tropical/storm-track?stormid=${encodeURIComponent(storm.id)}`, token);
      const forecast = await getJson<{ code: string; forecast?: QWeatherPoint[] }>(fetcher, host, `/v7/tropical/storm-forecast?stormid=${encodeURIComponent(storm.id)}`, token);
      return mapStorm(storm, track, forecast.forecast ?? []);
    }));
  };
}

async function getJson<T extends { code: string }>(fetcher: Fetcher, host: string, path: string, token: string): Promise<T> {
  const response = await fetcher(`${host.replace(/\/$/, '')}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`QWeather request failed with status ${response.status}`);
  const payload = await response.json() as T;
  if (payload.code !== '200') throw new Error(`QWeather request failed with code ${payload.code}`);
  return payload;
}

function mapStorm(storm: StormSummary, payload: TrackPayload, forecast: QWeatherPoint[]): Typhoon {
  const history = (payload.track ?? []).map((point) => mapPoint(point, false));
  const current = payload.now ? mapPoint(payload.now, false) : history.at(-1);
  if (!current) throw new TypeError(`QWeather track has no current point for ${storm.id}`);
  const predicted = forecast.map((point) => mapPoint(point, true));

  return TyphoonSchema.parse({
    id: storm.id,
    name: storm.name ?? storm.id,
    level: payload.now?.type ?? payload.track?.at(-1)?.type ?? 'Unknown',
    current,
    history,
    forecast: predicted,
    movementDirection: payload.now?.moveDir ?? 'Unknown',
    movementSpeedKph: numberOrUndefined(payload.now?.moveSpeed),
    fxLink: payload.fxLink,
  });
}

function mapPoint(point: QWeatherPoint, forecast: boolean): TrackPoint {
  return {
    observedAt: point.fxTime ?? point.time ?? point.pubTime ?? '',
    latitude: Number(point.lat),
    longitude: Number(point.lon),
    pressureHpa: numberOrUndefined(point.pressure),
    windMps: numberOrUndefined(point.windSpeed),
    forecast,
  };
}

function numberOrUndefined(value: string | undefined): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

async function createJwt(credentialId: string, apiKey: string, now: Date): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1_000);
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({ sub: credentialId, iat: issuedAt, exp: issuedAt + TOKEN_TTL_SECONDS }));
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey('raw', encoder.encode(apiKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

function base64Url(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  return Buffer.from(bytes).toString('base64url');
}
