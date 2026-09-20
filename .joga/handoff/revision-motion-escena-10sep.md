# Revisión de Nico — ronda `motion-escena-10sep`

Commit auditado: `7a0e97a` sobre base `c55b94e`. Plan: `.joga/handoff/plan-motion-escena-10sep.md`.
Auditoría en solo lectura. Servidores de prueba montados fuera del repo (`git archive` a un directorio temporal, puertos 8731/8732) y apagados por PID exacto al terminar. El repo no se tocó: `git status` sigue mostrando solo los 4 archivos sin seguimiento de la otra sesión (`investigacion-falai-10sep.md`, `plan-motion-escena-10sep.md`, `sonda-fal-worker.js`, `sonda-modelos-worker-v2.js`), que no audité.

---

## Veredicto: **CAMBIOS**

Dos defectos reales, uno de ellos **CRÍTICO** porque tumba un guardián de dinero que ya estaba aprobado (`c18d0ab`). Todo lo demás que pidió el plan está medido y pasa.

---

## Defectos

### 1. CRÍTICO — «Otra escena» salta el guardián de cargo incierto y gasta $0,09 sin preguntar

**Archivo:** `studio.js:78`

```js
$('again').onclick=()=>{resetGeneration();createScene();};
```

`resetGeneration()` (`studio.js:9`) pone `studio.uncertain=false` y borra `studio.message`. Se ejecuta **antes** de que `createScene()` (`studio.js:36`) pueda evaluar su guardián `if(studio.uncertain&&!window.confirm(t('uncertain')))return;`. Resultado: el botón nuevo desarma el guardián y luego gasta.

**Cómo llega el usuario ahí:** escena lista → pulsa «Animar esta escena» → se le cae la red al enviar `/generate` → queda `uncertain=true`, `imageReady=true`, sin video. En ese estado `#again` **está visible** (`studio.js:19`).

**Medición** (Worker simulado, dos pulsaciones en el **mismo** estado):

| Acción | Diálogo de confirmación | Llamadas de red | `studio.uncertain` después | Mensaje en pantalla |
|---|---|---|---|---|
| Botón principal «Animar esta escena» *(control)* | **1** | ninguna (respondí «no») | sigue `true` | sigue el aviso de cargo |
| **«Otra escena»** | **0** | `/compose` → `/compose-status` → `/compose-image` | pasa a `false` | el aviso **desaparece** |

El control demuestra que mi instrumento sí cuenta confirmaciones (contó 1 en la fila de arriba), así que el 0 de la segunda fila es del código, no del arnés.

Es exactamente el fallo que `c18d0ab` («restaurar guardián de cargo falso») existe para impedir: el usuario ve «podría haberse generado un cargo de $0,49», pulsa el botón que tiene al lado, y el aviso se borra solo mientras se le cobran $0,09 más. Y pierde la única pista que tenía para ir a revisar su actividad en Higgsfield.

**Nota de alcance:** que `resetGeneration()` limpie `uncertain` ya venía de `c55b94e` (escribir en la descripción también lo limpiaba) y se aprobó así. Lo nuevo, y lo que lo vuelve crítico, es que ahora hay un **botón de un clic** que lo limpia y gasta en el mismo gesto.

---

### 2. Alto — `#again` es un botón nativo del navegador sin estilar: 26 px de alto, rompe el diseño y viola el mínimo táctil de la ronda anterior

**Archivos:** `creator.html:43` (el botón) y `studio.css:1` (no hay ninguna regla para `#again`).

`studio.css` solo añadió dos cosas: `.preview video,#scene{…}` y `#modes button.on{…}`. `#again` se quedó sin CSS y hereda el estilo por defecto del navegador.

**Medido** (estilos computados en el motor de layout, no a ojo):

| | `#again` | `#create` | botones de modo | `.examples button` (móvil) |
|---|---|---|---|---|
| Alto | **25,5 px** | 44 px | 44 px | 44 px (`min-height:44px`) |
| `appearance` | `auto` (nativo) | — | — | — |
| Fondo | `rgb(239,239,239)` gris del sistema | morado `#6941cf` | blanco / `#f0eafb` | blanco |
| Borde | **`2px outset` negro** | `0` | `1px solid` | `1px solid` |
| `border-radius` | **0 px** | 10 px | 20 px | 20 px |
| Tamaño de letra | **16 px** | 13 px | 13 px | 13 px |

Dos consecuencias:

- **Diseño.** Un botón gris nativo con borde negro `outset` y esquinas cuadradas, dentro de la tarjeta blanca de vista previa donde todo lo demás es redondeado y morado. José dijo que el diseño no cambia y que lo único visible nuevo sería `#modes`, `#scene` y `#again`; `#again` puede existir, pero no vestido de formulario de 1998.
- **Móvil — regresión contra `bb683e9`.** Esa ronda estableció 44 px de alto mínimo para todo lo tocable de esta página (`.primary`, `.examples button`, `.thumbnail button`) y se aprobó por eso. `#again` mide **25,5 px a 430 px de ancho y 26 px a 320 px**: es el único control tocable de la página por debajo del mínimo, y encima está en la mitad de abajo, donde la mano no llega bien.

Confirmado a 320, 375, 430 y 1440 px. No es un desbordamiento — no hay ninguno — es tamaño y aspecto.

---

## Lo que verifiqué y **sí** pasa

**Alcance.** `git show 7a0e97a --stat`: solo `worker.js`, `studio.js`, `creator.html`, `studio.css`, `tests/composer-worker.mjs` y la nota. `git diff c55b94e 7a0e97a -- index.html style.css i18n.js` → **vacío**. En `worker.js` el diff toca **solo** la ruta `/compose` (líneas 67-95); `/generate`, `/status`, `/download`, `/compose-status`, `/compose-image` idénticos. No hay `gate.js` ni service worker en este repo. Única llave de `localStorage`: `jiLang`, sin cambios (`studio.js:7` y `:78`). Branding sin tocar.

**JS válido y pruebas.** `node --check` limpio en `worker.js`, `studio.js`, `i18n.js`. `node tests/worker.mjs` → PASS. `node tests/composer-worker.mjs` → PASS. `creator.html` no tiene scripts en línea.

**Worker `/compose` — sonda propia con `fetch` simulado** (fuera del repo). Control primero: 1 foto → 200 con `task_id`, y las 3 llamadas esperadas (`/files/generate-upload-url` → `PUT` → `POST …/higgsfield-ai/soul/reference`).

| Caso | Resultado | Llamadas a Higgsfield |
|---|---|---|
| 0 fotos | 400 `one reference photo required` | 0 |
| 2 fotos | 400 `one reference photo required` | 0 |
| 1 foto `application/pdf` | 400 | 0 |
| 1 foto de 0 bytes | 400 | 0 |
| 1 foto de 11 MB | 400 | 0 |
| `aspect_ratio=4:3` | 400 `invalid aspect ratio` | 0 |
| 1 foto correcta | 200 `task_id` | 3 |
| Higgsfield 404 | **502** `{"error":"404: model_not_found"}` | — |
| Higgsfield 500 | **502** `{"error":"500: boom"}` | — |
| 200 sin `request_id` | 502 | — |

Cuerpo enviado, verbatim: `image_reference_url` = la `public_url` firmada, `aspect_ratio` `16:9`, `resolution` `720p`, `batch_size` `1`, y el `prompt` = preámbulo + `Scene: ` + lo que escribió el usuario. Coincide con el contrato del `openapi.json` que trae el plan.

**Modo «Animar mi foto» — idéntico a hoy.** Corrí el mismo flujo en `c55b94e` y en `7a0e97a` y comparé cuerpo por cuerpo. Las dos versiones producen exactamente:

```
POST /generate   image=FILE:yo.jpg:image/jpeg:777&prompt=la persona sonrie&duration=5
GET  /status?task_id=vid-1
```

y el mismo `Descargar` (`…/download?task_id=vid-1`, `target=_blank`). Cero diferencias.

**Modo «Crear una escena» — el flujo completo, medido llamada por llamada.**

| Paso | Llamadas registradas | `/generate` | `/compose` |
|---|---|---|---|
| «Crear escena» | `/compose` (1 foto, `aspect_ratio=16:9`) → `/compose-status` → `/compose-image` | **0** | 1 |
| «Otra escena» | `/compose` → `/compose-status` → `/compose-image` | **0** | 1 |
| «Animar esta escena» | `/generate` → `/status` | 1 | 0 |
| «Crear otra versión» | `/generate` → `/status` | 1 | **0** |

**El `image` que se anima es la escena, no la foto original — comprobado por bytes:** la foto subida pesa `777` bytes y el blob de escena `54321`; el `POST /generate` lleva `image=FILE:scene.jpg:image/jpeg:54321`. No hay forma de confundirlos.

La escena aparece en la vista previa (`#scene` visible, `#emptyPreview` oculto), el botón principal pasa a «Animar esta escena» y aparece «Otra escena».

**La desviación de Tavo (`studio.js:60`) es correcta.** El limpiado en línea de solo los campos de video:

```js
if(studio.videoUrl){studio.videoTask=null;studio.videoUrl=null;studio.uncertain=false;$('video').pause();$('video').removeAttribute('src');$('download').removeAttribute('href');}
```

Medido: «Crear otra versión» en modo escena hace **1 `/generate` nuevo con el mismo blob de 54321 bytes y 0 `/compose`** — no vuelve a cobrar la escena ya pagada, que es justo lo que el plan busca («así nadie paga el video sin ver antes la imagen»). Lo que `resetGeneration()` limpiaba y aquí no (`stage`, `message`, `detail`) se reasigna dos líneas después dentro de `animate()`, así que no queda estado sucio. Y el guardián `if(studio.uncertain&&!confirm(…))` sigue **antes** del limpiado, así que en este camino no se desarma. En modo «Animar mi foto» el comportamiento es equivalente al de `resetGeneration()` porque no hay estado de imagen. Aprobada.

**Errores (el `catch` de D4).**

| Escenario | Mensaje en pantalla | Estado |
|---|---|---|
| `/compose` 502 `404: model_not_found` | «No se pudo completar la solicitud. (404: model_not_found)» | `imageTask=null`, `uncertain=false` — motivo visible, **sin** alarma de cargo |
| `/compose-status` `{"status":"failed","error":"nsfw"}` | «El proveedor no pudo completar la generación… (nsfw)» | `imageTask=null`, `imageReady=false`, botón «Intentar de nuevo»; el reintento vuelve a funcionar y da escena |
| 12 fallos de sondeo | `waiting` | **exactamente 12** llamadas a `/compose-status`, `imageTask='img-1'` conservado; al reanudar: **0 `/compose`**, solo `/compose-status` + `/compose-image` — no se cobra dos veces |
| Corte de red al enviar | `uncertain` | camino **único**: `uncertain=true`, `imageTask=null` |

**Diseño — cero cambios de layout no pedidos.** Comparé la caja de cada elemento de `<main>` entre `c55b94e` y `7a0e97a` a 1440, 430, 375 y 320 px, con el idioma fijado en español y `document.fonts.ready` esperado.

- A 1440: base 45 cajas, nueva 48. La diferencia son **exactamente** las tres nuevas (`#modes` y sus dos botones). Todo lo de abajo baja **53 px** de forma uniforme (29 de alto + 24 de margen), con `x` y ancho idénticos. El panel de vista previa no se mueve ni un píxel: `762|684|595|429` en las dos.
- A 320: mismo patrón, desplazamiento uniforme de **119 px** (95 + 24, los dos botones apilados).
- `scrollWidth === innerWidth` en los cuatro anchos: **sin desbordes**.
- `#scene` con una imagen 16:9 real (640×360): caja `354×228` dentro de una pantalla de `356×230`, `object-fit:contain`, fondo `#16141d` — exactamente las mismas reglas que `.preview video`, que es lo que pedía el plan.
- Botones de modo: **44 px de alto** a 320/375/430. Cumplen.
- Contraste del botón `.on`: `#6941cf` sobre `#f0eafb` = **5,49:1**. Pasa AA (≥4,5:1).
- El diff real de `studio.css` son solo dos cosas: `.preview video` → `.preview video,#scene`, y la regla nueva `#modes button.on`. Nada más.

**i18n.** 47 claves en ES y 47 en EN, **sin huecos ni desajustes**: ninguna clave solo en un idioma, ningún valor vacío, ningún `data-copy` del HTML sin traducción, ningún elemento renderizado en blanco. Cambiar de idioma con una escena lista **conserva** escena, blob (54321), foto y descripción, y traduce los textos nuevos correctamente en los dos sentidos.

**Invalidación.** Cambiar de modo limpia escena y video (`imageReady=false`, `imageUrl=null`, `sceneBlob=null`, `src` del `<img>` quitado). Cambiar de foto o de descripción, igual.

**Consola limpia.** Sin errores de página ni excepciones. Los 3 `ERR_NAME_NOT_RESOLVED` que salen son Google Fonts, porque mi entorno de prueba está sin red — son míos, no del código.

---

## Lo que el plan no pidió (para que lo decida Kimo MD, no son defectos)

1. **`render()` sobrescribe `TEXT[language]`** (`studio.js:16`): `TEXT[language].referenceHint` y `.cost` se reasignan en cada render a partir de `hintMotion`/`hintScene` y `costMotion`/`costScene`. Es idempotente y los valores literales originales de `referenceHint` y `cost` coinciden con las variantes «motion», así que hoy no rompe nada — pero deja dos claves del diccionario como código muerto que ya nadie puede leer. Si mañana alguien cambia `referenceHint` en el objeto, no pasará nada en pantalla y va a perder una hora buscando por qué.
2. **En modo escena no existe el estado «Continuar»**: con `waiting` y un `imageTask` vivo, el botón dice «**Crear escena**» (`studio.js:18`) mientras el mensaje dice «Pulsa **Continuar video** para consultar el mismo trabajo sin enviarlo otra vez». El mensaje nombra un botón que no está en pantalla, y el botón que sí está promete un cobro que en realidad no ocurre (medido: 0 `/compose` al reanudar). Falta una clave tipo `resumeScene` («Continuar escena»). El plan no la pidió, por eso no lo cuento como defecto de Tavo.
3. **`<img id="scene" alt="">`** (`creator.html:41`): el plan lo especificó así, y Tavo lo siguió. Pero es el contenido principal del panel, no un adorno; con `alt=""` un lector de pantalla no anuncia nada cuando la escena llega. Bastaría un `alt` con el texto de `sceneReady`.
4. **En modo escena, el prompt del video es la descripción de la escena.** El plan lo dice explícitamente en F, y Tavo lo siguió. Solo apunto la consecuencia para José: a Kling le llega «a caballo por una pradera dorada al atardecer» como instrucción de *movimiento*. Funciona, pero puede que dé menos movimiento del esperado. Es decisión de producto, no un fallo.
5. **`tests/studio.cjs` está obsoleto** (ronda de 8 fotos: espera `0 / 8`, 8 miniaturas, «Puedes añadir hasta 8 imágenes»). No es de esta ronda — ya estaba roto en `c55b94e` — y además necesita Playwright, que no está instalado en este Mac. O se actualiza o se borra, pero conviene no dejarlo ahí fingiendo que cubre algo.
6. **`creator.html:22` sigue con `<span id="photoCount">0 / 8</span>`** en el HTML; el JS lo pisa con `0 / 1` al primer render. Cosmético y preexistente.

---

## Para arreglar (mínimo, sin tocar nada más)

1. `studio.js:78` — mover el guardián antes del reset. Por ejemplo, que `#again` haga la comprobación de `uncertain` **antes** de llamar a `resetGeneration()`, o que `createScene()` reciba la señal de que viene de «Otra escena» y evalúe el guardián primero. Lo que no puede quedar es `resetGeneration()` limpiando `uncertain` sin preguntar.
2. `studio.css` — una regla para `#again` que lo ponga en la línea del resto: el aspecto de `.examples button` (blanco, borde `var(--line)`, radio 20, 13 px) y, dentro del `@media(max-width:480px)`, `min-height:44px`. Es una línea, no toca ninguna regla existente.

Después de eso vuelvo a medir solo esos dos puntos y el flujo de escena completo.

---

## Si se aprueba: qué queda para la prueba viva

Nada más que esto, y lo autoriza José:

1. Push de los estáticos **y** pegar `worker.js` en Cloudflare — `/compose` cambió de modelo (`nano-banana` → `higgsfield-ai/soul/reference`). Si solo se sube el sitio, el botón «Crear escena» va a devolver 502 `model_not_found` contra el Worker viejo. Secretos intactos.
2. Una escena real con la foto de José: **$0,09**. Comprobar que la persona sale reconocible y que la imagen llega al panel.
3. Si le gusta, un video de esa escena: **$0,49**. Comprobar que anima la escena y no la foto original.

Total autorizado: **$0,58**. No gasté nada en esta auditoría: todo con Worker simulado.

---

## Lecciones de esta vuelta

Por cada tropiezo, la regla — no el defecto.

1. **Un control nuevo que llama a `resetGeneration()` hereda todo lo que esa función limpia, guardianes incluidos.** Regla: cuando una función de limpieza apaga una bandera de seguridad (`uncertain`, `busy`, un candado de cobro), todo botón nuevo que la invoque tiene que evaluar el guardián **antes** de llamarla. Y la prueba de ese botón no es «¿hace lo suyo?» sino «¿en qué estado peligroso puede estar visible, y qué apaga al pulsarlo?».
2. **Un elemento nuevo sin regla de CSS no sale «neutro», sale nativo.** Regla: todo `<button>`, `<input>` o `<select>` que se añada a una página con diseño propio necesita su regla en el mismo commit; si el plan no la especifica, eso es un hueco del plan que hay que levantar, no una licencia para omitirla. Y la comprobación es medir `appearance`, `border-radius` y alto computados y compararlos con un hermano ya aprobado — leer el HTML no lo detecta jamás.
3. **Una ronda que fija un mínimo (44 px táctiles) fija una invariante, no un parche de esa ronda.** Regla: cada ronda posterior mide ese mínimo sobre **todos** los controles tocables, incluidos los que ella misma acaba de crear. `bb683e9` cubrió los botones que existían entonces; `#again` nació después y se escapó.
4. **Mi imagen de prueba falseó la geometría.** Medí `#scene` con un JPEG de 1×1 y salió `354×354` — cuadrado, señal de alarma. Con una imagen 16:9 real (640×360) salió `354×228`, correcto. Regla: cuando se mide la caja de un `<img>` o un `<video>`, el archivo de prueba tiene que tener la **proporción real** del contenido que va a llevar; si no, se está midiendo el sustituto.
5. **Las capturas de pantalla me volvieron en blanco** con el viewport emulado, dos veces. No inventé lo que había en ellas: cambié de instrumento y me quedé con los estilos y las cajas computados, que salen del propio motor de layout. Regla: si la captura no muestra lo que debería mostrar, el fallo es del instrumento hasta que se demuestre lo contrario; se cambia de instrumento y se dice cuál se usó, no se describe una imagen que no se vio.
6. **Cada afirmación de flujo se sostuvo en un control previo.** Antes de creer «0 confirmaciones» probé que mi `confirm` falso contaba 1 en el botón principal; antes de creer «12 sondeos» comprobé que el contador registraba las llamadas. Regla: un «no ocurrió» solo vale si en la misma sesión se demostró que el instrumento sabe registrar el «sí ocurrió».
7. **Contradicción interna del plan.** El punto D dice que `studio.imageUrl` es la URL del Worker `/compose-image?task_id=…`; el punto F dice que es `URL.createObjectURL(blob)`. Tavo siguió F, que es lo correcto (una descarga en vez de dos). Regla: cuando dos puntos del plan se contradicen, el implementador elige y **lo escribe en su nota** para que el revisor no tenga que adivinar cuál era la intención. Aquí no estaba anotado.
8. **Al apagar mis servidores filtré por comando completo, no por número de puerto**, comprobando con `ps -o command=` que cada PID era mi `python -m http.server 873x` antes de matarlo. Regla: nunca matar por coincidencia parcial de dígitos; un PID puede contener el número de tu puerto por casualidad.

---
---

# Tercera vuelta — `692a8a8` (comprobación final)

## Veredicto: **CAMBIOS**

Un solo defecto, no crítico pero real y medido: **el punto K no cumple su propio objetivo medible**. J y L pasan enteros. Todo lo demás que volví a medir sigue bien.

Y el defecto viene del plan, no de Tavo: el plan **prescribió literalmente** la regla que lo causa. Lo corrijo abajo.

---

## 1. Alcance — limpio

`git diff 7a0e97a 692a8a8 --stat` → `creator.html` 1+/1−, `studio.css` 1+/1−, `studio.js` 4+/4−. **6+/6−, tres archivos**, exactamente los del plan.

Comparación regla por regla de `studio.css` (117 → 118 reglas): la única diferencia en todo el archivo es la regla nueva `#again{...}`. **Ninguna regla existente alterada, ninguna eliminada.** En `creator.html`, un `diff` completo devuelve una sola línea cambiada: el `class="primary"` añadido a `#again`. **Cero cambios de layout no pedidos.**

| Comprobación | Resultado |
|---|---|
| `node --check studio.js` | OK |
| `node --check worker.js` | OK |
| `node tests/worker.mjs` | PASS |
| `node tests/composer-worker.mjs` | PASS |
| Claves i18n | **48 ES / 48 EN**, mismo orden, 0 huérfanas, 0 vacías, 0 idénticas entre idiomas |
| `localStorage` | única clave `jiLang` — sin renombrar, nadie pierde nada |
| Marca | `▶ Joga Motion` intacta, `.brand-icon` con `aria-hidden="true"`, sin marca duplicada |
| `gate.js` / service worker | no existen en este repo — no aplica |

`tests/studio.cjs` **no se pudo ejecutar**: `Cannot find module 'playwright'`. No es de esta ronda (falta la dependencia en la máquina), pero conviene saberlo: esa red de seguridad no está corriendo. Lo suplí con el navegador y un Worker simulado.

---

## 2. J — guardián antes del reset: **PASA**

Estado montado de verdad: modo escena → `/compose` → `/compose-status` → `/compose-image` → escena lista (`imageReady=true`, blob `image/jpeg` de 369 946 B, `#again` visible); luego **corte de red al animar** (el Worker simulado destruye el socket en `POST /generate`) → `uncertain=true`, `message='uncertain'`, `#again` sigue visible.

| Acción sobre «Otra escena» | Confirmaciones | Llamadas de red | Estado después |
|---|---|---|---|
| **Cancelar** | **1** | **0** | `uncertain=true`, aviso íntegro en pantalla, `imageTask` conservado |
| **Aceptar** | **1** | **1 × `POST /compose`**, **0 × `/generate`** (contadores del servidor: `{compose:1, compose-status:1, compose-image:1}`) | `uncertain=false`, `message='sceneReady'` |

**No hay doble pregunta**, aunque `createScene()` tenga su propio guardián: `resetGeneration()` apaga `uncertain` antes de llamarla. Confirmado por conteo, no por lectura.

**Control** (botón principal): en estado `uncertain` sigue dando **1 confirmación y 0 llamadas** al cancelar. Verificado dos veces — una con clic real del ratón y otra con `.click()`.

---

## 3. K — estilo de `#again`: **FALLA** (único motivo del veredicto)

`creator.html:43` — clase añadida, correcto.
`studio.css:1` — regla `#again{appearance:none;font:inherit;cursor:pointer}` — **aquí está el defecto.**

`font:inherit` es una **taquigrafía** que reescribe `font-size` **y** `font-weight`. Y va en un selector de **ID** (especificidad 1,0,0), que gana a `.primary` (0,1,0). Resultado: la regla que se añadió *para* igualar `#again` con `#download` es justo la que **cancela** el `font-size:13px; font-weight:600` de `.primary`.

Estilos computados, fuentes cargadas (`document.fonts.status === "loaded"`), idioma fijado en `es`, sin `:hover`:

| Ancho | `#again` alto / letra | `#download` alto / letra |
|---|---|---|
| 320 px | **47,5 px** / **16 px / 400** | 44,0 px / 13 px / 600 |
| 375 px | **47,5 px** / **16 px / 400** | 44,0 px / 13 px / 600 |
| 430 px | **47,5 px** / **16 px / 400** | 44,0 px / 13 px / 600 |
| 1440 px | **47,5 px** / **16 px / 400** | 43,5 px / 13 px / 600 |

La letra sale **23 % más grande y en peso normal en vez de semibold**, y el botón **3,5 px más alto** que su hermano, en los cuatro anchos. El plan pedía «mismo alto, radio, **tamaño de letra** y colores que `#download`»: el tamaño de letra y el alto **no coinciden**.

Lo que **sí** coincide: radio `10px`, `padding 14px 23px`, fondo `rgb(105,65,207)` (idéntico; el `rgb(89,51,183)` que vi al principio era `:hover` de mi propio ratón, lo descarté moviéndolo), texto `#fff`, `border 0`, `appearance:none`, `min-height:44px` en móvil, ancho 100 % en móvil. **`overflowX = 0` en los cuatro anchos**; `#again` y `#download` comparten `x` y `width` exactos (246 / 301 / 356 px).

**Aislado con un control**, desactivando declaraciones una a una sobre la hoja viva:

| Variante de la regla | `#again` |
|---|---|
| tal cual (`appearance` + `font` + `cursor`) | 47,5 px · 16 px/400 ✗ |
| **sin `font:inherit`** | **44,0 px · 13 px/600 ✓ idéntico a `#download`** |
| sin la regla entera | 44,0 px · 13 px/600, pero `appearance:auto` |

### El arreglo — una palabra menos

```css
#again{appearance:none}
```

`font:inherit` y `cursor:pointer` **ya los da la base** del propio `studio.css` (`button,textarea,input{font:inherit}` y `button{cursor:pointer}`), y allí están con especificidad baja, que es justo lo que permite a `.primary` mandar. Repetirlos en un ID los convierte en un bloqueo. Solo `appearance:none` aporta algo, y lo dejo por Safari/iOS aunque en Chromium el `.primary` ya lo neutralice.

### Corrección al plan (punto K, línea 72)

El plan dice: «añadir en `studio.css` una sola regla `#again{appearance:none;font:inherit;cursor:pointer}` — **nada más**». **Ese texto es incorrecto** y contradice el objetivo medible de su propia frase siguiente. Tavo lo aplicó al pie de la letra; el error de fondo es del plan. Lo que le toca a Tavo es lo otro: la regla se escribió y **no se midió** — bastaban dos `getComputedStyle` para verlo.

---

## 4. L — «Continuar escena» y texto genérico: **PASA**

12 fallos seguidos en `/compose-status` (socket destruido), medidos con contador de cliente **y** de servidor:

- **12 llamadas exactas** a `/compose-status`, 65 s de reloj (11 esperas de 5 s + el corte), **1 sola `POST /compose`** en todo el episodio.
- Mensaje: «La consulta se interrumpió. **Pulsa Continuar** para consultar el mismo trabajo sin enviarlo otra vez.» — **genérico, sin «Continuar video»**. El inglés igual: «Press Continue…».
- Botón principal: **«Continuar escena»** (`Continue scene` en EN). `imageTask='img-task-1'` **conservado**, `imageReady=false`, `#again` oculto (correcto: todavía no hay escena).

Al pulsarlo con el Worker respondiendo `completed`: **0 × `POST /compose`** (contadores del servidor: `{compose-status:1, compose-image:1}`, sin `compose`), mismo `imageTask`, y **la escena aparece de verdad**: `#scene` visible, `naturalWidth×naturalHeight = 1672×941`, caja de 228 px de alto con proporción 16:9 — usé una imagen 16:9 real, no un 1×1, por la lección 4 de la vuelta anterior.

---

## 5. Regresiones: **ninguna**

**Modo «Animar mi foto» = `c55b94e`.** Comparé `createVideo()` de `c55b94e` con `animate()` línea a línea: el `try` y **el `catch` entero son idénticos**; lo único distinto es que `if(studio.videoUrl)resetGeneration()` pasó a un bloque en línea que limpia lo mismo que importa al vídeo (`videoTask`, `videoUrl`, `uncertain`, `<video>`, `href`) y que después se reasignan `message`/`detail`/`stage` de todos modos. Medido en vivo: `POST /generate` **una sola vez**, con `image = FILE foto.jpg` (la foto original, no una escena), `prompt`, `duration=5`.

**D4 intacto**, las dos ramas medidas:
- *Guardián de cargo falso*: corte de red durante `POST /generate` → `uncertain=true` + aviso de posible cargo, sin `videoTask` inventado.
- *Rama `waiting` del catch de vídeo*: 12 fallos de `/status` → `message='waiting'`, **`videoTask='vid-task-1'` conservado**, botón «Continuar video»; al pulsarlo con `completed`, **0 × `POST /generate`** (servidor: `{status:1, download:1}`) y el vídeo aparece.

**Flujo de escena completo** (compose → imagen → animar → vídeo):
`POST /generate` **una vez**, con `image = FILE scene.jpg image/jpeg 369946B` — **el blob de la escena**, no la foto de partida (`studio.js` solo pone ese nombre en la rama de escena). Después: `#video` visible, `#scene` oculto, `#again` oculto, botón «Crear otra versión», y **Descargar** con `href=…/download?task_id=vid-task-1`, `target="_blank"`, `rel="noopener"`.

**i18n vivo**: el toggle cambia en caliente y vuelve, en los dos sentidos — `lang`, `<title>`, botones de modo, mensaje de estado, `#download` y `#again` («Otra escena» ↔ «Another scene»). Sin recargar.

### Observación menor (no bloquea, no es de esta ronda)

Mientras se crea una **escena**, el botón principal dice «**Creando tu video…**» (clave `working`) mientras el panel de progreso dice, correctamente, «Creando tu escena…». Viene de `7a0e97a`. Una clave `composingBtn` lo arreglaría; lo dejo anotado para una ronda futura, no para ésta.

---

## Qué hay que cambiar (lista para Tavo)

**Un solo cambio, un archivo, una palabra menos.**

1. `studio.css` — dejar la regla en `#again{appearance:none}`. Quitar `font:inherit` (es la causa) y `cursor:pointer` (ya lo da `button{cursor:pointer}` de la misma hoja). Nada más se toca.

Después vuelvo a medir solo eso: `#again` y `#download` con el mismo `font-size`, `font-weight` y alto en 320/375/430/1440, y que `overflowX` siga en 0.

---

## Si se aprueba en la cuarta vuelta: lista de publicación

1. **Push de los estáticos** (`creator.html`, `studio.css`, `studio.js`) **y pegar `worker.js` en Cloudflare**. Las dos cosas, no una: `/compose` cambió de modelo en `7a0e97a` (`nano-banana` → `higgsfield-ai/soul/reference`). Si solo sube el sitio, «Crear escena» devolverá 502 `model_not_found` contra el Worker viejo. Secretos intactos, no hay que tocarlos. Recordar que `git push` no sale desde el agente.
2. **Prueba viva, la autoriza José**: una escena real con su foto — **$0,09** — y comprobar que la persona sale reconocible. Si le gusta, un vídeo de esa escena — **$0,49** — y comprobar que anima **la escena** y no la foto original, y que «Descargar» abre el vídeo. Total **$0,58**.

**No gasté nada en esta auditoría.** Todo con Worker simulado en `127.0.0.1`, servido desde un directorio temporal fuera del repo. `git status` quedó igual que al empezar: no toqué ningún archivo del proyecto salvo este reporte.

---

## Lecciones de esta vuelta

Por cada defecto y cada tropiezo, la regla — no el defecto.

1. **Una taquigrafía de CSS en un selector de ID puede deshacer justo lo que el cambio quería lograr.** `font:inherit` no es «heredar la familia»: reescribe `font-size` y `font-weight`, y desde un ID gana a cualquier clase. Regla: al añadir una regla defensiva a un elemento para que se parezca a otro, usar **propiedades sueltas** (`appearance:none`), nunca taquigrafías (`font`, `background`, `border`), y **nunca en un selector de ID** si el aspecto lo tiene que dar una clase. Y la comprobación no es leer la regla: es comparar `getComputedStyle` del elemento con el de su hermano ya aprobado.
2. **Un plan puede prescribir el defecto.** Aquí el plan dictó la regla exacta, palabra por palabra, y esa regla contradecía el objetivo medible que el propio plan escribía dos líneas después. Regla: cuando un plan da **código literal** y además un **objetivo medible**, manda el objetivo; el implementador aplica el código, **lo mide contra el objetivo**, y si no cuadra levanta la mano en vez de dar por bueno el dictado. Y el revisor audita contra el objetivo, no contra el literal.
3. **Lo que se prescribe puede estar ya en la hoja.** `font:inherit` y `cursor:pointer` ya estaban en la base de `studio.css` con especificidad baja — que es exactamente lo que permitía a `.primary` mandar. Regla: antes de añadir una declaración «defensiva», buscarla en el archivo; si ya está más arriba con menos especificidad, repetirla no refuerza, **bloquea**.
4. **Mi primer clic real no llegó nunca y casi lo tomo por un fallo del código.** `scroll_to` seguido de clic inmediato dio 0 confirmaciones; el mismo clic, tras dejar asentar el desplazamiento, dio 1. Es el mismo tropiezo del enlace «roto» de rondas anteriores, otra vez. Regla: entre mover la página y pulsar, **esperar y volver a comprobar con `elementFromPoint` que el elemento sigue bajo esas coordenadas**. Y ante un resultado que acusa al código, correr el control antes de escribir nada — el primer «fallo» de esta vuelta era mío.
5. **`requestAnimationFrame` no dispara con el panel del navegador oculto** y colgó mi función de medida hasta el timeout de 45 s. Igual, los clics sintéticos por coordenadas caducan cuando el panel se esconde, y las capturas de pantalla vuelven en blanco. Regla: en un arnés que puede correr con el panel oculto, esperar con `setTimeout`, no con `rAF`; medir con `getComputedStyle`/`getBoundingClientRect`, que salen del motor de layout y no dependen de que se pinte; y si hace falta pulsar, `.click()` **con un control que demuestre que llega al manejador**.
6. **Cambié de instrumento a media auditoría y volví a pasar el control.** Cuando los clics reales dejaron de funcionar, no di por bueno `.click()`: repetí el control (1 pulsación → 1 confirmación, 0 llamadas) antes de seguir. Regla: **cada vez que se cambia de instrumento, se repite el control**; un control pasado con el instrumento anterior no avala al siguiente.
7. **El envoltorio de `fetch` que se instala dos veces cuenta doble.** Mi lista de cliente mostró `POST /generate` dos veces porque envolví `fetch` sobre un `fetch` ya envuelto; los contadores del servidor decían `generate:1`, que era la verdad. Regla: contar las llamadas **en el lado que no se puede instrumentar dos veces** (el servidor simulado), y usar el registro del cliente solo para ver el *contenido* (nombre de archivo, campos del multipart).
8. **Otra sesión escribió en `.joga/handoff/` mientras yo auditaba** — apareció `plan-motion-niveles-10sep.md` a mitad de mi ronda. No lo abrí ni lo audité. Regla: los archivos de handoff que aparecen durante la revisión y no están en el plan de esta ronda **no son de esta ronda**; se anotan y se dejan en paz. El nombre por ronda (`revision-motion-escena-10sep.md`) es lo que evitó que nos pisáramos.
9. **`tests/studio.cjs` no corre: falta `playwright` en la máquina.** No es un defecto del código, pero significa que la red de seguridad automática del navegador **no está protegiendo a nadie** en este repo. Regla: si una prueba del repo no se puede ejecutar, eso se reporta como riesgo aunque el veredicto no dependa de ella — una prueba que nunca corre es peor que no tenerla, porque da confianza falsa.
10. **Apagué mi servidor por ruta completa del script**, comprobando con `ps -o command=` que el PID era mi `harness.cjs` antes de matarlo. Regla: nunca filtrar por número de puerto ni por coincidencia parcial de dígitos.

---

# Cuarta vuelta — `12bd4f0`

## Veredicto: APROBADO

El defecto de la tercera vuelta está corregido y medido. No encontré ninguno nuevo.

## 1. Alcance

```
git diff 692a8a8 12bd4f0 --stat
 studio.css | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

Un archivo, una línea. `creator.html` y `studio.js` byte a byte idénticos entre `692a8a8` y `12bd4f0` (comprobado con `diff -q` sobre los dos árboles extraídos con `git archive`). La regla quedó exactamente como se pidió:

- antes: `#again{appearance:none;font:inherit;cursor:pointer}`
- ahora: `#again{appearance:none}`

`cursor:pointer` se fue con ella, y eso está bien: lo sigue dando `button{cursor:pointer}` de la misma hoja — lo verifiqué medido, no razonado (`cursor:"pointer"` en los cuatro anchos).

## 2. Control del instrumento (antes de creer ningún «pasa»)

Serví **los dos commits a la vez**, `692a8a8` en `127.0.0.1:8792` y `12bd4f0` en `127.0.0.1:8791`, y pasé **el mismo arnés** por los dos, con el idioma fijado en `es` y `await document.fonts.ready` en ambos. Sobre el CSS viejo el instrumento reportó:

| | `#again` (viejo) | `#create` |
|---|---|---|
| alto | **47,5 px** | 44 px |
| `font-size` | **16 px** | 13 px |
| `font-weight` | **400** | 600 |

Es exactamente el defecto que reporté en la tercera vuelta, con los mismos números. El instrumento detecta lo que dice detectar. Sin este control, las igualdades de abajo no valdrían nada.

## 3. Estilos computados de `#again` y `#download` frente a `.primary`

Idioma fijo `es`, fuentes cargadas, `dpr` 2. `#again` y `#download` nunca son visibles a la vez (`render()` oculta `#again` en cuanto hay `videoUrl`), así que medí cada uno en su estado real y ambos contra `#create`, que es el `.primary` ya aprobado.

**`#again`, escena lista:**

| ancho | alto | `font-size` | `font-weight` | `border-radius` | fondo | texto | `appearance` | `cursor` |
|---|---|---|---|---|---|---|---|---|
| 320 | **44,00** | 13px | 600 | 10px | `rgb(105,65,207)` | `rgb(255,255,255)` | none | pointer |
| 375 | **44,00** | 13px | 600 | 10px | `rgb(105,65,207)` | `rgb(255,255,255)` | none | pointer |
| 430 | **44,00** | 13px | 600 | 10px | `rgb(105,65,207)` | `rgb(255,255,255)` | none | pointer |
| 1440 | 43,50 | 13px | 600 | 10px | `rgb(105,65,207)` | `rgb(255,255,255)` | none | pointer |

En los cuatro anchos, `#create` devolvió **exactamente los mismos valores**, incluidos `padding` (14/23), `display:flex`, `justify-content:center`, `align-items:center`, `white-space:nowrap`, `line-height:normal`, `border-top-width:0px`, `min-height` y el ancho en píxeles (246 / 301 / 356 / — ). También el mismo `font-family` (`Inter, system-ui, sans-serif`).

**`#download`, vídeo listo:** 44,00 px a 375 y 43,50 px a 1440, con `font-size` 13px, `font-weight` 600, radio 10px, `rgb(105,65,207)` sobre blanco, `appearance:none`, `cursor:pointer` — idéntico a `#again` y a `#create`.

**Sobre los 43,5 px a 1440.** El objetivo pedía alto ≥ 44 px. En escritorio los **tres** botones miden 43,50 px, no solo `#again`: es el alto propio de `.primary` (14 + 14 de relleno más ~15,5 de línea), y la regla de 44 px es la de blanco táctil que impone `@media(max-width:480px)`, donde los tres miden **44,00 px clavados**. No es un defecto de este cambio ni una regresión: es el valor aprobado en la ronda `motion-legible-movil`. Lo anoto para que quede dicho y no lo redescubra otra vuelta.

**La única diferencia que encontré es `appearance`:** `auto` en `#create` frente a `none` en `#again` y `#download`. Es intencional y no cambia nada visible — un `<button>` con `background-color` propio y `border:0` no dibuja cromo nativo. No me quedé con el razonamiento: **rastericé**. A 375 px, «Animar esta escena» y «Otra escena» salen como la misma píldora morada, mismo alto, mismo radio, mismo blanco en negrita. Sin sombra interior ni desplazamiento de línea base.

## 4. Regresión: «Otra escena» y el guardián de cargo

Reproduje el camino real por el que `uncertain` puede quedar en `true` con la escena ya lista — no lo forcé a mano: escena creada bien, y luego **un envío ambiguo de `POST /generate`** (la red falla después de mandar). Ahí `render()` deja `#again` visible con `uncertain === true`. Entonces pulsé «Otra escena»:

| | medido |
|---|---|
| confirmaciones en esa pulsación | **1** (ni 0 ni 2) |
| `POST /compose` que dispara | **1** |
| `studio.uncertain` después | `false` |
| mensaje final | «Tu escena está lista. ¿La animamos?» |

El contador de confirmaciones marcó **0** en los pasos donde no debía preguntar y **1** en el que sí — o sea que distingue, no está clavado en un número.

**Flujo completo escena → animar → vídeo:** exactamente **1** `POST /compose` y exactamente **1** `POST /generate`. Traza del servidor simulado:

```
POST /compose → GET /compose-status → GET /compose-image → POST /generate → GET /status
```

Conté en el **servidor simulado**, no envolviendo `fetch` — la lección 7 de la vuelta anterior.

## 5. Lo demás que revisé y pasa

- **JS válido:** `node --check` en `studio.js`, `i18n.js` y `worker.js` — los tres OK. `studio.css` con llaves balanceadas (118 / 118).
- **i18n:** 48 claves en `es` y 48 en `en`, cero huecos en cualquiera de los dos sentidos. Los 20 `data-copy` de `creator.html` existen en ambos idiomas y ninguno queda vacío al pintar. **Toggle vivo comprobado:** pulsando «English» el botón pasa a «Español», `<html lang>` a `en`, «Otra escena» a «Another scene» — y `#again` sigue midiendo 44,00 px / 13px / 600 en inglés, sin desborde.
- **`localStorage`:** una sola clave, `jiLang`, sin renombrar. Nadie pierde nada.
- **Sin desbordes:** `scrollWidth === clientWidth` en 320, 375, 430 y 1440, en los dos idiomas y en los tres estados (vacío, escena lista, vídeo listo).
- **Accesibilidad y marca:** `#again` es un `<button type="button">` con texto visible, así que no necesita `aria-label` y no lo tiene (correcto: un `aria-label` ahí duplicaría la etiqueta). `.brand-icon` sigue con `aria-hidden="true"`, la marca sigue siendo «Joga **Motion**». `studio.css` no toca nada de marca.
- **Gate y service worker:** este repo no tiene ninguno de los dos. No aplica.
- **Consola:** un solo error, `ERR_UNKNOWN_URL_SCHEME`, y es **de mi arnés** (mandé `about:blank` como `video_url` falso). No es del código.

## 6. Higiene

**No gasté crédito.** Todo contra Worker simulado en `127.0.0.1`, servido desde directorios temporales fuera del repo (`git archive` de cada commit a un directorio de trabajo). No hice push ni deploy. Apagué mis dos servidores comprobando con `ps -o command=` que la línea de comandos completa era la mía antes de matar cada PID — en la máquina había **ocho** `http.server` de otras sesiones, incluido uno en el mismo 8791, y ninguno se tocó. `git status` quedó igual que al empezar: no toqué ningún archivo del proyecto salvo este reporte.

Los archivos de handoff que `git status` marca como modificados o sin seguimiento son de la otra sesión y del plan de esta ronda; no los audité.

---

## Lista de publicación

1. **Push de los estáticos** (`creator.html`, `studio.css`, `studio.js`) **y pegar `worker.js` en Cloudflare.** Las dos cosas, no una. `/compose` cambió de modelo en `7a0e97a` (`nano-banana` → `higgsfield-ai/soul/reference`); si solo sube el sitio, «Crear escena» devolverá 502 `model_not_found` contra el Worker viejo. Los secretos no se tocan. Recordar que `git push` no sale desde el agente: lo lanza José.
2. **Orden seguro:** pegar primero el Worker, después el sitio. Al revés hay una ventana en la que el sitio nuevo pega contra el Worker viejo.

## Lo que queda para la prueba viva — la autoriza José

Nada de esto lo hice yo, y nada de esto debe hacerse sin su visto bueno:

1. **Una escena real con su foto — $0,09.** Comprobar que la persona sale reconocible.
2. **Si le gusta, un vídeo de esa escena — $0,49.** Comprobar dos cosas: que anima **la escena** y no la foto original, y que «Descargar vídeo» abre el archivo.

**Total $0,58.**

---

## Lecciones de esta vuelta

1. **No hubo ningún defecto nuevo, y eso también se gana con el control.** La única razón por la que puedo afirmar «idénticos» sin que sea un «se ve bien» disfrazado es que pasé el mismo arnés por el commit viejo y **le vi encontrar el defecto conocido**. Regla, ya para `AGENTS.md`: **en una vuelta de verificación, servir el commit anterior y el nuevo a la vez y pasar el mismo instrumento por los dos.** El commit viejo es el control perfecto: se sabe exactamente qué tiene que reportar. Un «pasa» sin ese contraste es una afirmación, no una medición.
2. **Una diferencia sobrante en la tabla no es automáticamente un defecto, pero sí obliga a rasterizar.** `appearance:auto` frente a `none` era la única celda distinta entre `#create` y `#again`. Razonar que «un botón con fondo propio no dibuja cromo nativo» es correcto y **no basta** — es justo la clase de cosa que en este proyecto ya salió mal (el favicon del disco negro). Regla: **toda diferencia que quede en pie tras la medición numérica se cierra con un píxel, no con un argumento.**
3. **Reproducir el estado por el camino real, no poniendo la variable a mano.** Para probar el guardián necesitaba `uncertain === true` con la escena lista. Ponerlo a mano habría probado mi suposición; lo saqué haciendo fallar `POST /generate` de forma ambigua, que es como pasa de verdad. Regla: **el estado de una prueba se alcanza por el camino del usuario; si no se puede llegar por ahí, la prueba está midiendo algo que no ocurre.** Además así descubrí cuál es el único camino por el que `#again` puede verse con `uncertain` activo — un dato que ninguna lectura del código me había dado.
4. **`zoom` con región no recorta en este panel: devuelve la captura entera.** No es un defecto del proyecto, es mi herramienta. Regla para el arnés: **si se pide un recorte y vuelve la pantalla completa, la comparación «antes/después» por región no es fiable** — hay que encuadrar por `scrollIntoView` y comprobar con `elementFromPoint` que el elemento está donde se cree, antes de mirar.
5. **Mi primer `pkill -f "python3 -m http.server 8791"` no mató nada** porque la línea real empieza por la ruta larga de `Python.app`. El susto útil es el contrario al de la vez anterior: un patrón **demasiado estrecho** falla en silencio y deja el proceso vivo, igual que uno demasiado laxo mata de más. Regla: **cerrar siempre verificando — `pgrep`, luego `ps -o command=` del PID, comparar la línea completa, matar, y volver a comprobar que el puerto no responde.** En esta máquina había ocho `http.server` de otras sesiones y uno en mi mismo puerto: sin esa verificación, mato el de otro.
6. **El único error de consola era mío.** `about:blank` como `video_url` falso produce un `ERR_UNKNOWN_URL_SCHEME` que parece del código. Regla: **antes de apuntar un error de consola en el reporte, comprobar si lo genera el arnés** — y si es del arnés, decirlo en el reporte igual, para que la próxima vuelta no lo persiga.
