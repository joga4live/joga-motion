# Implementación — Joga Motion, ronda motion-09sep, plan v2

Base: commit `af5b098`. Aplica `plan-motion-09sep-v2.md` al pie de la letra, todos los ítems de la tabla (C1, C2, S3-S6, L1, L2, L4).

## Archivos cambiados

### `worker.js` — reemplazo completo
Contrato nuevo de `/generate`: `multipart/form-data` con `image` (File), `prompt`, `duration`. Sin base64 en ningún punto (S3): `uploadImage` ahora usa `file.arrayBuffer()` directo hacia el PUT presignado.
- `readJson(res)` (S6): lee texto y prueba `JSON.parse`; si falla, `{detail: texto.slice(0,200)}`. Se usa en los 4 puntos que antes hacían `.json()` sin protección.
- `hfError(status, data)` (S4): lee `detail` primero (string o array/objeto), cae a `message`/`error`.
- `/status` y `/download` (S5): usan `fetchStatus`, que trae `{ok, code, data}`; si `!ok`, devuelven fallo explícito en vez de disfrazarse de "processing".
- `TASK_ID = /^[A-Za-z0-9-]{1,80}$/` (L2): valida `task_id` en `/status` y `/download` antes de usarlo en la URL saliente y en `Content-Disposition`.
- `IMAGE_TYPES` (L4): solo `image/jpeg`, `image/png`, `image/webp` — se quitó `image/gif`.
- Comentario de cabecera (L1) actualizado al contrato multipart nuevo.

### `creator.js` — cambios puntuales
- M: `window.onLangChange` ahora solo llama `renderQuickPrompts()`. Se quitó `_origOnLangChange` y la llamada de vuelta a `applyLang()`. Verifiqué en `i18n.js:193` que `applyLang()` es quien llama a `onLangChange()` al final — la llamada de regreso era el ciclo que producía el `RangeError`.
- N: se quitó `imageB64` de `state`. En `handleFile`, se valida el tipo (`jpeg/png/webp`) antes del tamaño, con `showToast(t('c_err_type'))` y `return` si no cumple. Se quitó la línea que armaba `imageB64` desde el `FileReader` (el reader se queda solo para el preview).
- O: en `generateVideo`, la guarda es `if (!state.imageFile)`. El fetch a `/generate` ahora manda `FormData` (`image`, `prompt`, `duration`) sin cabecera `Content-Type` manual.
- P: `/status` usa `encodeURIComponent(taskId)`.
- Q: `downloadVideo` fija `a.target='_blank'; a.rel='noopener';` antes de `a.click()`.

### `creator.html` — una clave nueva
`c_err_type` agregado en `STRINGS.es` y `STRINGS.en`, junto a `c_err_big`:
- ES: "Formato no válido. Usa JPG, PNG o WebP."
- EN: "Invalid format. Use JPG, PNG or WebP."

No se tocó `i18n.js`, `style.css` ni `index.html` — confirmado con `git diff --stat` (sin cambios en esos tres).

## Verificado con comandos

- `node --check worker.js` y `node --check creator.js`: sin errores de sintaxis.
- `grep -n imageB64 creator.js worker.js`: cero resultados — no queda ningún rastro del contrato base64 viejo.
- `grep -n gif worker.js`: no aparece `image/gif` en `IMAGE_TYPES`.
- `grep -c c_err_type creator.html`: 2 (una por idioma) — paridad de la clave nueva confirmada.
- `git diff --stat`: solo `creator.html`, `creator.js`, `worker.js` tienen cambios; `i18n.js`/`index.html`/`style.css` en cero.
- Lectura de `i18n.js:184-193`: confirmé que `applyLang()` llama a `onLangChange()` al final — la causa del bucle documentada en el plan es correcta y el arreglo (M) la corta.

## PENDIENTE DE MEDICIÓN (no verificable con comandos, es de Nico/Kimo MD)

1. **Cero `RangeError` al cargar `creator.html`** — necesita consola de navegador real. Esperado: sin errores; pulsar "10 s" y "Onírico" deja `state.selectedDuration===10`, `state.selectedStyle==='dreamy'`, clase `on` puesta; slider con fondo degradado; cambiar EN/ES repinta los prompts rápidos sin error.
2. **Toast `c_err_type` visible al subir `.gif`/`.bmp`** — necesita interacción real con `<input type="file">` en navegador (no simulable por comando). Esperado: aparece el toast en el idioma activo y la imagen no queda marcada como lista.
3. **Cuerpo `multipart/form-data` real en la pestaña Red** al pulsar GENERAR contra un endpoint local falso — necesita DevTools. Esperado: `image` como archivo binario (no base64), `prompt` con el modificador de estilo, `duration=10` si se eligió esa opción.
4. **Descarga con `409` no navega** — necesita clic real en el botón DESCARGAR contra un endpoint que devuelva JSON. Esperado: la página del creador sigue intacta (`genBtn` sigue presente, URL no cambia) y se abre una pestaña nueva con el JSON, gracias a `target='_blank'`.

No pude medir ninguno de los 4 puntos anteriores porque mi rol no levanta servidores ni navegadores — se lo dejo íntegro a Nico, tal como indica el plan en su sección "Cómo se comprueba".

## Desviaciones del plan

Ninguna. Se siguió el plan v2 literal, incluyendo el `worker.js` completo tal como está en el bloque de código del plan.

## Commit

Un commit local, sin push. Hash: ver `git log -1` en el repo `joga-motion` tras este informe (se crea inmediatamente después de escribir este archivo).

## Nota fuera de alcance

Este repo (`joga-motion`) no tiene `AGENTS.md` ni `init.sh` en su raíz — son del repo principal de Joga Intelligence. Seguí las instrucciones del prompt de esta ronda (que ya traían el plan inline) en su lugar, y lo dejo anotado aquí en vez de fingir que corrí un `init.sh` que no existe.
