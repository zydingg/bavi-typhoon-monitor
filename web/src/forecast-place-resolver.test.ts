import { describe, expect, test, vi } from 'vitest';
import { toAmapCoordinate } from './amap-coordinate.js';
import { createForecastPlaceResolver, forecastPlaceCoordinateKey } from './forecast-place-resolver.js';

const point = {
  observedAt: '2026-07-13T12:00:00+08:00',
  longitude: 121.5,
  latitude: 29.9,
  forecast: true,
};

describe('createForecastPlaceResolver', () => {
  test('uses a reverse-geocoded city and caches an identical coordinate', async () => {
    const getAddress = vi.fn((_: [number, number], callback: (status: string, result: unknown) => void) =>
      callback('complete', {
        regeocode: { addressComponent: { city: '宁波市', district: '鄞州区' } },
      }),
    );
    const resolve = createForecastPlaceResolver({ Geocoder: vi.fn(() => ({ getAddress })) } as never);

    await expect(resolve(point)).resolves.toBe('宁波附近');
    await resolve({ ...point });

    expect(getAddress).toHaveBeenCalledTimes(1);
    expect(getAddress).toHaveBeenCalledWith(
      toAmapCoordinate(point.longitude, point.latitude),
      expect.any(Function),
    );
  });

  test('creates distinct keys for coordinates on opposite sides of the Sanya fallback boundary', () => {
    const inside = { ...point, longitude: 109.5, latitude: 16.9014 };
    const outside = { ...point, longitude: 109.5, latitude: 16.9010 };

    expect(forecastPlaceCoordinateKey(inside)).toBe('109.5,16.9014');
    expect(forecastPlaceCoordinateKey(outside)).toBe('109.5,16.901');
    expect(forecastPlaceCoordinateKey(inside)).not.toBe(forecastPlaceCoordinateKey(outside));
  });

  test('keeps failed reverse-geocode fallbacks distinct across the strict Sanya boundary', async () => {
    const getAddress = vi.fn((_: [number, number], callback: (status: string, result: unknown) => void) =>
      callback('error', {}),
    );
    const resolve = createForecastPlaceResolver({ Geocoder: vi.fn(() => ({ getAddress })) } as never);

    await expect(resolve({ ...point, longitude: 109.5, latitude: 16.9014 })).resolves.toBe('三亚附近');
    await expect(resolve({ ...point, longitude: 109.5, latitude: 16.9010 })).resolves.toBe('近海海域');

    expect(getAddress).toHaveBeenCalledTimes(2);
  });

  test('normalizes an array city before preferring it to the district', async () => {
    const resolve = createForecastPlaceResolver({
      Geocoder: vi.fn(() => ({
        getAddress: (_: [number, number], callback: (status: string, result: unknown) => void) =>
          callback('complete', {
            regeocode: { addressComponent: { city: ['台北市'], district: '信义区' } },
          }),
      })),
    } as never);

    await expect(resolve({ ...point, longitude: 121.57, latitude: 25.03 })).resolves.toBe('台北附近');
  });

  test('uses a reverse-geocoded district when city is unavailable', async () => {
    const resolve = createForecastPlaceResolver({
      Geocoder: vi.fn(() => ({
        getAddress: (_: [number, number], callback: (status: string, result: unknown) => void) =>
          callback('complete', {
            regeocode: { addressComponent: { district: '鄞州区' } },
          }),
      })),
    } as never);

    await expect(resolve(point)).resolves.toBe('鄞州区附近');
  });

  test('uses the coastal fallback when reverse geocoding fails', async () => {
    const resolve = createForecastPlaceResolver({
      Geocoder: vi.fn(() => ({
        getAddress: (_: [number, number], callback: (status: string, result: unknown) => void) => callback('error', {}),
      })),
    } as never);

    await expect(resolve({ ...point, longitude: 122.5, latitude: 23.6 })).resolves.toBe('东海海域');
  });

  test('uses a bounded Northeast Asia fallback when reverse geocoding fails', async () => {
    const resolve = createForecastPlaceResolver({
      Geocoder: vi.fn(() => ({
        getAddress: (_: [number, number], callback: (status: string, result: unknown) => void) => callback('error', {}),
      })),
    } as never);

    await expect(resolve({ ...point, longitude: 124.6, latitude: 39.4 })).resolves.toBe('丹东附近');
    await expect(resolve({ ...point, longitude: 123, latitude: 34 })).resolves.toBe('黄海海域');
  });

  test('uses the coastal fallback for a complete response without an address', async () => {
    const resolve = createForecastPlaceResolver({
      Geocoder: vi.fn(() => ({
        getAddress: (_: [number, number], callback: (status: string, result: unknown) => void) => callback('complete', {}),
      })),
    } as never);

    await expect(resolve(point)).resolves.toBe('宁波附近');
  });

  test('uses the East China Sea fallback for a complete response without addressComponent', async () => {
    const resolve = createForecastPlaceResolver({
      Geocoder: vi.fn(() => ({
        getAddress: (_: [number, number], callback: (status: string, result: unknown) => void) =>
          callback('complete', { regeocode: {} }),
      })),
    } as never);

    await expect(resolve({ ...point, longitude: 122.5, latitude: 23.6 })).resolves.toBe('东海海域');
  });
});
