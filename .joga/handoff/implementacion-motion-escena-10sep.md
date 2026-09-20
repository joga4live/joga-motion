# Implementación — ronda motion-escena-10sep, segunda vuelta

Commit: `692a8a8` sobre `7a0e97a` (base `c55b94e`). Corrige los dos defectos de `revision-motion-escena-10sep.md` (J, K) y añade L. Solo se tocaron `studio.js`, `creator.html`, `studio.css` — confirmado con `git diff --stat`.

## J — guardián de cargo en «Otra escena» (crítico)

`studio.js`, handler de `#again` (última línea del archivo):
```js
$('again').onclick=()=>{if(studio.uncertain&&!window.confirm(t('uncertain')))return;resetGeneration();createScene();};
```
Ahora el guardián se evalúa **antes** de `resetGeneration()`, igual que en el botón principal y en `animate()`. Aplicado tal cual lo trae el plan.

**Verificado con comandos:** `node --check studio.js` limpio; lectura del diff confirma que la única diferencia en esa línea es la condición añadida al principio del arrow function, sin tocar el resto del archivo.

**Pendiente de medición** (requiere navegador, no lo hago yo): repetir la tabla de Nico — provocar `uncertain=true` (cortar red al pulsar «Animar esta escena»), luego pulsar «Otra escena» y confirmar que aparece el `window.confirm` con el texto de `uncertain`, que cancelar no dispara `/compose`, y que `studio.uncertain` sigue en `true` tras cancelar. Resultado esperado: mismo comportamiento que el botón principal (1 confirmación, 0 llamadas de red si se cancela).

## K — estilo de `#again`

`creator.html`: el botón pasó de sin clase a `class="primary"`, la misma que `#download`:
```html
<button id="again" type="button" class="primary" hidden data-copy="otherScene"></button>
```
`studio.css`: añadida la única regla que pide el plan, por si el navegador insiste en su `appearance` nativo de `<button>`:
```css
#again{appearance:none;font:inherit;cursor:pointer}
```
Nada más se tocó en `studio.css` (verificado: el diff son 2 inserciones en la línea 1, ninguna regla existente se modificó).

**Verificado con comandos:** `node --check` no aplica a CSS; confirmé por lectura que `.primary` ya define `border:0`, `border-radius:10px`, `background:var(--accent)`, `color:#fff`, `font-size:13px`, `font-weight:600`, y que en `@media(max-width:480px)` hereda `.primary{min-height:44px;width:100%}` igual que `#download`.

**Pendiente de medición** (navegador): estilos computados de `#again` vs `#download` en el estado donde ambos son visibles (escena lista, video generado con error o video listo no aplica porque `#again` se oculta con video — el estado real para compararlos es cuando `#again` está visible y `#download` no, así que la comparación correcta es contra los valores fijos de la clase `.primary`, no lado a lado). Esperado: alto ≥44px, `border-radius:10px`, `font-size:13px`, fondo `#6941cf`/`color:#fff`, sin borde `outset` ni fondo gris de sistema — a 320/375/430/1440px.

## L — «Continuar escena»

`studio.js`:
- Clave `resumeScene` añadida a `TEXT.es` («Continuar escena») y `TEXT.en` («Continue scene»).
- `render()`, línea del texto de `#create`: en modo `scene`, sin `imageReady`, si no está en `failed`, ahora distingue `imageTask` presente (`resumeScene`) de ausente (`createScene`):
```js
studio.mode==='scene'?(studio.imageReady?'animateScene':(studio.message==='failed'?'retry':(studio.imageTask?'resumeScene':'createScene'))):...
```
- El clic de `#create` no cambió: ya llamaba a `createScene()` en este estado, y `createScene()` ya reanuda sin reenviar porque comprueba `if(!studio.imageTask)` antes de hacer `POST /compose`.
- Texto `waiting` (ES y EN) generalizado: ya no nombra «Continuar video», dice «Pulsa Continuar…» / «Press Continue…», válido para el flujo de imagen y el de video.

**Verificado con comandos:**
- `node -e` con `eval` sobre el objeto `TEXT` extraído del archivo: 48 llaves en `es`, 48 en `en`, cero solo-en-un-idioma, cero valores vacíos (incluye `resumeScene`).
- `node --check studio.js` limpio.
- `node tests/worker.mjs` y `node tests/composer-worker.mjs`: PASS (no dependen del texto de UI, pero confirman que el contrato `/compose` y `/generate` sigue intacto).

**Pendiente de medición** (navegador): provocar 12 fallos de sondeo en `/compose-status` con `imageTask` vivo y sin `imageReady`; confirmar que el botón principal muestra «Continuar escena», que pulsarlo hace **0** `POST /compose` nuevos y reanuda el sondeo (`/compose-status` + `/compose-image`), y que el mensaje en pantalla ya no menciona «Continuar video».

## Verificación general

- `node --check studio.js` y `node --check worker.js`: OK (worker.js no se tocó esta vuelta, se revisó igual por costumbre del gate de publicación).
- `node tests/worker.mjs`: PASS.
- `node tests/composer-worker.mjs`: PASS.
- `git diff --stat -- studio.js creator.html studio.css`: 3 archivos, 6 inserciones / 6 borrados — coincide con J, K, L y nada más.
- No hay `gate.js` ni service worker en este repo (confirmado por Nico en su auditoría anterior); no aplican las reglas 1 y 2 de oro.
- i18n: paridad exacta 48/48, incluida la clave nueva `resumeScene`.
- Branding: sin cambios de color, logo ni layout — el único CSS nuevo es una regla de reseteo de `appearance` para un botón que ya existía.

## Pendiente para Nico

1. Medir J: confirmar diálogo antes del reset en `#again` con `uncertain=true`, en un estado real (interrumpir red durante «Animar esta escena»).
2. Medir K: estilos computados de `#again` (alto, radio, fuente, colores) a 320/375/430/1440px, comparados contra los valores fijos de `.primary`/`#download`.
3. Medir L: estado de 12 fallos de sondeo en fase imagen — texto del botón «Continuar escena», 0 `/compose` al reanudar, mensaje `waiting` genérico.
4. No repetí lo que Nico ya midió y no toqué (flujo completo de escena, errores, contraste de `#modes button.on`, geometría de `#scene`, invalidación al cambiar modo/foto/descripción): sigue igual, sin cambios de código ahí.

No hice commit de los archivos untracked de la otra sesión (`investigacion-falai-10sep.md`, `plan-motion-escena-10sep.md`, `sonda-fal-worker.js`, `sonda-modelos-worker-v2.js`, `revision-motion-escena-10sep.md`) — solo `studio.js`, `creator.html`, `studio.css`. Sin push.

## Tercera vuelta — commit `12bd4f0`

Nico encontró un solo defecto en `692a8a8` (sección "3. K — estilo de `#again`: FALLA" de `revision-motion-escena-10sep.md`): la regla de K, `#again{appearance:none;font:inherit;cursor:pointer}`, va en un selector de ID (especificidad 1,0,0) y `font:inherit` es taquigrafía de `font-size`+`font-weight`. Eso gana sobre `.primary` (0,1,0) y cancela `font-size:13px;font-weight:600`, dejando `#again` en 47,5px/16px/400 en vez de 44px/13px/600 como `#download`. Nico midió esto con `getComputedStyle`; yo no lo medí, solo apliqué la corrección que el propio Nico dejó prescrita en su reporte.

**Cambio único**, en `studio.css`, esa misma línea:
```css
#again{appearance:none}
```
Se quitan `font:inherit` y `cursor:pointer`: ambos ya los da la base de la misma hoja con especificidad baja (`button,textarea,input{font:inherit}` y `button{cursor:pointer}`, ambos en la línea 1), que es justo lo que permitía a `.primary` mandar antes de que la regla de ID los bloqueara. Solo `appearance:none` aporta algo nuevo (reseteo para Safari/iOS), y se conserva.

**Verificado con comandos:**
- `git diff --stat` antes de commitear: 1 archivo (`studio.css`), 1 inserción / 1 borrado — nada más tocado.
- `node -e` verificando balance de llaves `{}` en `studio.css`: 118/118 (subió de 117 a 118 al añadir la regla en la vuelta anterior; no cambió en esta).
- `node -e` con regex confirma que el archivo contiene exactamente `#again{appearance:none}` y ya no `font:inherit` ni `cursor:pointer` en esa regla.
- `git diff --stat -- creator.html studio.js worker.js i18n.js`: vacío, ningún otro archivo tocado.
- Commit `12bd4f0`, un solo archivo (`studio.css`, 1 insertion/1 deletion), mensaje bilingüe. Sin push.
- No existe `init.sh` en este repo (`find . -iname init.sh` vacío) — no aplica el paso de `bash init.sh` que pide mi rol por defecto; lo señalo en vez de omitirlo en silencio.
- No hay `gate.js` ni service worker en este repo (confirmado por Nico en su auditoría anterior) — no aplican las reglas 1 y 2 de oro. i18n y branding no se tocaron.

**Pendiente de medición** (navegador, no lo hago yo): repetir exactamente la tabla de Nico — `getComputedStyle(#again)` vs los valores fijos de `.primary`/`#download` en 320/375/430/1440px. Esperado tras el cambio: `#again` en 44px de alto (móvil) / mismo alto que `#download` en desktop, `font-size:13px`, `font-weight:600`, igual que antes de que `font:inherit` lo rompiera — coincidiendo con la fila "sin `font:inherit`" que el propio Nico midió y dejó documentada (44,0px · 13px/600, idéntico a `#download`). También confirmar `overflowX=0` en los cuatro anchos, como ya medía Nico.
