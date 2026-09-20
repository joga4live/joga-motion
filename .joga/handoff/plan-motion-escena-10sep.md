# Plan — Joga Motion, ronda motion-escena-10sep: «Crear una escena» con una foto de referencia

Base: `c55b94e` (video directo aprobado + portada + móvil). Decisión de José (10-sep): el producto vendible es *verse en una historia que no existía*, no mover una foto. Medido con su llave (sondas v1/v2): el único modelo de imagen con referencia disponible es **`higgsfield-ai/soul/reference`** (1 foto → escena nueva, 1,5 cr / $0,094). No hay multi-referencia en Higgsfield (eso va por fal.ai, en investigación de Sol; no es esta ronda).

## Qué se construye

En el creador (diseño intacto) aparece una elección de **modo**, con dos opciones:
- **Animar mi foto** — lo de hoy: la foto va directo a Kling.
- **Crear una escena** — nuevo: la persona/objeto de la foto se coloca en la escena que el usuario describe. Dos pasos con costo visible: primero se **fabrica la escena** ($0,09, rápido) y se muestra en el panel de vista previa; el usuario decide **«Animar esta escena»** ($0,49) u **«Otra escena»** (vuelve a fabricar). Así nadie paga el video sin ver antes la imagen.

Una sola foto, como hoy. El paso de imagen NO se dispara solo.

## Contrato Higgsfield (del `openapi.json`, verificado 10-sep)

`POST https://api.higgsfield.ai/higgsfield-ai/soul/reference` — required `prompt`, `image_reference_url` (uri pública, la `public_url` de la subida firmada). Opcionales: `aspect_ratio` enum `9:16|16:9|4:3|3:4|1:1|2:3|3:2` (default 4:3 → usar **`16:9`**), `resolution` `720p|1080p` (usar **`720p`**), `batch_size` 1|4 (**1**), `enhance_prompt` (default true, dejar), `style_strength`, `seed`. Respuesta y `GET /requests/{id}/status`: `status` enum `queued|in_progress|nsfw|failed|completed|canceled`, `images[].url`, `error`. → **`/compose-status` y `/compose-image` del Worker ya leen `data.images?.[0]?.url` y los estados terminales: no cambian.**

## `worker.js` — solo la ruta `/compose` (líneas ~67-100)

**A.** Exactamente **una** foto: `if (photos.length !== 1) return json({ error: 'one reference photo required' }, 400);` (sustituye la comprobación 1–8).
**B.** Sustituir la llamada a `/nano-banana` por:
```js
        const imageUrl = await uploadImage(photos[0], authHeader);
        const result = await fetch(`${HF_BASE}/higgsfield-ai/soul/reference`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
          body: JSON.stringify({
            prompt: 'Photorealistic cinematic scene, natural light, composed as the opening frame of a video. '
              + 'The person or subject from the reference image appears in the scene, recognizable, with natural anatomy. '
              + 'Scene: ' + prompt,
            image_reference_url: imageUrl, aspect_ratio: aspect, resolution: '720p', batch_size: 1,
          }),
        });
```
(`aspect` sigue validándose contra `16:9|9:16|1:1`; el cliente manda `16:9`.) Borrar `inputImages` y el bucle. El resto de la ruta (`readJson`, `request_id`, `hfError`, 502) igual. Actualizar el comentario de cabecera de la ruta (una línea).
**C.** Nada más en `worker.js`. `/generate`, `/status`, `/download`, `/compose-status`, `/compose-image` intactos.

## `studio.js`

**D. Estado.** `studio.mode = 'motion'` (o `'scene'`), `studio.imageTask`, `studio.imageReady`, `studio.imageUrl` (la URL del Worker `/compose-image?task_id=…` para mostrarla), `studio.sceneBlob` (la imagen bajada, para mandarla a `/generate`). `resetGeneration()` los limpia y quita el `src` del `<img>` de escena.

**E. Modo.** Contenedor `#modes` (ver H) con dos botones que ponen `studio.mode` y llaman `resetGeneration(); render();`. En `render()`: botón activo con clase `on`; textos que dependen del modo:
- `referenceHint`: motion → «Describe el movimiento que quieres ver en esta imagen.» / scene → «Describe la escena: dónde está, qué hace, con qué luz. La persona de la foto aparecerá en ella.»
- `placeholder`: scene → «Por ejemplo: a caballo por una pradera al atardecer, sonriendo a la cámara.»
- `cost`: motion → «Cada creación usa una generación de video.» / scene → «Crear la escena usa una generación de imagen; animarla, una de video.»
- `samples`: scene → [«A caballo», «…a caballo por una pradera dorada al atardecer, sonriendo a la cámara»], [«En el espacio», «…dentro de una nave espacial mirando la Tierra por la ventana»], [«Bajo la lluvia», «…caminando de noche por una calle de Tokio con luces de neón y lluvia suave»]. (EN equivalentes.)
- Botón principal (`create`) en modo scene: sin escena → «Crear escena»; con escena lista y sin video → «Animar esta escena»; con video → «Crear otra versión». Botón secundario `#again` («Otra escena») visible solo en modo scene con escena lista y sin video: `resetGeneration()` **salvo** las fotos y el prompt, y vuelve a crear la escena.
- Vista previa: en modo scene, cuando `studio.imageUrl` existe y no hay video, `<img id="scene">` visible en el panel de vista previa (mismo lugar que el video); con video, el video como hoy.

**F. Flujo `createVideo()`** — se divide en dos funciones con el mismo `try/catch` de D4 (el `catch` aprobado en `c18d0ab`, con `submitting` y `e.rejected`):
- `createScene()`: `stage='image'`; si no hay `imageTask`: `FormData` con `images` (la foto), `prompt`, `aspect_ratio='16:9'` → `POST /compose` → `imageTask`; luego `status('/compose-status', imageTask)` (misma `status()` tolerante); al completar: `GET /compose-image?task_id=` → `blob` (validar tipo/tamaño como hacía Codex) → `studio.sceneBlob = blob`, `studio.imageUrl = URL.createObjectURL(blob)`, `imageReady=true`, `message='sceneReady'`.
- `animate()`: `stage='video'`; `FormData` con `image` = modo scene ? `new File([sceneBlob],'scene.jpg',{type: sceneBlob.type})` : la foto; `prompt`, `duration='5'` → `/generate` → `status('/status')` → video, como hoy.
- El botón `create` llama a: motion → `animate()`; scene sin escena → `createScene()`; scene con escena → `animate()`.
- En `catch`, la rama `terminal` en `stage==='image'` limpia `imageTask/imageReady`; en `stage==='video'` limpia `videoTask`.

**G. Textos nuevos ES/EN** (todos en `TEXT`, sin huecos): `modeMotion` «Animar mi foto»/«Animate my photo», `modeScene` «Crear una escena»/«Create a scene», `createScene` «Crear escena»/«Create scene», `animateScene` «Animar esta escena»/«Animate this scene», `otherScene` «Otra escena»/«Another scene», `sceneReady` «Tu escena está lista. ¿La animamos?»/«Your scene is ready. Animate it?», `composing` «Creando tu escena…»/«Creating your scene…», `costMotion`, `costScene`, `hintMotion`, `hintScene`, `placeholderScene`.

## `creator.html`

**H.** Añadir, justo encima del bloque de descripción, `<div id="modes" class="examples"></div>` (reutiliza el estilo de los botones de ejemplo: **sin CSS nuevo** salvo lo de I). En el panel de vista previa, junto al `<video>`, `<img id="scene" hidden alt="">` con las mismas clases/tamaño que el video. Y `<button id="again" type="button" hidden data-copy="otherScene"></button>` junto a Descargar. **Nada más cambia en el diseño.**

## `studio.css`

**I.** Solo lo mínimo: `#modes button.on` con el mismo aspecto que un botón activo ya existente (color del tema); `#scene` con las mismas reglas que el `<video>` (ancho 100 %, radio, fondo). Nada de tamaños nuevos ni colores nuevos. Los `@media` de móvil de `bb683e9` no se tocan.

## Corrección tras la revisión de Nico (`revision-motion-escena-10sep.md`, CAMBIOS)

**J. Guardián de cargo en «Otra escena» (crítico, `studio.js:78`).** `resetGeneration()` apagaba `studio.uncertain` antes de que `createScene()` preguntara. El manejador debe preguntar PRIMERO:
```js
$('again').onclick=()=>{if(studio.uncertain&&!window.confirm(t('uncertain')))return;resetGeneration();createScene();};
```
(`createScene()` no vuelve a preguntar porque `uncertain` ya quedó en `false` tras el reset.)

**K. Estilo de `#again` (alto, `creator.html:43`).** El botón debe verse exactamente como «Descargar video»: darle en `creator.html` **las mismas clases** que `#download`. Si por ser `<button>` (y no `<a>`) el navegador aún le pone `appearance`/borde/fuente propios, añadir en `studio.css` una sola regla `#again{appearance:none;font:inherit;cursor:pointer}` — nada más. Objetivo medible: mismo alto (≥ 44 px), radio, tamaño de letra y colores que `#download`.

**L. «Continuar escena» (de la lista aparte de Nico, barato y coherente).** En `render()`, cuando `studio.stage==='image'` y hay `imageTask` sin `imageReady`, el botón principal dice `resumeScene` («Continuar escena» / «Continue scene»); pulsarlo llama a `createScene()`, que ya reanuda sin reenviar porque comprueba `if(!studio.imageTask)`. Y el texto `waiting` pasa a ser genérico en ES/EN: «La consulta se interrumpió. Pulsa Continuar para consultar el mismo trabajo sin enviarlo otra vez.» / «The status check was interrupted. Press Continue to check the same job without submitting it again.» Añadir la clave `resumeScene` en ambos idiomas.

## Cómo se comprueba (Nico)
1. `node --check worker.js studio.js`; `node tests/worker.mjs`; `node tests/composer-worker.mjs` (adaptar el mock a `soul/reference`: 1 foto → 200; 2 fotos → 400).
2. Diseño: mismas 18 cajas de `c55b94e` salvo el bloque `#modes` nuevo y el `<img>`; móvil 320/375/430 sin desbordes; los botones de modo ≥ 44 px de alto en móvil.
3. Modo «Animar mi foto» = comportamiento idéntico a hoy (una sola `POST /generate`).
4. Modo «Crear una escena», Worker simulado: `POST /compose` una vez con `images` (1 archivo), `prompt`, `aspect_ratio=16:9`; sondeo `/compose-status`; `GET /compose-image`; la imagen aparece en la vista previa; el botón dice «Animar esta escena»; **no** hay `POST /generate` hasta pulsarlo; «Otra escena» → nuevo `/compose` sin `/generate`. Al animar: una `POST /generate` con `image` = el blob de la escena.
5. Errores: 502 `{"error":"404: model_not_found"}` en `/compose` → motivo visible, sin alarma de cargo; `nsfw` en `/compose-status` → «El proveedor no pudo… (nsfw)», se puede reintentar; 12 fallos de sondeo → `waiting` con `imageTask` conservado.
6. Cambiar de modo limpia escena y video; cambiar foto o descripción también.
7. Producción, tras Push + pegar Worker: José autoriza **una** escena ($0,09) y **un** video ($0,49) con su foto.

## Publicación
Push origin (estáticos) **y** pegar `worker.js` en Cloudflare (cambió `/compose`). Secretos intactos.
