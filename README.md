# 台风监测看板

运行环境：Node.js 20.12.0 或更高版本（用于在启动时读取可选的 `.env` 文件）。

一个本地运行的台风监测看板：Express 服务在启动时从浙江省水利厅台风门户获取并校验数据，React/Vite 前端通过本地 API 展示当前台风、轨迹和预报。

## 启动

1. 复制环境变量模板：`copy .env.example .env`
2. 安装依赖：`npm install`
3. 启动开发服务：`npm run dev`
4. 打开 [http://localhost:5173](http://localhost:5173)

默认会同时启动：

- 前端 Vite 服务：`http://localhost:5173`
- API 服务：`http://localhost:8787`

开发环境中，Vite 会将 `/api/*` 代理到 API 服务。PowerShell 若因执行策略无法运行 `npm.ps1`，请使用 `npm.cmd run dev`（其他 npm 命令同理）。

## 配置与数据来源

`.env` 只需配置以下实际生效的变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `8787` | Express API 的监听端口。 |
| `TYPHOON_API_URL` | `https://typhoon.slt.zj.gov.cn/Api/TyphoonList/Default` | 浙江省水利厅台风门户的上游数据地址。 |

服务启动时会请求 `TYPHOON_API_URL`，解析 JSON/JSONP 响应并校验台风轨迹坐标。浏览器每 60 秒轮询本地 `/api/typhoon/current`；服务端按 `TYPHOON_REFRESH_SECONDS`（默认 600 秒）独立刷新上游，不需要重新启动服务。

看板只消费本地 `/api/typhoon/current`，不会从浏览器直接调用上游。项目当前没有可通过环境变量启用的本地 fixture 数据源；`source` 固定为 `Zhejiang Typhoon Portal`，不应将任何页面展示或接口返回视为已验证的实时上游数据，除非该次启动的上游请求确实成功。

### Weather configuration

Set `SENIVERSE_API_KEY` in the ignored local `.env` file to enable current
weather for the selected typhoon's coordinates. The key is read only by the
Express server, used for the Seniverse upstream request, and is never included
in the browser bundle or the snapshot response. If the weather request fails,
the typhoon snapshot remains available and reports weather as unavailable.

### Upstream refresh

The server refreshes `TYPHOON_API_URL` once at startup and then every
`TYPHOON_REFRESH_SECONDS` seconds. The default is `600` seconds (10 minutes).
Refreshes are server-owned, never overlap, and stop when the HTTP server closes.
Each upstream request is aborted after 10 seconds; after a successful refresh,
a later failed refresh returns the preserved snapshot with `status: "stale"`.
The browser continues to poll only the local API and does not need an upstream
map-provider key: the trajectory map bundles its own local GeoJSON base map.

## API

`GET /api/typhoon/current` 始终返回 HTTP `200` 和一个快照：

```json
{
  "status": "live",
  "selected": { "id": "..." },
  "storms": [{ "id": "..." }],
  "weather": null,
  "weatherStatus": "unavailable",
  "updatedAt": "2026-07-11T00:00:00.000Z",
  "source": "Zhejiang Typhoon Portal"
}
```

响应字段：

| 字段 | 说明 |
| --- | --- |
| `status` | `live`、`empty`、`stale` 或 `error`。 |
| `selected` | 观测时间最新的台风；没有可选台风时为 `null`。 |
| `storms` | 已成功加载并通过校验的台风数组。 |
| `updatedAt` | 最近一次成功加载的 ISO 8601 时间；首次加载失败时省略。 |
| `source` | 当前实现固定为 `Zhejiang Typhoon Portal`。 |

状态含义：

- `live`：最近一次上游加载成功，且返回至少一个台风。
- `empty`：最近一次上游加载成功，但未返回台风。
- `stale`：此前有成功数据，后续刷新失败；接口保留并返回最近一次成功数据及其时间。
- `error`：一次刷新失败且没有缓存的台风记录可用；`selected` 为 `null`，`storms` 为空。它既可能发生在首次加载失败时，也可能发生在此前成功但结果为空、随后刷新失败时。

`stale` 是服务层在周期刷新失败时保留上次成功快照的回退机制；如果启动时上游不可用，接口会返回 `error`，而不是编造或替换为 fixture 数据。

## 验证

```bash
npm run typecheck
npm test
npm run build
```

手动检查时，可在 `http://localhost:5173` 验证：有可用台风数据时的轨迹与指标；上游成功但为空时的“当前暂无活动台风”；以及响应为 `error` 时的不可用提示。1280 × 720 下，主看板采用四项指标和“轨迹 / 预报”两栏布局；较窄视口会按 CSS 断点收缩为两栏或一栏。

`stale` 缓存回退需要先获得一次成功快照，再让下一次周期服务刷新失败；当前没有公开的运行时开关可以在浏览器中模拟该状态。
