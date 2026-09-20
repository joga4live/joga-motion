# Revisión — ronda motion-fal-storage-11sep (Nico)

Commit auditado: `61f6a50` sobre `8b5437c`. Fecha: 11-sep-2026.

## Veredicto: APROBADO

Ningún defecto que rompa algo para el usuario. Tres observaciones menores (no bloquean) al final, con
una recomendación para la siguiente vuelta.

## 1. Alcance

- `git diff 8b5437c 61f6a50 --stat`: solo `worker.js` (+37/−3) y `tests/composer-worker.mjs` (+49/−16).
- Página (`creator.html`, `studio.js`, `studio.css`, `i18n.js`, `index.html`): diff vacío.
- Árbol de trabajo: `worker.js` y `tests/` limpios (coinciden con HEAD). Los `.md` modificados de la
  ronda `motion-fal-escena-11sep` son de la otra sesión: no los audité ni los toqué.
- `node --check worker.js`: OK. `node tests/worker.mjs`: PASS. `node tests/composer-worker.mjs`: PASS (2,19 s
  reales: los dos reintentos de `/generate` esperan 1 s cada uno de verdad).

## 2. Arnés propio con `fetch` simulado (13 pruebas, 0 fallos) — con control de mutaciones

Arnés en scratchpad, con `file_url` distinto por subida (`f1.png`, `f2.png`) para poder medir el orden,
cosa que el test de Tavo no distingue porque devuelve siempre la misma URL.

| Caso | Resultado medido |
|---|---|
| `/compose` 1 foto | 1 `POST https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3` con `Authorization: Key FALKEY-123`, body exacto `{content_type:'image/jpeg', file_name:'joga-<ms>.jpg'}`; 1 `PUT https://up.fal/u1` **sin** ninguna cabecera `authorization` (comprobado sin distinguir mayúsculas), `Content-Type: image/jpeg`, cuerpo = bytes del archivo; **0** llamadas a `api.higgsfield.ai`; `image_urls` = `['…/f1.png']`; `task_id` devuelto |
| Extensión por tipo | png → `.png` + `content_type image/png`; webp → `.webp`; jpeg → `.jpg` |
| `/compose` 2 fotos | secuencia de hosts `rest.fal.ai, up.fal, rest.fal.ai, up.fal, queue.fal.run`; cuerpos de los PUT `bytes0, bytes1`; `image_urls` = `[f1, f2]` en orden |
| initiate 401 | 502 `fal upload-url 401: Invalid credentials`, 1 sola llamada |
| PUT fal 500 | 502 `fal image PUT failed (500)`, 1 PUT (sin reintento), 0 llamadas a nano-banana |
| `/compose-status`, resultado 422 `detail[]` con `input.prompt:'SECRETO-DEL-USUARIO'` | HTTP 200 `{status:'failed', error:'content_policy_violation: The content could not be processed because it contained material flagged by a content checker.'}`; la respuesta serializada **no contiene** `SECRETO` |
| resultado 422 con `detail` string | `{status:'failed', error:'422: bad'}` (cae a `hfError`) |
| resultado 503 | 502 `503: temporarily unavailable` (transitorio) |
| D2: estado `COMPLETED`+`error` | `{status:'failed', error:'CONTENT_FILTER: content policy'}` con 1 sola llamada (no lee el resultado) — intacto |
| `/compose` con nano-banana 422 `detail[]` | 502 `content_policy_violation: flagged`, sin el prompt |
| `/generate` PUT 524 → 200 | `task_id`; 2 PUT al **mismo** `upload_url`; 1 solo presign; separación entre PUTs **1001 ms**; segundo PUT con los bytes del archivo |
| `/generate` PUT 524 → 524 | 502 `image PUT failed (524)`; 2 PUT; 0 llamadas a Kling (no hay cobro) |
| `/generate` PUT 403 | 502 `image PUT failed (403)`; **1** PUT, sin espera (< 500 ms) |
| `/generate` presign 401 | 502 `upload-url 401: Invalid credentials` — intacto |

Sobre el 4xx sin reintento en el PUT: es lo correcto. Un 4xx de una URL firmada (403 firma caducada,
400 cabecera que no coincide, 413 tamaño) se repite igual al segundo intento; reintentar solo añade 1 s
de espera al usuario. El 524 es el único que hoy hemos visto y es ≥ 500.

**Control (13 mutaciones sobre una copia del worker, en scratchpad).** Mi arnés detectó las 13; el test
de Tavo detectó 9 de 13:

| Mutación | Arnés Nico | Test Tavo |
|---|---|---|
| PUT a fal con `Authorization` | detecta | detecta |
| `uploadToFal` devuelve `upload_url` | detecta | detecta |
| `/compose` vuelve a Higgsfield | detecta | detecta |
| sin rama 4xx→`failed` | detecta | detecta |
| `falError` filtra el JSON entero (fuga del prompt) | detecta | detecta |
| sin reintento del PUT | detecta | detecta |
| reintento **sin** la espera de 1 s | detecta | no detecta |
| reintento también en 4xx | detecta | no detecta |
| PUT a fal sin `Content-Type` | detecta | detecta |
| `storage_type=fal-cdn` (mal) | detecta | no detecta |
| initiate sin `Authorization` | detecta | detecta |
| 5xx del resultado → `failed` | detecta | detecta |
| `image_urls` invertido | detecta | no detecta |

Los cuatro huecos del test de Tavo no son defectos del código; son cobertura que conviene añadir en
alguna vuelta (ver observaciones).

## 3. Worker en ejecución (`wrangler dev` local, fuera del repo, llaves falsas, foto real de 370 KB)

- `POST /compose` 1 foto → **502** `{"error":"fal upload-url 401: Invalid Key Authorization header format. Expected '<key_id>:<key_secret>'."}` en 0,44 s. Las trazas del propio wrangler (`spans`) muestran **una sola** salida: `POST https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3 → 401`. Ninguna a Higgsfield.
- `POST /generate` 1 foto → **502** `{"error":"upload-url 401: Invalid credentials"}` en 0,89 s; traza: `POST https://api.higgsfield.ai/files/generate-upload-url → 401`.
- `POST /compose` sin fotos → 400 `one to eight reference photos required`; `GET /compose-status` → 502 `401: Authentication is required` (traza a `queue.fal.run`). Huellas de la receta, sin cambio.
- Apagado: maté por PID **solo mi** `workerd` (63513), su `node` (63502) y mi wrapper `npm exec` (63489), tras leer el nombre y la hora de arranque de cada uno. Quedan dos wrappers `npm exec wrangler@4 dev … --port 8799` huérfanos de otras sesiones (PID 59291 de las 16:09 y 59640 de las 16:11, sin hijo y sin puerto): **no los toqué**. El puerto 8799 quedó libre.

## 4. Riesgos

- **`file_name` por tipo**: correcto (jpg/png/webp), y `content_type` va igual al `file.type` validado por `IMAGE_TYPES`.
- **La llave de fal no viaja en el PUT**: medido (arnés, sin distinguir mayúsculas) y confirmado con la mutación M1. La URL firmada del initiate es la única credencial del PUT, igual que en Higgsfield.
- **Retención de `file_url`**: la doc de fal (`fal-cdn`, `media-expiration`, `file-storage`) no publica un plazo por defecto; solo dice que es configurable con `X-Fal-Object-Lifecycle-Preference` o a nivel de cuenta. No importa aquí: `nano-banana/edit` lee `file_url` en el mismo `/compose`, segundos después del PUT, y el resultado de fal es una URL nueva (`images[0].url`) que la página descarga por `/compose-image`. Nada vuelve a leer el `file_url` de la foto original más tarde.
- **El reintento no duplica cobros**: el PUT solo escribe bytes en una URL firmada; el cobro ocurre al llamar a Kling, y eso ocurre una sola vez y solo si algún PUT dio `ok` (medido: 524+524 → 0 llamadas a Kling).
- **Llaves de `localStorage`, gate, service worker, i18n, branding**: sin cambios (la página no se tocó).

## Observaciones (no bloquean)

1. `worker.js:157` — todo 4xx del resultado se vuelve `failed` terminal, incluido un 429 (medido: `{status:'failed', error:'429: rate limited'}`). La página entonces borra `imageTask` y una imagen ya generada y **cobrada** se pierde. Es lo que el plan pidió y hoy es improbable (un usuario sondeando cada 5 s), pero si aparece un 429 real en producción, excluir 429 (y 408) de la rama terminal. Gravedad: baja.
2. `worker.js:80` y `:44` — cuando fal responde sin `detail`/`message`/`error` (p. ej. `{}`), el texto cae a `hfError` y dice literalmente «Higgsfield API error» en un fallo de fal. Solo confunde al que depura; cosmético.
3. `worker.js:157` — `/compose-image` con 4xx en el resultado responde 200 con JSON `{status:'failed'}`; la página lo tomaría como blob de imagen. Solo pasaría si el resultado fue OK en `/compose-status` y 4xx un instante después: prácticamente imposible. Cosmético.
4. Test de Tavo: no distingue el orden de `image_urls` (misma URL para todas las subidas), ni el `storage_type`, ni la espera de 1 s, ni que el 4xx no reintente (tabla de mutaciones arriba).

## Qué queda para la prueba viva ($0,04)

Publicar `61f6a50` con Wrangler y, desde la página real, «Crear escena» con 1 foto:
- ya no puede aparecer `image PUT failed (524)`; el fallo de hoy era de Higgsfield y `/compose` ya no la llama;
- si el filtro rechaza el prompt, la página debe mostrar `content_policy_violation: The content could not be processed…` (sin el prompt repetido) y ofrecer «Intentar de nuevo»; repetir con una descripción sin «descalza»;
- huella de versión: `POST /compose` con `FAL_KEY` real y una foto real devuelve `task_id` en < 5 s, sin pasar por Higgsfield (antes tardaba 43–68 s en fallar).

## Lecciones de esta vuelta

- **Un mock que devuelve siempre la misma URL no puede medir el orden.** Cuando el contrato es «N subidas → N URLs en orden», el mock debe devolver una URL distinta por llamada, o el test aprueba un `reverse()`.
- **Controlar el arnés antes de creer el fallo.** Mi primera pasada marcó como FALLO el caso D2 (`COMPLETED`+`error`): era mi propio arnés, que al interceptar `fetch` dejó de contar llamadas. Sospechar del instrumento antes que del código sigue siendo la regla correcta; esta vez costó un minuto y no una falsa alarma.
- **Al apagar un servidor, listar por PID y mirar el nombre y la hora de arranque de cada proceso antes de matar.** En el puerto 8799 convivían mi wrangler y dos wrappers huérfanos de otras sesiones con la misma línea de comando; un `pkill -f` por la cadena del comando habría matado los tres.
- **Los tests de reintento con `setTimeout` real cuestan 1 s por caso.** Aceptable hoy (2 casos); si crece, inyectar el `sleep` o mockear timers para que los tests no midan el reloj de pared.
