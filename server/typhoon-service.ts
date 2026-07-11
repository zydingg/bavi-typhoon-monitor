import type { Typhoon } from './domain.js';

export type FeedStatus = 'live' | 'empty' | 'stale' | 'error';
export type TyphoonLoader = () => Promise<Typhoon[]>;

export interface TyphoonSnapshot {
  status: FeedStatus;
  selected: Typhoon | null;
  storms: Typhoon[];
  updatedAt?: string;
  source: 'QWeather Tropical Cyclone API';
  fxLink?: string;
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
      if (!Array.isArray(nextCache)) throw new TypeError('Typhoon loader must return an array');
      this.cache = [...nextCache];
      this.state = this.cache.length ? 'live' : 'empty';
      this.updatedAt = new Date().toISOString();
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
      updatedAt: this.updatedAt,
      source: 'QWeather Tropical Cyclone API',
      ...(selected?.fxLink ? { fxLink: selected.fxLink } : {}),
    };
  }
}

function selectTyphoon(storms: Typhoon[]): Typhoon | null {
  return storms.slice().sort((left, right) => right.current.observedAt.localeCompare(left.current.observedAt))[0] ?? null;
}
