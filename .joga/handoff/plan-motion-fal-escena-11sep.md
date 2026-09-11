# Plan — Joga Motion, ronda motion-fal-escena-11sep: el paso de imagen pasa a fal.ai

Base: `1529c4c` (árbol limpio). Solo `worker.js` y `tests/composer-worker.mjs`. **La página no se toca** (`studio.js`, `creator.html`, `studio.css` intactos).

## Por qué (medido el 10/11-sep)

- Higgsfield `soul/reference` con la foto + «playa al amanecer» devolvió la misma foto retocada (loto, halo, sin playa): es referencia de estilo, no de identidad.
- fal.ai `fal-ai/nano-banana/edit` con la **misma foto y el mismo prompt** devolvió a la misma mujer descalza en la playa al amanecer (JPEG 1344×768, 247 KB, ~2 s de cola). Obedece la escena y conserva a la persona. $0,039 por imagen.
- Contrato fal medido con la llave de José (sondas `sonda-fal-playa-worker-v2.js`): `POST https://queue.fal.run/fal-ai/nano-banana/edit`, header `Authorization: Key ${FAL_KEY}`, body `{prompt, image_urls:[…], num_images:1, output_format:'jpeg', aspect_ratio}` → `{request_id, status_url, response_url}`. **Estado y resultado se consultan con el app id base, SIN `/edit`:** `GET https://queue.fal.run/fal-ai/nano-banana/requests/{id}/status` → `{status: 'IN_QUEUE'|'IN_PROGRESS'|'COMPLETED', …}`; `GET https://queue.fal.run/fal-ai/nano-banana/requests/{id}` → `{images:[{url,width,height,content_type}], description}`. (Construir la URL con `/edit` da 405 — error ya cometido.) Doc oficial: fal.ai/models/fal-ai/nano-banana/edit/api — `aspect_ratio` enum `auto,21:9,16:9,3:2,4:3,5:4,1:1,4:5,3:4,2:3,9:16`; `output_format` `jpeg|png|webp`; `image_urls` sin máximo documentado.
- fal acepta **URLs públicas** como entrada (probado con GitHub Pages). La foto del usuario se sigue subiendo con `uploadImage()` a Higgsfield (URL firmada → `public_url`), y esa `public_url` se le pasa a fal. Nada nuevo que probar en la subida.
- El secreto `FAL_KEY` ya está en Cloudflare (José, 10-sep; verificado: longitud 69, sin espacios).

## Cambios en `worker.js`

**A. Constantes.** Junto a `HF_BASE`:
```js
const FAL_BASE = 'https://queue.fal.run';
const FAL_IMAGE_MODEL = 'fal-ai/nano-banana/edit';
const FAL_IMAGE_APP = 'fal-ai/nano-banana';
const MAX_REFERENCE_PHOTOS = 8;
```

**B. Helper de estado en fal**, junto a `fetchStatus`:
```js
async function falStatus(taskId, falHeaders) {
  const st = await fetch(`${FAL_BASE}/${FAL_IMAGE_APP}/requests/${taskId}/status`, { headers: falHeaders });
  return { ok: st.ok, code: st.status, data: await readJson(st) };
}
async function falResult(taskId, falHeaders) {
  const r = await fetch(`${FAL_BASE}/${FAL_IMAGE_APP}/requests/${taskId}`, { headers: falHeaders });
  return { ok: r.ok, code: r.status, data: await readJson(r) };
}
```
En `fetch()` del export, tras `authHeader`: `const falHeaders = { 'Content-Type': 'application/json', 'Authorization': `Key ${env.FAL_KEY}` };`

**C. `/compose`.**
- Si `!env.FAL_KEY` → `json({ error: 'FAL_KEY missing in Worker secrets' }, 502)` **antes** de leer el formulario (así el usuario ve el motivo).
- Fotos: aceptar de **1 a `MAX_REFERENCE_PHOTOS`** (`photos.length < 1 || photos.length > MAX_REFERENCE_PHOTOS` → 400 `'one to eight reference photos required'`). La página sigue mandando una; el tope de 8 queda listo para la ronda de varias fotos sin volver a tocar el Worker. Validación por archivo igual que hoy.
- `aspect`: validar contra `['16:9','9:16','1:1']` como hoy (todos válidos en fal).
- Subir cada foto con `uploadImage()` (Higgsfield) → `imageUrls` (array de `public_url`).
- Llamada:
```js
        const result = await fetch(`${FAL_BASE}/${FAL_IMAGE_MODEL}`, {
          method: 'POST', headers: falHeaders,
          body: JSON.stringify({
            prompt: 'Photorealistic cinematic scene, natural light, composed as the opening frame of a video. '
              + 'The people and subjects from the reference photos appear in the scene; keep their faces, hair and bodies recognizable, with natural anatomy. '
              + 'No glow effects, no halos, no text. Scene: ' + prompt,
            image_urls: imageUrls, num_images: 1, output_format: 'jpeg', aspect_ratio: aspect,
          }),
        });
        const data = await readJson(result);
        if (result.ok && data.request_id) return json({ task_id: data.request_id });
        return json({ error: hfError(result.status, data) }, 502);
```
(`hfError` ya lee `detail`, que es lo que devuelve fal en errores.) Actualizar el comentario de cabecera de la ruta (una línea).

**D. `/compose-status` y `/compose-image`.** Sustituir `fetchStatus` por `falStatus`; mapa de estados: `COMPLETED` → pedir `falResult` → `imageUrl = data.images?.[0]?.url`; si no hay → `{status:'failed', error:'completed without image url'}`; `IN_QUEUE`/`IN_PROGRESS` (o cualquier otro no terminal) → `{status:'processing'}`; `!ok` en status o result → `json({ error: hfError(code, data) }, 502)` (transitorio, como hoy). `/compose-image` sigue: solo `task_id` saneado por `TASK_ID`, el Worker relee la URL y reenvía los bytes con CORS y `Content-Type` del origen (será `image/jpeg`, host `*.fal.media`).

**D2 — fallo terminal en fal (hueco del plan, señalado por Tavo; doc oficial fal.ai/docs/documentation/model-apis/inference/queue, 11-sep).** fal solo tiene tres estados: `IN_QUEUE`, `IN_PROGRESS`, `COMPLETED`. **Un fallo llega como `COMPLETED` con los campos `error` (texto) y `error_type` (código)** en la respuesta de estado. Por tanto, en `/compose-status` y `/compose-image`: si `data.status === 'COMPLETED'` y `data.error` → `json({ status: 'failed', error: data.error_type ? `${data.error_type}: ${data.error}` : String(data.error) })` **antes** de pedir `falResult`. Si el resultado (`falResult`) viene `!ok` → 502 con `hfError(code, data)` (transitorio, como hoy); si viene ok sin `images[0].url` → `failed` «completed without image url» (queda como último recurso). Añadir a `tests/composer-worker.mjs`: status `COMPLETED` + `error:'content policy'` + `error_type:'CONTENT_FILTER'` → `/compose-status` responde `{status:'failed', error:'CONTENT_FILTER: content policy'}` y **no** llama al endpoint de resultado.

**E. Sin cambios** en `/generate`, `/status`, `/download`, `uploadImage`, `TASK_ID`, `IMAGE_TYPES`, `MAX_IMAGE_BYTES`.

## `tests/composer-worker.mjs`
**F.** Mock de `fetch`: `POST …/files/generate-upload-url` → presign; `PUT` → 200; `POST queue.fal.run/fal-ai/nano-banana/edit` → `{request_id:'01a0-test', status_url, response_url}` y **comprobar que el body trae `image_urls` (array con la `public_url`) y `prompt` que contiene el texto del usuario**; `GET …/fal-ai/nano-banana/requests/01a0-test/status` → `{status:'COMPLETED'}`; `GET …/requests/01a0-test` → `{images:[{url:'https://v3b.fal.media/x.jpg'}]}`. Casos: 0 fotos → 400; 9 fotos → 400; 1 foto → `task_id`; 2 fotos → `task_id` con 2 `image_urls`; `FAL_KEY` ausente → 502 con `FAL_KEY missing`; fal 4xx con `detail` → 502 con ese detalle; status `IN_PROGRESS` → `processing`; `/compose-image` con id inválido → 400, con id válido → bytes con `Content-Type` del origen.

## Cómo se comprueba (Nico)
1. `node --check worker.js`; `node tests/worker.mjs` (intacto); `node tests/composer-worker.mjs`.
2. `git diff 1529c4c -- studio.js creator.html studio.css index.html style.css i18n.js` **vacío**.
3. Worker con `fetch` simulado: los casos de F, más: la URL de estado y de resultado usan `fal-ai/nano-banana` (sin `/edit`); la petición a fal lleva `Authorization: Key <FAL_KEY>` y NO lleva la llave de Higgsfield; el `PUT` a la URL firmada no lleva ninguna Authorization.
4. `creator.html` servido en local contra el Worker real desplegado NO (gasta); contra Worker simulado: el flujo escena sigue idéntico desde la página (1 `/compose`, sondeo `/compose-status`, `/compose-image`, «Animar esta escena» → 1 `/generate`).
5. Producción (José autoriza): **una** escena con la foto de la playa ($0,04 en fal) y ver que aparece en la vista previa; opcionalmente animarla ($0,49).

## Publicación
Pegar `worker.js` en Cloudflare (comprobar con Cmd+F `nano-banana` antes de Deploy). Push de los `.md`/tests. Huella gratis para verificar: `POST /compose` sin fotos → «one to eight reference photos required» (la versión anterior dice «one reference photo required»).

## Fuera de esta ronda
- Página: permitir 2–8 fotos (`addPhotos`, contador, textos) — cuando la prueba con varias fotos confirme el parecido.
- El texto `uncertain` de `studio.js` nombra a Higgsfield; con los niveles, el cliente no debe ver proveedores.
- Tope de gasto en el Worker (obligatorio antes de cobrar).
