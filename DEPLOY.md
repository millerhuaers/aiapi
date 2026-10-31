# ssrf 分支部署说明

ssrf 分支 = main 分支（新前端 + 白天/黑夜切换）+ 鉴权与 SSRF 防护。

## 结构

- `worker.js`：加固版代理
- `public/index.html`：与 main 相同的新前端，测试器里多了一个“网关密钥”输入框
- `wrangler.toml`：`[assets]` 指向 `./public`，binding 为 `ASSETS`

## 必须先设置密钥

`PROXY_KEY` 是密钥，绝对不要写进仓库、不要写进 `wrangler.toml`：

```bash
npx wrangler secret put PROXY_KEY
npx wrangler deploy
```

没有设置 `PROXY_KEY` 时，加固版会直接返回 503，不对外提供代理（fail-closed），
这是有意为之，不是 bug。

## 调用方式的变化

所有代理请求（包括 `/openai/...` 等映射端点和 `/proxy`）都必须多带一个头：

```bash
curl https://<你的 Worker 域名>/openai/v1/models \
  -H "x-proxy-key: <PROXY_KEY>" \
  -H "Authorization: Bearer <上游 API Key>"
```

- `x-proxy-key`：网关密钥，证明你有权用这个中转
- `Authorization` / `x-api-key`：上游 API Key，照常转发给上游，不变

前端测试器：在“网关密钥”框里填 `PROXY_KEY`，发送时会自动带上这个头。

## /proxy 的白名单

默认关闭。`wrangler.toml` 里 `PROXY_ALLOWED_HOSTS` 为空时，
`/proxy` 一律返回 403。

需要开放时，只写精确域名，逗号分隔，例如：

```toml
[vars]
PROXY_ALLOWED_HOSTS = "api.example.com,example.org"
```

同时还满足才放行：

- 必须是 `https`
- 不能带用户名/密码，不能用非 443 端口
- 不能是 localhost、`.local`、`.internal`、内网/回环/链路本地 IP 字面量、元数据主机
- 重定向会手动跟随并逐跳校验，跳到白名单外直接拒绝

## 其他加固

- 前缀匹配：最长优先 + 边界检查，`/openai-evil` 不再命中 `/openai`
- 请求头只放行白名单，`x-proxy-key` 本身不会转发给上游
- 响应头删 `set-cookie` 等逐跳头，不加会屏蔽 API 的 CSP
- 错误统一返回通用信息，不泄露上游内部错误
- 请求体上限 10 MB，上游超时 30 秒
- 生产上还建议在 Cloudflare 侧加 Rate Limiting / WAF（代码里不做跨实例限流）

## 局限，必须读

Workers 在 `fetch` 之前无法可靠地把域名解析成 IP 再做内网段拦截，
DNS 重绑定类攻击不能仅靠本文件 100% 挡住。
因此白名单是本分支的核心防线：白名单越小越安全，不要为了图方便把它放得过大。
