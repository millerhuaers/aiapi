// ==========================================
// API Proxy Service (Cloudflare Workers Native)
// main: 原版代理逻辑 + 新版前端（public/index.html，经 Workers Static Assets 提供）
// 注意：首页不再内嵌在 worker.js 里，部署时必须用 wrangler.toml 的 [assets] 配置。
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
  '/telegram': 'https://api.telegram.org',
// --- 新增：国产大模型（OpenAI 兼容） ---
  '/qwen': 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  '/doubao': 'https://ark.cn-beijing.volces.com/api/v3',
  '/hunyuan': 'https://api.hunyuan.cloud.tencent.com/v1',
  '/minimax': 'https://api.minimax.chat/v1',
  '/stepfun': 'https://api.stepfun.com/v1',
  '/baichuan': 'https://api.baichuan-ai.com/v1',
  '/spark': 'https://spark-api-open.xf-yun.com/v1',
  '/qianfan': 'https://qianfan.baidubce.com/v2',

  // --- 新增：聚合 & 开源推理（OpenAI 兼容） ---
  '/deepinfra': 'https://api.deepinfra.com/v1/openai',
  '/nebius': 'https://api.studio.nebius.com/v1',
  '/sambanova': 'https://api.sambanova.ai/v1',
  '/hyperbolic': 'https://api.hyperbolic.xyz/v1',
  '/chutes': 'https://llm.chutes.ai/v1',
  '/llama': 'https://api.llama.com/compat/v1',

  // --- 新增：多模态（图像/视频/语音） ---
  '/fal': 'https://fal.run',
  '/runway': 'https://api.dev.runwayml.com',
  '/luma': 'https://agents.lumalabs.ai/v1',
  '/ideogram': 'https://api.ideogram.ai',
  '/bfl': 'https://api.bfl.ai',
  '/deepgram': 'https://api.deepgram.com',

  // --- 新增：搜索 & 向量 ---
  '/jina': 'https://api.jina.ai',
  '/tavily': 'https://api.tavily.com',
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

    // 首页：由 Workers Static Assets（public/index.html）提供，
    // 不要在这里给它加 default-src 'none' 的 CSP，否则会屏蔽页面自身的脚本。
    if (pathname === '/' || pathname === '/index.html') {
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }
      return new Response('Frontend asset not configured. Deploy with the [assets] section in wrangler.toml.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
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
