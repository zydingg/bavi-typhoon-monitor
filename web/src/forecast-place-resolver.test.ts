import { describe, expect, test, vi } from 'vitest';
import { toAmapCoordinate } from './amap-coordinate.js';
import { createForecastPlaceResolver } from './forecast-place-resolver.js';

const point = {
  observedAt: '2026-07-13T12:00:00+08:00',
  longitude: 121.5,
  latitude: 29.9,
  forecast: true,
};

describe('createForecastPlaceResolver', () => {
  test('uses a reverse-geocoded city and caches the coordinate', async () => {
    const getAddress = vi.fn((_: [number, number], callback: (status: string, result: unknown) => void) =>
      callback('complete', {
        regeocode: { addressComponent: { city: '宁波市', district: '鄞州区' } },
      }),
    );
    const resolve = createForecastPlaceResolver({ Geocoder: vi.fn(() => ({ getAddress })) } as never);

    await expect(resolve(point)).resolves.toBe('宁波附近');
    await resolve({ ...point, longitude: 121.5004, latitude: 29.9004 });

    expect(getAddress).toHaveBeenCalledTimes(1);
    expect(getAddress).toHaveBeenCalledWith(
      toAmapCoordinate(point.longitude, point.latitude),
      expect.any(Function),
    );
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

    await expect(resolve({ ...point, longitude: 122.5, latitude: 23.6 })).resolves.toBe('台北附近');
  });

  test('uses the coastal fallback for a complete response without an address', async () => {
    const resolve = createForecastPlaceResolver({
      Geocoder: vi.fn(() => ({
        getAddress: (_: [number, number], callback: (status: string, result: unknown) => void) => callback('complete', {}),
      })),
    } as never);

    await expect(resolve(point)).resolves.toBe('宁波附近');
  });
});
