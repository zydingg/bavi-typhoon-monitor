export type FeedStatus = 'live' | 'empty' | 'stale' | 'error';

export interface TrackPoint {
  observedAt: string;
  longitude: number;
  latitude: number;
  pressureHpa?: number;
  windMps?: number;
  forecast: boolean;
}

export interface Typhoon {
  id: string;
  name: string;
  level: string;
  current: TrackPoint;
  history: TrackPoint[];
  forecast: TrackPoint[];
  movementDirection: string;
  movementSpeedKph?: number;
  radiusKm?: number;
  warning?: string;
}

export interface TyphoonSnapshot {
  status: FeedStatus;
  selected: Typhoon | null;
  storms: Typhoon[];
  updatedAt?: string;
  source: 'Zhejiang Typhoon Portal';
}
