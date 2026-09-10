// SONDA v2 — Joga Motion. Campos tomados del openapi oficial. Usa /estimate/: NO genera, NO cobra, NO revela la llave.
// Pegar en Cloudflare -> Deploy -> abrir https://joga-motion-api.omhotien90.workers.dev/diag -> luego volver a pegar worker.js
const CORS = { 'Access-Control-Allow-Origin': '*' };
const HF_BASE = 'https://api.higgsfield.ai';
const CANDIDATOS = {
  "higgsfield-ai/soul/reference": {
    "prompt": "a woman opens her eyes at sunrise, gentle camera push in",
    "image_reference_url": "https://joga4live.github.io/joga-intelligence/assets/awaken/hero-awaken.png"
  },
  "higgsfield-ai/soul/standard": {
    "prompt": "a woman opens her eyes at sunrise, gentle camera push in"
  },
  "veo3.1/reference-to-video": {
    "prompt": "a woman opens her eyes at sunrise, gentle camera push in",
    "image_urls": [
      "https://joga4live.github.io/joga-intelligence/assets/awaken/hero-awaken.png"
    ]
  },
  "veo3.1/image-to-video": {
    "prompt": "a woman opens her eyes at sunrise, gentle camera push in",
    "image_url": "https://joga4live.github.io/joga-intelligence/assets/awaken/hero-awaken.png"
  },
  "veo3.1/fast/image-to-video": {
    "prompt": "a woman opens her eyes at sunrise, gentle camera push in",
    "image_url": "https://joga4live.github.io/joga-intelligence/assets/awaken/hero-awaken.png"
  },
  "sora-2/image-to-video": {
    "prompt": "a woman opens her eyes at sunrise, gentle camera push in"
  },
  "minimax/hailuo-2.3/standard/image-to-video": {
    "prompt": "a woman opens her eyes at sunrise, gentle camera push in",
    "image_url": "https://joga4live.github.io/joga-intelligence/assets/awaken/hero-awaken.png"
  },
  "minimax/hailuo-02/standard/image-to-video": {
    "prompt": "a woman opens her eyes at sunrise, gentle camera push in",
    "image_url": "https://joga4live.github.io/joga-intelligence/assets/awaken/hero-awaken.png"
  },
  "bytedance/seedance/v1/lite/image-to-video": {
    "prompt": "a woman opens her eyes at sunrise, gentle camera push in",
    "image_url": "https://joga4live.github.io/joga-intelligence/assets/awaken/hero-awaken.png"
  },
  "kling-video/v2.5-turbo/standard/image-to-video": {
    "prompt": "a woman opens her eyes at sunrise, gentle camera push in",
    "image_url": "https://joga4live.github.io/joga-intelligence/assets/awaken/hero-awaken.png"
  },
  "kling-video/v2.1/standard/image-to-video": {
    "prompt": "a woman opens her eyes at sunrise, gentle camera push in",
    "image_url": "https://joga4live.github.io/joga-intelligence/assets/awaken/hero-awaken.png"
  },
  "kling-video/v2.1/pro/image-to-video": {
    "prompt": "a woman opens her eyes at sunrise, gentle camera push in",
    "image_url": "https://joga4live.github.io/joga-intelligence/assets/awaken/hero-awaken.png"
  },
  "higgsfield-ai/dop/standard": {
    "prompt": "a woman opens her eyes at sunrise, gentle camera push in",
    "image_url": "https://joga4live.github.io/joga-intelligence/assets/awaken/hero-awaken.png"
  },
  "wan-25-preview/image-to-video": {
    "prompt": "a woman opens her eyes at sunrise, gentle camera push in",
    "image_url": "https://joga4live.github.io/joga-intelligence/assets/awaken/hero-awaken.png"
  }
};
async function leer(res){ const t = await res.text(); try { return JSON.parse(t); } catch { return { texto: t.slice(0,160) }; } }
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/diag') return new Response(JSON.stringify({ error: 'Worker en modo sonda v2. Volver a pegar worker.js.' }), { status: 503, headers: { 'Content-Type': 'application/json', ...CORS } });
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Key ${env.HF_API_KEY_ID}:${env.HF_API_KEY_SECRET}` };
    const resultado = {};
    for (const [modelo, body] of Object.entries(CANDIDATOS)) {
      if (body._nota) { resultado[modelo] = { disponible: false, detalle: body._nota }; continue; }
      const r = await fetch(`${HF_BASE}/estimate/${modelo}`, { method: 'POST', headers, body: JSON.stringify(body) });
      const d = await leer(r);
      resultado[modelo] = r.ok ? { disponible: true, creditos: d.credits, usd: d.usd } : { disponible: false, http: r.status, detalle: d.detail ?? d.texto ?? d };
    }
    return new Response(JSON.stringify({ resultado }, null, 2), { headers: { 'Content-Type': 'application/json', ...CORS } });
  },
};
