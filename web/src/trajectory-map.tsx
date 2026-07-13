import { useEffect, useRef, useState } from 'react';
import { init, registerMap, use } from 'echarts/core';
import { EffectScatterChart, LinesChart } from 'echarts/charts';
import { GeoComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import typhoonBasinMap from './assets/typhoon-basin.geo.json';
import { WindFlowLayer } from './wind-flow.js';
import type { Typhoon } from './types.js';

use([EffectScatterChart, GeoComponent, LinesChart, TooltipComponent, CanvasRenderer]);
registerMap('typhoon-basin', typhoonBasinMap as Parameters<typeof registerMap>[1]);

function radiusSeries(storm: Typhoon) {
  if (storm.radiusKm === undefined) return [];

  const radiusPixels = Math.max(20, storm.radiusKm * 1.5);
  return [0.72, 1].map((scale, index) => ({
    name: `Radius ripple ${index + 1}`,
    type: 'effectScatter' as const,
    coordinateSystem: 'geo' as const,
    data: [{ value: [storm.current.longitude, storm.current.latitude] }],
    symbolSize: radiusPixels * scale,
    rippleEffect: { scale: 1.25 + index * 0.35, brushType: 'stroke' as const },
    itemStyle: { color: 'rgba(114, 219, 255, 0.12)', borderColor: '#72dbff', borderWidth: 1 },
    silent: true,
    z: 1,
  }));
}

export function TrajectoryMap({ storm }: { storm: Typhoon }) {
  const chartElement = useRef<HTMLDivElement>(null);
  const [windCenter, setWindCenter] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const element = chartElement.current;
    if (!element) return;

    const chart = init(element);
    const observedCoordinates = [...storm.history, storm.current].map((point) => [point.longitude, point.latitude]);
    const forecastCoordinates = [storm.current, ...storm.forecast].map((point) => [point.longitude, point.latitude]);
    const syncWindCenter = () => {
      const pixel = chart.convertToPixel({ geoIndex: 0 }, [storm.current.longitude, storm.current.latitude]);
      if (Array.isArray(pixel) && typeof pixel[0] === 'number' && typeof pixel[1] === 'number') {
        setWindCenter({ x: pixel[0], y: pixel[1] });
      }
    };

    chart.setOption({
      animationDuration: 500,
      backgroundColor: 'transparent',
      geo: {
        map: 'typhoon-basin',
        roam: true,
        center: [125, 25],
        zoom: 1.45,
        itemStyle: { areaColor: '#123e57', borderColor: '#4d89a6', borderWidth: 1 },
        emphasis: { itemStyle: { areaColor: '#1c5e7d' } },
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: { value?: number[]; data?: { value?: number[] } }) => {
          const [longitude, latitude] = params.value ?? params.data?.value ?? [];
          return `${longitude?.toFixed(1)}°E, ${latitude?.toFixed(1)}°N`;
        },
      },
      series: [
        { name: 'Observed track', type: 'lines', coordinateSystem: 'geo', polyline: true, data: [{ coords: observedCoordinates }], lineStyle: { color: '#38d7ff', width: 3 } },
        { name: 'Forecast track', type: 'lines', coordinateSystem: 'geo', polyline: true, data: [{ coords: forecastCoordinates }], lineStyle: { color: '#ffc857', width: 2, type: 'dashed' },
        },
        { name: 'Current center', type: 'effectScatter', coordinateSystem: 'geo', data: [{ value: [storm.current.longitude, storm.current.latitude] }], symbolSize: 16, rippleEffect: { scale: 2.8 }, itemStyle: { color: '#ff6b4a' }, z: 3 },
        ...radiusSeries(storm),
      ],
    });

    chart.on('finished', syncWindCenter);
    chart.on('georoam', syncWindCenter);
    syncWindCenter();
    const resize = () => {
      chart.resize();
      syncWindCenter();
    };
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      chart.off('finished', syncWindCenter);
      chart.off('georoam', syncWindCenter);
      chart.dispose();
    };
  }, [storm]);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={chartElement} className="trajectory-chart" />
      <WindFlowLayer center={windCenter} intensity={storm.current.windMps ?? 20} label="台风环流示意" />
    </div>
  );
}
