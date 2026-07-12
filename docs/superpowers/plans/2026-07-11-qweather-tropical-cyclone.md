# 和风热带气旋数据源替换：实施计划

**目标：** 以和风天气热带气旋 API 驱动台风监测大屏，自动显示西北太平洋活跃台风。

## 全局约束

- `QWEATHER_API_KEY` 和 `QWEATHER_API_HOST` 仅可存在于被忽略的 `.env`；不能输出到日志、响应、浏览器或 Git。
- 服务端必须将 API Key 仅通过 `X-QW-Api-Key` 请求头传递；不得使用 JWT 或 `Authorization` Bearer。
- `QWEATHER_API_HOST` 是部署分配的专属 Host，必须配置；不得回退到公共 Host。
- 仅查询 `basin=NP`，仅加载 `isActive === '1'` 的台风；没有活动台风时返回 `empty` 状态。
- 快照来源为 `QWeather Tropical Cyclone API`，且可选展示 API 返回的 `fxLink`。

## Task 1：服务端和和风适配器（已完成）

- [x] 使用 API Key 请求活跃台风列表、实况路径与预报。
- [x] 映射为既有快照、缓存和 stale 语义。
- [x] 每次刷新读取当前年份，并为上游请求设置 10 秒超时。
- [x] 将专属 API Host 设为必填配置；服务端测试、类型检查和复审通过。

## Task 2：大屏契约与归属

**文件：** `web/src/types.ts`、`web/src/dashboard.tsx`、`web/src/App.test.tsx`、`web/src/styles.css`。

1. 先写失败测试：快照来源为 `QWeather Tropical Cyclone API` 时显示来源及 `fxLink` 链接。
2. 更新浏览器快照类型以匹配服务端：来源为 QWeather，并保留可选 `fxLink`。
3. 以现有海洋面板样式展示数据来源、更新时间和可选 QWeather 链接；保留 live、empty、stale、error 视图和响应式布局。
4. 运行前端聚焦测试、全量测试、类型检查和构建，并确认浏览器构建产物没有 API Key 或 API Host。
