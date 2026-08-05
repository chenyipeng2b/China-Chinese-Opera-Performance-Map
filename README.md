# 中国戏曲演出地图 🎭

中国戏曲演出信息可视化地图，基于 ECharts 构建，展示全国范围内的戏曲演出信息。

## 在线访问

[https://chenyipeng2b.github.io/China-Chinese-Opera-Performance-Map/](https://chenyipeng2b.github.io/China-Chinese-Opera-Performance-Map/)

## 功能特性

- **中国地图可视化**：基于 ECharts 的中国地图，展示全国各地戏曲演出
- **三色状态标记**：演出中（红）· 即将演出（青蓝）· 已结束（棕）
- **剧种筛选**：支持 56 个剧种的标签筛选
- **省份点击**：点击地图省份查看该省剧种分布
- **演出搜索**：按演出名称搜索
- **暗色模式**：亮色/暗色双主题切换
- **讨论区**：戏迷互动交流，支持点赞/点踩
- **移动端适配**：响应式布局，手机端完美展示
- **跨浏览器兼容**：支持 Chrome / Safari / Firefox / 微信内置浏览器

## 技术栈

- ECharts 5.x 地图渲染
- 纯前端，无框架依赖
- localStorage 数据持久化
- CSS 变量主题系统
- 宣纸水墨风格 UI

## 项目结构

```
opera-map/
├── index.html          # 主页面
├── admin.html          # 管理后台
├── css/
│   └── style.css       # 样式表
├── js/
│   ├── main.js         # 主逻辑
│   ├── map.js          # 地图渲染
│   ├── discuss.js      # 讨论区模块
│   ├── theme.js        # 主题管理
│   ├── log.js          # 日志系统
│   ├── polyfill.js     # 跨浏览器兼容
│   ├── admin.js        # 管理后台逻辑
│   ├── crawler.js      # 数据爬取
│   ├── data.js         # 数据处理
│   └── autocomplete.js # 搜索自动补全
├── data/
│   ├── china.json      # 中国地图 GeoJSON
│   └── performances.json # 演出数据
└── img/
    └── logo.png        # 网站 Logo
```

## 部署

通过 GitHub Pages 自动部署，推送到 `main` 分支即可。

## License

MIT
