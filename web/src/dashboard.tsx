import { useEffect, useRef } from 'react';
import { init, registerMap, use } from 'echarts/core';
import { EffectScatterChart, LinesChart } from 'echarts/charts';
import { GeoComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import typhoonBasinMap from './assets/typhoon-basin.geo.json';
import type { TrackPoint, TyphoonSnapshot } from './types.js';

use([EffectScatterChart, GeoComponent, LinesChart, TooltipComponent, CanvasRenderer]);
registerMap('typhoon-basin', typhoonBasinMap as Parameters<typeof registerMap>[1]);

interface DashboardProps {
  snapshot: TyphoonSnapshot;
  requestError?: string;
}

const formatNumber = (value: number | undefined, unit: string) =>
  value === undefined ? '—' : `${Math.round(value)} ${unit}`;

const formatDateTime = (value: string | undefined) => {
  if (!value) return '最近一次成功数据';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '最近一次成功数据'
    : new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
};

const closestForecast = (forecast: TrackPoint[], current: TrackPoint, hours: number) => {
  if (!forecast.length) return undefined;
  const target = new Date(current.observedAt).getTime() + hours * 60 * 60 * 1000;
  return forecast.reduce((closest, point) => {
    const closestDistance = Math.abs(new Date(closest.observedAt).getTime() - target);
    const pointDistance = Math.abs(new Date(point.observedAt).getTime() - target);
    return pointDistance < closestDistance ? point : closest;
  });
};

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <section className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
      {detail ? <span>{detail}</span> : null}
    </section>
  );
}

function ForecastCard({ label, point }: { label: string; point?: TrackPoint }) {
  return (
    <section className="forecast-card">
      <p>{label}</p>
      {point ? (
        <>
          <strong>{formatNumber(point.windMps, 'm/s')}</strong>
          <span>{point.latitude.toFixed(1)}°N / {point.longitude.toFixed(1)}°E</span>
          <span>预报时刻：{point.observedAt}</span>
        </>
      ) : <span>暂无预测数据</span>}
    </section>
  );
}

/* Retired Cartesian implementation retained only as source history.
function LegacyTrajectoryChart({ current, history, forecast }: {
  current: TrackPoint;
  history: TrackPoint[];
  forecast: TrackPoint[];
}) {
  const chartElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = chartElement.current;
    if (!element) return;

    const chart = init(element);
    const historyCoordinates = [...history, current].map((point) => [point.longitude, point.latitude]);
    const forecastCoordinates = [current, ...forecast].map((point) => [point.longitude, point.latitude]);

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
      grid: { top: 30, right: 32, bottom: 42, left: 48 },
      tooltip: {
        trigger: 'item',
        formatter: (params: { data?: number[] }) => {
          const [longitude, latitude] = params.data ?? [];
          return `${longitude?.toFixed(1)}°E, ${latitude?.toFixed(1)}°N`;
        },
      },
      xAxis: {
        type: 'value', min: 105, max: 150, interval: 5, name: '经度 (°E)', nameTextStyle: { color: '#7faac5' },
        axisLabel: { color: '#7faac5', formatter: '{value}°' }, axisLine: { lineStyle: { color: '#28516d' } },
        splitLine: { lineStyle: { color: 'rgba(74, 139, 173, 0.18)' } },
      },
      yAxis: {
        type: 'value', min: 5, max: 45, interval: 5, name: '纬度 (°N)', nameTextStyle: { color: '#7faac5' },
        axisLabel: { color: '#7faac5', formatter: '{value}°' }, axisLine: { lineStyle: { color: '#28516d' } },
        splitLine: { lineStyle: { color: 'rgba(74, 139, 173, 0.18)' } },
      },
      series: [
        { name: '实况轨迹', type: 'line', data: historyCoordinates, symbol: 'circle', symbolSize: 6, lineStyle: { color: '#38d7ff', width: 3 }, itemStyle: { color: '#38d7ff' } },
        { name: '预测路径', type: 'line', data: forecastCoordinates, symbol: 'emptyCircle', symbolSize: 7, lineStyle: { color: '#ffc857', width: 2, type: 'dashed' }, itemStyle: { color: '#ffc857' } },
        { name: '当前中心', type: 'effectScatter', data: [[current.longitude, current.latitude]], symbolSize: 16, rippleEffect: { scale: 2.8 }, itemStyle: { color: '#ff6b4a' } },
      ],
    });

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
        { name: 'Observed track', type: 'lines', coordinateSystem: 'geo', polyline: true, data: [{ coords: historyCoordinates }], lineStyle: { color: '#38d7ff', width: 3 } },
        { name: 'Forecast track', type: 'lines', coordinateSystem: 'geo', polyline: true, data: [{ coords: forecastCoordinates }], lineStyle: { color: '#ffc857', width: 2, type: 'dashed' } },
        { name: 'Current center', type: 'effectScatter', coordinateSystem: 'geo', data: [{ value: [current.longitude, current.latitude] }], symbolSize: 16, rippleEffect: { scale: 2.8 }, itemStyle: { color: '#ff6b4a' } },
      ],
    }, { notMerge: true });

    const resize = () => chart.resize();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(resize);
    resizeObserver?.observe(element);
    if (!resizeObserver) window.addEventListener('resize', resize);
    return () => {
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener('resize', resize);
      chart.dispose();
    };
  }, [current, forecast, history]);

  return <div ref={chartElement} className="trajectory-chart" role="img" aria-label="台风轨迹海域图，横轴为经度，纵轴为纬度" />;
}
*/

function TrajectoryChart({ current, history, forecast }: {
  current: TrackPoint;
  history: TrackPoint[];
  forecast: TrackPoint[];
}) {
  const chartElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = chartElement.current;
    if (!element) return;

    const chart = init(element);
    const observedCoordinates = [...history, current].map((point) => [point.longitude, point.latitude]);
    const forecastCoordinates = [current, ...forecast].map((point) => [point.longitude, point.latitude]);

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
        { name: 'Forecast track', type: 'lines', coordinateSystem: 'geo', polyline: true, data: [{ coords: forecastCoordinates }], lineStyle: { color: '#ffc857', width: 2, type: 'dashed' } },
        { name: 'Current center', type: 'effectScatter', coordinateSystem: 'geo', data: [{ value: [current.longitude, current.latitude] }], symbolSize: 16, rippleEffect: { scale: 2.8 }, itemStyle: { color: '#ff6b4a' } },
      ],
    });

    const resize = () => chart.resize();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(resize);
    resizeObserver?.observe(element);
    if (!resizeObserver) window.addEventListener('resize', resize);
    return () => {
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener('resize', resize);
      chart.dispose();
    };
  }, [current, forecast, history]);

  return <div ref={chartElement} className="trajectory-chart" role="img" aria-label="Typhoon trajectory map" />;
}

export function Dashboard({ snapshot, requestError }: DashboardProps) {
  const storm = snapshot.selected;
  if (!storm) return null;

  const forecast24 = closestForecast(storm.forecast, storm.current, 24);
  const forecast48 = closestForecast(storm.forecast, storm.current, 48);
  const fixtureSource = String(snapshot.source) === 'fixture';

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">浙江沿海台风监测中心</p>
          <h1>{storm.name} <span>{storm.level}</span></h1>
        </div>
        <div className="status-cluster">
          {fixtureSource ? <span className="status-badge fixture">开发样例数据</span> : null}
          {snapshot.status === 'live' && !fixtureSource ? <span className="status-badge live">实时监测中</span> : null}
          {snapshot.status === 'stale' ? <span className="status-badge stale">数据延迟</span> : null}
        </div>
      </header>

      {snapshot.status === 'stale' ? <aside className="freshness-banner">数据延迟：展示最近一次成功数据（{formatDateTime(snapshot.updatedAt)}）</aside> : null}
      {requestError ? <aside className="freshness-banner error-banner">最新请求失败：{requestError}</aside> : null}

      <section className="metrics" aria-label="台风关键指标">
        <MetricCard label="最大风速" value={formatNumber(storm.current.windMps, 'm/s')} />
        <MetricCard label="中心气压" value={formatNumber(storm.current.pressureHpa, 'hPa')} />
        <MetricCard label="移动方向" value={storm.movementDirection} detail={formatNumber(storm.movementSpeedKph, 'km/h')} />
        <MetricCard label="警戒半径" value={formatNumber(storm.radiusKm, 'km')} detail={storm.warning} />
      </section>

      <section className="monitor-grid">
        <section className="trajectory-panel">
          <div className="panel-heading"><div><p className="eyebrow">TRAJECTORY MAP</p><h2>台风轨迹海域</h2></div><span>实况 / 预测</span></div>
          <TrajectoryChart current={storm.current} history={storm.history} forecast={storm.forecast} />
        </section>
        <aside className="forecast-panel">
          <div className="panel-heading"><div><p className="eyebrow">FORECAST</p><h2>路径预报</h2></div></div>
          <ForecastCard label="24小时预报" point={forecast24} />
          <ForecastCard label="48小时预报" point={forecast48} />
          <section className="source-note"><p>数据来源</p><strong>{snapshot.source}</strong><span>更新时间：{formatDateTime(snapshot.updatedAt)}</span></section>
        </aside>
      </section>
    </main>
  );
}
