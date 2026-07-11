# 心知天气实况接入设计

## 目标

在现有台风监测大屏中增加台风中心附近的心知天气实况。台风路径、等级和轨迹仍由浙江台风门户提供；心知仅补充位置实况，不替代台风数据源。

## 数据流

```text
当前台风中心坐标
  → 服务端心知适配器
  → https://api.seniverse.com/v3/weather/now.json
  → 本地 GET /api/typhoon/current 的 weather 字段
  → 大屏“中心附近实况”卡片
```

适配器使用 `location=<latitude>:<longitude>`、`language=zh-Hans`、`unit=c` 查询。`SENIVERSE_API_KEY` 只从服务端 `.env` 读取，绝不返回给浏览器或写入客户端包。

## 接口契约

快照新增可选 `weather` 字段：`locationName`、`text`、`code`、`temperatureC`、`windDirection`、`windSpeedKph`、`pressureMb`、`observedAt`。没有当前台风时为 `null`；心知请求失败时同样为 `null`，并附带面向 UI 的 `weatherStatus: available | unavailable | not_applicable`。

## 刷新与降级

天气查询在每次服务端台风刷新成功且存在当前台风时执行，并复用既有 600 秒刷新节奏。台风刷新、缓存和 `live/empty/stale/error` 语义不因心知失败而改变。心知接口失败只影响天气卡片，卡片显示“中心附近天气暂不可用”；不伪造天气数据。

## UI 与测试

大屏在指标区新增“中心附近实况”卡片，显示天气文字、气温、风向/风速与观测时间。无台风时不展示该卡片；天气不可用时显示明确占位状态。

测试覆盖请求 URL 参数、Key 不进入 API 响应或前端、成功字段标准化、失败降级，以及卡片的可用/不可用状态。
