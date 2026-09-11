# Plan — Joga Motion, ronda motion-niveles-10sep: Básico / Intermedio / Avanzado

Base: la ronda `motion-fal-escena-11sep` aprobada y publicada (commit a fijar por Kimo al lanzar; no construir antes). Decisión de José (10-sep): tres niveles de calidad **por modelo, no por proveedor**; el cliente nunca ve el proveedor; OpenArt fuera del Worker.

## Por qué solo Kling en esta ronda (medido)

`openapi.json` oficial (10-sep): `kling-video/v2.5-turbo/standard/image-to-video`, `kling-video/v2.1/standard/image-to-video` y `kling-video/v2.1/pro/image-to-video` tienen **exactamente el mismo contrato** que ya usa `/generate`: required `prompt` + `image_url`; `duration` entero enum **[5, 10]**; opcionales `cfg_scale` (0–1, default 0,5) y `negative_prompt`. En cambio `minimax/hailuo-2.3/standard` usa `duration` **[6, 10]**, `wan-25-preview` exige `resolution`, y `higgsfield-ai/dop/standard` tiene otra forma (`motions`, `end_image_url`). Meterlos obligaría a ramificar el contrato; se dejan para después. Precios medidos con la llave de José (sondas v1/v2, `/estimate`, 5 s):

| Nivel | Modelo | Créditos | USD |
|---|---|---|---|
| Básico | `kling-video/v2.5-turbo/standard/image-to-video` | 3,36 | $0,21 |
| Intermedio | `kling-video/v2.1/standard/image-to-video` | 4,48 | $0,28 |
| Avanzado | `kling-video/v2.1/pro/image-to-video` | 7,84 | $0,49 |

Nivel por defecto: **Intermedio** (confirmado por José el 11-sep).

## `worker.js` — solo `/generate`

**A.** Sustituir la constante `MODEL` por una tabla:
```js
const VIDEO_MODELS = {
  basico:     'kling-video/v2.5-turbo/standard/image-to-video',
  intermedio: 'kling-video/v2.1/standard/image-to-video',
  avanzado:   'kling-video/v2.1/pro/image-to-video',
};
```
**B.** En `/generate`, leer `quality` del multipart: `const quality = String(form.get('quality') || 'intermedio'); if (!(quality in VIDEO_MODELS)) return json({ error: 'quality must be basico, intermedio or avanzado' }, 400);` y usar `${HF_BASE}/${VIDEO_MODELS[quality]}` en el `fetch`. El cuerpo enviado a Higgsfield no cambia (`prompt`, `image_url`, `duration`).
**C.** Nada más: `/status`, `/download`, `/compose*` intactos. `tests/worker.mjs`: añadir un caso `quality=otro` → 400 y uno por nivel que compruebe la ruta pedida al `fetch` simulado.

## `studio.js`

**D.** Estado `studio.quality = 'intermedio'`. Cambiarlo NO invalida la escena (la imagen sirve para cualquier nivel); sí invalida el video (`videoTask`/`videoUrl` a null, como hace «Crear otra versión»).
**E.** Selector `#quality` con tres botones (mismo estilo que `#modes`, clase `on` en el activo) y, debajo de cada nombre, el precio en créditos del cliente — **pendiente de José**: los precios al cliente aún no existen; en esta ronda se muestra solo el nombre del nivel y una línea `qualityHint` («Básico: rápido y económico · Intermedio: equilibrado · Avanzado: máxima calidad»). Nada de USD en pantalla.
**F.** `animate()` añade `form.append('quality', studio.quality)`.
**G.** Textos ES/EN: `quality` («Nivel de calidad» / «Quality level»), `qBasico` («Básico» / «Basic»), `qIntermedio` («Intermedio» / «Intermediate»), `qAvanzado` («Avanzado» / «Advanced»), `qualityHint` (arriba). `spec` pasa a «Video de 5 s · Horizontal · {nivel}».

## `creator.html`
**H.** `<div id="quality" class="examples"></div>` debajo de `#modes`, con su etiqueta `data-copy="quality"`. Nada más.

## `studio.css`
**I.** Nada, salvo que `#quality button.on` necesite la misma regla que `#modes button.on` (entonces: ampliar ese selector, no duplicar).

## Cómo se comprueba (Nico)
1. `node --check`; `node tests/worker.mjs` con los casos nuevos.
2. Con Worker simulado: cada nivel manda `quality` correcto en `POST /generate`; el Worker simulado registra la ruta de Higgsfield por nivel; `quality` inválido → 400 visible con motivo.
3. Cambiar de nivel tras un video limpia el video y deja la escena; cambiar antes de generar no dispara nada.
4. Diseño: mismas cajas + `#quality`; 320/375/430 sin desbordes; botones ≥ 44 px en móvil; ES/EN sin huecos.
5. Producción (autoriza José): la misma escena/foto animada en los **tres** niveles (~$0,98 en total) y comparar a ojo antes de fijar los nombres al público — es el control de que «más caro = mejor» para este tipo de escenas.

## Publicación
Push (estáticos) + pegar `worker.js` en Cloudflare (cambió `/generate`).

## Fuera de esta ronda (siguientes)
- **Tope de gasto en el Worker** (obligatorio antes de cobrar): contador diario en KV/Durable Object + límite por IP; hoy `/generate` y `/compose` están abiertos a cualquiera que conozca la URL.
- **8 fotos vía fal.ai** (`nano-banana/edit`): depende de la sonda FAL (`.joga/handoff/sonda-fal-worker.js`).
- Hailuo / Wan / DoP como niveles extra, cada uno con su contrato.
