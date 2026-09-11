# Revisión — ronda motion-fal-escena-11sep (Nico)

Base `1529c4c` → `d7cb443` + `4d3e519`. Auditado en solo lectura; mi arnés, el servidor simulado y las copias mutadas vivieron en el scratchpad de la sesión, no en el repo. `git status` al cerrar: solo lo que ya estaba (`plan-motion-niveles-10sep.md` modificado por la otra sesión, cuatro archivos sin seguimiento de esta ronda). No los audité ni los toqué.

## Veredicto: APROBADO

Ningún defecto en lo que el plan pidió. Lo que sigue son las mediciones y, aparte, lo que el plan no pidió y los riesgos que solo se cierran con la prueba viva.

## 1. Alcance y sintaxis

- `git diff 1529c4c 4d3e519 --stat` → solo `tests/composer-worker.mjs` (+35/−11) y `worker.js` (+33/−12). Diff de `studio.js creator.html studio.css index.html style.css i18n.js tests/worker.mjs`: 0 bytes.
- `git diff 12bd4f0 4d3e519 -- worker.js`: cuatro hunks, todos antes de la línea 138 (`/generate`). Extraje el bloque `/generate` + `/status` + `/download` de `12bd4f0` y de `4d3e519` (72 líneas cada uno): `diff` vacío. `uploadImage` idéntico (mismo md5). `TASK_ID`, `IMAGE_TYPES`, `MAX_IMAGE_BYTES` sin cambio.
- `node --check worker.js` OK; `node tests/worker.mjs` PASS; `node tests/composer-worker.mjs` PASS (Node 24.20).

## 2. Worker con `fetch` simulado (arnés propio, 84 comprobaciones, 84 PASA)

**Control del arnés:** 13 mutaciones sobre copias de `worker.js`, las 13 pusieron en rojo al menos una comprobación (guard de `FAL_KEY` después de leer el form → 3 rojas; llave de Higgsfield en la llamada a fal → 2; `/edit` en la URL de estado → 22; `/edit` en la de resultado → 12; quitar el cortocircuito `data.error` → 4; invertir `image_urls` → 1; tope 7 → 2; `completed` en minúscula → 16; `Authorization` en el `PUT` → 1; aceptar `?url=` del cliente → 3; `output_format: png` → 1; quitar `error_type` del mensaje → 2; quitar el `!rOk` del resultado → 1). Ninguna mutación pasó en verde.

`/compose`
- Sin `FAL_KEY` (ausente o cadena vacía) → 502 `FAL_KEY missing in Worker secrets`, con CORS, **0 fetch salientes y `Request.formData()` nunca invocado** (lo instrumenté con un envoltorio sobre el prototipo).
- 0 fotos → 400 `one to eight reference photos required` (la huella para producción); 9 → 400; 8 → 200 con 17 fetch (8 presign + 8 PUT + 1 fal). Prompt vacío/1801, aspecto `4:3`, GIF, 10 MB+1 → 400 sin fetch.
- 1 foto → exactamente 3 fetch en orden: `POST api.higgsfield.ai/files/generate-upload-url` con `Key hf-id:hf-secret`; `PUT` a la URL firmada **sin ninguna cabecera Authorization**; `POST https://queue.fal.run/fal-ai/nano-banana/edit` con `Authorization: Key <FAL_KEY>` y `Content-Type: application/json`; la llave de Higgsfield no aparece en cabeceras ni cuerpo de la llamada a fal; la de fal no viaja en el cuerpo.
- Cuerpo: claves exactamente `aspect_ratio, image_urls, num_images, output_format, prompt` (ningún resto de `image_reference_url/resolution/batch_size`); `image_urls = [public_url]`; `num_images 1`; `output_format 'jpeg'`; `aspect_ratio` pasa `9:16`; `prompt` empieza con el preámbulo y termina en `Scene: <texto del usuario>`.
- 2 fotos → 5 fetch, `image_urls` en orden de subida (`ref-1`, `ref-2`), subidas secuenciales.
- fal 422 con `detail` texto → 502 `422: <detail>`; `detail` array → 502 con el JSON; fal 200 sin `request_id` → 502; fal 504 HTML → 502 `504: <html>…`; `PUT` 403 → 502 y fal no se llama.

`/compose-status`
- URL de estado = `https://queue.fal.run/fal-ai/nano-banana/requests/<id>/status` (sin `/edit`), `Authorization: Key <FAL_KEY>`, sin llave Higgsfield.
- `IN_QUEUE` / `IN_PROGRESS` → `{status:'processing'}`, 1 solo fetch.
- `COMPLETED` + `error` + `error_type` → `{status:'failed', error:'CONTENT_FILTER: content policy violation'}`, **1 solo fetch** (no pide el resultado). Sin `error_type` → solo el mensaje. `error: null` → sigue al resultado.
- `COMPLETED` limpio → `GET https://queue.fal.run/fal-ai/nano-banana/requests/<id>` (sin `/edit`) → `{status:'completed', image_url:'https://v3b.fal.media/out.jpg'}`; 2 fetch, ninguno a `fal.media`.
- Resultado sin `images[0].url` → `failed` «completed without image url». Estado 404 → 502 `404: Request not found` (sin campo `status`, o sea transitorio para la página). Resultado 500 → 502. Excepción de red → 502 «temporarily unavailable». `task_id` vacío o con `/` → 400 sin fetch.

`/compose-image`
- `../bad` → 400 sin fetch. Id válido con `&url=https://evil.test/x.jpg&image_url=…` → reenvía los 4 bytes del origen (`FF D8 FF E0`), `Content-Type: image/jpeg` del origen (y `image/png` cuando el origen lo dice), `Access-Control-Allow-Origin: *`, tercer fetch a `https://v3b.fal.media/out.jpg`, **cero llamadas a `evil.test`**. Origen 410 → 502 «Could not retrieve scene image». Aún procesando → JSON `processing`; `COMPLETED`+`error` → `failed` con 1 fetch.

`/generate`, `/status`, `/download`: siguen en Higgsfield con `Key hf-id:hf-secret`, sin ninguna llamada a `fal.run`; `/generate` funciona **sin** `FAL_KEY` (el video no depende de fal).

## 3. Página local contra Worker simulado

Serví `creator.html` desde el repo (lectura) con un servidor en el scratchpad que reescribe al vuelo `WORKER` a `http://127.0.0.1:4567/api` y registra cada llamada. Foto inyectada con el propio `addPhotos()` de la página (JPEG 256×144), modo «Crear una escena», descripción «caminando descalza por una playa al amanecer», idioma es.

- Flujo completo, registro exacto del servidor: `POST /compose` (`images`, `prompt`, `aspect_ratio=16:9`) → `GET /compose-status` ×2 (processing, completed) → `GET /compose-image` → **`POST /generate` con `image: scene.jpg (image/jpeg, 14 431 B)`** = el blob de la escena, `duration=5` → `GET /status` ×2 → video. Un solo `/compose`, un solo `/generate`. La escena se mostró (`#scene` 535×301 px, natural 256×144), botón «Animar esta escena», luego «Crear otra versión» y enlace de descarga a `/download?task_id=hf-vid-888`.
- Fallo de fal (`/compose-status` → `{status:'failed', error:'CONTENT_FILTER: content policy'}`): la página deja `imageTask = null`, `imageReady = false`, botón «Intentar de nuevo», mensaje «El proveedor no pudo completar la generación. Puedes intentarlo de nuevo. (CONTENT_FILTER: content policy)». Nada queda colgado.
- `/compose` → 502 `FAL_KEY missing…`: `imageTask = null`, `message = 'error'`, `detail` con el texto, sin `uncertain`. El usuario ve el motivo.

## 4. Contrato fal contra la doc (leída hoy)

- `fal.ai/models/fal-ai/nano-banana/edit/api`: `prompt` y `image_urls` requeridos; `num_images` (def. 1); `aspect_ratio` enum `auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16` (los tres del Worker están dentro); `output_format` `jpeg|png|webp` (**default `png`**, por eso importa mandar `jpeg` explícito — se manda); salida `images[{url, content_type, file_name, file_size, width, height}]` + `description`; sin máximo documentado para `image_urls`. Coincide con el plan.
- `fal.ai/docs/…/inference/queue`: estados `IN_QUEUE`, `IN_PROGRESS`, `COMPLETED`; `error` («present only if the request failed») y `error_type` en la respuesta de estado. D2 coincide con la doc.
- **Una discrepancia doc ↔ plan, y gana lo medido:** la doc escribe las URLs de estado/resultado como `queue.fal.run/{model-id}/requests/{id}/status`, sin aclarar que el sub-path (`/edit`) se quita; el plan lo midió (405 con `/edit`) y el Worker usa `fal-ai/nano-banana`. Correcto tal como está; la doc es la imprecisa.
- Doc de fal sobre expiración de medios: solo «Download files you need to keep before they expire» (remite a *media-expiration*, sin cifra). El Worker relee `images[0].url` en el mismo sondeo en que la página pide `/compose-image`; no hay ventana larga.

## 5. Riesgos (no bloquean; se cierran con la prueba viva)

- **`public_url` de Higgsfield como entrada de fal — cadena no medida.** Las dos sondas (`sonda-fal-playa-worker*.js`) usaron una PNG de GitHub Pages, no una `public_url` de Higgsfield. La doc de Higgsfield (`file-uploads.md`) dice que **la URL de subida caduca en una hora** y no dice nada de la vida ni del acceso de `public_url`. El plan afirma «nada nuevo que probar en la subida»; discrepo en un grado: la lectura de esa URL por fal es exactamente lo que la escena viva de $0,04 tiene que confirmar. Si fal responde 422 «image_urls[0] unreachable» o similar, el Worker ya lo traduce a 502 con el detalle, así que el diagnóstico será inmediato.
- **8 subidas de 10 MB.** Son E/S, no CPU (Cloudflare mide CPU, no espera), así que el límite de CPU no aplica. Lo que sí: `formData()` retiene las 8 `File` en memoria (~80 MB) más el `arrayBuffer()` de la foto en curso (10 MB) frente a los 128 MB del Worker, y el cuerpo de 80 MB queda bajo el tope de 100 MB por petición. Hoy la página manda una foto; antes de abrir 2–8 en la página, medir con 8 fotos reales de 10 MB.
- Fallo de fal e `imageTask`: medido en §3, no queda colgado.

## Lo que el plan no pidió (informativo, no cuenta contra el veredicto)

- `worker.js:1-3`: la cabecera del archivo sigue diciendo «Proxy: Higgsfield AI image-to-video / Secrets: HF_API_KEY_ID, HF_API_KEY_SECRET»; falta `FAL_KEY`. Cosmético; conviene actualizarlo en la próxima ronda que toque el Worker.
- `worker.js:34`: si fal devuelve un error sin `detail/message/error`, `hfError` dice «Higgsfield API error» para un fallo de fal. Solo cosmético y solo en ese caso raro.
- `worker.js:112`: si la subida a Higgsfield falla dentro de `/compose`, el mensaje dice «Submission may have been accepted» aunque fal nunca se llamó. Preexistente desde `12bd4f0`, no de esta ronda.
- `tests/composer-worker.mjs` no comprueba que el `PUT` va sin `Authorization` ni que la llamada a fal va sin la llave de Higgsfield; mi arnés sí, y el plan no lo pedía en F.

## Publicación (si José aprueba)

1. Pegar `worker.js` completo en Cloudflare; Cmd+F `nano-banana` (debe aparecer) y `soul/reference` (no debe aparecer) antes de Deploy.
2. Huella gratis: `POST https://joga-motion-api.omhotien90.workers.dev/compose` sin fotos → `{"error":"one to eight reference photos required"}` (la versión vieja dice «one reference photo required»). Vale como huella porque la comprobación de fotos va después del guard de `FAL_KEY`: si respondiera `FAL_KEY missing…`, el secreto no está en ese Worker.
3. Push de `.md`, sondas y `tests/composer-worker.mjs` (la página no cambió; no hay service worker en este repo).

## Prueba viva (gasto, José autoriza)

- Una escena con la foto de la playa: ~$0,04 en fal. Confirma la cadena Higgsfield `public_url` → fal y que la persona aparece en la playa (el motivo de toda la ronda).
- Opcional: animarla, $0,49 en Higgsfield.
- Opcional y sin gasto extra si ocurre: un rechazo real de fal para ver el `error_type` verdadero; D2 está implementado según la doc, no medido con un fallo real.

## Lecciones de esta vuelta

- **«Nada nuevo que probar» exige señalar qué sonda lo probó.** El plan dio por probada la entrada `public_url` → fal, pero las sondas usaron GitHub Pages. Regla: cuando un plan declare algo como ya medido, cite el archivo de la sonda y el valor exacto que usó; si el valor difiere del de producción, no está medido.
- **La doc puede contradecir lo medido; el plan debe decir cuál gana y por qué.** fal documenta la URL de estado con `{model-id}` completo y en la práctica hay que quitar el sub-path. El plan lo hizo bien (registró el 405). Regla: cada contrato externo en un plan lleva «doc dice X, medido Y» cuando no coinciden.
- **Un arnés sin control no vale.** Trece mutaciones, trece rojas; sin eso, los 84 verdes serían humo. Una de las mutaciones hizo que mi propio arnés reventara en vez de marcar rojo (parseaba JSON fuera de una comprobación); lo endurecí antes de contar. Regla: cada `await r.json()` del arnés va dentro de una comprobación o con `catch`.
- Sin tropiezos del proceso esta vez: nombre de reporte por ronda respetado, servidor y copias mutadas fuera del repo, proceso detenido por PID exacto y nombre de comando, no por número de puerto.
