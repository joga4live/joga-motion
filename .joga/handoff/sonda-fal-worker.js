// SONDA FAL — Joga Motion. Dos pruebas reales con fal-ai/nano-banana/edit (2 fotos y 8 fotos), ~$0.08 en total.
// No revela la llave. Pegar en Cloudflare -> Deploy -> abrir https://joga-motion-api.omhotien90.workers.dev/diag
// Despues volver a pegar el worker.js aprobado.

const CORS = { 'Access-Control-Allow-Origin': '*' };
const FAL = 'https://queue.fal.run';
const MODEL = 'fal-ai/nano-banana/edit';
const P = 'https://joga4live.github.io/joga-intelligence/';
const FOTOS = [
  P + 'founder.jpg', P + 'assets/awaken/hero-awaken.png', P + 'joga-robot-poster.jpg', P + 'app-shot.png',
  P + 'joga-challenge.png', P + 'joga-logo.png', P + 'joga-lockup.png', P + 'icon-512.png',
];

async function leer(res) {
  const t = await res.text();
  try { return JSON.parse(t); } catch { return { texto: t.slice(0, 300) }; }
}

async function prueba(nombre, urls, headers) {
  const t0 = Date.now();
  const body = {
    prompt: 'A single photorealistic scene that combines the subjects of all the reference images into one composition, natural light.',
    image_urls: urls, num_images: 1, output_format: 'jpeg', aspect_ratio: '16:9',
  };
  const sub = await fetch(`${FAL}/${MODEL}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const s = await leer(sub);
  if (!sub.ok || !s.request_id) return { nombre, fotos: urls.length, envio: { http: sub.status, respuesta: s } };
  const id = s.request_id;
  let estado = null, intentos = 0;
  while (intentos++ < 45) {
    await new Promise(r => setTimeout(r, 2000));
    const st = await fetch(`${FAL}/${MODEL}/requests/${id}/status`, { headers });
    estado = await leer(st);
    if (estado.status === 'COMPLETED' || st.status >= 400) break;
  }
  const res = await fetch(`${FAL}/${MODEL}/requests/${id}`, { headers });
  const r = await leer(res);
  const img = r.images?.[0];
  let cabecera = null;
  if (img?.url) { const h = await fetch(img.url, { method: 'HEAD' }); cabecera = { http: h.status, tipo: h.headers.get('content-type'), bytes: h.headers.get('content-length'), host: new URL(img.url).host }; }
  return {
    nombre, fotos: urls.length, segundos: Math.round((Date.now() - t0) / 1000),
    envio: { http: sub.status, request_id: id },
    estado_final: estado?.status, resultado_http: res.status,
    imagen: img ? { url: img.url, ancho: img.width, alto: img.height, tipo: img.content_type, cabecera } : null,
    descripcion: r.description ? String(r.description).slice(0, 200) : undefined,
    error: (!img && r) ? r : undefined,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/diag') {
      return new Response(JSON.stringify({ error: 'Worker en modo sonda FAL. Volver a pegar worker.js.' }), {
        status: 503, headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }
    if (!env.FAL_KEY) return new Response(JSON.stringify({ error: 'Falta el secreto FAL_KEY en Cloudflare (Settings > Variables and Secrets).' }, null, 2), { headers: { 'Content-Type': 'application/json', ...CORS } });
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Key ${env.FAL_KEY}` };
    const llave = { presente: true, longitud: String(env.FAL_KEY).length, con_espacios: String(env.FAL_KEY) !== String(env.FAL_KEY).trim(), contiene_dos_puntos: String(env.FAL_KEY).includes(':') };
    const solo = url.searchParams.get('solo');
    const pruebas = [];
    if (solo !== '8') pruebas.push(await prueba('dos_fotos', FOTOS.slice(0, 2), headers));
    if (solo !== '2') pruebas.push(await prueba('ocho_fotos', FOTOS, headers));
    return new Response(JSON.stringify({ llave, modelo: MODEL, pruebas }, null, 2), { headers: { 'Content-Type': 'application/json', ...CORS } });
  },
};
