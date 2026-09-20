# Implementación — ronda motion-10sep: video directo (diseño intacto)

Base: `45538fa`. Fuente: `.joga/handoff/plan-motion-10sep-video-directo.md`. Sin `AGENTS.md` ni `init.sh`
en este repo aparte (`joga-motion`) — se siguió el prompt de Kimo MD como fuente de verdad de la ronda.

## Archivos cambiados

### `studio.js`
- **A.** `studio` (línea 2): quitados `imageTask`, `imageReady`; añadido `detail`.
- **B.** `addPhotos` (línea 27): tope de 1 imagen; si ya hay foto, la nueva la reemplaza (revoca la URL
  anterior) en vez de dar error `limit`. `render()`: `photoCount` → `N / 1`; `upload.disabled=studio.busy`.
- **C.** `createVideo()` reescrito literal según el plan: sin `/compose`, `/compose-status`,
  `/compose-image`; va directo a `/generate` (Kling) con `image`, `prompt`, `duration=5`.
  `resetGeneration()`: quitados `imageTask`/`imageReady`; añadido `studio.detail=''`.
- **D.** `request()` lee el cuerpo del error (`res.clone().json()`) y lo guarda en `e.detail`;
  `outdated` solo si 404 sin `detail`. `status()`, en fallo terminal, guarda `e.detail=String(data.error||'')`.
  `render()`: `$('message').textContent` ahora concatena `t(message)` + `' ('+detail+')'` cuando hay detalle.
- **D2.** `status()` reescrito: tolera hasta 12 fallos transitorios seguidos (1 min, reintento cada 5 s)
  antes de rendirse; un 4xx (`rejected`/`outdated`) sí aborta de inmediato. El `task_id` nunca se pierde
  en ese camino.
- **D3.** `resetGeneration()` limpia también `studio.message` y `studio.detail` (ya no queda texto de
  aviso huérfano al escribir un carácter).
- **E.** Textos ES/EN actualizados: `formats`, `photos`, `upload`, `referenceHint`, `cost`, `placeholder`,
  `samples` (ahora 3 ejemplos de movimiento de cámara sobre una imagen). Eliminadas las claves `limit` y
  `composing` (ya no se usan en ningún branch).

### `creator.html`
- **F.** `<input id="photos">` perdió el atributo `multiple`. No había texto fijo «Hasta 8 imágenes»
  fuera de `data-copy` (el contador `#photoCount` se pinta por JS en `render()` al cargar). No se tocó
  nada de diseño: mismas clases, misma estructura, mismos colores.

### `worker.js`
- **G.** Sin cambios, como pedía el plan. `/generate`, `/status`, `/download` verificados por lectura:
  existen y su contrato (multipart `image`+`prompt`+`duration`, `?task_id=`) coincide con lo que ahora
  manda `studio.js`.

### `tests/`
- **H. No se tocó `tests/studio.cjs`.** Playwright no está instalado en este Mac
  (`node -e "require.resolve('playwright')"` → `Cannot find module 'playwright'`, mismo hallazgo que
  Nico documentó ayer). Editar el test a ciegas sin poder correrlo iba contra la instrucción de mínimos
  cambios verificables, así que quedó igual y aquí anoto qué casos hay que reescribir cuando haya
  Playwright:
  - Rutas simuladas: quitar `/compose`, `/compose-status`, `/compose-image`; dejar solo `/generate`
    (revisar `image`+`prompt`+`duration` en el multipart) y `/status`.
  - `setInputFiles('#photos', ...)` con 9 fotos y la aserción de "Puedes añadir hasta 8 imágenes." ya no
    aplican — el input dejó de ser `multiple`; el caso nuevo es: subir 1 foto → "1 / 1"; subir otra →
    reemplaza sin mensaje de error.
  - El caso del 502 a mitad del sondeo (línea 12 y 21 del test actual) cambia de intención: con D2, un
    solo 502 ya **no** interrumpe nada — el test debe simular ~12 fallos seguidos para llegar al mensaje
    de reanudación, o 1-3 fallos seguidos de éxito para comprobar que el sondeo se recupera solo.
  - `images`/`videos` contadores: ya no hay `images` (no se llama `/compose`), solo `videos`.
  - `tests/worker.mjs` y `tests/composer-worker.mjs` no se tocaron (regla explícita del encargo).

## Verificado con comandos
- `node --check studio.js` → sin errores de sintaxis.
- `node tests/worker.mjs` → **PASA** (`provider outage preserves task, invalid duration and task IDs rejected`).
- `grep` de confirmación: 0 referencias a `imageTask`, `imageReady`, `compose`, `'limit'`, `composing` en
  `studio.js`; 0 referencias a `multiple` o a un texto fijo "Hasta 8"/"Up to 8" en `creator.html`.
- `git diff --stat`: solo `creator.html` (+1/-1) y `studio.js` (+19/-21) tocados; `worker.js`, `studio.css`,
  `style.css`, `index.html`, `i18n.js` y el PNG intactos.
- i18n: mismas 35 llaves en `es` y `en` tras quitar `limit`/`composing` de ambos diccionarios a la vez
  (revisado por lectura línea por línea, ambos bloques mantienen la misma lista de claves).

## PENDIENTE DE MEDICIÓN (Nico / Kimo MD — yo no levanto servidor ni navegador)
Los puntos 2–6 de "Cómo se comprueba" del plan necesitan un navegador real:
1. Servir `creator.html` con un Worker simulado, subir 1 imagen → miniatura "1 / 1"; subir otra → la
   reemplaza sin error; "Crear video" se habilita con descripción. **Esperado: sí**, por lectura de
   `addPhotos`/`render()`.
2. Clic en "Crear video" con Worker simulado `{"task_id":"abc"}` → en Red debe verse **una sola**
   `POST /generate` (campos `image`, `prompt`, `duration=5`), luego `/status?task_id=abc` cada 5 s;
   con `{"status":"completed","video_url":…}` aparece el video y "Descargar" con `target=_blank`.
   **Esperado: sí**, el código es literal al del plan.
3. Worker simulado `502 {"error":"404: model_not_found"}` → mensaje visible debe ser
   "No se pudo completar la solicitud. (404: model_not_found)", nunca la frase de posible cargo.
   **Esperado: sí** — verificado por lectura: `e.detail='404: model_not_found'` (no vacío) →
   `outdated=false`, cae en la rama `else if(e.detail)` → `message='error'`, nunca `uncertain`.
4. Worker simulado `{"status":"failed","error":"nsfw"}` → "El proveedor no pudo completar…(nsfw)".
   **Esperado: sí**, confirmado por lectura de `status()`/`createVideo()` arriba.
5. ES/EN sin desbordes a 390 px, consola limpia. No lo puedo medir sin navegador.

## Desviación de plan a reportar (no la corregí sola)
En **D2 + C combinados**, cuando `status()` se rinde tras 12 fallos transitorios seguidos, lanza
`w` con `w.detail=e.detail||''`. Pero `worker.js:hfError()` **siempre** produce un `error` no vacío
(cae a `'Higgsfield API error'` si no hay nada mejor) para cualquier 502. Eso significa que `e.detail`
casi nunca está vacío, así que en `createVideo()` el `catch` **nunca llega** a la rama
`else studio.message=studio.videoTask?'waiting':'error'` (la del texto "La consulta se interrumpió...
Continuar video") — siempre cae antes en `else if(e.detail){studio.message='error';...}`. El plan
prosa dice "solo tras 12 fallos seguidos... se cae en waiting", pero su propio código literal (que
implementé tal cual, sin alterarlo) no produce ese resultado con el `worker.js` real.
**Efecto práctico:** no es un defecto funcional — `studio.videoTask` se conserva igual en ambas ramas,
así que el botón sigue mostrando "Continuar video" y "Continuar" sigue sin reenviar el trabajo (eso es
lo que de verdad protege contra el doble cobro). Lo único que cambia es el texto mostrado: en vez de
"La consulta se interrumpió..." se vería algo como "No se pudo completar la solicitud. (503: ...)".
Lo dejo tal cual pide el plan (no inventé un arreglo) y lo marco para que Kimo MD decida si el texto
distinto es aceptable o si quiere que `status()` fuerce `message='waiting'` explícitamente al rendirse
por fallos transitorios.

## Reglas de oro
- No existen `gate.js` ni service worker en este repo — no aplican.
- i18n: toggle y diccionarios ES/EN se mantienen funcionando (por lectura); mismas llaves en ambos.
- Branding: `index.html`, `style.css`, el logo y el PNG no se tocaron.

## Commit
Un solo commit local, sin push ni deploy. Hash: ver `git log -1` tras esta nota (se añade abajo por
Kimo MD/Nico si hace falta referenciarlo).

## Segunda vuelta — D4 (corrección de Nico, `revision-motion-10sep-video-directo.md`)
- `studio.js:39-45`: sustituido el bloque `catch` de `createVideo()` por el de D4 del plan — restaura el
  guardián `!e.rejected` en la rama `uncertain` y añade la rama `waiting` (fallos transitorios de sondeo)
  antes de la rama `e.detail`. Único archivo tocado; `node --check studio.js` OK; `git diff` muestra solo
  ese bloque (+2/-1 líneas). Hash de este commit: ver `git log -1 --format=%H` (un commit no puede
  contener su propio hash final; se lo doy a Kimo MD en el reporte de esta ronda).
