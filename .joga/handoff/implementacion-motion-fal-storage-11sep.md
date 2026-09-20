# Implementación — ronda motion-fal-storage-11sep

Base: `8b5437c` (aprobado, en producción como `35097a21`). Archivos tocados: `worker.js`, `tests/composer-worker.mjs`. Nada más — no toqué los `.md` de la ronda `motion-fal-escena-11sep` que aparecían modificados en el árbol al llegar (otra sesión en paralelo, per el plan).

## `worker.js`

- **A. `uploadToFal(file, falKey)`** (nueva, junto a `uploadImage`): `POST rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3` → `PUT upload_url` (sin `Authorization`, con `Content-Type` del archivo) → devuelve `file_url`. Copiado literal del snippet del plan.
- **B. `/compose`** usa `uploadToFal(file, env.FAL_KEY)` en vez de `uploadImage(file, authHeader)`. `uploadImage` (Higgsfield) queda intacta para `/generate`.
- **C. `falError(status, data)`** (nueva): si `data.detail` es array no vacío, `${first.type||status}: ${first.msg||'request rejected'}`; si no, cae a `hfError`. Aplicada en tres puntos: el error final de `/compose` tras llamar a `nano-banana/edit`; y en `/compose-status`/`/compose-image`, donde el `!rOk` de `falResult` ahora se bifurca por código — 4xx → `{status:'failed', error: falError(...)}` (terminal, sin reintento en la página), 5xx → `{error: falError(...)}` con 502 (transitorio, igual que antes). El chequeo de `falStatus` (el primer `!ok`, antes del `COMPLETED`) no lo tocué — el plan solo pedía el cambio en `falResult`.
- **D. Reintento único del PUT en `uploadImage`**: si el primer PUT falla con status ≥500 (incluye 524), espera 1 s (`setTimeout`) y reintenta una vez con el mismo `upload_url` firmado; si también falla, lanza el error de siempre. No pide nuevo presign, como dice el plan.
- **E.** No toqué `/status`, `/download`, `TASK_ID`, `IMAGE_TYPES`, `MAX_IMAGE_BYTES`, ni el prompt de `/compose`.

## `tests/composer-worker.mjs`

Reescrito siguiendo F: mocks nuevos para `rest.fal.ai/storage/upload/initiate` (verifica `Authorization: Key test-fal-key`) y su PUT (verifica que NO lleva `Authorization` y sí `Content-Type: image/jpeg`); `nano-banana/edit` ahora exige que `image_urls` traiga el `file_url` de fal, no el `public_url` de Higgsfield; assert explícito de que ninguna llamada en `/compose` toca `api.higgsfield.ai`. Casos nuevos: initiate 401 → 502 `fal upload-url 401: …`; PUT 500 → 502 `fal image PUT failed (500)`; resultado 422 con `detail` array `content_policy_violation` → `/compose-status` `{status:'failed', error:'content_policy_violation: …'}` con assert de que el prompt marcado (`DONOTLEAK`) no aparece en la respuesta; resultado 503 → 502 transitorio; `/generate` con PUT 524→200 → `task_id` (reintento exitoso) y PUT 524→524 → 502 `image PUT failed (524)`. Los conteos de llamadas por foto (3 para 1 foto, 5 para 2) no cambiaron porque el patrón initiate+PUT tiene el mismo número de llamadas que presign+PUT.

Nota: los dos casos de reintento de `/generate` disparan el `setTimeout` real de 1 s cada uno (~2 s extra de tiempo de ejecución del archivo) — es el costo de probar el retry literal del plan sin mockear timers.

## Verificado con comandos

- `node --check worker.js` → sin salida (sintaxis OK).
- `node tests/worker.mjs` → `PASS: provider outage preserves task, invalid duration and task IDs rejected`.
- `node tests/composer-worker.mjs` → `PASS: fal.ai storage upload for /compose, readable fal errors (content-policy and transient), and /generate PUT retry`.
- `git diff worker.js` revisado línea por línea contra el plan: A–D coinciden literal.
- No encontré `init.sh` en este repo (no existe en `joga-motion`, a diferencia de lo que describe el rol general de Tavo) — lo noto en vez de inventar un resultado.
- `tests/studio.cjs` no corre aquí: falta el módulo `playwright` en este entorno. No estaba en la lista de verificación del plan (que pide `node --check`, `worker.mjs`, `composer-worker.mjs`); no lo forcé.

## PENDIENTE DE MEDICIÓN (no puedo levantar servidores ni navegadores)

- **`wrangler dev` local con llaves falsas** (paso 3 del plan): `/compose` con 1 foto debería dar `502 fal upload-url 401: …` con la petición saliendo hacia `rest.fal.ai` y no hacia Higgsfield; `/generate` con 1 foto debería seguir dando `502 upload-url 401: Invalid credentials` hacia Higgsfield. Razonamiento: el código nuevo llama a `rest.fal.ai/storage/upload/initiate` con la key falsa antes que a nada de Higgsfield en `/compose`, así que el 401 debería llegar desde ahí; no lo ejecuté.
- **Producción con escena real ($0.04, ya autorizado por José)**: confirmar que `image PUT failed (524)` de Higgsfield ya no aparece en `/compose`, y que si el filtro de fal rechaza el prompt, la página muestra `content_policy_violation: …` y permite reintentar. Esto requiere publicar con Wrangler primero (fuera de mi alcance) y probar con la página real.
- No corrí nada contra APIs reales ni gasté crédito — todo lo de arriba fue con `fetch` simulado.

## Commit

Un commit local con `worker.js` y `tests/composer-worker.mjs` únicamente. No hice push ni deploy.
