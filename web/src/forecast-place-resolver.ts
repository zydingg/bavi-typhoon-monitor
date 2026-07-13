import { toAmapCoordinate } from './amap-coordinate.js';
import { nearestCoastalCity } from './forecast-nodes.js';
import type { TrackPoint } from './types.js';

interface AmapGeocoder {
  getAddress(
    coordinate: [number, number],
    callback: (status: string, result?: AmapReverseGeocodeResult) => void,
  ): void;
}

interface AmapReverseGeocodeResult {
  regeocode?: {
    addressComponent?: {
      city?: string | string[];
      district?: string;
    };
  };
}

export interface AmapGeocoderApi {
  Geocoder?: new (options?: Record<string, unknown>) => AmapGeocoder;
}

export function createForecastPlaceResolver(amap: AmapGeocoderApi): (point: TrackPoint) => Promise<string> {
  const cache = new Map<string, Promise<string>>();

  return (point) => {
    const key = `${point.longitude.toFixed(3)},${point.latitude.toFixed(3)}`;

    if (!cache.has(key)) {
      cache.set(key, reverseGeocode(amap, point).catch(() => `${nearestCoastalCity(point.longitude, point.latitude)}附近`));
    }

    return cache.get(key)!;
  };
}

function reverseGeocode(amap: AmapGeocoderApi, point: TrackPoint): Promise<string> {
  const Geocoder = amap.Geocoder;
  if (!Geocoder) {
    return Promise.reject(new Error('AMap Geocoder is unavailable'));
  }

  return new Promise((resolve, reject) => {
    const geocoder = new Geocoder();

    geocoder.getAddress(toAmapCoordinate(point.longitude, point.latitude), (status, result) => {
      const addressComponent = result?.regeocode?.addressComponent;
      if (status !== 'complete' || !addressComponent) {
        reject(new Error('AMap reverse geocode failed'));
        return;
      }

      const city = normalizeCity(addressComponent.city);
      const district = addressComponent.district?.trim();
      const place = city || district;

      if (!place) {
        reject(new Error('AMap reverse geocode returned no address'));
        return;
      }

      resolve(`${place}附近`);
    });
  });
}

function normalizeCity(city: string | string[] | undefined): string | undefined {
  const value = (Array.isArray(city) ? city[0] : city)?.trim().replace(/市$/, '').trim();
  return value || undefined;
}
