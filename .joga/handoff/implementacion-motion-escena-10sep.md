# Implementación — ronda motion-escena-10sep

Base: `c55b94e`. Plan seguido: `.joga/handoff/plan-motion-escena-10sep.md` (secciones A–I).

## Archivos cambiados

### `worker.js` (solo ruta `/compose`, secciones A–C)
- **A.** `if (photos.length !== 1) return json({ error: 'one reference photo required' }, 400);` — reemplaza el rango 1–8.
- **B.** Se borró el bucle `inputImages` y la llamada a `/nano-banana`; ahora sube la única foto con `uploadImage(photos[0], authHeader)` y llama a `POST /higgsfield-ai/soul/reference` con `image_reference_url`, `aspect_ratio`, `resolution:'720p'`, `batch_size:1`, tal como especifica el plan (código copiado literal).
- **C.** Comentario de cabecera de la ruta actualizado a una línea («One reference photo -> one new scene...»). Nada más tocado: `/generate`, `/status`, `/download`, `/compose-status`, `/compose-image` intactos (ya leían `data.images?.[0]?.url` y los estados terminales, confirmado por lectura directa, no hizo falta cambiarlos).

### `studio.js`
- **Estado (D):** `studio.mode='motion'`, más `imageTask`, `imageReady`, `imageUrl`, `sceneBlob`. `resetGeneration()` ahora también revoca el `imageUrl` (object URL), limpia esos cuatro campos y quita el `src` de `#scene`.
- **Modo (E):** contenedor `#modes` se puebla en `render()` con dos botones (`modeMotion`/`modeScene`) que fijan `studio.mode`, llaman `resetGeneration()` y re-renderizan. Botón activo recibe clase `on`. `referenceHint` y `cost` se recalculan cada render mutando `TEXT[language]` con `hintMotion/hintScene` y `costMotion/costScene` antes del bucle genérico de `data-copy` (no se tocó el HTML de esos dos elementos, siguen usando `data-copy="referenceHint"`/`"cost"` sin cambios). `placeholder` del textarea usa `placeholderScene` en modo escena. Ejemplos (`#examples`) cambian de array según el modo, con los tres ejemplos de escena del plan (traducción EN propia, no estaba en el plan literal). Botón `create` y visibilidad/disable de `#again` implementados como en E.
- **Flujo (F):** `createVideo()` se dividió en `createScene()` (POST `/compose` con `images`, `prompt`, `aspect_ratio='16:9'` → sondeo `/compose-status` → `GET /compose-image` → valida tipo/tamaño del blob → `sceneBlob`/`imageUrl`/`imageReady`/`message='sceneReady'`) y `animate()` (FormData `image` = blob de escena empaquetado en `File` si modo escena, si no la foto; `/generate` → `/status` → video, igual que antes). Catch de cada función es el mismo de cinco ramas aprobado en `c18d0ab`, con la única variable que cambia entre ellas: `imageTask`/`imageReady` en `createScene()`, `videoTask` en `animate()` — exactamente lo que pide el plan.
- **Textos (G):** las 12 llaves pedidas están en `TEXT.es` y `TEXT.en`, sin huecos (paridad verificada por script, 47/47 llaves en ambos idiomas).

### `creator.html`
- `<div id="modes" class="examples"></div>` insertado justo encima del bloque de descripción (después del `<p class="hint">`, antes del `<label>` de la sección 02).
- `<img id="scene" hidden alt="">` agregado junto al `<video>` dentro de `.preview-screen`.
- `<button id="again" type="button" hidden data-copy="otherScene"></button>` agregado junto a `#download`.
- Nada más tocado en el diseño.

### `studio.css` (solo I)
- `.preview video{...}` se convirtió en selector combinado `.preview video,#scene{...}` — mismas cuatro propiedades exactas, sin valores nuevos.
- `#modes button.on{border-color:var(--accent);background:#f0eafb;color:var(--accent)}` — reutiliza los dos colores que ya usa `.upload:hover,.upload.drag` para el estado "activo"; ningún color ni tamaño nuevo.
- Los `@media` de `bb683e9` no se tocaron. Los botones de `#modes` heredan `.examples button{...;min-height:44px;...}` del `@media(max-width:480px)` ya existente, sin CSS nuevo para eso.

### `tests/composer-worker.mjs`
- Mock adaptado al contrato `soul/reference`: intercepta `/higgsfield-ai/soul/reference` en vez de `/nano-banana`, valida `image_reference_url`, `prompt`, `aspect_ratio`, `resolution`, `batch_size`. Casos: 0 fotos → 400, 2 fotos → 400, 1 foto → 200 con `task_id`. El resto del archivo (compose-status, compose-image, outage, path traversal) se conservó igual, solo se agregó el caso de 2 fotos.

## Desviación del plan (anotada, no corregida por mi cuenta)

El plan no especifica qué hace `animate()` con `studio.videoUrl` preexistente al pulsar "Crear otra versión" en modo escena. Si `animate()` llamara a `resetGeneration()` completo (como hacía la vieja `createVideo()` con `if(studio.videoUrl)resetGeneration()`), se borraría también `imageReady`/`imageUrl`/`sceneBlob` — perdiendo la escena que el usuario ya pagó y quiere volver a animar. Implementé en su lugar un limpiado en línea dentro de `animate()` que solo resetea `videoTask`/`videoUrl`/`uncertain` y el `<video>`/`#download`, sin tocar el estado de la escena. `resetGeneration()` (la función completa, con el borrado de escena) queda reservada para cambios de modo, foto, descripción y el botón "Otra escena", tal como pide D y el punto 6 de verificación. Lo marco aquí para que Nico lo revise con ojo crítico: es la única parte donde el código no reutiliza literalmente una función existente sino que reimplementa un subconjunto de su lógica.

## Verificación

- `node --check worker.js studio.js` → sin errores de sintaxis.
- `node tests/worker.mjs` → PASS.
- `node tests/composer-worker.mjs` (adaptado) → PASS: 1 foto → 200, 2 fotos → 400, 0 fotos → 400, compose-status/compose-image, outage, path traversal.
- Paridad de llaves i18n ES/EN: 47/47, sin huecos (script ad hoc, no queda en el repo).
- Balance de llaves `{}` en `studio.css`: 117/117.
- Todos los `id` que `studio.js` referencia con `$()` existen en `creator.html` (`modes`, `scene`, `again`, más los quince ya existentes) — verificado con `grep`.
- `git diff --stat` confirma que solo se tocaron los cinco archivos permitidos.

## Pendiente de medición (no lo puedo comprobar yo — Tavo no levanta servidores ni navegadores)

1. **Diseño / punto 2 del plan**: que las 18 cajas de `c55b94e` sigan iguales salvo `#modes` y `#scene`; que a 320/375/430px no haya desborde; que los botones de `#modes` midan ≥44px de alto en móvil. Mi expectativa: deberían cumplirse, porque `#modes` reutiliza literalmente la clase `.examples` (mismo padding, mismo `min-height:44px` en el `@media(max-width:480px)` ya aprobado) y no agregué ningún ancho ni margen nuevo. Pero esto se mide viendo la pantalla, no leyendo el CSS.
2. **Punto 3**: que el modo "Animar mi foto" sea comportamiento idéntico a hoy. Por código, `animate()` en modo motion es funcionalmente igual a la vieja `createVideo()` (mismo orden de FormData, misma validación, mismo catch) — pero solo un run real en navegador confirma que no hay una diferencia de timing o de estado inicial que se me haya escapado.
3. **Punto 4**: el flujo completo con Worker simulado (compose → compose-status → compose-image → aparece la imagen → "Animar esta escena" → un solo `/generate`; "Otra escena" → nuevo `/compose` sin `/generate`). Lo verifiqué a nivel de lógica de código y con el mock de Node en `composer-worker.mjs` (que cubre el Worker, no el cliente `studio.js`). El flujo del lado del navegador (clicks reales, estados de `render()`, que `#scene` efectivamente se vea) no lo corrí — no hay equivalente de `tests/studio.cjs` actualizado para este modo nuevo, y `tests/studio.cjs` (Playwright) quedó desactualizado desde antes de esta ronda (prueba el flujo viejo de 8 fotos) y no estaba en mi lista de archivos permitidos ni en el "Cómo se comprueba" del plan, así que no lo toqué.
4. **Punto 6**: que cambiar de modo, foto o descripción limpie escena y video. Por código sí ocurre (todos esos handlers llaman `resetGeneration()`, que ahora limpia ambos) — pendiente de confirmar visualmente que `#scene` y `#video` en verdad desaparecen de pantalla.
5. **Punto 7 (producción)**: no aplica a esta ronda — no hice push ni pegué el Worker en Cloudflare, no hubo llamadas reales a Higgsfield ni gasto.

## No tocado
`index.html`, `style.css`, `i18n.js`, portada — sin cambios, como exige la instrucción. `tests/studio.cjs` no se tocó (fuera de alcance, ya desactualizado desde antes). Archivos de otra sesión (`.joga/handoff/investigacion-falai-10sep.md`, `plan-motion-escena-10sep.md`, `sonda-modelos-worker-v2.js`) no se agregaron al commit.
