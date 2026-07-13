import type { TrackPoint } from './types.js';

export const FORECAST_HOURS = [12, 24, 36, 48, 60, 72, 96] as const;

const MAX_TARGET_DISTANCE_MS = 6 * 3_600_000;
const EARTH_RADIUS_KM = 6_371;

export interface ForecastNode {
  hoursAhead: (typeof FORECAST_HOURS)[number];
  point?: TrackPoint;
}

const COASTAL_CITIES = [
  { name: '三亚', longitude: 109.5, latitude: 18.25 },
  { name: '台北', longitude: 121.57, latitude: 25.03 },
  { name: '厦门', longitude: 118.08, latitude: 24.48 },
  { name: '福州', longitude: 119.3, latitude: 26.08 },
  { name: '温州', longitude: 120.7, latitude: 27.99 },
  { name: '宁波', longitude: 121.55, latitude: 29.87 },
  { name: '上海', longitude: 121.47, latitude: 31.23 },
  { name: '青岛', longitude: 120.38, latitude: 36.07 },
  { name: '那霸', longitude: 127.68, latitude: 26.21 },
  { name: '鹿儿岛', longitude: 130.56, latitude: 31.6 },
  { name: '釜山', longitude: 129.08, latitude: 35.18 },
];

export function buildForecastNodes(current: TrackPoint, forecast: TrackPoint[]): ForecastNode[] {
  const currentTime = Date.parse(current.observedAt);

  return FORECAST_HOURS.map((hoursAhead) => {
    const target = currentTime + hoursAhead * 3_600_000;
    const nearest = forecast.reduce<TrackPoint | undefined>((best, candidate) =>
      !best || Math.abs(Date.parse(candidate.observedAt) - target) < Math.abs(Date.parse(best.observedAt) - target)
        ? candidate
        : best,
    undefined);

    return {
      hoursAhead,
      point: nearest && Math.abs(Date.parse(nearest.observedAt) - target) <= MAX_TARGET_DISTANCE_MS ? nearest : undefined,
    };
  });
}

export function nearestCoastalCity(longitude: number, latitude: number): string {
  if (COASTAL_CITIES.length === 0) {
    return '近海';
  }

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const nearest = COASTAL_CITIES.reduce((best, city) => {
    const latitudeDelta = toRadians(city.latitude - latitude);
    const longitudeDelta = toRadians(city.longitude - longitude);
    const a =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(toRadians(latitude)) * Math.cos(toRadians(city.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
    const distance = 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return distance < best.distance ? { city, distance } : best;
  }, { city: COASTAL_CITIES[0], distance: Number.POSITIVE_INFINITY });

  return nearest.city.name;
}
