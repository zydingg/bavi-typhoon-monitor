import { TyphoonSchema, type TrackPoint, type Typhoon } from './domain.js';
import type { TyphoonLoader } from './typhoon-service.js';

type Fetcher = typeof fetch;

interface Options {
  apiKey?: string;
  fetcher?: Fetcher;
  host?: string;
  now?: Date | (() => Date);
  timeoutMs?: number;
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

const DEFAULT_TIMEOUT_MS = 10_000;

export function createQWeatherLoader({
  apiKey = process.env.QWEATHER_API_KEY,
  fetcher = fetch,
  host = process.env.QWEATHER_API_HOST,
  now = () => new Date(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: Options = {}): TyphoonLoader {
  if (!apiKey) {
    return async () => { throw new Error('QWeather API key is not configured'); };
  }
  const configuredHost = host?.trim();
  if (!configuredHost) {
    return async () => { throw new Error('QWeather API host is not configured'); };
  }
  if (!isHttpsUrl(configuredHost)) {
    return async () => { throw new Error('QWeather API host must be a valid HTTPS URL'); };
  }

  return async () => {
    const requestedAt = typeof now === 'function' ? now() : now;
    const years = [requestedAt.getUTCFullYear(), requestedAt.getUTCFullYear() - 1];
    const lists = await Promise.all(years.map((year) => getJson<{ code: string; storm?: StormSummary[] }>(
      fetcher, configuredHost, `/v7/tropical/storm-list?basin=NP&year=${year}`, apiKey, timeoutMs,
    )));
    const active = lists.flatMap((list) => list.storm ?? []).filter((storm) => storm.isActive === '1');

    return Promise.all(active.map(async (storm) => {
      const track = await getJson<TrackPayload>(fetcher, configuredHost, `/v7/tropical/storm-track?stormid=${encodeURIComponent(storm.id)}`, apiKey, timeoutMs);
      const forecast = await getJson<{ code: string; forecast?: QWeatherPoint[] }>(fetcher, configuredHost, `/v7/tropical/storm-forecast?stormid=${encodeURIComponent(storm.id)}`, apiKey, timeoutMs);
      return mapStorm(storm, track, forecast.forecast ?? []);
    }));
  };
}

async function getJson<T extends { code: string }>(fetcher: Fetcher, host: string, path: string, apiKey: string, timeoutMs: number): Promise<T> {
  const configuredTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`QWeather request timed out after ${configuredTimeoutMs}ms`)), configuredTimeoutMs);
  try {
    const response = await abortable(fetcher(`${host.replace(/\/$/, '')}${path}`, {
      headers: { 'X-QW-Api-Key': apiKey },
      signal: controller.signal,
    }), controller.signal);
    if (!response.ok) throw new Error(`QWeather request failed with status ${response.status}`);
    const payload = await abortable(response.json() as Promise<T>, controller.signal);
    if (payload.code !== '200') throw new Error(`QWeather request failed with code ${payload.code}`);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

function mapStorm(storm: StormSummary, payload: TrackPayload, forecast: QWeatherPoint[]): Typhoon {
  const history = (payload.track ?? []).map((point) => mapPoint(point, false));
  const current = payload.now ? mapPoint(payload.now, false) : history.at(-1);
  if (!current) throw new TypeError(`QWeather track has no current point for ${storm.id}`);
  const predicted = forecast.map((point) => mapPoint(point, true));
  const fxLink = isHttpsUrl(payload.fxLink) ? payload.fxLink : undefined;

  return TyphoonSchema.parse({
    id: storm.id,
    name: storm.name ?? storm.id,
    level: payload.now?.type ?? payload.track?.at(-1)?.type ?? 'Unknown',
    current,
    history,
    forecast: predicted,
    movementDirection: payload.now?.moveDir ?? 'Unknown',
    movementSpeedKph: numberOrUndefined(payload.now?.moveSpeed),
    ...(fxLink ? { fxLink } : {}),
  });
}

function isHttpsUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
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
