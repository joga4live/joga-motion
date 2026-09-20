// SONDA FAL PLAYA v2 — Joga Motion. Recupera la imagen ya generada (sin gastar) usando status_url/response_url de fal.
// /diag?id=<request_id>  -> recupera ese trabajo.   /diag  -> genera uno nuevo (~$0.04) y usa las URLs que devuelve fal.
// Requiere FAL_KEY. No revela la llave. Despues volver a pegar el worker.js aprobado.

const CORS = { 'Access-Control-Allow-Origin': '*' };
const FAL = 'https://queue.fal.run';
const MODEL = 'fal-ai/nano-banana/edit';
const APP = 'fal-ai/nano-banana';
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
      return new Response(JSON.stringify({ error: 'Worker en modo sonda FAL v2. Volver a pegar worker.js.' }), {
        status: 503, headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }
    if (!env.FAL_KEY) return new Response(JSON.stringify({ error: 'Falta FAL_KEY' }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Key ${env.FAL_KEY}` };
    const t0 = Date.now();
    const salida = {};

    let statusUrl, responseUrl, id = url.searchParams.get('id');
    if (id) {
      statusUrl = `${FAL}/${APP}/requests/${id}/status`;
      responseUrl = `${FAL}/${APP}/requests/${id}`;
      salida.modo = 'recuperar ' + id;
    } else {
      const sub = await fetch(`${FAL}/${MODEL}`, {
        method: 'POST', headers,
        body: JSON.stringify({ prompt: ESCENA, image_urls: [FOTO], num_images: 1, output_format: 'jpeg', aspect_ratio: '16:9' }),
      });
      const s = await leer(sub);
      salida.modo = 'nuevo';
      salida.envio = { http: sub.status, request_id: s.request_id, status_url: s.status_url, response_url: s.response_url };
      if (!sub.ok || !s.request_id) return new Response(JSON.stringify({ ...salida, respuesta: s }, null, 2), { headers: { 'Content-Type': 'application/json', ...CORS } });
      id = s.request_id; statusUrl = s.status_url; responseUrl = s.response_url;
    }

    let estado = null, http = 0;
    for (let i = 0; i < 50; i++) {
      const st = await fetch(statusUrl, { headers });
      http = st.status; estado = await leer(st);
      if (estado.status === 'COMPLETED' || st.status >= 400) break;
      await new Promise(r => setTimeout(r, 2000));
    }
    salida.estado = { http, status: estado?.status, detalle: estado?.status ? undefined : estado };

    const res = await fetch(responseUrl, { headers });
    const r = await leer(res);
    const img = r.images?.[0];
    let cabecera = null;
    if (img?.url) {
      const h = await fetch(img.url, { method: 'HEAD' });
      cabecera = { http: h.status, tipo: h.headers.get('content-type'), bytes: h.headers.get('content-length'), host: new URL(img.url).host };
    }
    salida.resultado = { http: res.status, segundos: Math.round((Date.now() - t0) / 1000) };
    salida.imagen = img ? { url: img.url, ancho: img.width, alto: img.height, tipo: img.content_type, cabecera } : null;
    if (r.description) salida.descripcion = String(r.description).slice(0, 300);
    if (!img) salida.error = r;
    return new Response(JSON.stringify(salida, null, 2), { headers: { 'Content-Type': 'application/json', ...CORS } });
  },
};
