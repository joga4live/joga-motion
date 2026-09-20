# Plan — Joga Motion, ronda motion-fal-storage-11sep: la foto sube al almacenamiento de fal; errores de fal legibles

Base: `8b5437c` (aprobado por Nico, desplegado por Wrangler como versión `35097a21`). Solo `worker.js` y `tests/composer-worker.mjs`. La página no se toca.

## Qué está roto hoy (medido en producción, 11-sep 16:25–16:50)

- **La subida a Higgsfield falla por tiempo**: tres intentos seguidos de «Crear escena» desde la página terminaron en `image PUT failed (524)` a los 43, 68 y 66 s (anoche ya falló una vez en `/generate` y entró al reintentar). `/compose` con fal NO necesita Higgsfield: solo lo usábamos como lugar público donde dejar la foto.
- **El almacenamiento de fal funciona y es rápido** (sonda `sonda-storage-fal` desplegada 2 min con Wrangler): `POST https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3` con `{content_type, file_name}` y `Authorization: Key ${FAL_KEY}` → `{file_url, upload_url}` (0,6 s); `PUT upload_url` con `Content-Type` y los bytes → 200 (1,3 s para 1,45 MB); `HEAD file_url` → 200 `image/png` público en `v3b.fal.media`; `nano-banana/edit` aceptó ese `file_url` en `image_urls`. Contrato tomado del código oficial del cliente de fal (`fal-js/libs/client/src/storage.ts`; host REST `https://rest.fal.ai` en `config.ts`).
- **Los fallos de fal no siempre llegan como D2 supuso.** En la sonda, el filtro de contenido rechazó el prompt («woman walks barefoot… beach at sunrise», que anoche pasó dos veces): el estado fue `COMPLETED` **sin** `error`/`error_type`, y el **resultado** (`GET …/requests/{id}`) devolvió **422** con `detail` = **array** `[{loc:['body','prompt'], msg:'The content could not be processed because it contained material flagged by a content checker.', type:'content_policy_violation', url:'https://docs.fal.ai/errors#content_policy_violation', input:{…}}]`. Hoy el Worker lo convertiría en `502 «422: [{"loc":…,"input":{…prompt entero…}}]»` — transitorio para la página (sondea hasta rendirse) y con el prompt del usuario vuelto a mandar dentro del texto. Ese rechazo no cobra y NO es transitorio: hay que decirlo como `failed` con un motivo corto.

## `worker.js`

**A. Subida a fal.** Nuevo helper junto a `uploadImage`:
```js
async function uploadToFal(file, falKey) {
  const init = await fetch('https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${falKey}` },
    body: JSON.stringify({ content_type: file.type, file_name: `joga-${Date.now()}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}` }),
  });
  const i = await readJson(init);
  if (!init.ok || !i.upload_url || !i.file_url) throw new Error('fal upload-url ' + hfError(init.status, i));
  const put = await fetch(i.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: await file.arrayBuffer() });
  if (!put.ok) throw new Error(`fal image PUT failed (${put.status})`);
  return i.file_url;
}
```
(El PUT al storage de fal NO lleva `Authorization` — igual que la doc de Higgsfield para su URL firmada; la sonda lo hizo así y dio 200.)
**B. `/compose`** usa `uploadToFal(file, env.FAL_KEY)` en vez de `uploadImage(file, authHeader)`. `uploadImage` se queda para `/generate` (Kling sigue en Higgsfield).
**C. Errores de fal legibles (D4).** Nueva función:
```js
function falError(status, data) {
  const d = data?.detail;
  if (Array.isArray(d) && d.length) {
    const first = d[0] || {};
    return `${first.type || status}: ${first.msg || 'request rejected'}`;
  }
  return hfError(status, data);
}
```
En `/compose-status` y `/compose-image`: si `falResult` viene `!ok` con **4xx** → `json({ status: 'failed', error: falError(rCode, rData) })` (terminal: la página limpia `imageTask` y muestra el motivo); con **5xx** → `json({ error: falError(rCode, rData) }, 502)` (transitorio, como hoy). En `/compose`, el `return json({ error: hfError(result.status, data) }, 502)` pasa a `falError`. Así el texto nunca arrastra el `input` (el prompt del usuario) ni el JSON entero.
**D. Reintento único del PUT en `uploadImage`** (Higgsfield, para `/generate`): si el `PUT` responde 5xx o 524, repetir **una** vez tras 1 s (nuevo presign no hace falta: la URL firmada dura 1 h). Es lo que anoche habría evitado el fallo del primer intento.
**E. Sin cambios** en `/status`, `/download`, `TASK_ID`, `IMAGE_TYPES`, `MAX_IMAGE_BYTES`, ni en el prompt de `/compose`.

## `tests/composer-worker.mjs`
**F.** Mock: `POST rest.fal.ai/storage/upload/initiate` → `{file_url:'https://v3b.fal.media/files/x.png', upload_url:'https://up.test/x'}`; `PUT up.test` → 200 (comprobar que NO lleva `Authorization` y sí `Content-Type` del archivo); la petición a `nano-banana/edit` lleva ese `file_url` en `image_urls`. **Ninguna** llamada a `api.higgsfield.ai` en `/compose`. Casos nuevos: initiate 401 → 502 `fal upload-url 401: …`; PUT 500 → 502 `fal image PUT failed (500)`; resultado 422 con `detail` array `content_policy_violation` → `/compose-status` `{status:'failed', error:'content_policy_violation: The content could not be processed…'}` y **sin** el prompt en el texto; resultado 503 → 502 transitorio; en `/generate`, PUT 524 y luego 200 → `task_id` (reintento), PUT 524 dos veces → 502 `image PUT failed (524)`.

## Cómo se comprueba (Nico)
1. `node --check`; los tres tests.
2. Arnés con `fetch` simulado: los casos de F con control (mutaciones). `/generate`, `/status`, `/download` sin cambio salvo el reintento.
3. `wrangler dev` local con llaves falsas (receta en `.claude/skills/verify/SKILL.md`): `/compose` con 1 foto → `502 fal upload-url 401: …` (la petición sale hacia `rest.fal.ai`, no hacia Higgsfield); `/generate` con 1 foto → `502 upload-url 401: Invalid credentials` (Higgsfield).
4. Producción (José ya autorizó las pruebas de escena): una escena real desde la página ($0,04); si el filtro la rechaza, la página debe decir «content_policy_violation: …» y permitir reintentar con otra descripción — probar entonces una descripción sin «descalza» (p. ej. «camina por la orilla de una playa al amanecer»).

## Publicación
Wrangler desde el Mac (`git show <hash>:worker.js` → scratch → `deploy`), esperar 15 s, huella: `/compose` con 1 foto y llave real ya no puede dar `image PUT failed (524)` de Higgsfield; y Push de docs.

## Fuera de esta ronda
- `safety_tolerance` de fal (enum 1–6, default 4, "solo API" según la ficha del modelo): podría bajar los falsos positivos del filtro; decidir con José y probar antes de cambiarlo.
- La página: mostrar `failed` de escena con un texto humano («El proveedor rechazó la descripción; cámbiala e inténtalo de nuevo») en vez del código.
