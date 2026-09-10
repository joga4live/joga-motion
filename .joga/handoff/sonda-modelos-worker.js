// SONDA TEMPORAL — Joga Motion. Pregunta a Higgsfield qué modelos acepta tu llave.
// Usa /estimate/<modelo>: NO genera nada y NO cobra. No revela la llave.
// Pegar en Cloudflare → Deploy → abrir https://joga-motion-api.omhotien90.workers.dev/diag
// Después volver a pegar el worker.js real.

const CORS = { 'Access-Control-Allow-Origin': '*' };
const HF_BASE = 'https://api.higgsfield.ai';
const IMG = 'https://joga4live.github.io/joga-intelligence/assets/awaken/hero-awaken.png';

const CANDIDATOS = {
  'nano-banana':                          { prompt: 'test', input_images: [{ type: 'image_url', image_url: IMG }], num_images: 1, aspect_ratio: '16:9', output_format: 'jpeg' },
  'higgsfield-ai/soul/reference':         { prompt: 'test', image_url: IMG },
  'higgsfield-ai/soul/standard':          { prompt: 'test' },
  'higgsfield-ai/soul/character':         { prompt: 'test', image_url: IMG },
  'reve/remix':                           { prompt: 'test', image_url: IMG },
  'reve/edit':                            { prompt: 'test', image_url: IMG },
  'flux-pro/kontext/max/text-to-image':   { prompt: 'test' },
  'kling-video/v2.1/pro/image-to-video':  { prompt: 'test', image_url: IMG, duration: 5 },
  'kling-video/v2.1/standard/image-to-video': { prompt: 'test', image_url: IMG, duration: 5 },
};

async function leer(res) {
  const t = await res.text();
  try { return JSON.parse(t); } catch { return { texto: t.slice(0, 160) }; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/diag') {
      return new Response(JSON.stringify({ error: 'Worker en modo sonda. Volver a pegar worker.js.' }), {
        status: 503, headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Key ${env.HF_API_KEY_ID}:${env.HF_API_KEY_SECRET}` };
    const resultado = {};
    for (const [modelo, body] of Object.entries(CANDIDATOS)) {
      const r = await fetch(`${HF_BASE}/estimate/${modelo}`, { method: 'POST', headers, body: JSON.stringify(body) });
      const d = await leer(r);
      resultado[modelo] = r.ok
        ? { disponible: true, creditos: d.credits, usd: d.usd }
        : { disponible: false, http: r.status, detalle: d.detail ?? d.texto ?? d };
    }
    return new Response(JSON.stringify({ que_es: 'estimacion por modelo con tu llave; disponible=false + model_not_found = tu cuenta no tiene ese modelo', resultado }, null, 2),
      { headers: { 'Content-Type': 'application/json', ...CORS } });
  },
};
