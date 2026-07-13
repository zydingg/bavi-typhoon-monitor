import { useEffect, useRef, useState } from 'react';
import { loadAmap } from './amap-loader.js';
import { toAmapCoordinate } from './amap-coordinate.js';
import type { TrackPoint, Typhoon } from './types.js';

type AmapCoordinate = [number, number];

interface AmapMapInstance {
  addControl(control: unknown): void;
  destroy(): void;
  setCenter(center: AmapCoordinate): void;
}

interface AmapPolyline {
  setMap(map: AmapMapInstance | null): void;
  setPath(path: AmapCoordinate[]): void;
}

interface AmapMarker {
  setMap(map: AmapMapInstance | null): void;
  setPosition(position: AmapCoordinate): void;
}

interface AmapWithTrackOverlays {
  Map: new (container: string | HTMLElement, options?: Record<string, unknown>) => AmapMapInstance;
  Marker: new (options: Record<string, unknown>) => AmapMarker;
  Polyline: new (options: Record<string, unknown>) => AmapPolyline;
  ToolBar: new () => unknown;
}

interface OverlayRefs {
  currentMarker: React.MutableRefObject<AmapMarker | undefined>;
  forecastPolyline: React.MutableRefObject<AmapPolyline | undefined>;
  observedPolyline: React.MutableRefObject<AmapPolyline | undefined>;
}

function coordinateFor(point: TrackPoint): AmapCoordinate {
  return toAmapCoordinate(point.longitude, point.latitude);
}

function updateOverlays(amap: AmapWithTrackOverlays, map: AmapMapInstance, storm: Typhoon, overlays: OverlayRefs) {
  const currentCoordinate = coordinateFor(storm.current);
  const observedPath = [...storm.history, storm.current].map(coordinateFor);
  const forecastPath = [storm.current, ...storm.forecast].map(coordinateFor);

  map.setCenter(currentCoordinate);

  if (overlays.observedPolyline.current) {
    overlays.observedPolyline.current.setPath(observedPath);
  } else {
    const observedPolyline = new amap.Polyline({
      path: observedPath,
      strokeColor: '#38d7ff',
      strokeOpacity: 1,
      strokeWeight: 3,
    });
    observedPolyline.setMap(map);
    overlays.observedPolyline.current = observedPolyline;
  }

  if (overlays.forecastPolyline.current) {
    overlays.forecastPolyline.current.setPath(forecastPath);
  } else {
    const forecastPolyline = new amap.Polyline({
      path: forecastPath,
      strokeColor: '#ffc857',
      strokeOpacity: 1,
      strokeStyle: 'dashed',
      strokeWeight: 2,
    });
    forecastPolyline.setMap(map);
    overlays.forecastPolyline.current = forecastPolyline;
  }

  if (overlays.currentMarker.current) {
    overlays.currentMarker.current.setPosition(currentCoordinate);
  } else {
    const currentMarker = new amap.Marker({
      position: currentCoordinate,
      offset: [-8, -8],
      content: '<span aria-hidden="true" style="display:block;width:16px;height:16px;border:2px solid #fff;border-radius:50%;background:#ff6b4a"></span>',
    });
    currentMarker.setMap(map);
    overlays.currentMarker.current = currentMarker;
  }
}

function removeOverlays(overlays: OverlayRefs) {
  overlays.observedPolyline.current?.setMap(null);
  overlays.forecastPolyline.current?.setMap(null);
  overlays.currentMarker.current?.setMap(null);
  overlays.observedPolyline.current = undefined;
  overlays.forecastPolyline.current = undefined;
  overlays.currentMarker.current = undefined;
}

export function TrajectoryMap({ storm }: { storm: Typhoon }) {
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<AmapMapInstance>();
  const amap = useRef<AmapWithTrackOverlays>();
  const stormRef = useRef(storm);
  const observedPolyline = useRef<AmapPolyline>();
  const forecastPolyline = useRef<AmapPolyline>();
  const currentMarker = useRef<AmapMarker>();
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const overlays = { observedPolyline, forecastPolyline, currentMarker };

  stormRef.current = storm;

  useEffect(() => {
    let active = true;

    void loadAmap()
      .then((loadedAmap) => {
        if (!active || !mapElement.current) return;

        const api = loadedAmap as AmapWithTrackOverlays;
        const initialCenter = coordinateFor(stormRef.current.current);
        const nextMap = new api.Map(mapElement.current, {
          center: initialCenter,
          dragEnable: true,
          resizeEnable: true,
          viewMode: '2D',
          zoom: 7,
          zoomEnable: true,
        });

        map.current = nextMap;
        amap.current = api;
        nextMap.addControl(new api.ToolBar());
        updateOverlays(api, nextMap, stormRef.current, overlays);
        setLoadState('ready');
      })
      .catch(() => {
        if (active) setLoadState('error');
      });

    return () => {
      active = false;
      removeOverlays(overlays);
      map.current?.destroy();
      map.current = undefined;
      amap.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (amap.current && map.current) {
      updateOverlays(amap.current, map.current, storm, overlays);
    }
  }, [storm]);

  return (
    <div ref={mapElement} className="amap-trajectory-map" role="region" aria-label="高德台风交互地图">
      {loadState === 'loading' && <p className="amap-map-status" role="status">高德地图加载中…</p>}
      {loadState === 'error' && <p className="amap-map-status" role="alert">高德地图加载失败</p>}
    </div>
  );
}
