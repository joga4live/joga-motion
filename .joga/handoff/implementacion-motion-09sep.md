# Implementación — motion-09sep

Commit local: `af5b098` (sin push — José sube con GitHub Desktop).

## worker.js
- **A.** Borrada `HF_PLATFORM`. `/generate` ahora pega a `${HF_BASE}/${MODEL}` (`https://api.higgsfield.ai/...`).
- **B.** Borrado `STYLE_MODEL`. Un solo `MODEL = 'kling-video/v2.1/pro/image-to-video'`.
- **C.** Nueva `uploadImage()` con el flujo de 3 pasos (`/files/generate-upload-url` → PUT con `upload_headers` → `public_url`). `/generate` sube por esa vía cuando no llega `image_url`, y manda `duration` como entero acotado a 5/10.
- **D.** Error de `/generate` ahora incluye `hf_status: hfRes.status` y devuelve 502 en vez de 500.
- **E.** `/status` lee `data.video?.url`, trata `completed` sin URL como `failed`, y suma `nsfw`/`canceled` a los estados finales.
- **F.** Nueva ruta `GET /download?task_id=`: reconsulta el status autenticado, valida `completed` + `video.url`, y reenvía los bytes con `Content-Disposition: attachment`.

## creator.js
- **G.** Borrado el comentario `// ← replace after deploy` en `WORKER_URL`.
- **H.** El POST a `/generate` ahora manda `content_type: state.imageFile.type`. No se tocó `style` en el body (no se manda desde antes; el Worker ya no lo lee).
- **I.** `handleFile()` deja solo `showToast(t('c_err_big'))`, sin el `||` de respaldo.
- **J.** El toast de error de red ahora incluye `err.message`; el toast de `status === 'failed'` incluye `data.error` cuando existe.
- **K.** `downloadVideo()` reescrita: usa `state.taskId` y apunta a `WORKER_URL + '/download?task_id=...'` en vez de `state.resultUrl` con `a.download` cross-origin.

## creator.html
- **L.** Agregada la clave `c_err_big` en `STRINGS.es` y `STRINGS.en`, junto a `c_err_api` como pedía el plan.

## No tocado
`i18n.js`, `style.css`, `index.html` — tal como indica el plan.

## Desviación del plan (anotada, no corregida por mi cuenta)
El comentario existente arriba de `/generate` (`// Accepts: { image_url OR image_b64, prompt, duration, style }`) sigue mencionando `style`, que ya no se lee ahí (el estilo viaja dentro del prompt desde `creator.js`, sin cambios). El plan no pidió tocar ese comentario y las reglas de esta ronda prohíben "mejoras" no pedidas, así que lo dejé igual. Si Kimo MD/Nico lo quieren corregido, es un cambio de una línea.

## Verificado (con comandos, sin navegador — no me corresponde levantar servidores)
- `node --check worker.js` y `node --check creator.js`: sin errores de sintaxis.
- `git diff` revisado línea por línea contra el plan: los 12 cambios (A–L) están todos aplicados y ningún archivo fuera de la lista fue tocado.
- Conteo de llaves i18n: `c_err_big` quedó en ambos diccionarios (ES/EN), junto a las demás `c_err_*`, sin romper la paridad de llaves existente.
- `grep` confirma que no queda ninguna referencia a `HF_PLATFORM`, `STYLE_MODEL`, `data.output` ni `String(duration)` en el repo.

## PENDIENTE DE MEDICIÓN (no puedo verificarlo yo — necesita navegador/servidor real)
1. **Flujo completo en `creator.html`**: subir PNG/JPG y ver que `state.imageFile.type` viaja correcto, que el toast de >10 MB sale en español/inglés según el idioma activo, y que sin imagen/sin prompt salen `c_err_no_img` / `c_err_no_prompt`. Espero: todos los toasts con texto legible, ninguno con la clave cruda.
2. **Worker con `curl`** (no lo corrí porque implica pegar el código en Cloudflare o levantar un entorno de ejecución, fuera de mi alcance en esta ronda): `POST /generate` sin `image_b64` → 400; `GET /status` sin `task_id` → 400; `GET /download` sin `task_id` → 400; `GET /download?task_id=inventado` → 409 (si Higgsfield responde con status distinto de completed) o 502 (si el PUT/GET intermedio falla), nunca 500 sin cuerpo. Espero que se cumpla dado el código, pero no lo ejecuté contra el Worker desplegado.
3. **Generación real de punta a punta** con crédito de Higgsfield: explícitamente fuera de mi alcance, solo la autoriza José (regla del plan y de mis instrucciones — no llamo a la API real ni al Worker desplegado con una imagen real).

Todo lo de "PENDIENTE" queda para Nico/Kimo MD con navegador real, o para José en la prueba viva con crédito.
