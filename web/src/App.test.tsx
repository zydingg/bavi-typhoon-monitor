import { act, cleanup, render, screen } from '@testing-library/react';
import { init } from 'echarts/core';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from './App.js';
import { Dashboard } from './dashboard.js';
import { getCurrentTyphoon } from './api.js';

vi.mock('./api.js', () => ({ getCurrentTyphoon: vi.fn() }));

vi.mock('echarts/core', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    convertToPixel: vi.fn(() => [120, 80]),
    on: vi.fn(),
    off: vi.fn(),
  })),
  registerMap: vi.fn(),
  use: vi.fn(),
}));

vi.mock('./wind-flow.js', () => ({
  WindFlowLayer: ({ label }: { label: string }) => <canvas aria-label={label} />,
}));

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

beforeEach(() => {
  mockGetCurrentTyphoon.mockResolvedValue(emptySnapshot);
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

test('does not mount the circulation canvas for empty or error snapshots', () => {
  const { rerender } = render(<App initialSnapshot={emptySnapshot} />);

  expect(screen.queryByLabelText('台风环流示意')).toBeNull();

  rerender(<App initialSnapshot={{ ...emptySnapshot, status: 'error' }} />);

  expect(screen.queryByLabelText('台风环流示意')).toBeNull();
});

test('renders command center rails, circulation disclosure, and QWeather attribution from a live snapshot', () => {
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
  expect(screen.getByText('台风环流示意')).toBeTruthy();
  expect(screen.getByLabelText('台风环流示意')).toBeInstanceOf(HTMLCanvasElement);
  expect(screen.getByText(`预报时刻：${sparseForecastAt}`)).toBeTruthy();
  expect(screen.getByText('QWeather Tropical Cyclone API')).toBeTruthy();
  const link = screen.getByRole('link', { name: '查看和风天气详情' });
  expect(link.getAttribute('href')).toBe('https://www.qweather.com/typhoon/2601.html');
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toBe('noreferrer');
  expect(screen.queryByLabelText('中心附近实况')).toBeNull();
});

test('resynchronizes the circulation center after a map roam event', () => {
  render(<App initialSnapshot={liveSnapshot} />);

  const chart = vi.mocked(init).mock.results.at(-1)?.value as { on: ReturnType<typeof vi.fn> };

  expect(chart.on).toHaveBeenCalledWith('georoam', expect.any(Function));
});

test('hides the QWeather link when the snapshot has no fxLink', () => {
  render(<App initialSnapshot={liveSnapshot} />);

  expect(screen.queryByRole('link', { name: '查看和风天气详情' })).toBeNull();
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
