# main 分支部署说明

main 分支 = 原版代理逻辑 + 新版前端（带白天/黑夜切换）。

## 结构

- `worker.js`：代理逻辑，首页不再内嵌，改为从 Static Assets 取 `public/index.html`
- `public/index.html`：新版前端，含端点搜索/分类、在线测试、cURL / JS / Python 示例
- `wrangler.toml`：`[assets]` 指向 `./public`，binding 为 `ASSETS`

## 白天/黑夜切换

首页右上角有切换按钮：

- 默认跟随系统 `prefers-color-scheme`，第一次打开是深色还是浅色由系统决定
- 点一次切换一次，选择会存在浏览器 `localStorage`（键名 `api-proxy-theme`）里，下次打开保持
- 浅色模式用 `[data-theme="light"]` 覆盖颜色变量，输入框、代码块、卡片都会跟着变浅

## 部署

```bash
npx wrangler deploy
```

注意：main 分支不能只用 Dashboard 粘贴单个 `worker.js` 部署，
因为首页在 `public/index.html` 里，必须用 wrangler 的 `[assets]` 一起部署。

## 注意

main 分支仍保留原版的开放式 `/proxy`，仍无网关鉴权，
公开部署请优先用 ssrf 分支。
