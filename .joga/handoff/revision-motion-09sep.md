# Revisión — Joga Motion, ronda motion-09sep

Revisor: Nico. Solo lectura. Commit auditado: `af5b098` (local, sin push).
Fecha: 9-sep-2026.

---

## VEREDICTO: **CAMBIOS**

Aclaración importante para no culpar a quien no toca: **Tavo implementó los 12 cambios A–L
exactamente como los pidió el plan, y no tocó nada fuera de los tres archivos autorizados.**
Verifiqué cada uno contra el código y contra la doc oficial de Higgsfield. Su trabajo está bien.

El veredicto es CAMBIOS por dos defectos **medidos** que impiden que la ronda cumpla su objetivo
declarado ("que la generación funcione de punta a punta"):

1. Un fallo **preexistente** que el plan no vio y que deja muerta media interfaz — y que además
   **desmiente una afirmación del plan** en la que se apoya el cambio B.
2. Un fallo **en el código nuevo** (cambio K) que, cuando la descarga falla, borra la página del
   usuario y su resultado.

Ninguno de los dos es "desviación de Tavo". Los dos bloquean.

---

## Alcance — PASA

| Comprobación | Resultado |
|---|---|
| Archivos tocados por `af5b098` | `creator.html`, `creator.js`, `worker.js` — exactamente los tres del plan |
| `i18n.js`, `style.css`, `index.html` | `git diff 1399cc5 af5b098 -- i18n.js style.css index.html` → **vacío**. Intactos byte por byte |
| Archivos de otra sesión | `git status` solo lista `.joga/` sin rastrear. No hay nada de otra ronda |
| Cambios fuera del plan | Ninguno en el diff |
| `node --check worker.js` / `creator.js` | Sin errores |
| Script inline de `creator.html` (extraído y validado) | Sin errores de sintaxis |
| Secretos en claro | `grep` de `api_key/secret/token/bearer/sk-` en `*.js` y `*.html`: **cero resultados**. Solo `env.HF_API_KEY_ID` / `env.HF_API_KEY_SECRET` |

---

## Los 12 cambios A–L — todos implementados

Contrastados contra la doc oficial, que descargué y leí (no me fié del plan).

**Fuentes medidas, no citadas de memoria:**
- `https://docs.higgsfield.ai/docs/openapi.json` (168 050 bytes, HTTP 200):
  `servers: [{"url": "https://api.higgsfield.ai"}]`, 50 rutas.
- La ruta `/kling-video/v2.1/pro/image-to-video` **existe** en el openapi.
- Su schema: `required: ["prompt","image_url"]`;
  `duration: {"enum":[5,10],"type":"integer","default":5}`; `image_url: {type: string, format: uri}`.
- La respuesta declara `status, request_id, status_url, cancel_url, error, images, video, audio, audios`.
- `docs/api-reference/requests/get-request-status.md`: enum
  `queued | in_progress | nsfw | failed | completed | canceled`; el video vive en `video.url`.
- `docs/concepts/file-uploads.md`: `POST https://api.higgsfield.ai/files/generate-upload-url`,
  cuerpo `{content_type}`, respuesta `public_url / upload_url / upload_headers / content_type`,
  subida por `PUT` con **todas** las cabeceras de `upload_headers`, la URL **expira en 1 hora**, y
  el aviso literal: no mandar las credenciales de Higgsfield a la URL prefirmada.
- `curl POST https://api.higgsfield.ai/files/generate-upload-url` sin llaves → **401
  `{"detail":"Invalid credentials"}`**, no 404. La ruta existe de verdad.

| # | Estado | Evidencia |
|---|---|---|
| **A** Host | PASA | `HF_PLATFORM` borrado; `worker.js:60` usa `${HF_BASE}/${MODEL}`. Host = el `servers` del openapi |
| **B** Un solo modelo | PASA | `worker.js:23`. La ruta existe en el openapi. Ver §Crítico 1: la *justificación* del plan es falsa |
| **C** Subida 3 pasos | PASA | `worker.js:27-42` literal de la doc. El `PUT` **no** manda `Authorization` — cumple el aviso de la doc |
| **D** Error diagnosticable | PARCIAL | `hf_status` y 502 están (`worker.js:89`), pero no llegan al usuario. Ver §Serio 4 |
| **E** `video.url` + finales | PASA | `worker.js:102-110`. Campo y enum coinciden con la doc |
| **F** `/download` sin URL del cliente | PASA | `worker.js:114-130`. Solo `task_id`; el Worker relee el status autenticado. Ver §Serio 5 y §Crítico 2 |
| **G** Comentario borrado | PASA | `creator.js:7` limpio |
| **H** `content_type` | PASA | **Medido en el navegador**: el cuerpo real del POST es `{content_type:"image/png", duration:5 (number), image_b64, prompt}`; `style` **no** viaja |
| **I** `c_err_big` | PASA | **Medido**: subir un archivo de 11 MB muestra "La imagen es muy pesada (máx 10 MB)." — no la clave cruda |
| **J** Error real en el toast | PASA | `creator.js:182, 219` |
| **K** Descarga por el Worker | PASA en forma, FALLA en uso | **Medido**: `href = .../download?task_id=TASK-FALSO-123`; sin `state.taskId` no hace nada. Pero ver §Crítico 2 |
| **L** Clave en ES/EN | PASA | **Medido**: paridad `STRINGS.es` 98 llaves / `STRINGS.en` 98 llaves, cero faltantes en ambos sentidos |

### Sospechas que perseguí y que NO eran defecto

- **`atob` con prefijo `data:`** — descartado midiendo. `creator.js:104` hace
  `.split(',')[1]`. Medí el b64 real de un PNG: `tiene_prefijo_data: false`, empieza en
  `iVBORw0KGgoA`. Y corrí el `Uint8Array.from(atob(...))` del Worker sobre ese mismo b64: devuelve
  **861 bytes**, igual que el archivo original, con firma PNG `89 50 4E 47` correcta.
- **`duration` como string** — descartado. Medido: `typeof body.duration === "number"`, valor `5`.
- **`state.taskId` anulado antes de la descarga** — descartado. `resetCreator()` lo anula, pero
  solo después de cerrar el panel de resultado. El guardia `if (!state.taskId) return` funciona (medido).
- **`upload_headers` ausente** — hay respaldo `|| {'Content-Type': type}` (`worker.js:39`).
- **`/download` en el Worker desplegado da 404** — confirmado y **esperado**: lo desplegado es el
  código viejo. No es defecto de Tavo. (`/status` sin `task_id` → 400 y `/generate` sin imagen → 400
  siguen respondiendo bien, con CORS.)

---

## DEFECTOS BLOQUEANTES

### CRÍTICO 1 — `initCreator()` nunca corre: el selector de estilo y el de duración están muertos

**Archivo:línea:** `creator.js:62-66` ↔ `i18n.js:193` (y el disparo en `creator.html:203`).

**Qué pasa.** Recursión mutua infinita:

- `i18n.js:193` — `applyLang()` termina con `if (typeof onLangChange === 'function') onLangChange();`
- `creator.js:64` — `window.onLangChange` llama a `applyLang()`

`creator.html:203` hace `document.addEventListener('DOMContentLoaded', () => { applyLang(); initCreator(); });`.
`applyLang()` revienta con `RangeError: Maximum call stack size exceeded`, el manejador aborta,
y **`initCreator()` no se ejecuta nunca**.

**Qué prueba.** Medido en navegador real sobre `creator.html` servido en `127.0.0.1`:

- Consola al cargar: `Uncaught RangeError: Maximum call stack size exceeded ... onLangChange (creator.js:64:3)`.
- **CONTROL del arnés** (para no repetir el error de medir mal): até un listener temporal al botón
  de 10 s y lo cliqueé → el listener disparó (`CONTROL_click_funciona: true`). Mi clic sintético sirve.
- Clic real en "10 s" y en el estilo "dreamy":
  `antes {dur:5, style:"cinematic", clase_on:false}` → `despues {dur:5, style:"cinematic", clase_on:false}`.
  **Nada cambia.**
- **CONTROL 2**: ejecuté `bindDurBtns(); bindStyleBtns();` a mano y repetí los mismos clics →
  `{dur:10, style:"dreamy", clase_on_dur10:true}`. Los botones sirven; lo que falta es el enlace.
- `intensitySlider.style.background` = `NINGUNO` (lo pone la última línea de `initCreator`).

**Gravedad: CRÍTICA.** El usuario no puede elegir 10 segundos (siempre se manda `duration: 5`) ni
ningún estilo distinto de `cinematic`. Los botones ni siquiera se marcan al pulsarlos. El toggle de
idioma sí cambia el texto (medido: `c_sub` pasa de español a inglés), pero lanza el `RangeError`
en cada pulsación.

**No es regresión de Tavo.** Lo reproduje idéntico en el commit anterior `1399cc5`, servido en otro
puerto: mismo `RangeError` en `creator.js:64`, `initCreator_corrio: false`, clic en 10 s sin efecto.
Viene de Hermes Agent. `creator.js:61-66` e `i18n.js` no los tocó este commit.

**Por qué bloquea igual — y corrección al diagnóstico del líder.** El plan justifica el cambio B así:

> "El estilo YA se diferencia por el texto que `creator.js:148-156` añade al prompt — ese es el
> mecanismo real y se queda ahí."

**Medido: esa afirmación es falsa hoy.** El prompt que capturé del POST real es
`"prueba de auditoria. cinematic camera motion, film look, depth of field. Motion intensity: 5/10."`
— y va a salir con `cinematic` pase lo que pase, porque `state.selectedStyle` nunca cambia. Borrar
`STYLE_MODEL` fue correcto (el modelo `dop` no existe en el openapi, lo confirmé), pero el mecanismo
que el plan dio por vivo está muerto. Y el plan también dio por buenas las 7 clases CSS y los 17 IDs
del DOM sin comprobar que los *enlaces* llegaran a atarse.

**Arreglo:** una línea. Quitar el `applyLang()` de `creator.js:64` (`applyLang` ya es quien invoca a
`onLangChange`, así que la llamada sobra y es la que cierra el ciclo).

---

### CRÍTICO 2 — DESCARGAR tira al usuario fuera de la página cuando el video no está

**Archivo:línea:** `creator.js:254-259` (cambio K).

```js
function downloadVideo() {
  if (!state.taskId) return;
  var a = document.createElement('a');
  a.href = WORKER_URL + '/download?task_id=' + encodeURIComponent(state.taskId);
  a.click();
}
```

El enlace no lleva `target`, así que es una **navegación de primer nivel**. Funciona mientras el
Worker devuelva los bytes con `Content-Disposition: attachment`. En cuanto devuelva JSON —el 409
`{"error":"video not ready"}` de `worker.js:120` cuando pasó la hora de retención de Higgsfield, el
400 de `worker.js:116`, o el 502 de `worker.js:122`— el navegador **reemplaza la página del creador**
por el JSON crudo. El usuario pierde el resultado y la imagen que subió.

**Qué prueba.** Medido con un servidor local que imita las dos respuestas del Worker:

- Contra `409 {"error":"video not ready"}`: llamé a `downloadVideo()` tal cual. La página **navegó**.
  URL después: `http://127.0.0.1:8793/download?task_id=TASK-FALSO-123`;
  `document.getElementById('genBtn')` → `null` (el creador ya no existe);
  texto visible en pantalla: `{"error":"video not ready"}`.
- **CONTROL**: el mismo patrón de anchor contra un endpoint que sí devuelve
  `Content-Type: video/mp4` + `Content-Disposition: attachment` → `navego: false`,
  `sigue_el_creador: true`. La descarga ocurre y la página queda intacta.

El control es lo que hace válido el fallo: mi instrumento distingue los dos casos, no los confunde.

**Gravedad: CRÍTICA** (destruye el trabajo del usuario en un camino que se alcanza solo).
**No es desviación de Tavo:** el fragmento K del plan viene sin `target`; lo copió al pie de la letra.
**Arreglo:** una línea — `a.target = '_blank';` antes del `a.click()`.

---

## HALLAZGOS SERIOS (no bloquean, pero conviene resolverlos antes de la prueba con crédito)

### Serio 3 — el decodificado base64 puede exceder el límite de CPU del Worker
`worker.js:38` — `Uint8Array.from(atob(b64), c => c.charCodeAt(0))`.

**Medido** (Node, mismo motor V8 que workerd; con control de cronómetro: un bucle de 1 000
iteraciones marcó 0,063 ms, así que el reloj mide lo que dice medir):

| Imagen | CPU |
|---|---|
| 0,5 MB | 70 ms |
| 1 MB | 146 ms |
| 2 MB | 379 ms |
| 5 MB | 947 ms |
| 10 MB (el máximo que acepta la página) | **2 132 ms** |

De referencia: `Buffer.from(b64,'base64')` hace lo mismo en 8,8 ms. El coste está en el `charCodeAt`
elemento por elemento, no en el base64.

**Por qué importa:** el techo clásico de CPU por petición en el plan gratuito de Cloudflare Workers
es de **10 ms**. Si `joga-motion-api` está en plan gratuito, *toda* generación con una imagen de más
de ~70 KB se cae con Error 1102, que es una página **HTML sin cabeceras CORS** → el usuario ve
"Failed to fetch" y nadie sabe por qué. **Esto hay que confirmarlo (qué plan tiene el Worker) ANTES
de gastar el crédito en la prueba viva**, o la prueba puede fallar por esto y no por Higgsfield.
No puedo determinar el plan de la cuenta desde aquí. Es código del plan, no de Tavo.

### Serio 4 — el cambio D no cumple su propósito: el usuario sigue sin saber qué falló
`worker.js:89` y `worker.js:36`.

**Medido:** Higgsfield es una API FastAPI y sus errores traen el campo **`detail`**, no `message` ni
`error`:
- `POST /kling-video/v2.1/pro/image-to-video` sin llaves → `401 {"detail":"Invalid credentials"}`
- `GET /requests/inventado/status` sin llaves → `401 {"detail":"Invalid credentials"}`
- ruta inexistente → `405 {"detail":"Method Not Allowed"}`

La cadena `data.message || data.error || 'Higgsfield API error'` **nunca acierta**: cae siempre al
texto genérico. `hf_status` y `raw` sí quedan en la respuesta del Worker, pero `creator.js:177` solo
lee `data.error`, así que con las llaves mal el usuario ve
*"Error al generar el video. Intenta de nuevo. (Higgsfield API error)"* — exactamente el problema
que el plan quería eliminar ("Un 401 = llaves mal; 402 = sin créditos; 422 = schema. Hoy todo se ve
igual"). **Arreglo:** añadir `data.detail` a la cadena, y `hf_status` al texto del toast.
Es defecto del plan, no de Tavo: él escribió el fragmento D tal como venía.

### Serio 5 — `/status` y `/download` no miran si Higgsfield respondió con error
`worker.js:97-110` y `worker.js:117-120`. Nunca se comprueba `statusRes.ok` / `st.ok`.

**Medido contra el Worker desplegado:** `GET /status?task_id=inventado` →
**`HTTP 200 {"status":"processing"}`**. Es decir: un 401 de Higgsfield durante el sondeo se disfraza
de "procesando" y `creator.js` gira los **5 minutos completos** antes de rendirse con el mensaje
genérico. En `/download` el mismo caso sale como 409 "video not ready", que miente sobre la causa.

### Serio 6 — `.json()` sin protección en cuatro puntos
`worker.js:54` (`request.json()`), `:84`, `:101`, `:118`. Si la respuesta no es JSON, la excepción
sube sin capturar: el Worker devuelve **500 sin cabeceras CORS** y el navegador solo ve
"Failed to fetch". Riesgo **bajo** y lo bajo por medición: comprobé que Higgsfield devuelve
`content-type: application/json` incluso en 401 y 405. Queda el caso de un 5xx del borde de
Cloudflare (HTML) y el de un cuerpo malformado del cliente en `:54`.

---

## Lista aparte — lo que el plan NO pidió y quizá debería (no bloquea)

1. **`worker.js:52`** — el comentario sigue diciendo `{ image_url OR image_b64, prompt, duration, style }`
   y `style` ya no se lee. **Tavo lo declaró él mismo en su nota** en vez de arreglarlo por su cuenta:
   eso es exactamente lo correcto. Una línea.
2. **`worker.js:117` y `:127`** — `taskId` se interpola sin codificar en la URL del status y en la
   cabecera `Content-Disposition`. Mismo host, riesgo bajo, pero un `task_id` con comillas o salto de
   línea puede hacer que el constructor de `Headers` lance y devuelva 500. Sanear a
   `[A-Za-z0-9-]` resuelve las dos. (`creator.js:206` tampoco codifica el `task_id` de `/status`;
   preexistente.)
3. **CORS `*` sin autenticación en `/generate`** — cualquiera que conozca la URL del Worker puede
   gastar el crédito de Higgsfield de José. Preexistente; `/download` añade otra ruta abierta.
   No urge hoy, sí antes de que esto sea un producto de pago.
4. **`worker.js:25`** — `IMAGE_TYPES` incluye `image/gif`, que Kling image-to-video probablemente
   rechace. Solo se manifiesta si alguien sube un GIF.
5. **El límite de 10 MB de `creator.js:100`** — con el coste de CPU del §Serio 3, convendría bajarlo
   (2 MB sobran para una imagen de entrada) o cambiar el decodificado, sea cual sea el plan del Worker.

---

## Lo que NO hice

- **Ninguna generación real.** No gasté crédito. Solo José la autoriza. Es lo único que puede
  demostrar que `HF_API_KEY_ID` / `HF_API_KEY_SECRET` están bien puestas en el Worker — nada de lo
  que medí lo demuestra.
- **Ningún push ni despliegue.** El commit sigue local.
- **No edité ni un archivo del proyecto.** Mi única escritura es este reporte. El servidor de
  pruebas, las copias de `creator.html`, la copia del commit anterior y el servidor que imita la
  descarga viven todos en el directorio temporal de la sesión, nunca dentro del repo.

---

## Lecciones de esta vuelta

Reglas, no defectos. Para `AGENTS.md` §9.

1. **Que un botón exista en el HTML y su clase CSS exista en la hoja de estilos no prueba que el
   botón haga algo.** El plan verificó "los 17 IDs del DOM existen" y "las 7 clases de estado
   existen" y de ahí dio por vivo el mecanismo de estilos. Los enlaces (`addEventListener`) estaban
   sin atar. **Regla: para dar por vivo un control de interfaz, hay que pulsarlo y ver cambiar el
   estado — nunca basta con que el elemento y su clase existan.**

2. **Abrir la página y leer la consola es más barato que cualquier razonamiento, y encuentra cosas
   que nadie estaba buscando.** El `RangeError` llevaba tres commits ahí, sobrevivió al diagnóstico
   contra la documentación y a la implementación. Apareció en el primer segundo de cargar la página.
   **Regla: antes de auditar un diff de front-end, cargar la página y leer la consola. Un error no
   capturado en el arranque invalida todo lo que venga después en ese mismo manejador.**

3. **Cuando el plan afirma "esto ya funciona y no se toca", esa lista es lo primero que hay que
   medir, no lo último.** La sección "Lo que SÍ está bien" del plan es donde se escondía el fallo
   crítico. Enlaza con la lección ya conocida de que una afirmación imprecisa del líder se vuelve
   premisa incuestionada para Tavo y para mí. **Regla: la lista de "no se toca" del plan se audita
   con la misma dureza que el diff.**

4. **Un fragmento de código dentro del plan no está revisado por estar en el plan.** Los dos
   bloqueantes de esta ronda salieron de código que el plan traía escrito y Tavo copió al pie de la
   letra: el `downloadVideo()` sin `target` y el decodificado base64 de 2 132 ms. **Regla: el código
   literal que viene dentro de un plan se audita como código, no como instrucción ya aprobada.**

5. **Un camino de error se mide provocándolo, no leyéndolo.** Que `a.click()` tumbe la página entera
   no se ve leyendo `downloadVideo()`; se ve montando un endpoint que devuelva el 409 y mirando la
   URL después. Y hace falta el par: el caso feliz **no** navega, el caso de error **sí**. Sin ese
   par yo no habría sabido si mi instrumento medía el anchor o medía otra cosa. **Regla: todo camino
   de error que el código nuevo introduce se ejercita contra un endpoint falso que devuelva esa
   respuesta exacta, con el caso feliz como control.**

6. **Distinguir "preexistente" de "nuevo" cuesta dos minutos y cambia a quién se le pide el
   arreglo.** Levanté el commit anterior en otro puerto y reproduje el `RangeError` idéntico. Sin
   eso habría acusado a Tavo de una regresión que no cometió. **Regla: todo defecto que se encuentre
   en una auditoría se reproduce contra el commit anterior antes de llamarlo regresión.**

7. **Un límite de plataforma es un defecto medible, no una nota al pie.** "Decodificar base64 en el
   Worker" suena gratis hasta que sale 2 132 ms contra un techo de 10 ms. **Regla: todo trabajo por
   byte que se meta dentro de un Worker se cronometra con el tamaño máximo que la interfaz permite
   subir, y se compara contra el límite de CPU del plan contratado.**

8. **Un tropiezo mío, para que no se repita.** Al levantar el servidor de prueba escribí
   `curl .../download?task_id=x` sin comillas en zsh y el shell se comió el comando (`no matches
   found`), lo que me devolvió un código HTTP vacío que por un momento leí como "el servidor no
   responde". **Regla: en zsh, toda URL con `?` o `&` va entre comillas; un resultado vacío de
   `curl` es sospecha de shell antes que sospecha de servidor.**
