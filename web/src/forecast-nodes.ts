import type { TrackPoint } from './types.js';

export const FORECAST_HOURS = [12, 24, 36, 48, 60, 72, 96] as const;

const MAX_TARGET_DISTANCE_MS = 6 * 3_600_000;
const EARTH_RADIUS_KM = 6_371;
const MAX_COASTAL_FALLBACK_DISTANCE_KM = 150;

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
  { name: '烟台', longitude: 121.45, latitude: 37.46 },
  { name: '大连', longitude: 121.62, latitude: 38.92 },
  { name: '丹东', longitude: 124.39, latitude: 40.13 },
  { name: '南浦', longitude: 125.41, latitude: 38.74 },
  { name: '安州', longitude: 125.66, latitude: 39.62 },
  { name: '咸兴', longitude: 127.54, latitude: 39.92 },
  { name: '清津', longitude: 129.79, latitude: 41.78 },
  { name: '符拉迪沃斯托克', longitude: 131.89, latitude: 43.12 },
  { name: '纳霍德卡', longitude: 132.88, latitude: 42.82 },
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

function nearestCoastalCityWithDistance(longitude: number, latitude: number) {
  if (COASTAL_CITIES.length === 0) {
    return { city: undefined, distance: Number.POSITIVE_INFINITY };
  }

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  return COASTAL_CITIES.reduce((best, city) => {
    const latitudeDelta = toRadians(city.latitude - latitude);
    const longitudeDelta = toRadians(city.longitude - longitude);
    const a =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(toRadians(latitude)) * Math.cos(toRadians(city.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
    const distance = 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return distance < best.distance ? { city, distance } : best;
  }, { city: COASTAL_CITIES[0], distance: Number.POSITIVE_INFINITY });
}

function seaAreaName(longitude: number, latitude: number): string {
  if (longitude >= 118 && longitude <= 127 && latitude >= 31 && latitude <= 40.5) return '黄海海域';
  if (longitude >= 116 && longitude <= 131 && latitude >= 21 && latitude < 31) return '东海海域';
  if (longitude >= 127 && longitude <= 142 && latitude >= 34 && latitude <= 48) return '日本海海域';
  if (longitude >= 122 && longitude <= 136 && latitude >= 17 && latitude < 34) return '西北太平洋海域';
  return '近海海域';
}

export function nearestCoastalCity(longitude: number, latitude: number): string {
  return nearestCoastalCityWithDistance(longitude, latitude).city?.name ?? '近海';
}

export function forecastFallbackLabel(longitude: number, latitude: number): string {
  const nearest = nearestCoastalCityWithDistance(longitude, latitude);

  return nearest.city && nearest.distance <= MAX_COASTAL_FALLBACK_DISTANCE_KM
    ? `${nearest.city.name}附近`
    : seaAreaName(longitude, latitude);
}
