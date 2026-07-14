import { useEffect, useMemo, useRef, useState } from 'react';
import { loadAmap } from './amap-loader.js';
import { buildForecastNodes, forecastFallbackLabel } from './forecast-nodes.js';
import { createForecastPlaceResolver, forecastPlaceCoordinateKey, type AmapGeocoderApi } from './forecast-place-resolver.js';
import type { TrackPoint, TyphoonSnapshot } from './types.js';

interface CommandHeaderProps {
  snapshot: TyphoonSnapshot;
  requestError?: string;
}

interface MetricRailProps {
  current: TrackPoint;
  history: TrackPoint[];
  movementDirection: string;
  movementSpeedKph?: number;
}

interface ForecastRailProps {
  current: TrackPoint;
  forecast: TrackPoint[];
  level: string;
  source: TyphoonSnapshot['source'];
  updatedAt?: string;
  fxLink?: string;
}

const formatNumber = (value: number | undefined, unit: string) =>
  value === undefined ? '—' : `${Math.round(value)} ${unit}`;

const formatDateTime = (value: string | undefined) => {
  if (!value) return '最近一次成功数据';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '最近一次成功数据'
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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

function ForecastArrivalCard({
  hoursAhead,
  point,
  level,
  places,
}: {
  hoursAhead: number;
  point?: TrackPoint;
  level: string;
  places: Record<string, string>;
}) {
  const hour = `+${hoursAhead}h`;

  if (!point) {
    return (
      <section className="forecast-arrival-card forecast-arrival-card-unavailable">
        <time className="forecast-arrival-hour">{hour}</time>
        <span className="forecast-arrival-place">暂无预报</span>
      </section>
    );
  }

  const place = places[forecastPlaceCoordinateKey(point)] ?? forecastFallbackLabel(point.longitude, point.latitude);

  return (
    <section className="forecast-arrival-card">
      <time className="forecast-arrival-hour" dateTime={point.observedAt}>{hour}</time>
      <div>
        <h3 className="forecast-arrival-place">{place}</h3>
        <p className="forecast-arrival-meta">{point.latitude.toFixed(1)}°N / {point.longitude.toFixed(1)}°E · {level}</p>
      </div>
      <strong className="forecast-arrival-strength">{formatNumber(point.windMps, 'm/s')} · {formatNumber(point.pressureHpa, 'hPa')}</strong>
    </section>
  );
}

function isQWeatherFxLink(fxLink: string | undefined) {
  if (!fxLink) return false;

  try {
    const url = new URL(fxLink);
    return url.protocol === 'https:' && (url.hostname === 'qweather.com' || url.hostname.endsWith('.qweather.com'));
  } catch {
    return false;
  }
}

export function CommandHeader({ snapshot, requestError }: CommandHeaderProps) {
  const storm = snapshot.selected;
  if (!storm) return null;

  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">浙江沿海台风监测中心</p>
          <h1>{storm.name} <span>{storm.level}</span></h1>
        </div>
        <div className="status-cluster">
          {snapshot.status === 'live' ? <span className="status-badge live">实时监测中</span> : null}
          {snapshot.status === 'stale' ? <span className="status-badge stale">数据延迟</span> : null}
        </div>
      </header>
      {snapshot.status === 'stale' ? <aside className="freshness-banner">数据延迟：展示最近一次成功数据（{formatDateTime(snapshot.updatedAt)}）</aside> : null}
      {requestError ? <aside className="freshness-banner error-banner">最新请求失败：{requestError}</aside> : null}
    </>
  );
}

export function MetricRail({ current, history, movementDirection, movementSpeedKph }: MetricRailProps) {
  const recentHistory = [...history]
    .sort((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt))
    .slice(0, 6);

  return (
    <aside className="forecast-panel" aria-label="台风实时指标">
      <div className="panel-heading"><div><p className="eyebrow">CURRENT</p><h2>台风实时指标</h2></div></div>
      <MetricCard label="当前风速" value={formatNumber(current.windMps, 'm/s')} />
      <MetricCard label="中心气压" value={formatNumber(current.pressureHpa, 'hPa')} />
      <MetricCard label="移动方向" value={movementDirection} detail={formatNumber(movementSpeedKph, 'km/h')} />
      <MetricCard label="中心坐标" value={`${current.latitude.toFixed(1)}°N / ${current.longitude.toFixed(1)}°E`} />
      <section className="source-note">
        <p>最近实况点</p>
        {recentHistory.length ? (
          <ol>
            {recentHistory.map((point) => <li key={`${point.observedAt}-${point.latitude}-${point.longitude}`}>{formatDateTime(point.observedAt)}</li>)}
          </ol>
        ) : <span>暂无可用实况点</span>}
      </section>
    </aside>
  );
}

export function ForecastRail({ current, forecast, level, source, updatedAt, fxLink }: ForecastRailProps) {
  const nodes = useMemo(() => buildForecastNodes(current, forecast), [current, forecast]);
  const resolver = useRef<ReturnType<typeof createForecastPlaceResolver>>();
  const [places, setPlaces] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    const points = nodes.flatMap(({ point }) => point ? [point] : []);

    void loadAmap()
      .then((amap) => {
        resolver.current ??= createForecastPlaceResolver(amap as AmapGeocoderApi);
        return Promise.all(points.map(async (point) => {
          const key = forecastPlaceCoordinateKey(point);
          const place = await resolver.current!(point);
          return [key, place] as const;
        }));
      })
      .then((entries) => {
        if (active) setPlaces(Object.fromEntries(entries));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [nodes]);

  return (
    <aside className="forecast-panel" aria-label="未来路径预报">
      <div className="panel-heading"><div><p className="eyebrow">FORECAST</p><h2>未来路径预报</h2></div></div>
      {nodes.map(({ hoursAhead, point }) => (
        <ForecastArrivalCard
          key={hoursAhead}
          hoursAhead={hoursAhead}
          point={point}
          level={level}
          places={places}
        />
      ))}
      <section className="source-note">
        <p>数据来源</p>
        <strong>{source}</strong>
        <span>更新时间：{formatDateTime(updatedAt)}</span>
        {isQWeatherFxLink(fxLink) ? <a href={fxLink} target="_blank" rel="noreferrer">查看和风天气详情</a> : null}
      </section>
    </aside>
  );
}
