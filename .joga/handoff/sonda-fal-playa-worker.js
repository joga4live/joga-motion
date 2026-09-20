// SONDA FAL PLAYA — Joga Motion. Una prueba real con fal-ai/nano-banana/edit (~$0.04): la mujer de la foto en una playa al amanecer.
// Requiere el secreto FAL_KEY en Cloudflare. No revela la llave. No toca Higgsfield.
// Pegar en Cloudflare -> Deploy -> abrir https://joga-motion-api.omhotien90.workers.dev/diag (tarda ~30-60 s)
// Despues volver a pegar el worker.js aprobado.

const CORS = { 'Access-Control-Allow-Origin': '*' };
const FAL = 'https://queue.fal.run';
const MODEL = 'fal-ai/nano-banana/edit';
const FOTO = 'https://joga4live.github.io/joga-intelligence/assets/awaken/hero-awaken.png';
const ESCENA = 'The woman from the reference photo walks barefoot along a beach at sunrise, the calm sea behind her, soft golden light, looking toward the horizon. Keep her face and hair recognizable. Photorealistic, cinematic, natural light, no glow effects.';

async function leer(res) {
  const t = await res.text();
  try { return JSON.parse(t); } catch { return { texto: t.slice(0, 300) }; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/diag') {
      return new Response(JSON.stringify({ error: 'Worker en modo sonda FAL. Volver a pegar worker.js.' }), {
        status: 503, headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }
    if (!env.FAL_KEY) return new Response(JSON.stringify({ error: 'Falta el secreto FAL_KEY en Cloudflare (Settings > Variables and Secrets > Add > FAL_KEY > Secret > Deploy).' }, null, 2), { headers: { 'Content-Type': 'application/json', ...CORS } });
    const k = String(env.FAL_KEY);
    const llave = { longitud: k.length, con_espacios: k !== k.trim(), contiene_dos_puntos: k.includes(':') };
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Key ${k}` };
    const t0 = Date.now();

    const sub = await fetch(`${FAL}/${MODEL}`, {
      method: 'POST', headers,
      body: JSON.stringify({ prompt: ESCENA, image_urls: [FOTO], num_images: 1, output_format: 'jpeg', aspect_ratio: '16:9' }),
    });
    const s = await leer(sub);
    if (!sub.ok || !s.request_id) {
      return new Response(JSON.stringify({ llave, envio: { http: sub.status, respuesta: s } }, null, 2), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    let estado = null;
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const st = await fetch(`${FAL}/${MODEL}/requests/${s.request_id}/status`, { headers });
      estado = await leer(st);
      if (estado.status === 'COMPLETED' || st.status >= 400) break;
    }
    const res = await fetch(`${FAL}/${MODEL}/requests/${s.request_id}`, { headers });
    const r = await leer(res);
    const img = r.images?.[0];
    let cabecera = null;
    if (img?.url) {
      const h = await fetch(img.url, { method: 'HEAD' });
      cabecera = { http: h.status, tipo: h.headers.get('content-type'), bytes: h.headers.get('content-length'), host: new URL(img.url).host };
    }
    return new Response(JSON.stringify({
      llave, modelo: MODEL, segundos: Math.round((Date.now() - t0) / 1000),
      envio: { http: sub.status, request_id: s.request_id },
      estado_final: estado?.status, resultado_http: res.status,
      imagen: img ? { url: img.url, ancho: img.width, alto: img.height, tipo: img.content_type, cabecera } : null,
      descripcion: r.description ? String(r.description).slice(0, 300) : undefined,
      error: !img ? r : undefined,
    }, null, 2), { headers: { 'Content-Type': 'application/json', ...CORS } });
  },
};
