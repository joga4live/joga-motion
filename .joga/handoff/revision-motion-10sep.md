# Revisión — ronda motion-10sep (Nico)

Rango auditado: `git diff 588299f 45538fa` (commits `11545dd`, `353a23a`, `8aa2c87`, `117d88f`, `45538fa`).
Fecha: 10 de septiembre de 2026. Auditoría en solo lectura. No se gastó ni una generación de Higgsfield.

---

## Veredicto: **CAMBIOS**

El flujo nuevo está bien cableado — lo probé de punta a punta en Chrome contra un Worker simulado y
llega al video. Pero **la premisa de esta ronda es falsa** y hay tres defectos que, juntos, producen
exactamente lo que reporta José: "no genera videos", sin explicación.

---

## 0. CRÍTICO — la premisa del plan está equivocada: el Worker nuevo YA está desplegado

El encargo dice que el Worker en Cloudflare sigue siendo el de anoche, sin `/compose`, y que la
página falla con 404 en su primera petición. **Lo medí y no es así.** Probé el endpoint en vivo:

```
POST /compose        (8 partes, tipo no-imagen)  -> 400 {"error":"each photo must be JPEG, PNG or WebP, between 1 byte and 10MB"}
POST /generate       (duration=7)                -> 400 {"error":"duration must be 5 or 10"}
GET  /compose-status?task_id=abc                 -> 502 {"error":"404: Not Found"}
GET  /status?task_id=abc                         -> 502 {"error":"404: Not Found"}
GET  /nope                                       -> 404 {"error":"Not found"}
```

Las tres primeras respuestas **solo existen en el `worker.js` de hoy** (`worker.js:80`, `worker.js:128`,
`worker.js:155`). El Worker desplegado es el código nuevo. GitHub Pages también está al día:
`https://joga4live.github.io/joga-motion/creator.html` devuelve 3290 bytes y carga `studio.js` +
`studio.css` — idéntico al archivo local.

**Prueba de control de credenciales:** una llamada sin llave a `https://api.higgsfield.ai/requests/<uuid>/status`
devuelve `401 {"detail":"Invalid credentials"}`. El Worker desplegado, con el mismo id inexistente,
devuelve `404: Not found`. Es decir: **las credenciales del Worker son válidas y sí llegan a Higgsfield.**

**Consecuencia:** pegar el Worker en Cloudflare no cambiaría nada. La causa real de "no genera videos"
es otra, y los defectos 1 y 2 son justamente los que impiden verla.

---

## Defectos bloqueantes

### B1 — CRÍTICO. El cliente tira el cuerpo de la respuesta: el error real nunca se ve
`studio.js:28`

```js
async function request(path,options){const res=await fetch(WORKER+path,{...options,signal:AbortSignal.timeout(120000)});if(!res.ok){const e=new Error('Request failed');…throw e;}return res;}
```

El Worker se toma el trabajo de construir un mensaje útil (`hfError()`, `worker.js:29-32`) y lo manda
en `{"error": "..."}`. `request()` **nunca lee ese cuerpo**. Lanza un `Error('Request failed')` genérico.
Ni el usuario ni la consola ven jamás el motivo.

**Medido.** Simulé la respuesta que daría Higgsfield si el plan no tiene acceso al modelo de imágenes:
`502 {"error":"402: Nano Banana is not available on your current plan"}`. Lo que la página muestra:

> "No se pudo confirmar el envío. Revisa tu actividad en Higgsfield antes de crear otra versión: podría haberse generado un cargo."

Y `reasonVisibleAnywhere: false` — las cadenas `402` y `plan` no aparecen ni en el DOM ni en consola.
La consola solo registra `Failed to load resource: 502`.

**¿Es nuevo?** Sí. Anoche `creator.js:166` hacía `throw new Error(data.error || 'No task_id returned')`
y `creator.js:208` mostraba `showToast(t('c_err_api') + ' (' + data.error + ')')`. **Se perdió una
capacidad que estaba aprobada.**

**Qué tiene que hacer Tavo:** leer el JSON antes de lanzar, guardar `data.error` en el error, y
mostrarlo al usuario junto al texto amable (como anoche).

---

### B2 — CRÍTICO. Todo fallo de `/compose` se le presenta al usuario como un posible cargo
`studio.js:45` + `worker.js:98`, `worker.js:99`

`worker.js` devuelve **502 para todos** los fallos de `/compose`: tanto el rechazo razonado de
Higgsfield (`:98`) como cualquier excepción interna (`:99`). En el cliente:

```js
e.rejected = res.status>=400 && res.status<500;      // studio.js:28  -> false para 502
…
else if(submitting && !e.rejected){studio.uncertain=true; studio.message='uncertain';}   // studio.js:45
```

Resultado: **cualquier** rechazo determinista del servidor se convierte en la advertencia de cargo.
Y a partir de ahí, `studio.js:32` mete un `window.confirm()` bloqueante en cada intento posterior.

**Medido:** tras un 502, el siguiente clic abre el diálogo con ese texto; si el usuario cancela, se
queda encallado. Un usuario sin acceso al modelo de imágenes entra en un callejón sin salida, con un
aviso de cobro que es falso.

**Efecto lateral medido (B2b):** escribir **un solo carácter** en la descripción llama a
`resetGeneration()` (`studio.js:9`, vía `oninput` en `:51`), que pone `studio.uncertain=false`. El
diálogo de confirmación desaparece **mientras el mensaje de advertencia sigue en pantalla**. Estado
inconsistente: la app dice que quizá te cobraron y a la vez quita la protección.

**¿Es nuevo?** Sí, la ruta `uncertain` completa es nueva.

---

### B3 — CRÍTICO. Los dos arreglos de "errores transitorios" se estorban entre sí
`worker.js:155` + `studio.js:29`

El constructor cambió `/status`: donde `588299f` devolvía `{status:'failed', error:…}` ante un error de
consulta, ahora devuelve **502 sin declarar el trabajo fallido**. La intención es buena. Pero el
cliente nuevo hace lo contrario de lo que hacía el aprobado:

| | anoche (`588299f:creator.js:214`) | hoy (`studio.js:29`) |
|---|---|---|
| error transitorio al sondear | `.catch(function(){ /* ignore transient errors */ })` — sigue sondeando solo | `request()` lanza → **aborta el sondeo entero** |

**Medido.** Con un único 502 en el primer sondeo de `/status`, el sondeo se detiene por completo:
mensaje "La consulta se interrumpió. Pulsa Continuar video…", botón cambiado a "Continuar video", y
**hace falta que el usuario esté frente a la pantalla para pulsarlo**. Un trabajo de Kling tarda
minutos; un parpadeo de red a mitad hoy exige niñera, anoche no.

Lo que sí funciona bien: al pulsar Continuar, el conteo del servidor mostró **1 sola** llamada a
`/compose` y **1 sola** a `/generate` en toda la sesión. **No hay envíos duplicados ni doble cobro.**
Eso está bien resuelto y hay que conservarlo.

**Nota sobre `tests/worker.mjs`:** la prueba afirma "transient errors must not look terminal" y **pasa**.
La prueba es correcta y el camino sigue roto, porque la prueba se detiene en el borde del Worker.

**Qué tiene que hacer Tavo:** que `status()` tolere N errores seguidos (2–3) y siga sondeando, y solo
entonces se rinda con el mensaje de reanudación.

---

## Defectos serios (no bloquean el pegado, sí deberían entrar antes de venderlo)

### S1 — El motivo de un fallo terminal se descarta: el usuario paga otra vez
`studio.js:29` — `if(data.status==='failed'){const e=new Error('Generation failed');e.terminal=true;throw e;}`

El Worker manda `{status:'failed', error:'nsfw'}` (`worker.js:109`), y el cliente tira `data.error`.
**Medido:** con un rechazo `nsfw`, la pantalla dice "El proveedor no pudo completar la generación.
Puedes intentarlo de nuevo." y `reasonShown:false`. El usuario reintentará, y **cada reintento cuesta
otra generación pagada** por una causa que no va a cambiar sola.

### S2 — `joga-motion-brand-hero.png`: 2,1 MB para dibujar 356 px
`creator.html:18`

- Archivo: **2 161 578 bytes**, 1672×941 PNG.
- Tamaño real en pantalla a 390 px de ancho: **356×210 px CSS** (medido con `getBoundingClientRect`).
- Reencodado de control (`sips`): **246 688 bytes** a 1344 px (−88,6 %) · **109 150 bytes** a 780 px (−95 %).

Son ~1,9 MB tirados en cada carga móvil de `creator.html`. Además no lleva `width`/`height`, así que
provoca salto de maquetación al cargar. Incumple la habilidad `preparar-medios`. (No se usa en
`index.html`: 0 referencias.)

### S3 — 170 líneas de CSS muerto en la hoja de la portada
`style.css:752-924` (+11 259 bytes, la hoja pasa de 29 361 a 40 620 bytes, **+38 %**)

Las reglas nuevas apuntan a `.page-creator`, `.scene-row`, `.upload-zone`, `.assembly-panel`,
`.ctrl-panel`, `.btn-gen`, `.result-panel`, `.export-source`, `.creator-hero`, `.scene-select`.
**Conté las apariciones de cada una de esas clases en `index.html` + `creator.html`: 0 en las diez.**
`353a23a` las añadió para el creador viejo y `117d88f` lo reemplazó por `studio.css` sin borrarlas.
`index.html` es el único archivo que carga `style.css`, así que ese 38 % extra viaja en cada visita a
la portada sin pintar nada. Es código muerto **nuevo**, introducido dentro del rango revisado.

### S4 — Botón de quitar foto: 23×23 px
`studio.css` (regla `.thumbnail button`), medido a 390 px de ancho.

23×23 px, muy por debajo del mínimo de 44 px, y es una acción **destructiva** (borra una foto ya
subida). Otros controles rozan el límite: botones de ejemplo 29 px de alto, selector de idioma 35 px,
`hero-action` 42 px.

### S5 — Dos fallos de contraste y quince textos por debajo de 12 px
Medidos a 390 px, fuentes ya cargadas (`document.fonts.ready`), idioma fijado en español:

| elemento | tamaño | contraste | AA 4.5:1 |
|---|---|---|---|
| `.footer-note` | 10 px | **3,84:1** | ✗ |
| `.preview-tag` | 9 px | **4,31:1** | ✗ |
| `.hint`, `.cost-note`, `.video-spec` | 11 px | 5,34:1 | ✓ |
| `#photoCount` | 11 px | 4,86:1 | ✓ |

Aparte del contraste: **15 elementos entre 9 y 11 px**. Entre ellos `.cost-note` (11 px), que es el
único sitio donde se le dice al usuario que cada creación gasta **dos** generaciones pagadas. La
advertencia de dinero es la letra chica de la pantalla.

### S6 — `alt` del hero en español fijo, fuera del sistema de traducción
`creator.html:18` — `alt="Un libro se transforma en una aventura cinematográfica entre montañas"`.
No lleva `data-copy`, así que un usuario en inglés con lector de pantalla oye español. Todo lo demás
sí traduce (medido: 0 elementos vacíos tras el cambio de idioma).

### S7 — El botón de idioma del creador no tiene `aria-label`
`creator.html:14` (`<button id="language">`). Justo en esta ronda `i18n.js:195` **añadió** ese
`aria-label` al botón de la portada (`#lang-toggle`). El creador quedó con el criterio viejo.

### S8 — 31 pares de claves `c_*` muertos en `i18n.js`
`c_title`, `c_upload_hint`, `c_style_*`, `c_motion_*`, `c_dur_*`, `c_step_*`, `c_error_*`, `c_download`…
`creator.html` ya no carga `i18n.js`, así que solo las usaba la pantalla borrada. Muerto en es y en en.

### S9 — El corte de 120 s puede caer en el falso "posible cargo"
`studio.js:28` — `AbortSignal.timeout(120000)`

**Medido contra el Worker en vivo:** un cuerpo de **79 201 457 bytes** (8 × 9,9 MB) se subió y procesó
correctamente, respuesta 400 limpia, **16,3 s** desde este Mac. Desde una casa con 10 Mbps de subida
son ~63 s solo del navegador al Worker, más los 8 `PUT` secuenciales del Worker a Higgsfield
(`worker.js:84`). Pasarse de 120 s es plausible, y el abort cae en la rama `uncertain` de B2: le dice
al usuario que quizá le cobraron cuando lo más probable es que el envío ni salió.

### S10 — La nota `multi-scene-10sep.md` manda correr un archivo que no existe
Dice `node tests/creator.cjs`. En `tests/` solo hay `worker.mjs`, `composer-worker.mjs` y `studio.cjs`.

---

## Lo que verifiqué y **sí** pasó, con evidencia

**Contrato de Higgsfield** (descargué `https://docs.higgsfield.ai/docs/openapi.json`, 168 050 bytes, 50 rutas):

- `/nano-banana` existe como ruta POST. ✓
- `input_images` → `ImageUrlInputImageSchema` = exactamente `{type:"image_url", image_url}` con
  `additionalProperties:false`. El Worker manda justo eso (`worker.js:84`). ✓
- **`maxItems: 8`** en `input_images`. El límite de 1–8 del Worker (`worker.js:75`) es correcto y
  coincide con el máximo documentado; la nota del constructor dice la verdad. ✓
- `aspect_ratio`: `16:9` está en el enum. `output_format`: `jpeg` válido. `num_images`: máximo 4, se
  manda 1. ✓
- `RequestStatus` devuelve `request_id` e `images[]` de `MediaOutput` = `{url}` — `data.images?.[0]?.url`
  (`worker.js:108`) es correcto. ✓
- Estados terminales: el enum es exactamente `queued|in_progress|nsfw|failed|completed|canceled`.
  `worker.js:109` cubre los tres terminales de fallo. **No falta ninguno.** ✓
- Kling `v2.1/pro/image-to-video` sigue aceptando `prompt`+`image_url` requeridos y `duration` enum `[5,10]`. ✓

**Flujo real en Chrome** (copia del sitio servida fuera del repo, Worker simulado, `studio.js` real):

- Camino feliz con 8 fotos, registro del servidor: `/compose` (campo `images` ×8 + `prompt` +
  `aspect_ratio`) → `/compose-status` ×2 → `/compose-image` → `/generate` (campo `image`,
  `duration=5`) → `/status` ×2 → video visible + `href="/api/download?task_id=video-xyz"`,
  `target="_blank"`, mensaje "Tu video está listo." ✓
- Con 1 foto igual de bien. Con **9 fotos** se corta en 8 y avisa "Puedes añadir hasta 8 imágenes."; el
  botón de subir se deshabilita al llegar a 8. ✓
- **Reanudación sin duplicar envíos**: tras un corte a mitad del sondeo, la sesión completa registró
  **1** `/compose` y **1** `/generate`. Sin doble cobro. ✓
- Durante el trabajo se deshabilitan botón, textarea y subida. ✓

**Pruebas de control de mi propio arnés** (sin esto ningún "PASA" mío vale):
1. Inyecté un `File` sintético por el `<input type=file>` real → el thumbnail apareció, el contador
   pasó a "1 / 8" y el botón se habilitó al escribir. El instrumento sí llega al código real.
2. Forcé un 404 en `/compose` → la página mostró "Falta actualizar el Worker en Cloudflare para esta
   función.". El instrumento sí distingue las ramas de error.
3. Para el 401 de Higgsfield, comparé contra una llamada sin llave (`401 Invalid credentials`) antes
   de concluir nada sobre las credenciales del Worker.
4. Fijé el idioma en español y esperé `document.fonts.ready` antes de toda medición geométrica.

**i18n:** 37 claves en `es`, 37 en `en`, **0** faltantes en cualquier dirección, **0** claves usadas sin
definir, **0** definidas sin usar, **0** valores vacíos. El cambio ES/EN conserva fotos, el texto que
escribió el usuario (en su idioma original), el video y el enlace de descarga; actualiza
`document.documentElement.lang`; comparte la llave `jiLang` con `index.html`, así que la preferencia
viaja entre portada y creador. **No se rompió ninguna llave de `localStorage`.** ✓

**Maquetación:** sin desbordamiento horizontal a 390, 901 ni 1280 px (`scrollWidth == clientWidth`,
0 elementos fuera del viewport). El punto de quiebre de 900 px no deja hueco: a 901 px el hero mide
837 px, la columna de texto 326 px, sin desborde. ✓

**JS válido:** `node --check studio.js`, `node --check i18n.js` sin errores; `worker.js` se importa
como ESM sin problema. Consola limpia salvo los errores HTTP que yo provoqué. ✓

**Pruebas del constructor:** `node tests/worker.mjs` **PASA**. `node tests/composer-worker.mjs` **PASA**
(cubre 0/1/2/8/9 referencias, contrato, descarga por tarea, errores transitorios y que un `url=` del
cliente nunca se busca). `node tests/studio.cjs` **no se puede correr en este Mac: Playwright no está
instalado** (`Cannot find module 'playwright'`). Cubrí ese terreno por mi cuenta con Chrome.

**Seguridad:**
- `/compose-image` y `/download` aceptan **solo** `task_id`, validado contra `/^[A-Za-z0-9-]{1,80}$/`
  (`worker.js:15`). El test del constructor demuestra que un `&url=https://untrusted.test` se ignora
  (`composer-worker.mjs:23`). El Worker relee la URL desde el estado de Higgsfield. ✓
- `Content-Disposition` (`worker.js:184`) interpola un `taskId` ya validado por la regex: no hay
  inyección de cabecera posible. ✓
- **Ningún secreto en código.** El barrido de `*.js/*.html/*.css/*.mjs/*.cjs` solo devuelve
  `env.HF_API_KEY_ID` / `env.HF_API_KEY_SECRET`. ✓
- CORS `*` con `OPTIONS` respondido: idéntico a lo aprobado anoche, sin regresión. Verificado también
  contra el endpoint en vivo. ✓

**Límites de Cloudflare — medidos, y corrijo mi propia sospecha inicial:**
Temí que los 8 × 10 MB reventaran el límite de CPU. **Lo medí contra el Worker desplegado** enviando
79,2 MB en 8 partes con un tipo no-imagen (se rechaza en la validación, antes de tocar Higgsfield, así
que no costó nada): **HTTP 400 limpio en 16,3 s, sin `Error 1102`**. El plan de la cuenta aguanta el
`formData()` de 79 MB. Riesgo residual: en un banco de pruebas local, ese mismo cuerpo dejó **103 MB**
de buffers externos frente al límite de 128 MB por isolate; con dos envíos de 8 fotos concurrentes eso
sí puede dar 1102, y un 1102 llega **sin las cabeceras CORS del Worker**, así que el navegador vería un
fallo de red genérico → otra vez la rama falsa de "posible cargo" (B2).

**Alcance y reglas de oro:** `index.html` **sin tocar** — branding intacto. No existen `gate.js` ni
service worker en este repo, así que esas dos reglas no aplican. Los archivos tocados son los
esperados para un rehacer del creador; nada fuera de lugar.

---

## Lista aparte de producto (no bloquea, decide José)

**Capacidades que estaban aprobadas anoche y hoy ya no existen:**

| capacidad (`588299f`) | estado hoy |
|---|---|
| Elegir estilo (cinematográfico, soñador, dinámico, zoom, paneo, suave) | eliminada |
| Intensidad de movimiento (slider) | eliminada |
| Duración de 10 segundos | eliminada — solo 5 s (`studio.js:40` manda `duration:'5'` fijo) |
| Formato vertical y cuadrado | eliminada — solo horizontal (`aspect_ratio:'16:9'` fijo, `studio.js:37`) |
| Editor por escenas y montaje local de varios clips | eliminada (`creator.js`, 266 líneas, borrado) |
| Animar **tu propia foto** | cambiada: ahora se anima una imagen que la IA inventa a partir de tus fotos |

**Coste:** cada creación consume ahora **dos** generaciones de Higgsfield (una de imagen + una de
video) en lugar de una. El usuario solo se entera por un texto de 11 px.

**Riesgo abierto:** el propio constructor escribe en `reference-scenes-10sep.md` que "no se ha
confirmado acceso del plan de la cuenta al modelo de imágenes". No lo pude verificar sin gastar una
generación real, y no la gasté. Si resulta que el plan no lo incluye, con los defectos B1 y B2 la
página falla culpando a un envío perdido en vez de decir la verdad. **Ésa es hoy la hipótesis más
probable para el "no genera videos" de José**, y se comprueba en un minuto en cuanto B1 esté arreglado.

---

## Lecciones de esta vuelta

1. **Antes de diagnosticar desde el estado del despliegue, mídelo.** El encargo daba por hecho que el
   Worker seguía siendo el de anoche; tres `curl` mostraron que el nuevo ya estaba en producción. Todo
   el plan de la ronda apuntaba al arreglo equivocado.
   → *Regla: al abrir una ronda, sondear el endpoint en vivo buscando una cadena que solo la versión
   nueva pueda producir, y anotar el resultado en el plan.*
2. **Una prueba unitaria puede pasar mientras el camino que protege está roto.** `tests/worker.mjs`
   afirma "transient errors must not look terminal" y pasa; el cliente convierte ese mismo 502 en un
   frenazo total. La prueba se detiene justo en el borde del Worker.
   → *Regla: cuando un cambio cruza Worker y cliente, la prueba tiene que cruzarlo también, y afirmar
   sobre lo que acaba viendo el usuario, no sobre el código de estado.*
3. **Tirar el cuerpo de una respuesta es tirar el único diagnóstico que alguien va a tener.** Un
   `Error('Request failed')` genérico no es un respaldo, es un defecto.
   → *Regla: cualquier envoltorio de `fetch` lee `error` del cuerpo antes de lanzar.*
4. **"No se pudo confirmar el envío" es el mensaje más caro del producto** — le dice al usuario que
   quizá le cobraron. Reservarlo para resultados de verdad ambiguos (abortos, caída de red), nunca
   para un servidor que contestó con una razón.
   → *Regla: mapear el mensaje al usuario por lo que dijo el servidor, no por si el código es 4xx o 5xx.*
5. **Borrar una pantalla deja huérfanos su CSS y sus traducciones.** Se publicaron 11 KB de CSS muerto
   (+38 % en la hoja de la portada) y 31 pares de claves muertas.
   → *Regla: cuando una página deja de cargar una hoja o un archivo de idioma, hacer grep de sus clases
   y claves y borrar lo que ningún HTML referencia, en el mismo commit.*
6. **Sospeché del código antes que del plan de Cloudflare, y me equivoqué al revés de lo habitual:**
   di por peligroso un límite de CPU que la medición contra el Worker real desmintió (79 MB, 400
   limpio, 16,3 s). Lo digo porque un "fallo" mal medido cuesta lo mismo que un defecto real.
   → *Regla: un límite de plataforma se mide contra la plataforma, no se estima desde la documentación;
   y hay forma de medirlo sin gastar dinero (payload que se rechaza en la validación).*
7. **Proceso: reutilizar un puerto no es gratis.** El 8791 ya estaba ocupado por el servidor de otra
   sesión. Busqué uno libre en vez de reclamarlo, y al terminar maté **solo** mi proceso por PID exacto
   (16680), no por coincidencia de número de puerto.
   → *Regla: `lsof` antes de escuchar en un puerto; nunca matar un listener que no arrancaste tú.*
