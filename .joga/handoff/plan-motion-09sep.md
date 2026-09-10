# Plan — Joga Motion: hacer que la generación de video funcione de punta a punta

Ronda: motion-09sep. Repo: `joga-motion` (https://github.com/joga4live/joga-motion), separado de `joga-intelligence-repo`.
Origen del código: lo construyó Hermes Agent. Aplica la regla de revisión externa: nada se da por bueno sin Nico.

## Qué está roto hoy (medido, no afirmado)

Fuente de verdad: documentación oficial de Higgsfield (docs.higgsfield.ai — quickstart, concepts/file-uploads, api-reference/requests/get-request-status, openapi.json). El Worker desplegado en `https://joga-motion-api.omhotien90.workers.dev` devuelve el mismo string de error que `worker.js:48`, así que el código del repo ES el desplegado.

Hoy un usuario que sube una imagen y pulsa GENERAR falla siempre, por esta cadena:

1. `worker.js:15,51` — manda la petición a `https://platform.higgsfield.ai/...`. El host real (`servers` del openapi) es `https://api.higgsfield.ai`. Ya existe como `HF_BASE` en la línea 14.
2. `worker.js:27,29` — dos estilos apuntan al modelo `higgsfield-ai/dop/standard`, que NO existe en el openapi. Los modelos image-to-video reales son Kling v2.1 (standard/pro/master), Kling v2.5-turbo, Veo3.1, Seedance. `kling-video/v2.1/pro/image-to-video` sí existe.
3. `worker.js:58-61` — mete la imagen como `data:image/jpeg;base64,...` en `image_url`. La doc dice literal: solo URLs HTTPS públicas, o subir primero con el flujo de 3 pasos. Higgsfield la rechaza.
4. `worker.js:62` — `reqBody.duration = String(duration)` manda `"5"`. El schema del openapi dice `duration: {type: integer, enum: [5,10], default: 5}`. Rechazo de schema.
5. `worker.js:96` — lee la URL del video en `data.output.url` / `data.outputs[0].url` / `data.output`. Ninguno existe. El schema es `video: {url}` → `data.video.url`. Consecuencia: aunque todo lo anterior funcionara, `/status` devolvería `video_url: undefined`, `creator.js:208` nunca entra al `if`, y la página gira 5 minutos hasta dar "Error al generar".
6. `worker.js:94-103` — solo trata `completed` y `failed` como finales. El enum real es `queued | in_progress | nsfw | failed | completed | canceled`. `nsfw` y `canceled` giran hasta el timeout.
7. `creator.js:100` — `t('c_err_big')` no existe en ningún STRINGS; `t()` devuelve la clave, así que el `||` nunca aplica y el usuario ve el toast "c_err_big" al subir >10 MB.
8. `creator.js:253-259` — el botón DESCARGAR pone `a.download` sobre una URL de otro dominio (el CDN de Higgsfield). Los navegadores ignoran `download` cross-origin: abre el video en pestaña, no lo guarda. "Descarga instantánea" es promesa de portada.
9. `creator.js:179-184, 216-220` — el error real (`err.message`, `data.error`) solo va a `console.error`; el usuario siempre ve "Intenta de nuevo". Con las llaves mal puestas o sin créditos, nadie sabría por qué.

Lo que SÍ está bien y no se toca: el header `Authorization: Key ID:SECRET` (correcto), el path `/requests/{id}/status` (correcto), los 17 IDs del DOM que `creator.js` usa existen todos en `creator.html`, las 7 clases CSS de estado (`.show`, `.filled`, `.drag`, `.on`) existen en `style.css`, CORS preflight responde 200, GitHub Pages sirve los 5 archivos byte por byte iguales al repo.

## Cambios — exactos, por archivo

### `worker.js`

**A. Host.** Borrar la línea 15 (`HF_PLATFORM`). En la línea 51 usar `${HF_BASE}/${MODEL}`.

**B. Un solo modelo real.** Borrar el mapa `STYLE_MODEL` (líneas 24-32) y la línea 50. Sustituir por:
```js
const MODEL = 'kling-video/v2.1/pro/image-to-video';
```
Razón: no hay modelo `dop`. El estilo YA se diferencia por el texto que `creator.js:148-156` añade al prompt — ese es el mecanismo real y se queda ahí. Un mapa donde todas las entradas son iguales miente sobre lo que hace.

**C. Subida de imagen (3 pasos, literal de la doc).** Nueva función:
```js
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

async function uploadImage(b64, contentType, authHeader) {
  const type = IMAGE_TYPES.has(contentType) ? contentType : 'image/jpeg';
  const presign = await fetch(`${HF_BASE}/files/generate-upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
    body: JSON.stringify({ content_type: type }),
  });
  const p = await presign.json();
  if (!presign.ok || !p.upload_url || !p.public_url) {
    throw new Error(`upload-url failed (${presign.status}): ${p.message || p.error || JSON.stringify(p)}`);
  }
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const put = await fetch(p.upload_url, { method: 'PUT', headers: p.upload_headers || { 'Content-Type': type }, body: bytes });
  if (!put.ok) throw new Error(`image PUT failed (${put.status})`);
  return p.public_url;
}
```
Respuesta del paso 1 según la doc: `{ public_url, upload_url, content_type, upload_headers: { "Content-Type", "x-amz-tagging" } }`. El PUT lleva exactamente esos `upload_headers` y el binario crudo. La URL expira en 1 h.

En `/generate`, reemplazar las líneas 53-62 por:
```js
const { image_url, image_b64, content_type, prompt, duration } = body;
// ...validaciones existentes...
let imageUrl = image_url;
try {
  if (!imageUrl) imageUrl = await uploadImage(image_b64, content_type, authHeader);
} catch (e) {
  return json({ error: e.message }, 502);
}
const reqBody = {
  prompt,
  image_url: imageUrl,
  duration: duration === 10 ? 10 : 5,
};
```
`duration` va como entero y se acota a los dos valores del enum. Se mantiene la rama `image_url` por si alguien ya tiene una URL pública.

**D. Error de envío diagnosticable.** Línea 79, añadir el código HTTP de Higgsfield:
```js
return json({ error: data.message || data.error || 'Higgsfield API error', hf_status: hfRes.status, raw: data }, 502);
```
(Un 401 = llaves mal; 402 = sin créditos; 422 = schema. Hoy todo se ve igual.)

**E. Status con el campo y los finales correctos.** Reemplazar líneas 91-103:
```js
const data = await statusRes.json();
const videoUrl = data.video?.url;
if (data.status === 'completed') {
  if (videoUrl) return json({ status: 'completed', video_url: videoUrl });
  return json({ status: 'failed', error: 'completed without video url', raw: data });
}
if (data.status === 'failed' || data.status === 'nsfw' || data.status === 'canceled') {
  return json({ status: 'failed', error: data.error || data.status });
}
return json({ status: 'processing', hf_status: data.status });
```

**F. Descarga real, sin proxy abierto.** Nueva ruta `GET /download?task_id=xxx`. El cliente NO manda ninguna URL — el Worker vuelve a pedir el status a Higgsfield (autenticado), lee `video.url` del lado servidor y reenvía los bytes con cabecera de adjunto. Así no hay que adivinar el host del CDN ni aceptar URLs arbitrarias.
```js
if (request.method === 'GET' && url.pathname === '/download') {
  const taskId = url.searchParams.get('task_id');
  if (!taskId) return json({ error: 'task_id required' }, 400);
  const st = await fetch(`${HF_BASE}/requests/${taskId}/status`, { headers: { 'Authorization': authHeader } });
  const data = await st.json();
  const videoUrl = data.video?.url;
  if (data.status !== 'completed' || !videoUrl) return json({ error: 'video not ready' }, 409);
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
```
(Los resultados se conservan 1 h en Higgsfield según la doc — suficiente para el clic de descarga.)

### `creator.js`

**G.** Línea 7: borrar el comentario `// ← replace after deploy`. La URL ya es la real; el comentario hace creer que es un marcador.

**H.** Líneas 160-167, body del POST: añadir `content_type: state.imageFile.type`. NO añadir `style` — el Worker ya no lo lee (cambio B); el estilo viaja dentro del prompt como hoy.

**I.** Línea 100: dejar solo `showToast(t('c_err_big'))` (la clave se añade en creator.html, cambio K).

**J.** Mostrar el motivo real del error. Línea 181: `showToast(t('c_err_api') + ' (' + err.message + ')');`. Línea 218 (rama `failed`): `showToast(t('c_err_api') + (data.error ? ' (' + data.error + ')' : ''));`.

**K.** `downloadVideo()` (253-259): apuntar al Worker:
```js
function downloadVideo() {
  if (!state.taskId) return;
  var a = document.createElement('a');
  a.href = WORKER_URL + '/download?task_id=' + encodeURIComponent(state.taskId);
  a.click();
}
```
(`state.resultUrl` sigue sirviendo para el `<video>`; la descarga ya no depende de él.)

### `creator.html`

**L.** Añadir la clave en los dos `Object.assign`:
- ES (junto a `c_err_api`): `c_err_big: 'La imagen es muy pesada (máx 10 MB).',`
- EN: `c_err_big: 'Image too large (max 10 MB).',`

### No se toca
`i18n.js` (tiene claves duplicadas sin uso — limpieza aparte, no mezclar con este arreglo), `style.css`, `index.html`. El copy "Motor Kling AI" de la portada es ahora literalmente cierto.

## Cómo se comprueba (medir)

1. `creator.html` abierto en navegador real: subir un PNG y un JPG, ver que el preview aparece y `state.imageFile.type` es el correcto. Subir >10 MB: toast con texto en español, no "c_err_big".
2. Sin imagen → toast `c_err_no_img`. Sin prompt → `c_err_no_prompt`.
3. Worker (curl): `POST /generate` sin `image_b64` → 400 igual que hoy. `GET /status` sin `task_id` → 400. `GET /download` sin `task_id` → 400. `GET /download?task_id=inventado` → 409 o 502 con JSON, nunca 500 sin cuerpo.
4. Prueba viva de punta a punta = UNA generación Kling 5 s con crédito real. **Solo con el OK de José.** Es lo único que prueba que las llaves `HF_API_KEY_ID` / `HF_API_KEY_SECRET` están puestas en el Worker — nada de lo anterior lo demuestra.

## Publicación (no la hace el agente)
- `git push` no funciona desde aquí. Commit local; José sube con GitHub Desktop.
- El Worker se pega a mano en el panel de Cloudflare (Workers & Pages → joga-motion-api → Edit code → reemplazar todo → Deploy). Los secretos ya configurados se conservan al re-desplegar.
