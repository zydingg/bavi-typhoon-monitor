import { CommandHeader, ForecastRail, MetricRail } from './command-panels.js';
import { TrajectoryMap } from './trajectory-map.js';
import type { TyphoonSnapshot } from './types.js';

interface DashboardProps {
  snapshot: TyphoonSnapshot;
  requestError?: string;
}

export function Dashboard({ snapshot, requestError }: DashboardProps) {
  const storm = snapshot.selected;
  if (!storm) return null;

  return (
    <main className="dashboard">
      <CommandHeader snapshot={snapshot} requestError={requestError} />
      <section className="monitor-grid">
        <MetricRail
          current={storm.current}
          history={storm.history}
          movementDirection={storm.movementDirection}
          movementSpeedKph={storm.movementSpeedKph}
        />
        <section className="trajectory-panel">
          <div className="panel-heading"><div><p className="eyebrow">TRAJECTORY MAP</p><h2>台风轨迹海域</h2></div><span>实况 / 预报</span></div>
          <TrajectoryMap storm={storm} />
        </section>
        <ForecastRail
          forecast={storm.forecast}
          source={snapshot.source}
          updatedAt={snapshot.updatedAt}
          fxLink={snapshot.fxLink}
        />
      </section>
    </main>
  );
}
