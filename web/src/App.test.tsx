import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from './App.js';
import { Dashboard } from './dashboard.js';
import { getCurrentTyphoon } from './api.js';

vi.mock('./api.js', () => ({ getCurrentTyphoon: vi.fn() }));

vi.mock('echarts/core', () => ({
  init: vi.fn(() => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() })),
  registerMap: vi.fn(),
  use: vi.fn(),
}));

const emptySnapshot = {
  status: 'empty' as const,
  selected: null,
  storms: [],
  source: 'Zhejiang Typhoon Portal' as const,
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

test('shows the actual timestamp for sparse forecast data', () => {
  const observedAt = '2026-07-11T00:00:00.000Z';
  const sparseForecastAt = '2026-07-14T00:00:00.000Z';

  render(
    <Dashboard
      snapshot={{
        status: 'live',
        source: 'Zhejiang Typhoon Portal',
        storms: [],
        selected: {
          id: '2601',
          name: '海燕',
          level: '强台风',
          current: { observedAt, longitude: 128, latitude: 22, forecast: false },
          history: [],
          forecast: [{ observedAt: sparseForecastAt, longitude: 132, latitude: 25, windMps: 30, forecast: true }],
          movementDirection: '西北',
        },
      }}
    />,
  );

  expect(screen.getAllByText(`预报时刻：${sparseForecastAt}`)).toHaveLength(2);
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
