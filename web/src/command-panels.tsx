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
  forecast: TrackPoint[];
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
    : new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
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

function ForecastCard({ point }: { point: TrackPoint }) {
  return (
    <section className="forecast-card">
      <p>预报时刻：{point.observedAt}</p>
      <strong>{formatNumber(point.windMps, 'm/s')}</strong>
      <span>{point.latitude.toFixed(1)}°N / {point.longitude.toFixed(1)}°E</span>
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
            {recentHistory.map((point) => <li key={`${point.observedAt}-${point.latitude}-${point.longitude}`}>{point.observedAt}</li>)}
          </ol>
        ) : <span>暂无可用实况点</span>}
      </section>
    </aside>
  );
}

export function ForecastRail({ forecast, source, updatedAt, fxLink }: ForecastRailProps) {
  const forecastPoints = [...forecast].sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt));

  return (
    <aside className="forecast-panel" aria-label="未来路径预报">
      <div className="panel-heading"><div><p className="eyebrow">FORECAST</p><h2>未来路径预报</h2></div></div>
      {forecastPoints.length
        ? forecastPoints.map((point) => <ForecastCard key={`${point.observedAt}-${point.latitude}-${point.longitude}`} point={point} />)
        : <section className="forecast-card"><span>暂无可用预报节点</span></section>}
      <section className="source-note">
        <p>数据来源</p>
        <strong>{source}</strong>
        <span>更新时间：{formatDateTime(updatedAt)}</span>
        {isQWeatherFxLink(fxLink) ? <a href={fxLink} target="_blank" rel="noreferrer">查看和风天气详情</a> : null}
      </section>
    </aside>
  );
}
