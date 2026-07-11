import type { TrackPoint, WeatherObservation } from './domain.js';

export type { WeatherObservation, WeatherStatus } from './domain.js';

export type SeniverseLoader = (point: Pick<TrackPoint, 'latitude' | 'longitude'>) => Promise<WeatherObservation>;

export function createSeniverseLoader(
  key = process.env.SENIVERSE_API_KEY,
  fetcher: typeof fetch = fetch,
): SeniverseLoader {
  return async ({ latitude, longitude }) => {
    if (!key) {
      throw new Error('SENIVERSE_API_KEY is not configured');
    }

    const url = new URL('https://api.seniverse.com/v3/weather/now.json');
    url.search = new URLSearchParams({
      key,
      location: `${latitude}:${longitude}`,
      language: 'zh-Hans',
      unit: 'c',
    }).toString();
    const response = await fetcher(url);

    if (!response.ok) {
      throw new Error(`Seniverse request failed with status ${response.status}`);
    }

    const raw = await response.json();
    const result = raw.results?.[0];
    const now = result?.now;

    if (!result?.location?.name || !now) {
      throw new TypeError('Seniverse response has no current-weather record');
    }

    return {
      locationName: result.location.name,
      text: now.text,
      code: String(now.code),
      temperatureC: Number(now.temperature),
      windDirection: now.wind_direction,
      windSpeedKph: Number(now.wind_speed),
      pressureMb: Number(now.pressure),
      observedAt: now.last_update,
    };
  };
}
