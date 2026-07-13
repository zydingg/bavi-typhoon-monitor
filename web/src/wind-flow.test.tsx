import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { advanceParticle, WindFlowLayer } from './wind-flow.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('advances a particle tangentially around the circulation center', () => {
  const nextParticle = advanceParticle(
    { x: 160, y: 100, alpha: 1 },
    { x: 100, y: 100 },
    40,
    { width: 320, height: 200 },
  );

  expect(nextParticle.x).toBeLessThan(160);
  expect(nextParticle.y).toBeGreaterThan(100);
  expect(nextParticle.x).toBeGreaterThanOrEqual(0);
  expect(nextParticle.x).toBeLessThanOrEqual(320);
  expect(nextParticle.y).toBeGreaterThanOrEqual(0);
  expect(nextParticle.y).toBeLessThanOrEqual(200);
});

test('does not schedule animation when reduced motion is preferred', () => {
  const requestAnimationFrame = vi.fn();
  vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

  render(<WindFlowLayer center={{ x: 100, y: 100 }} intensity={40} label="台风环流示意" />);

  expect(requestAnimationFrame).not.toHaveBeenCalled();
});

test('renders an accessible canvas and cleans up its animation resources', () => {
  const cancelAnimationFrame = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 42));
  vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D);

  const { unmount } = render(
    <WindFlowLayer center={{ x: 100, y: 100 }} intensity={40} label="台风环流示意" />,
  );

  expect(screen.getByLabelText('台风环流示意')).toBeInstanceOf(HTMLCanvasElement);

  unmount();

  expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
  expect(disconnect).toHaveBeenCalledOnce();
});

test('draws circulation segments between two and six pixels', () => {
  const lineTo = vi.fn();
  const animationCallbacks: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
    animationCallbacks.push(callback);
    return animationCallbacks.length;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 320,
    height: 200,
  } as DOMRect);
  vi.spyOn(Math, 'random')
    .mockReturnValueOnce(0.5)
    .mockReturnValueOnce(0.5)
    .mockReturnValueOnce(0.5)
    .mockReturnValueOnce(1)
    .mockReturnValue(0.5);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo,
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D);

  render(<WindFlowLayer center={{ x: 100, y: 100 }} intensity={40} label="台风环流示意" />);
  animationCallbacks[0](0);

  const [x, y] = lineTo.mock.calls[0] as [number, number];
  const segmentLength = Math.hypot(x - 160, y - 100);
  expect(segmentLength).toBeGreaterThanOrEqual(2);
  expect(segmentLength).toBeLessThanOrEqual(6);
});
