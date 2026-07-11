import type { Typhoon, WeatherObservation, WeatherStatus } from './domain.js';
import type { SeniverseLoader } from './seniverse-weather.js';
import { normalizePortalTyphoon, parsePortalPayload } from './typhoon-source.js';

export type FeedStatus = 'live' | 'empty' | 'stale' | 'error';

export interface TyphoonSnapshot {
  status: FeedStatus;
  selected: Typhoon | null;
  storms: Typhoon[];
  weather: WeatherObservation | null;
  weatherStatus: WeatherStatus;
  updatedAt?: string;
  source: 'Zhejiang Typhoon Portal';
}

export interface PortalResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type PortalFetcher = (url: string, options?: { signal?: AbortSignal }) => Promise<PortalResponse>;
export type TyphoonLoader = () => Promise<Typhoon[]>;

const DEFAULT_PORTAL_URL = 'https://typhoon.slt.zj.gov.cn/Api/TyphoonList/Default';
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export function createPortalLoader(
  upstreamUrl = process.env.TYPHOON_API_URL ?? DEFAULT_PORTAL_URL,
  fetcher: PortalFetcher = fetch,
  timeoutMs = Number(process.env.TYPHOON_FETCH_TIMEOUT_MS ?? DEFAULT_FETCH_TIMEOUT_MS),
): TyphoonLoader {
  return async () => {
    const configuredTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0
      ? timeoutMs
      : DEFAULT_FETCH_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error(`Typhoon portal request timed out after ${configuredTimeoutMs}ms`));
    }, configuredTimeoutMs);

    try {
      const response = await fetcher(upstreamUrl, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`Portal request failed with status ${response.status}`);
      }

      const payload = parsePortalPayload(await response.text());
      const records = Array.isArray(payload) ? payload : payload?.data;

      if (!Array.isArray(records)) {
        throw new TypeError('Portal payload does not contain a typhoon data array');
      }

      return records.map((record: unknown) => normalizePortalTyphoon(record));
    } finally {
      clearTimeout(timeout);
    }
  };
}

export class TyphoonService {
  private cache: Typhoon[] = [];
  private state: FeedStatus = 'error';
  private updatedAt?: string;
  private weather: WeatherObservation | null = null;
  private weatherStatus: WeatherStatus = 'not_applicable';

  constructor(private loader: TyphoonLoader, private weatherLoader?: SeniverseLoader) {}

  setLoaderForTest(loader: TyphoonLoader): void {
    this.loader = loader;
  }

  async refresh(): Promise<void> {
    try {
      const nextCache = await this.loader();

      if (!Array.isArray(nextCache)) {
        throw new TypeError('Typhoon loader must return an array');
      }

      this.cache = [...nextCache];
      this.state = this.cache.length ? 'live' : 'empty';
      this.updatedAt = new Date().toISOString();

      const selected = selectTyphoon(this.cache);
      if (!selected) {
        this.weather = null;
        this.weatherStatus = 'not_applicable';
      } else if (!this.weatherLoader) {
        this.weather = null;
        this.weatherStatus = 'unavailable';
      } else {
        try {
          this.weather = await this.weatherLoader({
            latitude: selected.current.latitude,
            longitude: selected.current.longitude,
          });
          this.weatherStatus = 'available';
        } catch {
          this.weather = null;
          this.weatherStatus = 'unavailable';
        }
      }
    } catch {
      this.state = this.cache.length ? 'stale' : 'error';
    }
  }

  snapshot(): TyphoonSnapshot {
    const storms = [...this.cache];
    const selected = selectTyphoon(storms);

    return {
      status: this.state,
      selected,
      storms,
      weather: this.weather,
      weatherStatus: this.weatherStatus,
      updatedAt: this.updatedAt,
      source: 'Zhejiang Typhoon Portal',
    };
  }
}

function selectTyphoon(storms: Typhoon[]): Typhoon | null {
  return storms
    .slice()
    .sort((left, right) => right.current.observedAt.localeCompare(left.current.observedAt))[0] ?? null;
}
