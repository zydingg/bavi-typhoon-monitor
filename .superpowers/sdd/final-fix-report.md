# Final-fix report

## Delivered

- Added server-owned periodic upstream refreshes controlled by
  `TYPHOON_REFRESH_SECONDS` (default: 600 seconds). The refresh guard prevents
  concurrent loads, and the interval is cleared when the HTTP server closes.
- Added a 10-second `AbortController` timeout to the portal loader. Startup
  still brings up the listener and exposes an `error` snapshot when the first
  load fails or times out.
- Replaced the rendered dashboard trajectory with an ECharts `geo` map using a
  bundled local GeoJSON base map (`web/src/assets/typhoon-basin.geo.json`).
  Observed history, forecast, and current center all use geo coordinates; no
  remote map provider or key is required.
- Documented the default 10-minute refresh cadence in `.env.example` and
  `README.md`.

## Regression coverage

- `server/index.test.ts` covers the configured 600-second schedule, stale
  snapshot after a failed follow-up load, overlapping-refresh prevention,
  cleanup on server close, and listener/error snapshot after startup failure.
- `server/typhoon-service.test.ts` covers `AbortController` timeout behavior.

## Verification evidence

Run after the final trajectory-map routing change:

```text
npm.cmd test -- server/index.test.ts server/typhoon-service.test.ts web/src/App.test.tsx
3 test files passed, 16 tests passed

npm.cmd run typecheck
exit 0

npm.cmd test
6 test files passed, 23 tests passed

npm.cmd run build
exit 0; Vite production build completed
```

The Vite build emits its existing warning that the minified JavaScript chunk is
larger than 500 kB; this does not fail the build.

## Re-review follow-up

- Moved portal-loader timeout cleanup into an outer `finally`, so the
  `AbortController` remains active through both response acquisition and
  `response.text()` parsing. Invalid or non-positive timeout configuration now
  falls back to the 10-second default.
- Added a startup regression test with a response body that never resolves
  unless its `AbortSignal` fires. With the configured 10 ms timeout, startup
  now listens and serves the expected `error` snapshot instead of hanging.
- Updated the Chinese operational guidance that previously described refresh as
  startup-only, and retired the unused Cartesian helper from executable code.

### Re-review verification

```text
npm.cmd test -- server/index.test.ts server/typhoon-service.test.ts web/src/App.test.tsx
3 test files passed, 17 tests passed

npm.cmd run typecheck
exit 0
```
