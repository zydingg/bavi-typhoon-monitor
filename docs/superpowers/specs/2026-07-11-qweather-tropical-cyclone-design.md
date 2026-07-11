# 和风热带气旋数据源替换设计

## 目标

用和风天气热带气旋 API 完全替换浙江台风门户与心知天气。大屏只展示和风提供的活跃台风、实时路径和预报路径；没有活跃台风时明确显示空状态。

## 服务端数据流

1. 用服务端 `X-QW-Api-Key` 请求头和显式配置的 API Host 请求 `/v7/tropical/storm-list?basin=NP&year=<当前年>` 和上一年列表。
2. 选取 `isActive === "1"` 的西北太平洋台风。无结果则返回 `empty`。
3. 对每个活跃台风请求台风实况和路径；对优先台风请求 `/v7/tropical/storm-forecast?stormid=<id>`。
4. 标准化实时位置、强度、气压、风速、移动信息、历史路径与预测路径为现有 `Typhoon` 模型。

API Key 和部署分配的 API Host 只保存在 `.env` 的 `QWEATHER_API_KEY` 与 `QWEATHER_API_HOST`；服务不使用 JWT 或 Authorization Bearer 请求头，且不会回退到公共 Host。密钥和 API Host 不进入浏览器或 API 响应。

## 快照与归属

现有 `live`、`empty`、`stale`、`error` 缓存语义保留。和风列表成功但没有 `isActive` 台风时为 `empty`；列表或路径请求失败时沿用缓存降级规则。

快照的 `source` 更改为 `QWeather Tropical Cyclone API`，增加可选 `fxLink`；大屏在数据来源区展示来源和 `fxLink` 链接，并保留和风返回的 `refer` 归属信息供 README 说明。

## 移除范围

删除心知天气适配器、天气快照字段、中心附近天气卡片和 `SENIVERSE_API_KEY` 文档配置。删除浙江台风门户 URL、JSONP 解析和相关适配器逻辑。

## 测试与验收

测试覆盖 API-key 请求头、显式 Host、NP 列表中活跃台风筛选、路径/预报映射、空列表、路径失败后的缓存降级，以及前端来源展示。所有凭据扫描不得在客户端源码、构建产物、日志或 Git 变更中发现。
