# v1 分支部署说明

这是原版代码的存档分支，内容与用户 2026-10-31 提供的原版 Worker 代码一致：
单文件 `worker.js`，首页内嵌在代码里，包含开放式 `/proxy` 通用代理。

## 部署

```bash
npx wrangler deploy
```

也可以把 `worker.js` 直接粘贴到 Cloudflare Dashboard 的 Worker 编辑器里部署。

## 注意

v1 是原样存档，不含鉴权、不含 SSRF 白名单、不含前缀边界修复。
公开部署前请先看 main 分支（新前端）和 ssrf 分支（加固版），
不要把 v1 当作生产版本长期公开使用。
