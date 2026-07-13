import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from './App.js';
import { Dashboard } from './dashboard.js';
import { getCurrentTyphoon } from './api.js';
import { loadAmap } from './amap-loader.js';
import { toAmapCoordinate } from './amap-coordinate.js';

vi.mock('./api.js', () => ({ getCurrentTyphoon: vi.fn() }));

vi.mock('./amap-loader.js', () => ({ loadAmap: vi.fn() }));

const emptySnapshot = {
  status: 'empty' as const,
  selected: null,
  storms: [],
  source: 'QWeather Tropical Cyclone API' as const,
};

const liveSnapshot = {
  status: 'live' as const,
  selected: {
    id: '2601',
    name: '海燕',
    level: '强台风',
    current: { observedAt: '2026-07-11T08:00:00+08:00', longitude: 128, latitude: 22, forecast: false },
    history: [],
    forecast: [],
    movementDirection: '西北',
  },
  storms: [],
  source: 'QWeather Tropical Cyclone API' as const,
};

const mockGetCurrentTyphoon = vi.mocked(getCurrentTyphoon);
const mockLoadAmap = vi.mocked(loadAmap);

beforeEach(() => {
  mockGetCurrentTyphoon.mockResolvedValue(emptySnapshot);
  mockLoadAmap.mockReset();
  mockLoadAmap.mockRejectedValue(new Error('AMap is unavailable in this test'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

test('labels an empty response as no active typhoon', () => {
  render(
    <App
      initialSnapshot={{
        ...emptySnapshot,
      }}
    />,
  );

  expect(screen.getByText('当前暂无活动台风')).toBeTruthy();
});

test('renders a fetched error snapshot as unavailable data', async () => {
  mockGetCurrentTyphoon.mockResolvedValue({ ...emptySnapshot, status: 'error' });

  render(<App />);

  expect(await screen.findByText('实时数据暂不可用')).toBeTruthy();
});

test('renders command center rails and QWeather attribution without a synthetic circulation layer', () => {
  const observedAt = '2026-07-11T00:00:00.000Z';
  const sparseForecastAt = '2026-07-14T00:00:00.000Z';

  render(
    <Dashboard
      snapshot={{
        status: 'live',
        source: 'QWeather Tropical Cyclone API',
        fxLink: 'https://www.qweather.com/typhoon/2601.html',
        storms: [],
        selected: {
          id: '2601',
          name: '海燕',
          level: '强台风',
          current: {
            observedAt,
            longitude: 128,
            latitude: 22,
            windMps: 38,
            pressureHpa: 945,
            forecast: false,
          },
          history: [],
          forecast: [{ observedAt: sparseForecastAt, longitude: 132, latitude: 25, windMps: 30, forecast: true }],
          movementDirection: '西北',
          movementSpeedKph: 20,
        },
      }}
    />,
  );

  expect(screen.getByLabelText('台风实时指标')).toBeTruthy();
  expect(screen.getByLabelText('未来路径预报')).toBeTruthy();
  expect(screen.queryByLabelText('台风环流示意')).toBeNull();
  expect(screen.getByText('+72h')).toBeTruthy();
  expect(screen.getByText('QWeather Tropical Cyclone API')).toBeTruthy();
  const link = screen.getByRole('link', { name: '查看和风天气详情' });
  expect(link.getAttribute('href')).toBe('https://www.qweather.com/typhoon/2601.html');
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toBe('noreferrer');
  expect(screen.queryByLabelText('中心附近实况')).toBeNull();
});

test('renders fixed-hour forecast nodes with immediate coastal fallbacks', () => {
  const current = { observedAt: '2026-07-13T00:00:00+08:00', longitude: 121, latitude: 24, forecast: false };
  const atHour = (hours: number, longitude: number, latitude: number) => ({
    observedAt: new Date(Date.parse(current.observedAt) + hours * 3_600_000).toISOString(),
    longitude,
    latitude,
    windMps: 30,
    pressureHpa: 945,
    forecast: true,
  });
  const snapshotWithCurrentAndForecasts = {
    status: 'live' as const,
    source: 'QWeather Tropical Cyclone API' as const,
    selected: {
      id: 'NP2026',
      name: '巴威',
      level: '台风',
      current,
      history: [],
      forecast: [atHour(12, 122.5, 23.6), atHour(96, 132, 30)],
      movementDirection: '西北',
    },
    storms: [],
  };

  mockLoadAmap.mockResolvedValue({} as never);

  render(<Dashboard snapshot={snapshotWithCurrentAndForecasts} />);

  expect(screen.getByText('+12h')).toBeTruthy();
  expect(screen.getByText('+96h')).toBeTruthy();
  expect(screen.getAllByText(/暂无预报/)).toHaveLength(5);
  expect(screen.getByText(/台北附近/)).toBeTruthy();
  expect(screen.getAllByText('30 m/s · 945 hPa')).toHaveLength(2);
});

test('hides the QWeather link when the snapshot has no fxLink', () => {
  render(<App initialSnapshot={liveSnapshot} />);

  expect(screen.queryByRole('link', { name: '查看和风天气详情' })).toBeNull();
});

test('renders QWeather track coordinates on the accessible AMap container', async () => {
  const map = {
    addControl: vi.fn(),
    destroy: vi.fn(),
    setCenter: vi.fn(),
  };
  const observedPolyline = { setMap: vi.fn() };
  const forecastPolyline = { setMap: vi.fn() };
  const marker = { setMap: vi.fn() };
  const Map = vi.fn(() => map);
  const ToolBar = vi.fn(() => ({}));
  const Polyline = vi.fn()
    .mockReturnValueOnce(observedPolyline)
    .mockReturnValueOnce(forecastPolyline);
  const Marker = vi.fn(() => marker);
  const current = { observedAt: '2026-07-11T08:00:00+08:00', longitude: 128, latitude: 22, forecast: false };
  const observed = { observedAt: '2026-07-11T02:00:00+08:00', longitude: 129, latitude: 21, forecast: false };
  const forecast = { observedAt: '2026-07-11T14:00:00+08:00', longitude: 126, latitude: 23, forecast: true };

  mockLoadAmap.mockResolvedValue({ Map, ToolBar, Polyline, Marker } as never);
  mockGetCurrentTyphoon.mockImplementation(() => new Promise(() => {}));

  render(
    <App
      initialSnapshot={{
        ...liveSnapshot,
        selected: {
          ...liveSnapshot.selected,
          current,
          history: [observed],
          forecast: [forecast],
        },
      }}
    />,
  );

  expect(screen.getByLabelText('高德台风交互地图')).toBeTruthy();
  expect(screen.getByText('高德地图加载中…')).toBeTruthy();

  await act(async () => {});

  const currentCoordinate = toAmapCoordinate(current.longitude, current.latitude);
  expect(Map).toHaveBeenCalledWith(
    expect.any(HTMLElement),
    expect.objectContaining({
      viewMode: '2D',
      zoom: 7,
      resizeEnable: true,
      dragEnable: true,
      zoomEnable: true,
      center: currentCoordinate,
    }),
  );
  expect(map.setCenter).toHaveBeenCalledWith(currentCoordinate);
  expect(Polyline).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      path: [
        toAmapCoordinate(observed.longitude, observed.latitude),
        currentCoordinate,
      ],
      strokeColor: '#38d7ff',
    }),
  );
  expect(Polyline).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      path: [
        currentCoordinate,
        toAmapCoordinate(forecast.longitude, forecast.latitude),
      ],
      strokeColor: '#ffc857',
      strokeStyle: 'dashed',
    }),
  );
  expect(Marker).toHaveBeenCalledWith(expect.objectContaining({ position: currentCoordinate }));
});

test('shows an AMap loading error without constructing overlays', async () => {
  const Map = vi.fn();
  const Polyline = vi.fn();
  const Marker = vi.fn();
  mockLoadAmap.mockRejectedValue(new Error('loader failed'));
  mockGetCurrentTyphoon.mockImplementation(() => new Promise(() => {}));

  render(<App initialSnapshot={liveSnapshot} />);

  expect(await screen.findByText('高德地图加载失败')).toBeTruthy();
  expect(Map).not.toHaveBeenCalled();
  expect(Polyline).not.toHaveBeenCalled();
  expect(Marker).not.toHaveBeenCalled();
});

test('polls every sixty seconds and clears the interval on unmount', async () => {
  vi.useFakeTimers();
  const { unmount } = render(<App />);

  await act(async () => {});
  expect(mockGetCurrentTyphoon).toHaveBeenCalledTimes(1);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(mockGetCurrentTyphoon).toHaveBeenCalledTimes(2);

  unmount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(120_000);
  });
  expect(mockGetCurrentTyphoon).toHaveBeenCalledTimes(2);
});
