// ==========================================
// API Proxy Service (Cloudflare Workers Native)
// v1: 用户原版代码（2026-10-31 在对话中提供）
// ==========================================

const apiMapping = {
  // --- 基础 & 主流大模型 ---
  '/openai': 'https://api.openai.com',
  '/claude': 'https://api.anthropic.com',
  '/gemini': 'https://generativelanguage.googleapis.com',
  '/xai': 'https://api.x.ai',
  '/cohere': 'https://api.cohere.com',
  '/vertex': 'https://us-central1-aiplatform.googleapis.com/v1/publishers',

  // --- 国产大模型 & 出海明星 ---
  '/deepseek': 'https://api.deepseek.com',
  '/moonshot': 'https://api.moonshot.cn',
  '/zhipu': 'https://open.bigmodel.cn/api/paas/v4',

  // --- 聚合 & Serverless 推理平台 ---
  '/openrouter': 'https://openrouter.ai/api',
  '/groq': 'https://api.groq.com/openai',
  '/siliconflow': 'https://api.siliconflow.cn',
  '/together': 'https://api.together.xyz',
  '/fireworks': 'https://api.fireworks.ai',
  '/novita': 'https://api.novita.ai',
  '/portkey': 'https://api.portkey.ai',
  '/github': 'https://models.inference.ai.azure.com',
  '/replicate': 'https://api.replicate.com',
  '/akash': 'https://chatapi.akash.network/api',
  '/cerebras': 'https://api.cerebras.ai',

  // --- 厂商官方硬件推理加速 ---
  '/nvidia': 'https://integrate.api.nvidia.com',

  // --- 开源模型 & 特定领域 ---
  '/hf': 'https://api-inference.huggingface.co',
  '/mistral': 'https://api.mistral.ai',
  '/perplexity': 'https://api.perplexity.ai',

  // --- 多模态 (图像/语音/向量) ---
  '/stability': 'https://api.stability.ai',
  '/elevenlabs': 'https://api.elevenlabs.io',
  '/voyage': 'https://api.voyageai.com',
  '/midjourney': 'https://api.midjourney.com',

  // --- 社交媒体 & 机器人 API ---
  '/discord': 'https://discord.com/api',
  '/telegram': 'https://api.telegram.org'
};

// 添加CORS支持
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, x-api-key, openai-organization, anthropic-version, x-request-id',
};

// 添加安全头
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
};

function extractPrefixAndRest(pathname, prefixes) {
  for (const prefix of prefixes) {
    if (pathname.startsWith(prefix)) {
      return [prefix, pathname.slice(prefix.length)];
    }
  }
  return [null, null];
}

function isValidProxyUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

function getHomePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Proxy Service</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚀</text></svg>">
  <style>
    :root {
      --bg-color: #f5f7fa;
      --card-bg: #ffffff;
      --text-color: #333333;
      --accent-color: #3b82f6;
      --border-color: #e5e7eb;
      --code-bg: #f1f5f9;
      --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      --radius: 8px;
      --transition: all 0.3s ease;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg-color: #111827;
        --card-bg: #1f2937;
        --text-color: #f3f4f6;
        --accent-color: #60a5fa;
        --border-color: #374151;
        --code-bg: #272e3f;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
      line-height: 1.6;
      padding: 0;
      margin: 0;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
    header { text-align: center; margin-bottom: 3rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); }
    h1 {
      font-size: 2.8rem;
      font-weight: 700;
      margin-bottom: 1rem;
      background: linear-gradient(135deg, var(--accent-color), #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-fill-color: transparent;
    }
    .subtitle { font-size: 1.3rem; color: var(--text-color); opacity: 0.8; }
    .card {
      background-color: var(--card-bg);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 2rem;
      margin-bottom: 2.5rem;
      transition: var(--transition);
    }
    .card:hover { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); transform: translateY(-2px); }
    h2 {
      font-size: 1.8rem;
      margin-bottom: 1.5rem;
      color: var(--accent-color);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.8rem;
      position: relative;
    }
    h2::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      width: 80px;
      height: 3px;
      background: linear-gradient(135deg, var(--accent-color), #8b5cf6);
      border-radius: 3px;
    }
    h3 { font-size: 1.3rem; margin-top: 1.8rem; margin-bottom: 0.8rem; color: var(--text-color); }
    .endpoints-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.2rem; margin: 1.8rem 0; }
    .endpoint {
      background-color: var(--code-bg);
      border-radius: var(--radius);
      padding: 1.2rem;
      border-left: 4px solid var(--accent-color);
      transition: var(--transition);
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .endpoint:hover { transform: translateY(-3px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
    .endpoint-name { font-weight: bold; font-size: 1.1rem; color: var(--accent-color); margin-bottom: 0.6rem; }
    .endpoint-url { font-size: 0.9rem; word-break: break-all; opacity: 0.8; flex-grow: 1; }
    code {
      background-color: var(--code-bg);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.9em;
    }
    pre {
      background-color: var(--code-bg);
      padding: 1.2rem;
      border-radius: var(--radius);
      overflow-x: auto;
      margin: 1.2rem 0;
      border-left: 4px solid var(--accent-color);
    }
    .usage-example { margin-top: 1.5rem; padding: 1.5rem; background-color: rgba(59, 130, 246, 0.05); border-radius: var(--radius); }
    ul { padding-left: 1.8rem; margin: 1.2rem 0; }
    li { margin-bottom: 0.8rem; position: relative; }
    li::marker { color: var(--accent-color); }
    .footer { text-align: center; margin-top: 3.5rem; padding-top: 1.8rem; border-top: 1px solid var(--border-color); font-size: 0.95rem; opacity: 0.8; }
    .badge {
      display: inline-block;
      background-color: var(--accent-color);
      color: white;
      border-radius: 12px;
      padding: 0.2rem 0.8rem;
      font-size: 0.8rem;
      margin-left: 0.5rem;
      vertical-align: middle;
    }
    .feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin: 2rem 0; }
    .feature { padding: 1.5rem; background-color: var(--card-bg); border-radius: var(--radius); border: 1px solid var(--border-color); transition: var(--transition); }
    .feature:hover { transform: translateY(-3px); box-shadow: var(--shadow); }
    .feature-title { font-weight: bold; font-size: 1.1rem; margin-bottom: 0.8rem; color: var(--accent-color); }
    @media (max-width: 1200px) {
      .endpoints-grid { grid-template-columns: repeat(3, 1fr); }
      .feature-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 900px) {
      .endpoints-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 640px) {
      .endpoints-grid { grid-template-columns: 1fr; }
      .feature-grid { grid-template-columns: 1fr; }
      h1 { font-size: 2.2rem; }
      .container { padding: 1.5rem 1rem; }
    }
    .custom-button {
      display: inline-block;
      padding: 0 5px;
      color: #919ca7;
      text-align: center;
      text-decoration: none;
      font-size: 14px;
      font-weight: 900;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>API Proxy Service</h1>
      <p class="subtitle">A fast and secure proxy for AI and API services</p>
    </header>
    <section class="card">
      <h2>Available Endpoints</h2>
      <p>The following API endpoints are available for proxying:</p>
      <div class="endpoints-grid">
        ${Object.entries(apiMapping).map(([prefix, target]) =>
    `<div class="endpoint">
            <div class="endpoint-name">${prefix}</div>
            <div class="endpoint-url">${target}</div>
          </div>`
  ).join('')}
        <div class="endpoint">
          <div class="endpoint-name">/proxy <span class="badge">Universal</span></div>
          <div class="endpoint-url">General purpose proxy for any URL</div>
        </div>
      </div>
    </section>
    <section class="card">
      <h2>How to Use</h2>
      <div class="feature-grid">
        <div class="feature">
          <div class="feature-title">Simple Path Replacement</div>
          <p>Replace the original API domain with our proxy URL path</p>
        </div>
        <div class="feature">
          <div class="feature-title">Preserves Headers</div>
          <p>All authorization and API keys are securely forwarded</p>
        </div>
        <div class="feature">
          <div class="feature-title">CORS Enabled</div>
          <p>Works with browser-based applications</p>
        </div>
      </div>
      <p>Send your API requests to our proxy by replacing the original API domain with our proxy URL:</p>
      <pre>https://your-worker-subdomain.workers.dev${Object.keys(apiMapping)[0]}/[rest-of-path]</pre>
      <div class="usage-example">
        <h3>Example: OpenAI API</h3>
        <p>Instead of:</p>
        <pre>https://api.openai.com/v1/chat/completions</pre>
        <p>Use:</p>
        <pre>https://your-worker-subdomain.workers.dev/openai/v1/chat/completions</pre>
        <h3>Generic Proxy</h3>
        <p>For any URL, use the /proxy endpoint with the url parameter:</p>
        <pre>https://your-worker-subdomain.workers.dev/proxy?url=https://example.com/api/resource</pre>
      </div>
    </section>
    <section class="card">
      <h2>Important Notes</h2>
      <ul>
        <li><strong>Security:</strong> This service only proxies requests and does not store any API keys or data.</li>
        <li><strong>API Keys:</strong> You still need valid API keys for the respective services.</li>
        <li><strong>Headers:</strong> All requests preserve your Authorization headers and API keys.</li>
        <li><strong>CORS:</strong> Enabled for all origins, allowing browser-based applications to use this proxy.</li>
      </ul>
    </section>
    <footer class="footer">
      <center style="margin-top: 2rem;">
        <a href="http://creativecommons.org/licenses/by-nc-sa/4.0/" class="custom-button">COPYRIGHT BY-NC-SA 4.0</a> |
        <a href="https://ikms.eu.org" class="custom-button">KMS ACTIVATION</a> |
        <a href="https://docker.everyhub.top" class="custom-button">DOCKER HUB PROXY</a> |
        <a href="https://git.everyhub.top" class="custom-button">GITHUB PROXY</a> |
        <a href="https://pixiv.everyhub.top" class="custom-button">PIXIV IMAGES PROXY</a> |
        <a href="https://github.com/hunshcn/gh-proxy" class="custom-button">SOURCE CODE</a> |
        <a href="https://workers.cloudflare.com/" class="custom-button">POWERED CLOUDFLARE WORKERS</a>
      </center>
    </footer>
  </div>
</body>
</html>`;
}

// 重点：使用 Cloudflare Workers 的默认导出语法替换 Deno.serve
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 处理 CORS 预检请求
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders }
      });
    }

    // 首页
    if (pathname === '/' || pathname === '/index.html') {
      return new Response(getHomePage(), {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          ...securityHeaders
        }
      });
    }

    // robots.txt
    if (pathname === '/robots.txt') {
      return new Response('User-agent: *\nDisallow: /', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // 健康检查端点
    if (pathname === '/health' || pathname === '/ping') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // 处理通用代理请求
    if (pathname === '/proxy') {
      const targetUrl = url.searchParams.get('url');

      if (!targetUrl) {
        return new Response(JSON.stringify({
          error: 'Missing URL',
          message: 'Please provide a target URL using the "url" query parameter'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
            ...securityHeaders
          }
        });
      }

      if (!isValidProxyUrl(targetUrl)) {
        return new Response(JSON.stringify({
          error: 'Invalid URL',
          message: 'The provided URL is invalid or not allowed'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
            ...securityHeaders
          }
        });
      }

      try {
        const headers = new Headers();
        const allowedHeaders = [
          'accept', 'content-type', 'authorization', 'user-agent',
          'x-api-key', 'openai-organization', 'anthropic-version', 'x-request-id'
        ];

        for (const [key, value] of request.headers.entries()) {
          if (allowedHeaders.includes(key.toLowerCase())) {
            headers.set(key, value);
          }
        }

        const response = await fetch(targetUrl, {
          method: request.method,
          headers: headers,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
        });

        const responseHeaders = new Headers();

        // 复制原始响应头
        for (const [key, value] of response.headers.entries()) {
          responseHeaders.set(key, value);
        }

        Object.entries(corsHeaders).forEach(([key, value]) => {
          responseHeaders.set(key, value);
        });

        return new Response(response.body, {
          status: response.status,
          headers: responseHeaders
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Proxy Error', message: error.message }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
            ...securityHeaders
          }
        });
      }
    }

    // 处理特定API端点的代理请求
    const [prefix, rest] = extractPrefixAndRest(pathname, Object.keys(apiMapping));
    if (!prefix) {
      return new Response('Not Found', {
        status: 404,
        headers: { ...corsHeaders, ...securityHeaders }
      });
    }

    const targetUrl = `${apiMapping[prefix]}${rest}${url.search}`;

    try {
      const headers = new Headers();
      const allowedHeaders = [
        'accept', 'content-type', 'authorization', 'user-agent',
        'x-api-key', 'openai-organization', 'anthropic-version', 'x-request-id'
      ];

      for (const [key, value] of request.headers.entries()) {
        if (allowedHeaders.includes(key.toLowerCase())) {
          headers.set(key, value);
        }
      }

      // 转发请求到目标API (Cloudflare Workers 支持流式处理 body)
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
      });

      const responseHeaders = new Headers();

      for (const [key, value] of response.headers.entries()) {
        responseHeaders.set(key, value);
      }

      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });

      Object.entries(securityHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: 'Internal Server Error', message: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
          ...securityHeaders
        }
      });
    }
  }
};
