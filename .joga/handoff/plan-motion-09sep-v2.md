# Plan v2 — Joga Motion, ronda motion-09sep (segunda vuelta)

Base: commit `af5b098` (ronda 1, aprobada en alcance por Nico) + `revision-motion-09sep.md` (veredicto CAMBIOS).
Los defectos de esta vuelta son del plan v1, no de Tavo. Se corrigen todos aquí: los 2 críticos, los 4 serios y 3 de la lista aparte.

## Qué se arregla y por qué (todo medido por Nico)

| # | Defecto | Dónde | Arreglo |
|---|---|---|---|
| C1 | `applyLang()` ↔ `onLangChange()` se llaman en bucle → `RangeError` al cargar → `initCreator()` nunca corre → botones de estilo/duración muertos | `creator.js:62-66` | `onLangChange` solo repinta los prompts rápidos; no vuelve a llamar a `applyLang` |
| C2 | DESCARGAR sin `target` → cuando el Worker devuelve JSON (409/400/502) la página se reemplaza por el JSON | `creator.js:254-259` | `a.target='_blank'; a.rel='noopener'` |
| S3 | Decodificar base64 en el Worker: 2 132 ms por 10 MB; techo de CPU 10 ms en plan gratuito | `worker.js` (uploadImage / `atob`) | **Dejar de usar base64.** La página manda el archivo como `multipart/form-data`; el Worker lo lee con `request.formData()` y lo reenvía como `arrayBuffer()`. Cero decodificado |
| S4 | Higgsfield devuelve `{"detail": ...}`; la cadena `message‖error` nunca acierta | `worker.js:89` | Helper `hfError(status, data)` que lee `detail` (string o array) y antepone el código HTTP |
| S5 | `/status` y `/download` no miran `res.ok` → un 401 se disfraza de "processing" 5 min | `worker.js:97-120` | Si `!st.ok` → `{status:'failed', error: hfError(...)}` / 502 |
| S6 | `.json()` sin protección en 4 puntos → 500 sin CORS → "Failed to fetch" | `worker.js:54,84,101,118` | Helper `readJson(res)` que cae a `{detail: texto}`; `formData()` en try/catch → 400 |
| L1 | Comentario viejo menciona `style` | `worker.js:52` | Actualizar al contrato nuevo |
| L2 | `task_id` sin sanear en URL y en `Content-Disposition` | `worker.js:117,127`, `creator.js:206` | Regex `^[A-Za-z0-9-]{1,80}$` en el Worker (400 si no cumple); `encodeURIComponent` en el cliente |
| L4 | `image/gif` en `IMAGE_TYPES` | `worker.js:25` | Solo JPEG, PNG, WebP — igual que el texto de la interfaz |

No se toca: `i18n.js`, `style.css`, `index.html`. CORS abierto sin autenticación queda anotado para antes de vender (no en esta ronda).

## `worker.js` — versión completa nueva (reemplazar el archivo entero)

```js
// JOGA MOTION — Cloudflare Worker
// Proxy: Higgsfield AI image-to-video (Kling v2.1 pro)
// Secrets: HF_API_KEY_ID, HF_API_KEY_SECRET

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const HF_BASE = 'https://api.higgsfield.ai';
const MODEL = 'kling-video/v2.1/pro/image-to-video';
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const TASK_ID = /^[A-Za-z0-9-]{1,80}$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function readJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { detail: text.slice(0, 200) }; }
}

function hfError(status, data) {
  const d = data?.detail ?? data?.message ?? data?.error ?? 'Higgsfield API error';
  return `${status}: ${typeof d === 'string' ? d : JSON.stringify(d)}`;
}

async function uploadImage(file, authHeader) {
  const presign = await fetch(`${HF_BASE}/files/generate-upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
    body: JSON.stringify({ content_type: file.type }),
  });
  const p = await readJson(presign);
  if (!presign.ok || !p.upload_url || !p.public_url) {
    throw new Error('upload-url ' + hfError(presign.status, p));
  }
  const put = await fetch(p.upload_url, {
    method: 'PUT',
    headers: p.upload_headers || { 'Content-Type': file.type },
    body: await file.arrayBuffer(),
  });
  if (!put.ok) throw new Error(`image PUT failed (${put.status})`);
  return p.public_url;
}

async function fetchStatus(taskId, authHeader) {
  const st = await fetch(`${HF_BASE}/requests/${taskId}/status`, {
    headers: { 'Authorization': authHeader },
  });
  return { ok: st.ok, code: st.status, data: await readJson(st) };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const authHeader = `Key ${env.HF_API_KEY_ID}:${env.HF_API_KEY_SECRET}`;

    // POST /generate — multipart/form-data: image (file), prompt, duration (5|10)
    if (request.method === 'POST' && url.pathname === '/generate') {
      let form;
      try { form = await request.formData(); } catch { return json({ error: 'multipart form required' }, 400); }

      const file = form.get('image');
      const prompt = String(form.get('prompt') || '').trim();
      const duration = Number(form.get('duration')) === 10 ? 10 : 5;

      if (!prompt) return json({ error: 'prompt required' }, 400);
      if (!(file instanceof File) || !IMAGE_TYPES.has(file.type)) return json({ error: 'image must be JPEG, PNG or WebP' }, 400);
      if (file.size > MAX_IMAGE_BYTES) return json({ error: 'image too large (max 10MB)' }, 400);

      let imageUrl;
      try { imageUrl = await uploadImage(file, authHeader); }
      catch (e) { return json({ error: e.message }, 502); }

      const hfRes = await fetch(`${HF_BASE}/${MODEL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({ prompt, image_url: imageUrl, duration }),
      });
      const data = await readJson(hfRes);
      if (hfRes.ok && data.request_id) return json({ task_id: data.request_id });
      return json({ error: hfError(hfRes.status, data), hf_status: hfRes.status }, 502);
    }

    // GET /status?task_id=xxx
    if (request.method === 'GET' && url.pathname === '/status') {
      const taskId = url.searchParams.get('task_id') || '';
      if (!TASK_ID.test(taskId)) return json({ error: 'task_id required' }, 400);

      const { ok, code, data } = await fetchStatus(taskId, authHeader);
      if (!ok) return json({ status: 'failed', error: hfError(code, data) });

      if (data.status === 'completed') {
        const videoUrl = data.video?.url;
        if (videoUrl) return json({ status: 'completed', video_url: videoUrl });
        return json({ status: 'failed', error: 'completed without video url' });
      }
      if (data.status === 'failed' || data.status === 'nsfw' || data.status === 'canceled') {
        return json({ status: 'failed', error: data.error || data.status });
      }
      return json({ status: 'processing', hf_status: data.status });
    }

    // GET /download?task_id=xxx — el Worker relee video.url; el cliente nunca manda URLs
    if (request.method === 'GET' && url.pathname === '/download') {
      const taskId = url.searchParams.get('task_id') || '';
      if (!TASK_ID.test(taskId)) return json({ error: 'task_id required' }, 400);

      const { ok, code, data } = await fetchStatus(taskId, authHeader);
      if (!ok) return json({ error: hfError(code, data) }, 502);
      const videoUrl = data.video?.url;
      if (data.status !== 'completed' || !videoUrl) return json({ error: `video not ready (${data.status})` }, 409);

      const v = await fetch(videoUrl);
      if (!v.ok) return json({ error: `video fetch failed (${v.status})` }, 502);
      return new Response(v.body, {
        headers: {
          ...CORS,
          'Content-Type': v.headers.get('Content-Type') || 'video/mp4',
          'Content-Disposition': `attachment; filename="joga-motion-${taskId}.mp4"`,
        },
      });
    }

    return json({ error: 'Not found' }, 404);
  },
};
```

## `creator.js` — cambios puntuales

**M. Romper el bucle (C1).** Reemplazar las líneas 60-66 (desde el comentario `// Re-render quick prompts on lang change` hasta el cierre de `window.onLangChange`) por:
```js
window.onLangChange = function() { renderQuickPrompts(); };
```
(`applyLang` en `i18n.js:193` ya es quien llama a `onLangChange`; la llamada de vuelta sobraba y cerraba el ciclo.)

**N. Sin base64.** En `state` (líneas 10-18) quitar `imageB64`. En `handleFile`:
- Antes del tamaño, validar tipo: si `!['image/jpeg','image/png','image/webp'].includes(file.type)` → `showToast(t('c_err_type')); return;`
- Quitar la línea `state.imageB64 = e.target.result.split(',')[1];`. El `FileReader` se queda solo para el preview.

**O. Envío multipart.** En `generateVideo`:
- Línea 140: `if (!state.imageFile)` en vez de `!state.imageB64`.
- Reemplazar el `fetch` (líneas ~160-168) por:
```js
  var fd = new FormData();
  fd.append('image', state.imageFile);
  fd.append('prompt', fullPrompt);
  fd.append('duration', String(state.selectedDuration));

  fetch(WORKER_URL + '/generate', { method: 'POST', body: fd })
```
(Sin cabecera `Content-Type`: el navegador pone el `multipart/form-data` con su boundary.)

**P. `task_id` codificado (L2).** Línea ~206: `fetch(WORKER_URL + '/status?task_id=' + encodeURIComponent(taskId))`.

**Q. Descarga en pestaña aparte (C2).** En `downloadVideo`, antes de `a.click()`:
```js
  a.target = '_blank';
  a.rel = 'noopener';
```

## `creator.html` — una clave nueva

**R.** En los dos `Object.assign`, junto a `c_err_big`:
- ES: `c_err_type: 'Formato no válido. Usa JPG, PNG o WebP.',`
- EN: `c_err_type: 'Invalid format. Use JPG, PNG or WebP.',`

## Cómo se comprueba (para Nico)

1. `node --check worker.js creator.js`.
2. `creator.html` servido en local, consola limpia al cargar: **cero** `RangeError`. Pulsar "10 s" y "Onírico" → `state.selectedDuration === 10`, `state.selectedStyle === 'dreamy'`, clase `on` puesta. El slider tiene fondo degradado. Cambiar idioma con el botón EN/ES: los prompts rápidos cambian de idioma y no hay error en consola.
3. Subir un `.gif` o `.bmp` → toast `c_err_type` en español; no se marca como lista. Subir PNG → preview.
4. Con imagen + prompt, pulsar GENERAR contra un endpoint local falso que devuelva `{"task_id":"abc"}`: en la pestaña Red, el cuerpo es `multipart/form-data` con `image` (archivo binario, no texto base64), `prompt` que contiene el modificador del estilo elegido (p. ej. "dreamy ethereal"), `duration=10` si se eligió 10.
5. Descarga contra un endpoint local falso que devuelva `409 {"error":"video not ready"}`: la página del creador **sigue** (`genBtn` existe, URL no cambia); se abre una pestaña nueva con el JSON. Control: contra `Content-Disposition: attachment` descarga y tampoco navega.
6. Worker desplegado (código viejo aún): `/status?task_id=inventado` sigue dando 200 "processing" — es lo esperado hasta que José pegue el nuevo. NO gastar crédito.
7. CPU: `uploadImage` ya no hace ningún bucle por byte; `file.arrayBuffer()` es nativo. Nada que cronometrar.

## Publicación (igual que v1)
Commit local; José sube con GitHub Desktop y pega `worker.js` completo en Cloudflare. Los secretos se conservan.
