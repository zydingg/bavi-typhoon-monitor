import type { Typhoon } from './domain.js';
import { normalizePortalTyphoon, parsePortalPayload } from './typhoon-source.js';

export type FeedStatus = 'live' | 'empty' | 'stale' | 'error';

export interface TyphoonSnapshot {
  status: FeedStatus;
  selected: Typhoon | null;
  storms: Typhoon[];
  updatedAt?: string;
  source: 'Zhejiang Typhoon Portal';
}

export interface PortalResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type PortalFetcher = (url: string) => Promise<PortalResponse>;
export type TyphoonLoader = () => Promise<Typhoon[]>;

const DEFAULT_PORTAL_URL = 'https://typhoon.slt.zj.gov.cn/Api/TyphoonList/Default';

export function createPortalLoader(
  upstreamUrl = process.env.TYPHOON_API_URL ?? DEFAULT_PORTAL_URL,
  fetcher: PortalFetcher = fetch,
): TyphoonLoader {
  return async () => {
    const response = await fetcher(upstreamUrl);

    if (!response.ok) {
      throw new Error(`Portal request failed with status ${response.status}`);
    }

    const payload = parsePortalPayload(await response.text());
    const records = Array.isArray(payload) ? payload : payload?.data;

    if (!Array.isArray(records)) {
      throw new TypeError('Portal payload does not contain a typhoon data array');
    }

    return records.map((record: unknown) => normalizePortalTyphoon(record));
  };
}

export class TyphoonService {
  private cache: Typhoon[] = [];
  private state: FeedStatus = 'error';
  private updatedAt?: string;

  constructor(private loader: TyphoonLoader) {}

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
    } catch {
      this.state = this.cache.length ? 'stale' : 'error';
    }
  }

  snapshot(): TyphoonSnapshot {
    const storms = [...this.cache];
    const selected = storms
      .slice()
      .sort((left, right) => right.current.observedAt.localeCompare(left.current.observedAt))[0] ?? null;

    return {
      status: this.state,
      selected,
      storms,
      updatedAt: this.updatedAt,
      source: 'Zhejiang Typhoon Portal',
    };
  }
}
