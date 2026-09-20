# Revisión — Joga Motion, ronda motion-09sep, VUELTA 2

**Revisor:** Nico
**Commit auditado:** `bb707de`
**Base:** `af5b098` (vuelta 1, veredicto CAMBIOS)
**Plan:** `.joga/handoff/plan-motion-09sep-v2.md`
**Nota de Tavo:** `.joga/handoff/implementacion-motion-09sep-v2.md`

## Veredicto: **APROBADO**

Los 2 críticos, los 4 serios y los 3 de la lista aparte de la vuelta 1 están corregidos y **medidos**. No encontré ningún defecto atribuible a Tavo, ni ningún cambio fuera del plan v2. `worker.js` es idéntico byte a byte al bloque del plan.

**Una salvedad que no escondo:** C2 (que la descarga no tumbe la página) quedó **sin verificar** — no porque el código falle, sino porque **mi arnés falló su propio control** y no puedo certificar con él. Detalle completo en M5. El código es correcto por construcción y no hay nada que Tavo deba cambiar, pero es el primer punto a mirar en la prueba viva.

Aprobado ≠ probado en vivo. Ver "Qué queda SIN probar" al final.

---

## Bitácora de mediciones (se anota conforme se mide)

### M0 — Alcance y sintaxis
- `git diff --name-only 1399cc5 bb707de` → solo `creator.html`, `creator.js`, `worker.js` (+ la nota de handoff).
- `git diff 1399cc5 bb707de -- i18n.js style.css index.html` → **0 bytes**. Los tres intocados. PASA.
- `node --check worker.js` → OK. `node --check creator.js` → OK. (Node v24.20.0)
- `worker.js` vs. el bloque de código del plan v2: **idéntico byte a byte** (líneas 1-136).
- Trabajando limpio salvo los `.md` de handoff sin trackear. No se auditan archivos de otra sesión.

### M1 — C1 bucle `applyLang`↔`onLangChange` (crítico de la vuelta 1)
Servido en `http://127.0.0.1:62724/creator.html` (python3 http.server, solo lectura sobre el repo). Idioma fijado a `es` y `document.fonts.status === "loaded"` antes de medir.

- **Consola al cargar: 0 entradas.** Cero `RangeError`.
- **CONTROL DEL ARNÉS:** inyecté a propósito una recursión infinita (`boom()`) y `read_console_messages` devolvió `[error] Uncaught RangeError: Maximum call stack size exceeded`. El instrumento **sí** detecta lo que dice detectar → el "0 entradas" de arriba es una medición real, no un lector ciego.
- `initCreator()` corrió: `#quickPrompts` tiene **5** botones, el primero "Zoom suave hacia el horizonte...".
- **Clics reales** (no sintéticos) sobre "10 segundos" y "Onírico", con testigo de clics instalado como control:
  - testigo: `["10 segundos","Onírico"]` → los clics **sí** llegaron al DOM.
  - `state.selectedDuration === 10` (typeof `number`), `state.selectedStyle === "dreamy"`.
  - clase `on` exclusiva: `dur[5=false, 10=true]`; `estilo[cinematic=false, smooth=false, dynamic=false, dreamy=true, zoom=false, pan=false]`.
- **Slider con fondo:** `background-image: linear-gradient(to right, rgb(123,92,246) 44.4444%, rgba(255,255,255,0.07) 44.4444%)`. Para value=5, min=1, max=10 → (5-1)/9 = 44.44 %. Correcto.
- **Toggle de idioma (4 clics reales):** ES→EN repinta los 5 prompts rápidos ("Gentle zoom toward horizon..."), `c_dur_label` → "Video duration", botón → "ES", y `state` sobrevive intacto (`dur:10, estilo:dreamy`). 4 vueltas ES/EN sin errores nuevos en consola ni acumulación (siempre 5 prompts).

**C1: PASA.**

### M2 — N: validación de tipo de imagen en el cliente
Ejercitado el camino real (`input.files` vía `DataTransfer` → `handleFile(input)`), idioma `es`:

| archivo | toast | visible | `state.imageFile` | badge | preview | zona `filled` |
|---|---|---|---|---|---|---|
| `prueba.gif` (`image/gif`, cabecera GIF89a) | "Formato no válido. Usa JPG, PNG o WebP." | sí | `null` | none | none | no |
| `prueba.bmp` (`image/bmp`) | "Formato no válido. Usa JPG, PNG o WebP." | sí | `null` | none | none | no |
| **CONTROL** `prueba.png` (`image/png`) | (vacío) | no | `prueba.png (image/png)` | block | block | **sí** |

El control PNG demuestra que los `File` sintéticos sí atraviesan el código real; los rechazos no son "el arnés no llegó". Paridad es/en de `c_err_type` comprobada **en vivo**: en `en` → "Invalid format. Use JPG, PNG or WebP."

**N: PASA.**

### M3 — Contrato de Higgsfield frente a los supuestos del Worker (doc pública, sin gastar crédito)
Consultado `docs.higgsfield.ai/docs/openapi.json` y las páginas de conceptos. Ninguna contradicción:

- `request_id` es **UUID** (`"format": "uuid"`, ej. `d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff`). Un UUID solo trae hex y guiones → **pasa** `TASK_ID = /^[A-Za-z0-9-]{1,80}$/` (36 ≤ 80). **El regex NO es bloqueante.** Era el riesgo señalado en el encargo: descartado con la doc en la mano.
- `upload_headers` es un **objeto plano** (`{"Content-Type":"image/jpeg","x-amz-tagging":"retention=temporary"}`) → `headers: p.upload_headers` de `worker.js:46` es válido, y la doc dice explícitamente que hay que mandar *todas* esas cabeceras. Correcto. Subida por **PUT**: correcto.
- Cuerpo de generación: `{prompt, image_url, duration}` **a nivel raíz**, sin envoltorio `params`; `duration` es entero **enum [5,10]**; requeridos `prompt` e `image_url`. `worker.js:87` coincide.
- Estado: `GET /requests/{id}/status`, `status` ∈ {queued, in_progress, nsfw, failed, completed, canceled}, video en `video.url`. `worker.js:53-57,102-110` coincide, y `queued`/`in_progress` caen bien en el balde `processing`.
- Auth: `Authorization: Key <ID>:<SECRET>` es la forma **recomendada** (las cabeceras `hf-api-key`/`hf-secret` son legacy). `worker.js:65` coincide.

### M4 — O: contrato multipart en el cable (capturado en un endpoint local falso)
`WORKER_URL` redirigido en memoria al falso `127.0.0.1:62725` (sin tocar archivos del repo). Imagen: PNG real de 1×1 (70 bytes). Estilo **Onírico**, duración **10 s**, ambos elegidos con clics reales.

Cabeceras recibidas: `content-type: multipart/form-data; boundary=----WebKitFormBoundary0RrFMIDSyGWffoRQ`, `content-length: 558`. El navegador puso el boundary solo → **no** hay `Content-Type` manual en el `fetch`. Correcto.

Cuerpo recibido (558 bytes, 3 partes):
```
------WebKitFormBoundary0RrFMIDSyGWffoRQ
Content-Disposition: form-data; name="image"; filename="joga-prueba.png"
Content-Type: image/png

.PNG....IHDR..............IDATx.c...P....IEND.B`.
------WebKitFormBoundary0RrFMIDSyGWffoRQ
Content-Disposition: form-data; name="prompt"

La camara sube despacio sobre el mar. dreamy ethereal motion, soft glowing particles. Motion intensity: 5/10.
------WebKitFormBoundary0RrFMIDSyGWffoRQ
Content-Disposition: form-data; name="duration"

10
------WebKitFormBoundary0RrFMIDSyGWffoRQ--
```
Comprobado por bytes, no a ojo:
- firma PNG binaria `89 50 4E 47` **presente** en el offset 143 → la imagen viaja **binaria**.
- la cadena base64 `iVBORw0KGgo` **ausente** → **cero rastro del contrato viejo**. (S3/N confirmados en el cable.)
- `prompt` lleva el modificador del estilo elegido: `"dreamy ethereal motion, soft glowing particles"`.
- `duration` = `10`, el que se eligió con el clic.
- 70 bytes de imagen → 558 de cuerpo: sobrecarga de multipart, no el +33 % de base64.

**Sondeo:** el fake registró `\/status?task_id=abc` repetido. Intervalo medido sobre 20,1 s de reloj: **4 peticiones → 5,03 s** (esperado 5,00 s de `creator.js:215`). Un solo temporizador, sin duplicados.
> Tropiezo mío: al principio conté "6 peticiones en ~14 s" y sospeché de un temporizador doble. Era mi aritmética sobre el tiempo de ida y vuelta de las herramientas, no el código. Al cronometrarlo de verdad dio 5,03 s. Anotado en las lecciones.

**O: PASA.**

### M5 — C2 (descarga que no debe tumbar la página): **NO VERIFICADO — mi arnés falló su propio control**
Esto es lo más importante de esta vuelta y quiero ser explícito: **no pude medirlo**, y no voy a presentarlo como PASA.

Lo que ocurrió, en orden:
1. Primer clic real en DESCARGAR contra `409 {"error":"video not ready"}`: la pestaña **sí** se fue a `http://127.0.0.1:62725/download?task_id=abc`, mostrando el JSON, y `genBtn` desapareció. Es decir: el fallo de la vuelta 1, reproducido.
2. No reprodujo. Repetí el mismo clic real **6 veces más** (recargando entre tandas, con un contador `pagehide` guardado en `sessionStorage` que sobrevive a la navegación): **0 salidas, URL intacta, `genBtn` presente** en las 6.
3. **CONTROL NEGATIVO** (el que decide): fabriqué el ancla tal como estaba en la vuelta 1, **sin `target`**, y la pulsé de verdad. **Tampoco navegó.** Un arnés que no reproduce el fallo conocido no puede certificar su ausencia.
4. Segundo instrumento, Chrome real: el control negativo tampoco navegó; y al poner un **testigo dentro del `onclick`** descubrí que el testigo quedaba **vacío** — los clics del extensión **nunca llegaban al manejador**. Todos los "no navegó" de Chrome eran ciegos. Después las capturas de pantalla empezaron a agotar el tiempo ("renderer unresponsive") y la activación por teclado tampoco disparó el manejador.

**Conclusión honesta:** de 7 clics reales, 1 tumbó la página y 6 no; y el control que debía distinguir las dos versiones del código **no distingue**. Por tanto ni los 6 aciertos ni el 1 fallo son evidencia utilizable. C2 queda **sin medir**.

Lo que sí puedo afirmar sin navegador, y es lo que sostiene el veredicto:
- `creator.js:243-250` contiene `a.target='_blank'` y `a.rel='noopener'` antes de `a.click()`; leí la función **tal como está cargada en la página** (`downloadVideo.toString()`), no solo el archivo en disco, así que no es una lectura de código obsoleto.
- Por el estándar HTML, seguir un hipervínculo con `target` no vacío y distinto de `_self` navega **otro** contexto de navegación: **no puede reemplazar el documento actual**. El modo de fallo concreto de la vuelta 1 queda estructuralmente descartado por construcción, no por medición.
- Evidencia lateral de que el botón sí llega al servidor: la consola del panel registró `Failed to load resource: the server responded with a status of 409 (Conflict)` tras los clics en DESCARGAR — la petición se emite.

**Lo que queda para la prueba viva:** que al pulsar DESCARGAR con un video real (`Content-Disposition: attachment`) el archivo **se descargue** y la página del creador **siga en pie**; y que ningún bloqueador de ventanas emergentes se trague la pestaña de `_blank`.

### M6 — Worker ejercitado de verdad (44 comprobaciones) + control de mutación
Copié `worker.js` sin editar (solo `.mjs` para que Node lo importe; `diff` = idéntico) y ejercité `worker.fetch()` con `fetch` simulado y `Request`/`FormData`/`File` nativos de Node 24. **44/44 PASAN.** Lo relevante:

**S3 — sin base64:** el PUT recibe un `ArrayBuffer` de 100 bytes (`putCall.body instanceof ArrayBuffer`). No hay `atob`, `btoa`, `charCodeAt`, `fromCharCode` ni bucle por byte en `worker.js` ni en `creator.js` (grep: cero). Los 2 132 ms de CPU de la vuelta 1 desaparecen por construcción.

**Bugs nuevos del rediseño que había que descartar — todos limpios:**
- `p.upload_headers` como objeto → el PUT sale con `{"Content-Type":"image/png","x-amz-tagging":"retention=temporary"}`, las dos cabeceras que la doc exige. Si Higgsfield no manda `upload_headers`, cae a `Content-Type` del archivo. Correcto.
- `Number(form.get('duration'))`: `"10"`→10, `"5"`→5, `"basura"`→5, ausente→5. **Nunca NaN.**
- `form.get('image')` que no es `File` (texto) → **400**, no 500.
- Cuerpo no-multipart → **400 con CORS** (S6), no una excepción sin cabeceras.
- `duration` viaja como **entero** `10`, en la **raíz** del JSON, sin envoltorio `params` — igual que el schema de Higgsfield.

**S4 — `detail` de Higgsfield:** `detail` string → `"422: prompt violates policy"`. `detail` **array** → `422: [{"loc":["body","prompt"],"msg":"field required",...}]`, serializado, **sin `[object Object]`**. Sin `detail` cae a `message` → `"429: rate limited"`.

**S5 — `res.ok`:** `/status` con 401 → `{"status":"failed","error":"401: Invalid API key"}` (antes se disfrazaba de "processing" 5 minutos). `/download` con 401 → 502 explícito. Vídeo caído → `"video fetch failed (404)"`.

**S6 — `readJson`:** presign con cuerpo **vacío** → 502 con CORS. Presign con **HTML** → 502 y el texto recortado llega al cliente. Ninguna excepción sin CORS.

**L2 — `TASK_ID`:** el UUID real de Higgsfield `d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff` **se acepta**. Rechazados con 400 y **cero llamadas salientes**: `../../secret`, `a b`, `abc?x=1`, vacío, 81 caracteres, `ab/cd`, `a%2e%2e`.

**Estados:** `queued`/`in_progress` → `processing`; `failed`/`nsfw`/`canceled` → `failed` con motivo; `completed` sin `video.url` → `failed` (no deja al cliente sondeando 5 min).

**CONTROL DE MUTACIÓN (lo que hace creíble el 44/44):** rompí el worker a propósito de cuatro formas y la batería **se puso en rojo cada vez**:

| Mutación (reintroduce el bug de la vuelta 1) | Resultado |
|---|---|
| `/status` ignora `res.ok` | 43/44 — cae la prueba de S5 (`{"status":"processing"}`) |
| `hfError` deja de leer `detail` | 39/44 — caen 5 pruebas (`"Higgsfield API error"`) |
| `TASK_ID` sin guiones | la batería revienta: el UUID deja de pasar |
| vuelve `image/gif` a `IMAGE_TYPES` | 43/44 — cae la prueba de L4 |
| **sin mutar (código real)** | **44/44** |

Una batería que solo sabe decir "verde" no vale; ésta sabe decir "rojo".

### M7 — Alcance fino, i18n, `localStorage`, regresiones
- **Cero cambios de layout no pedidos.** El diff de `creator.html` son exactamente **2 líneas añadidas** (`c_err_type` en es y en en). Ni una regla de estilo, ni un elemento, ni un atributo tocado. `style.css` e `index.html` a cero.
- **Paridad i18n medida en la página viva** (no por grep): de las **28** claves `data-t`, **28 traducidas en ES y 28 en EN**, ninguna cayendo al nombre de la clave. El único valor idéntico en ambos idiomas es `s_zoom = "Zoom In"`, que es intencional.
- **Llaves de `localStorage`: intactas.** `JM_LANG_KEY = 'jiLang'` sigue igual y `i18n.js` no se tocó → **nadie pierde su idioma guardado**. Es la única llave del proyecto.
- **L1 (comentario obsoleto): corregido.** `worker.js:67` ahora dice `multipart/form-data: image (file), prompt, duration (5|10)`. Ningún comentario menciona ya `style`, base64 ni el contrato JSON viejo.
- **Sin restos del contrato viejo:** grep de `imageB64|image_b64|atob|btoa|base64` en `worker.js` y `creator.js` → **cero**.
- Accesibilidad y branding: el commit no toca marca, logotipo ni `aria-*`; no hay marca duplicada nueva. Nada que reportar en esta vuelta.

---

## Defectos

### Defectos de Tavo
**Ninguno.** Implementó el plan v2 literalmente; `worker.js` coincide byte a byte con el bloque del plan y los cambios de `creator.js`/`creator.html` son exactamente los puntos M, N, O, P, Q y R. Las cuatro cosas que dejó marcadas como "pendiente de medición" eran, en efecto, las cuatro que sólo se pueden medir con navegador, y declaró honestamente que no las midió en vez de afirmarlas. Tres de las cuatro (C1, N, O) las medí y pasan; la cuarta (C2) es la que mi arnés no pudo certificar.

### Lo que el plan no pidió (no bloquea esta vuelta)
1. **`worker.js:5-9` — CORS abierto a `*` sin autenticación.** Cualquiera puede gastar el crédito de Higgsfield de José apuntando a la URL del Worker. El plan v2 lo anotó explícitamente como "para antes de vender", así que **no lo cuento como defecto de esta ronda**, pero sigue en pie y crece de importancia en cuanto haya crédito de pago detrás.
2. **`creator.js:180` — el sondeo se rinde a los 5 minutos** (60 intentos × 5 s) y enseña el error genérico. Para 10 s de Kling en hora punta puede quedarse corto; el video se generó y el usuario ve "Error al generar el video". No estaba en el plan; conviene medirlo en la prueba viva antes de decidir si se sube.
3. **`creator.js:214` — `.catch(function(){})` silencioso en el sondeo.** Es deliberado (errores transitorios de red), pero si el Worker cae del todo, el usuario espera los 5 minutos completos sin señal. Anotado, no urgente.
4. **`index.html` sigue diciendo "Kling AI"** en `feat2_desc` mientras el Worker usa Kling **a través de Higgsfield**. No es falso, y `index.html` está fuera de alcance por el plan; lo dejo apuntado para la ronda de textos.

---

## Qué queda SIN probar hasta la prueba viva (la que autoriza José)
No gasté un solo crédito de Higgsfield y no toqué el Worker desplegado (que sigue con el código viejo, como avisaba el encargo). Esto es lo que **sólo** la prueba viva puede decidir, y lo que espero ver en cada caso:

1. **C2 — DESCARGAR con un video real.** Es lo primero que hay que mirar, porque es lo único que no pude certificar. *Espero ver:* el archivo `joga-motion-<uuid>.mp4` se guarda y **la página del creador sigue en pie** (el botón GENERAR sigue ahí, la URL no cambia). *Señal de alarma:* que la pestaña se llene de texto JSON, o que no pase absolutamente nada (bloqueador de ventanas emergentes comiéndose el `_blank`).
2. **`request.formData()` devolviendo `File` en el Worker desplegado.** Cloudflare sólo entrega `File` en los formularios si la *compatibility date* del Worker es ≥ 2021-11-03 (bandera `formdata_parser_supports_files`). Este repo **no tiene `wrangler.toml`** — José pega el código en el panel, así que la fecha es la que tenga ya ese Worker, y no puedo leerla desde aquí. *Espero ver:* la generación arranca normal. *Señal de alarma inequívoca:* **toda** generación falla al instante con `"image must be JPEG, PNG or WebP"` aunque la imagen sea un PNG válido — eso sería exactamente este problema, y se arregla subiendo la compatibility date en el panel, sin tocar el código.
3. **El camino feliz completo contra Higgsfield real:** que `/files/generate-upload-url` conteste con `upload_url`/`public_url`, que el PUT con `upload_headers` sea aceptado por el almacenamiento, y que el `request_id` que vuelve sea el UUID que espero. Todo eso lo medí contra un doble, no contra el servicio.
4. **Los tiempos reales:** cuánto tarda un video de 5 s y uno de 10 s, para saber si los 5 minutos de sondeo bastan (punto 2 de la lista de arriba).
5. **Un error real de Higgsfield de punta a punta** (por ejemplo un prompt rechazado): *espero ver* el toast con el texto real de Higgsfield entre paréntesis, no el genérico a secas. Es lo que S4 debía arreglar y sólo se ve con un error auténtico.

---

## Lecciones de esta vuelta

**Del proceso de medición (todas mías, ninguna del código):**

1. **Un instrumento que no reproduce el fallo conocido no puede certificar su ausencia.** Antes de dar por bueno un "no pasa nada", hay que construir la versión *rota* del código y comprobar que el arnés la ve fallar. En C2 hice ese control **al final**, y descubrí que mis 6 "PASA" no valían nada. Si lo hubiera hecho **primero**, me habría ahorrado la mitad del trabajo. Regla: **el control negativo va antes de la medición, no después.**
2. **Un clic sintético no es un clic hasta que un testigo lo confirma.** En Chrome real, todos mis clics devolvían "clicked on element ref_N" y **ninguno llegaba al manejador**: el testigo dentro del `onclick` quedó vacío. La herramienta informa de que hizo el gesto, no de que el gesto surtiera efecto. Regla: **en toda prueba de interacción, un testigo dentro del manejador; sin testigo, el resultado no se apunta.** (En los botones de estilo/duración sí lo puse, y por eso esa medición sí vale.)
3. **Una batería en verde no dice nada hasta que se la ve en rojo.** Las 44 comprobaciones del Worker sólo valen porque cuatro mutaciones deliberadas las tumbaron. Regla: **toda batería nueva se valida mutando el código que examina.**
4. **No deducir el tiempo transcurrido de los `sleep` del guion.** Conté "6 sondeos en 14 s" y sospeché de un temporizador duplicado; al cronometrar con reloj real dio 5,03 s, exacto. Las idas y vueltas de las herramientas tardan lo suyo. Regla: **si la medición es un ritmo, se toma la hora al empezar y al terminar.**
5. **`grep` con patrones cortos miente.** `grep -n gif worker.js` "encontró" gif en cuatro líneas: estaban dentro de `JSON.strin**gif**y`. Y mi regex de claves i18n dio 5 falsos huecos porque no veía varias claves en una misma línea. Ambas se resolvieron midiendo en la página viva. Regla: **para paridad de idiomas, cosechar de la página renderizada, no del texto fuente.**
6. **Escribir el reporte desde el primer minuto funcionó.** El intento anterior de esta auditoría se perdió entero al trancarse al final. Esta vez cada medición quedó anotada al hacerla. Regla: **crear el archivo del veredicto antes de la primera medición y anotar conforme se mide.**

**Del código y del proyecto:**

7. **El regex que parecía bloqueante no lo era, y la doc lo zanjó en minutos.** `TASK_ID = /^[A-Za-z0-9-]{1,80}$/` frente a un `request_id` que resultó ser UUID: encaja. Regla: **antes de marcar como bloqueante un formato de identificador, buscar un ejemplo literal en la documentación del proveedor** — es más rápido que razonarlo y no se equivoca.
8. **Un cambio de contrato entre el cliente y el servidor se comprueba en el cable, no en los dos archivos por separado.** Leer `creator.js` y `worker.js` y "ver que coinciden" no habría detectado un `Content-Type` manual de más. Capturar los 558 bytes reales sí. Regla: **cuando cambia el contrato de una petición, capturar el cuerpo real contra un doble local.**
9. **La compatibility date de un Worker es parte del código aunque no esté en el repo.** `request.formData()` devolviendo `File` depende de ella, y aquí no hay `wrangler.toml` que la fije. Regla: **cuando el Worker se pega a mano en el panel, anotar en el reporte los supuestos de plataforma y el síntoma exacto que delataría que fallan.**
10. **Anotar el PID al levantar cada servidor y comprobar la identidad del proceso antes de matarlo.** Había un servidor de otra sesión escuchando en el 8791 (PID 7404) y siguió vivo. Regla ya conocida, cumplida: **matar por PID propio anotado, nunca por coincidencia de números de puerto.**
