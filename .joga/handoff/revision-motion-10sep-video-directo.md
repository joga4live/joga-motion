# Revisión — ronda motion-10sep-video-directo (commit `de6e3d1`)

Revisor: Nico · 10-sep-2026 · solo lectura (no toqué ni un archivo del proyecto; este reporte es mi única escritura)
Base comparada: `45538fa` · Implementación: `de6e3d1` (Tavo) · Plan: `plan-motion-10sep-video-directo.md`

## Veredicto: **CAMBIOS**

Dos defectos reales, los dos de una línea, los dos en el mismo bloque `catch` de `studio.js:39-45`.
Todo lo demás que el plan pedía **pasó, medido**: el diseño está intacto al píxel, el flujo directo a
`/generate` funciona, el motivo real del error se ve, y el sondeo tolerante no reenvía trabajos (no
duplica cargos).

---

## Cómo medí (y el control que respalda cada número)

Navegador real (Chrome vía Playwright 1.60 tomado de `~/Downloads/motor-agentico-v2.0.0/node_modules`,
**nada instalado en el repo**), `studio.js` y `creator.html` servidos **byte a byte** desde el repo
(hash verificado contra el servidor: `creator.html`, `studio.js`, `studio.css` IDÉNTICOS). Worker
simulado por interceptación de red. **Cero peticiones reales a Higgsfield: 0 crédito gastado**
(contador de peticiones al dominio real = 0 en todas las corridas; en la corrida móvil las bloqueé
explícitamente).

Controles del arnés, antes de creer nada:
- **Control del interceptor**: un `fetch` directo desde la página al Worker devolvió mi cuerpo
  simulado (`{"task_id":"ctrl"}`) → el mock sí está en el camino.
- **Control del contador de envíos**: forcé un segundo envío legítimo («Crear otra versión») y el
  contador marcó `POST /generate = 2` → cuando digo «una sola», el instrumento sabe contar dos.
- **Control de geometría**: inyecté `.editor{padding-left:40px}` y mi comparador detectó 5 cajas
  movidas → cuando digo «0 diferencias», el instrumento sabe ver diferencias.
- Idioma fijado por `localStorage` antes de cargar y `document.fonts.ready` esperado en cada medición
  (las dos causas de mis falsos positivos anteriores).
- **Susto de arnés, resuelto:** al apagar mi servidor descubrí que el puerto 8791 seguía ocupado. Hay un
  `python3 -m http.server 8791` **ajeno, PID 7404, corriendo desde el 28-ago** (13 días), atado a `*:8791`
  y sirviendo un directorio que devuelve 404 en todo. **No lo maté: no es mío.** Mis mediciones no están
  contaminadas y lo puedo probar: (a) el `shasum` de `creator.html`, `studio.js` y `studio.css` servidos
  coincidió con el del repo antes de medir; (b) mi bind más específico (`127.0.0.1`) gana sobre el
  comodín para las conexiones IPv4, y al apagarlo el mismo `curl` pasó de `200` a `404`; (c) si algo
  hubiera llegado al servidor ajeno, la página habría sido un error 404, no el estudio con sus textos
  correctos. **José: ese proceso viejo conviene cerrarlo** (`kill 7404`), pero que lo haga quien lo abrió.

---

## CRÍTICO

Ninguno. Nada de lo que encontré deja la app en blanco, ni rompe el flujo, ni cobra dos veces.

---

## Defectos (bloquean el APROBADO)

### 1. Vuelve la falsa alarma de cargo: un 4xx sin cuerpo JSON dispara «podría haberse generado un cargo»
**Archivo:** `studio.js:43` — `else if(submitting){studio.uncertain=true;studio.message='uncertain';}`
**Gravedad:** media (no cuesta dinero; asusta al usuario y le mete un `confirm` en cada intento posterior)
**Regresión:** sí. En `45538fa` la rama era `else if(submitting&&!e.rejected)`. El guardián `!e.rejected`
se perdió en esta ronda — y viene **del plan**, no de Tavo: el bloque `catch` que Tavo copió está escrito
así, literal, en `plan-motion-10sep-video-directo.md` §C. Corrijo aquí mi propio encargo: el plan
introdujo la regresión que el plan venía a arreglar.

**Prueba (medida):** Worker simulado responde `413 "Payload Too Large"` con `Content-Type: text/plain`
al `POST /generate`:

```
E5  msg="No se pudo confirmar el envío. Revisa tu actividad en Higgsfield antes de crear otra
         versión: podría haberse generado un cargo."   uncertain=true
```

Un 4xx significa que la petición fue **rechazada antes de llegar a Higgsfield** — no hay cargo posible.
Los 4xx del propio Worker traen JSON (`{"error":…}`) y caen antes en la rama `e.detail`, por eso no se
notó; el hueco lo abren los 4xx **del borde de Cloudflare o de un proxy corporativo** (403 de WAF, 429,
413, portal cautivo con HTML). Verifiqué el contraste: `400` **con** JSON sí muestra el motivo real
(`E6: "No se pudo completar la solicitud. (duration must be 5 o 10)"`, `uncertain=false`).

### 2. Tras un minuto de fallos transitorios, el usuario lee «no se pudo completar» aunque el trabajo sigue vivo
**Archivo:** `studio.js:42` — la rama `else if(e.detail)` se come la rama `waiting` de `studio.js:44`
**Gravedad:** media (riesgo de que el usuario pague dos veces por decisión propia)
**Estado:** es la desviación que Tavo reportó honestamente en su nota (§«Desviación de plan»). La medí y
**confirmo su diagnóstico**: tiene razón, y el plan estaba equivocado al afirmar que se cae en `waiting`.

**Prueba (medida), 12 fallos seguidos de `/status`:**

| Caso | Mensaje que ve el usuario | Botón | `videoTask` |
|---|---|---|---|
| 12× `502 {"error":"502: upstream timeout"}` | «**No se pudo completar la solicitud.** (502: upstream timeout)» | «Continuar video» | conservado |
| 12× corte de red (sin cuerpo) | «La consulta se interrumpió. Pulsa Continuar video…» | «Continuar video» | conservado |

Como el Worker (`worker.js:29-31`, `hfError`) **siempre** produce un `error` no vacío, el caso real es
siempre el primero: la fila correcta es inalcanzable en producción.

**Por qué no lo doy por aceptable** (la pregunta que me hiciste): la parte cara está bien —medí que
pulsar «Continuar video» hace **0 nuevos `POST /generate`** y reanuda el sondeo del mismo `task_id`—,
pero el mensaje y el botón se contradicen. «No se pudo completar la solicitud» es lenguaje de fracaso
definitivo; el usuario que lo cree **edita la descripción o cambia la foto** (`resetGeneration()` pone
`videoTask=null`) y vuelve a pulsar Crear video → **segundo cargo por un trabajo que probablemente
sigue vivo y va a completarse**. El camino barato existe y está a un `else if` de distancia.

**Cambio que pido (una línea, insertada antes de la rama `e.detail`):**

```js
else if(!submitting&&studio.videoTask&&!e.rejected){studio.message='waiting';studio.detail=e.detail||'';}
```

Verifiqué esta rama contra los 11 escenarios que ya medí y no rompe ninguno: el `!e.rejected` evita que
un 4xx terminal durante el sondeo (p. ej. `task_id required`) quede atrapado en un «Continuar video»
eterno, y el `!submitting` deja intacto el camino de envío. Resultado para el usuario: «La consulta se
interrumpió. Pulsa Continuar video para consultar el mismo trabajo sin enviarlo otra vez. (502: upstream
timeout)» — motivo real **y** salida barata.

**Y en el mismo bloque, para el defecto 1:** `else if(submitting&&!e.rejected)` (restaurar el guardián).

---

## Menores (no bloquean, decide José)

3. **`creator.html:22`** conserva el literal `0 / 8` como contenido estático del `#photoCount`. El plan §F
   pedía ajustar los textos fijos fuera de `data-copy`. Medido: `render()` lo sobrescribe a `0 / 1` en el
   arranque, así que el usuario nunca lo ve — salvo que `studio.js` no cargue. Cosmético, pero es deuda.
4. **Soltar varias fotos a la vez no avisa.** El `<input>` ya no es `multiple` (correcto), pero el
   `ondrop` (`studio.js:48`) sí recibe varias. Medido: soltar 3 válidas → se queda la primera (`a.png`),
   `mensaje=""`, sin explicación. Como la clave `limit` se eliminó, no hay texto que decir. Sugerencia:
   o un aviso nuevo, o dejarlo (el contador «1 / 1» ya insinúa el límite).
   Caso mixto medido: soltar `[malo.gif, bueno.png]` → añade `bueno.png` **y** muestra «Usa imágenes JPG,
   PNG o WebP…». Defendible, pero confunde.
5. **Textos que siguen en plural** con un flujo de una sola imagen, en los dos idiomas por igual:
   `subtitle` («Tus imágenes y una idea» / «Your images and an idea»), `emptyText` («Añade tus imágenes»),
   `footer` («Editar las fotos»). El plan §E no los listaba; lo anoto para que José decida.
6. **`studio.stage` quedó muerto**: se escribe en `studio.js:36` y ya nadie lo lee (`render()` usa
   siempre `t('animating')`). Sin efecto, pero invita a confusión en la próxima ronda.
7. **`tests/studio.cjs` quedó codificando el contrato viejo** (8 fotos, `/compose`, mensaje «Puedes añadir
   hasta 8 imágenes»). Tavo lo documentó como el plan §H permitía, así que **no se lo cuento como falta**.
   Sí corrijo un hecho que los dos dimos por bueno: **Playwright sí existe en este Mac** — lo usé desde
   `~/Downloads/motor-agentico-v2.0.0/node_modules/playwright` con `channel:'chrome'`. Lo que falta no es
   Playwright, es un `package.json` en `joga-motion` (los binarios de `~/Library/Caches/ms-playwright` son
   de la versión 1181 y esa copia pide 1223, por eso hay que usar el Chrome instalado).

---

## Fuera de alcance, pero hay que decirlo: la letra del diseño nuevo es demasiado chica

`studio.css` **no se tocó** en esta ronda, así que esto no bloquea el commit — pero el diseño que José
aprobó hoy llega al celular así (habilidad `revisar-en-celular`, Chrome con emulación real de iPhone,
320/375/430 px, ES y EN, con foto y descripción cargadas):

| Medida | Español | Inglés |
|---|---|---|
| Desbordes horizontales | **0** en 320, 375 y 430 | **0** |
| `scrollWidth` vs pantalla | 320/320, 375/375, 430/430 | igual |
| Textos bajo 12 px | **11 de 19 (58%)** | 10 de 19 (53%) |
| El más chico | **9 px** («VISTA PREVIA») | 10 px |
| Botones bajo 44×44 | **7** | 7 |

El peor botón es la **× para quitar la foto: 23×23 px** (le faltan 21 px por lado). Referencia para José:
esta conversación se lee en 16 px; el texto más chico de su estudio mide 9.
No lo arregló nadie porque nadie lo había medido: es del diseño de esta mañana, no de este commit.
**Lo que sí verifiqué es que esta ronda no lo empeoró**: mismo CSS, mismas cajas.

---

## Lo que verifiqué y **sí** pasó (con evidencia)

**Alcance (limpio).** `git show de6e3d1 --stat` → solo `creator.html` (1 línea), `studio.js` (38 líneas) y
la nota de implementación. `git diff 45538fa de6e3d1 -- worker.js studio.css style.css index.html i18n.js`
→ **vacío**. `git status` sin archivos modificados de otra sesión (solo mis handoff sin seguir).

**Diseño intacto — medido, no mirado.** Comparé 18 cajas (`getBoundingClientRect` de `.hero`, `.studio`,
`.editor`, `.preview`, `.upload`, `#create`, `.create-row`, `.cost-note`, `#examples`, `.preview-screen`,
`.preview-footer`, `.footer-note`, `textarea`, `.nav`, `.hero-copy`, `.hero-image` + `scrollWidth` y
`scrollHeight`) entre `45538fa` y el árbol de trabajo, mismo idioma, mismas fuentes cargadas:
**0 diferencias de 18**. DOM estático de `<main>` **idéntico**. Único cambio de atributo: `multiple`
(antes `true`, ahora `false`). El control con CSS inyectado detectó 5 cajas movidas, así que el cero es
un cero de verdad.

**Sintaxis y pruebas.** `node --check studio.js` OK. `node tests/worker.mjs` → PASS.
`node tests/composer-worker.mjs` → PASS (rutas `/compose*` del Worker, que siguen vivas y sin llamarse).

**Una imagen, reemplazo y fuga de memoria.** Subir → `1 / 1`, 1 miniatura, sin mensaje de error. Subir otra
→ sigue en `1 / 1`, 1 miniatura, la miniatura muestra el archivo nuevo (`alt="dos.png"`), y
**`URL.revokeObjectURL` recibió exactamente la URL anterior** (instrumenté la función: 1 revocación, la
correcta). «Crear video» deshabilitado sin descripción y con solo espacios.

**Camino feliz — red medida.** Rutas observadas: `["POST /generate","GET /status","GET /status"]`.
**Una sola** `POST /generate`, multipart con `image` (filename `foto.png`), `prompt` y `duration=5`.
**Cero llamadas a `/compose*`.** Sondeo `?task_id=abc`, intervalo medido **5012 ms**. Con `completed` +
`video_url`: video visible, `#download` con `target="_blank"` y `rel="noopener"`, href
`…/download?task_id=abc`, mensaje «Tu video está listo.», botón «Crear otra versión», progreso oculto.

**Motivo real del error (el defecto de esta mañana, cerrado).** `502 {"error":"404: model_not_found"}` →
«**No se pudo completar la solicitud. (404: model_not_found)**», `uncertain=false`, **sin** la frase del
cargo, y el reintento no muestra ningún `confirm`. `{"status":"failed","error":"nsfw"}` → «El proveedor no
pudo completar la generación. Puedes intentarlo de nuevo. (nsfw)», `videoTask=null`, botón «Intentar de
nuevo».

**D2 (sondeo tolerante).** 3 fallos `502` seguidos y luego `completed` → **el video llega igual**, 4
sondeos, **1 sola** `POST /generate`, 16 s. Tras rendirse a los 12 fallos, «Continuar video» → **0 nuevas
`POST /generate`** y el sondeo se reanuda con el mismo `task_id`. La plata está protegida.

**D3.** Tras un error, escribir en la descripción deja el mensaje **vacío** (`""`), no un texto huérfano.

**Camino a la alarma de cargo (tu pregunta 7).** Ya **no** es el único: además del `fetch` que lanza (red
caída → `uncertain=true` y `window.confirm` en el intento siguiente, medido), llegan a `uncertain` el
`200` sin `task_id` (correcto: el trabajo pudo aceptarse) y el `500` sin cuerpo (correcto), **y también
los 4xx sin cuerpo, que es el defecto 1** (incorrecto). Con el guardián restaurado vuelven a ser solo los
tres primeros.

**Idiomas.** 35 claves en `es` y 35 en `en`, **0 faltantes en cada lado**; todos los `data-copy` de
`creator.html` tienen traducción; ninguna clave con el mismo texto en los dos idiomas; las claves muertas
`limit` y `composing` se eliminaron **y** no quedó ninguna referencia a ellas (`grep` limpio). El botón de
idioma cambia los seis textos nuevos en ambos sentidos, conserva lo escrito en el `textarea`, traduce el
`aria-label` del botón de quitar («Remove image 1»), y **en ninguna pantalla aparece la palabra
`undefined`**. Consola: **0 `pageerror`, 0 `console.error`** en las 11 corridas.

**Reglas de oro y llaves.** No hay `gate.js` ni service worker en este repo (no aplican). Única llave de
`localStorage`: `jiLang`, sin renombrar → nadie pierde nada. Sin secretos en el diff. Marca (`.brand`,
`index.html`, el hero) sin tocar. `aria-live="polite"` del `#message` intacto.

---

## Si se aplican los dos cambios: qué queda para la prueba viva con crédito

1. Aplicar las dos líneas del bloque `catch` y volver a correr `node --check studio.js`. No hace falta otra
   ronda completa mía: puedo reverificar solo los 11 escenarios de error en un par de minutos.
2. **Publicar** (Pages sigue sirviendo el `studio.js` viejo: sin push, lo de producción no mide nada de
   esto). Recordatorio del flujo real: `git push` no funciona desde el agente.
3. **Una sola** prueba con crédito: 1 foto real de José + una descripción corta → esperar el `completed`.
   Lo que hay que mirar es una sola cosa, porque es lo único que no puedo simular: que Higgsfield acepte
   `kling-video/v2.1/pro/image-to-video` con **su** llave (lo que reventó hoy fue `/nano-banana`, otro
   modelo). Si vuelve `404: model_not_found`, ahora el usuario **verá el motivo** en pantalla en vez de la
   alarma de cargo.
4. Después de esa prueba: el `/download` real (mi medición sólo comprueba el `href`, el `target` y el
   `rel`; que el archivo baje con `Content-Disposition` lo verifica `tests/worker.mjs`, no el navegador).
5. Pendiente aparte, para José: la letra de 9-11 px y la × de 23×23 en el celular.

---

## Lecciones de esta vuelta

- **Un plan que trae el código escrito hereda sus propios defectos.** El guardián `!e.rejected` no lo
  borró el implementador: venía borrado en el bloque `catch` que el plan entregó listo para pegar. Regla:
  cuando el plan incluya código literal, el que lo escribe debe **difear ese bloque contra el que
  reemplaza** y justificar cada trozo que desaparece; y el revisor debe auditar el plan como código, no
  como intención.
- **Un `catch` con ramas en cadena es un orden de prioridades, y el orden es la lógica.** Añadir una rama
  nueva (`e.detail`) delante de las viejas silenció una rama existente (`waiting`) sin que nadie lo
  escribiera. Regla: al insertar una rama en un `if/else if`, enumerar los casos que ya pasaban por ahí y
  decir por cuál rama salen ahora — Tavo lo hizo por razonamiento y acertó; medirlo lo confirmó en 20
  segundos.
- **«El mensaje correcto» y «el botón correcto» son dos aciertos distintos.** Aquí el botón decía
  «Continuar video» (barato) mientras el texto decía «no se pudo completar» (caro). Regla: cuando un
  estado de error conserva un trabajo que ya se pagó, revisar **texto y botón juntos**, y preguntarse qué
  hace el usuario que solo lee el texto.
- **Una desviación reportada por el implementador vale doble.** Tavo marcó el punto 2 él mismo y su
  diagnóstico era exacto; sin esa nota yo habría llegado igual, pero una hora más tarde. Regla: la nota de
  implementación debe seguir teniendo una sección obligatoria «lo que no salió como el plan decía»,
  aunque el implementador crea que es aceptable.
- **«La herramienta no está instalada» merece un segundo grep antes de darlo por hecho.** Los dos dimos
  por muerto Playwright; estaba a un `find` de distancia en otro proyecto del mismo Mac. Regla: antes de
  anotar «no se pudo probar por falta de X», buscar X en todo `~/Downloads` y `~/Documents`; y si el repo
  tiene tests que dependen de X, ese repo necesita su `package.json`.
- **Lo que nadie mide, nadie arregla.** El diseño de esta mañana pasó dos revisiones y llegó al celular
  con el 58% de sus textos por debajo de 12 px, porque las dos revisiones miraron el flujo, no la
  tipografía. Regla: **todo cambio visual aprobado pasa por `revisar-en-celular` antes de cerrarse**,
  aunque el cambio no sea «de celular».
- **Elegir un puerto «poco usado» no es lo mismo que comprobar que está libre.** Me até al 8791 sin
  mirar, y ahí llevaba 13 días un servidor olvidado de otra sesión. Esta vez no pasó nada porque el
  `shasum` de la habilidad `revisar-en-celular` caza justo esto — pero la suerte no es un control. Regla:
  antes de levantar un servidor, `lsof -nP -iTCP:<puerto> -sTCP:LISTEN`; si hay algo, cambiar de puerto,
  **nunca** matar lo que hay. Y regla hermana: los servidores olvidados son de quien los abrió; el
  revisor los reporta, no los apaga.
- **Tropiezo mío, para que no se repita:** monté el servidor de medición en un puerto fijo y lo apagué por
  PID exacto (`kill 19958`, proceso verificado por nombre completo antes de matarlo), nunca por
  coincidencia de número de puerto — la regla que salió del día que maté dos procesos del sistema.
  Ninguna de mis herramientas escribió dentro del repo: Playwright prestado, servidor y scripts en el
  scratchpad.

---

# Tercera vuelta — `c18d0ab` (comprobación final)

## Veredicto: **APROBADO**

## 1. Alcance del diff (`git diff de6e3d1 c18d0ab --stat`)
```
 .joga/handoff/implementacion-motion-10sep-video-directo.md | 7 +++++++
 studio.js                                                  | 3 ++-
 2 files changed, 9 insertions(+), 1 deletion(-)
```
Solo `studio.js` (+ la nota de Tavo). El cambio de código es exactamente el bloque D4 del plan
(`studio.js:42` añadida, `studio.js:44` modificada); ni una línea más. `node --check` OK en
`studio.js`, `worker.js` e `i18n.js`.

`git status` sigue limpio salvo los cuatro archivos sin seguimiento en `.joga/handoff/` (planes y
revisiones, incluido `revision-motion-10sep.md` de la otra sesión — **no auditado**, no es de esta ronda).

## 2. Control del arnés (antes de creer ningún resultado)
Serví **el mismo `creator.html` del repo** en `127.0.0.1:8913` (servidor estático, solo lectura;
`md5` del `studio.js` servido == el del repo: `a37c83ecf737a7fbde663ee60fa78e20`) y, en paralelo,
una copia del código **anterior** (`git show de6e3d1:studio.js`) fuera del repo en `127.0.0.1:8914`.
Worker simulado con intercepción de red en Playwright.

Control: el escenario 413 contra el código viejo reprodujo **el defecto que reporté**
(`message='uncertain'`, texto del cargo en pantalla). Contra `c18d0ab`, el mismo escenario da
`error`. El instrumento distingue las dos versiones: sus «PASA» no son humo.

## 3. Mediciones — los seis escenarios del catch

| # | Escenario | `message` | `uncertain` | `detail` | `videoTask` | Botón |
|---|---|---|---|---|---|---|
| A | 413 `text/plain` en el envío | `error` | **false** | `''` | `null` | Crear video |
| B | 502 `{"error":"404: model_not_found"}` en el envío | `error` | false | `404: model_not_found` | `null` | Crear video |
| C | corte de red en el envío (fetch lanza) | **`uncertain`** | true | `''` | `null` | Crear video |
| D | 3 fallos 502 en `/status`, luego `completed` | `ready` | false | `''` | conservado | Crear otra versión |
| E | 12 fallos seguidos en `/status` | **`waiting`** | false | `503: temporary upstream` | **conservado** | **Continuar video** |
| F | `{"status":"failed","error":"nsfw"}` | `failed` | false | `nsfw` | **`null`** | Intentar de nuevo |

- **A** — texto en pantalla: «No se pudo completar la solicitud.» Sin la frase del cargo. Era el
  defecto crítico de la segunda vuelta; cerrado.
- **C** — `uncertain` sigue siendo el **único** camino a esa alarma (única asignación en todo el
  archivo, `studio.js:44`, y solo A/B/E la evitaron sin bloquearla aquí).
- **E** — 12 llamadas a `/status`, ni una más a `/generate`. Al pulsar «Continuar video»:
  `POST /generate` antes = **1**, después = **1** → **0 envíos nuevos**; volvió a sondear el mismo
  `task_id` (`task-xyz-1`). El motivo real viaja hasta el texto: «La consulta se interrumpió… (503:
  temporary upstream)». Era el segundo defecto de la segunda vuelta; cerrado.
- **F** — `videoTask` a `null`, como debe: un `failed` terminal no deja trabajo pendiente.

## 4. Camino feliz (ES y EN)
1 imagen → **exactamente 1 `POST /generate`** → 2 sondeos (`processing`, `completed`) → video visible
(`#video src`), `#emptyPreview` oculto, `#progress` oculto. Descargar: `href` =
`…/download?task_id=task-xyz-1`, **`target="_blank"`**, `rel="noopener"`.
Textos: ES «Tu video está listo.» / «Crear otra versión»; EN «Your video is ready.» / «Create another
version». **0 `pageerror` y 0 mensajes de consola** en ambos idiomas (los `502`/`413` de los
escenarios de fallo son el log de red del navegador, no errores de la app).

## 5. Regresiones y reglas de oro
- **i18n:** 35 claves en `es`, 35 en `en`, **paridad exacta**, sin claves huérfanas. Toggle vivo
  (medido: la interfaz entera cambia de idioma).
- **`localStorage`:** única llave `jiLang`, sin renombrar. Progreso de usuarios intacto.
- **Branding:** `creator.html` no se tocó en este commit; cabecera, emblema y hero idénticos.
- **Gate / service worker:** este repo no tiene ninguno de los dos; nada que romper.
- **`multiple`:** sigue fuera del `<input id="photos">` (0 coincidencias) — lo aprobado en la vuelta
  anterior sigue en pie.
- **Layout:** el diff no toca HTML ni CSS. Cero cambios visuales.

## 6. Qué falta para la prueba viva con crédito en producción
Esta ronda **no gastó ni un crédito**: todo se midió contra un Worker simulado. Lo que queda, y solo
José puede hacerlo:
1. **Desplegar** `worker.js` en Cloudflare (pegado a mano, `git push` no funciona desde el agente) y
   el sitio con `creator.html` + `studio.js`.
2. **Una sola generación real** con una imagen propia: confirmar que el modelo de video responde con
   `task_id`, que `/status` llega a `completed` y que el video se reproduce y se descarga.
3. **Comprobar el gasto** en la actividad de Higgsfield: debe aparecer **una** generación, no dos —
   es la única forma de confirmar en vivo que el guardián de doble envío funciona con dinero de por
   medio.
4. Si en esa prueba sale `404: model_not_found`, el mensaje de error ya muestra el motivo real: el
   arreglo está en el Worker (nombre del modelo), no en `studio.js`.

## Lecciones de esta vuelta

- **Un defecto encontrado leyendo se cierra midiendo, no releyendo.** Los dos fallos del `catch` los
  hallé por trazado de ramas; la tentación esta vuelta era volver a trazar el bloque nuevo y darlo
  por bueno. Regla: **cuando el revisor propone la corrección, está obligado a medirla como si la
  hubiera escrito otro** — el autor de un arreglo no es buen juez de su propio arreglo, y el revisor
  que dicta el arreglo se vuelve su autor.
- **El mejor control de un arnés es la versión anterior del código.** Servir `de6e3d1` en un puerto
  y `c18d0ab` en otro convierte el «pasa» en «pasa *y* el instrumento veía el fallo hace un commit».
  Regla: **para verificar una corrección, correr el mismo escenario contra el commit previo y exigir
  que falle ahí.** Cuesta un `git show` y elimina de raíz el falso PASA por arnés mudo.
- **`head` en una tubería mata al proceso que mide.** El escenario de 12 fallos corrió 64 s y su
  resultado se perdió por un `SIGPIPE` de `tee … | head -200`: el encabezado se imprimió y el JSON no.
  Un resultado truncado parece un resultado. Regla: **la salida de una medición va a archivo primero
  (`> salida.txt`), y se lee del archivo**; nunca se recorta la tubería de la que depende el proceso.
- **Servir el repo en vez de copiarlo prueba lo que se publica.** Levanté el servidor estático
  apuntando al directorio del repo (lectura pura) y verifiqué por `md5` que el `studio.js` servido es
  byte a byte el del commit. Regla: **antes de medir, comparar el hash del archivo servido con el del
  repo**; una copia desactualizada en el scratchpad es el modo más silencioso de auditar código que
  no existe.
- **Puertos y limpieza, sin novedad y a propósito.** Comprobé con `lsof` antes de elegir 8913/8914,
  dejé en paz el 8791 ajeno (13 días en pie, no es mío) y apagué los míos por PID exacto verificando
  antes el nombre completo del proceso. Ninguna herramienta mía escribió dentro del repo. Sin
  incidentes que reportar en este apartado.
