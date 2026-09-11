# Implementación — ronda motion-fal-escena-11sep (tercera vuelta: D3)

Commit `8b5437c` sobre `7637a05` (HEAD antes de este cambio; incluye ya `4d3e519` D2, aprobado y desplegado). Solo `worker.js` y `tests/composer-worker.mjs`. No toqué `studio.js`, `creator.html`, `studio.css`, `index.html`, `style.css`, `i18n.js`, ni los `.md` de handoff de otras sesiones.

## Contexto

Una verificación en ejecución del 11-sep (con `wrangler dev` y llaves falsas) encontró que el `catch` externo de `/compose` convertía **cualquier** excepción en el texto genérico «Scene service unavailable. Submission may have been accepted; do not retry automatically.» — incluyendo el caso en que `uploadImage()` falla *antes* de tocar fal (`upload-url 401: Invalid credentials`, o `image PUT failed (524)`), donde la frase «may have been accepted» es directamente falsa: nada se envió. En producción, la primera escena real por fal falló a los 43 s con ese mismo texto genérico, sin que quedara claro por qué. Kimo MD dejó esto como punto D3 en `.joga/handoff/plan-motion-fal-escena-11sep.md`.

## `worker.js`

Único cambio, en el `catch` externo de la ruta `/compose` (línea ~112):

```diff
-      } catch { return json({ error: 'Scene service unavailable. Submission may have been accepted; do not retry automatically.' }, 502); }
+      } catch (e) { return json({ error: e && e.message ? e.message : 'Scene service unavailable' }, 502); }
```

Ahora el mensaje que ve el cliente es la causa real (`e.message`) cuando la hay — p. ej. `upload-url 401: Invalid credentials` o `image PUT failed (524)`, ambos ya construidos así por `uploadImage()` — y cae al texto genérico solo si la excepción no trae `message`. Se quitó la frase «Submission may have been accepted»: como señala el plan, el único caso en que el envío pudo haberse aceptado es que el `fetch` a fal lance *después* de enviar, y para eso el cliente ya tiene su propio guardián `uncertain` en `studio.js`, que no toqué. Nada más se modificó en el archivo — confirmado con `git diff`: una sola línea cambiada.

## `tests/composer-worker.mjs`

- Agregué dos variables de control al mock: `presignStatus` y `putStatus` (ambas `null` por defecto).
  - `.../files/generate-upload-url`: si `presignStatus` está seteado, responde `{detail:'Invalid credentials'}` con ese status en vez del presign normal.
  - `PUT https://upload.test/...`: si `putStatus` está seteado, responde con ese status en vez de `200`.
- Dos casos nuevos, junto a los demás de `/compose`:
  - `presignStatus=401` → `POST /compose` con 1 foto → `502`, `error` matchea `/upload-url 401/`.
  - `putStatus=524` → `POST /compose` con 1 foto → `502`, `error` matchea `/image PUT failed \(524\)/`.
  - Ambas variables se resetean a `null` justo después para no interferir con los casos siguientes (fal `IN_PROGRESS`, etc.).

## Verificación con comandos

- `node --check worker.js`: OK.
- `node --check tests/composer-worker.mjs`: OK.
- `node tests/worker.mjs`: PASS, intacto.
- `node tests/composer-worker.mjs`: PASS, incluyendo los dos casos nuevos de D3.
- `git diff -- worker.js tests/composer-worker.mjs` revisado antes de commitear: 1 línea cambiada en `worker.js`, 16 inserciones / 4 borrados en el test (los dos casos nuevos más las dos variables de control), nada más.
- `git status --short` antes de `git add`: solo `worker.js` y `tests/composer-worker.mjs` fueron a staging y al commit. `.joga/handoff/plan-motion-fal-escena-11sep.md` (modificado) y `.joga/handoff/revision-procedimiento-cloudflare-11sep.md` (sin trackear) son de la otra sesión/de Kimo MD — no los toqué ni los incluí en el commit.
- Commit local `8b5437c`, un solo commit, sin push.

## Pendiente de medición (no lo puedo comprobar yo — no levanto servidores ni navegadores, ni gasto real)

1. **La huella gratis del plan** («Publicación»): `POST /compose` sin fotos → el texto debe seguir siendo «one to eight reference photos required» (eso no cambió en esta vuelta, pero es la forma barata de confirmar que el Worker pegado en Cloudflare es el correcto tras el deploy).
2. **El caso real que disparó esto**: la escena de producción que falló a los 43 s con el mensaje genérico — no sé si la causa real era `image PUT failed (524)` (sospecha del plan) u otra cosa, porque el mensaje genérico se comía la evidencia. Con este cambio, la próxima vez que ocurra, el mensaje en pantalla debería traer la causa real. Solo se puede confirmar reproduciéndolo o esperando a que vuelva a pasar en producción, con quien tenga la llave y autorice el riesgo/gasto.
3. **Punto 4 del plan original** («Cómo se comprueba»): `creator.html` en local contra un Worker simulado, confirmando que el flujo de escena desde la página no cambió. Esperado: idéntico a antes — no toqué `studio.js` ni `creator.html`, y el shape de la respuesta de error (`{error}` con 502) no cambió, solo su contenido.
4. **Punto 5 del plan original** (producción, gasto real): una escena con la foto de playa vía fal (~$0,04) para confirmar visualmente que la persona aparece reubicada en la escena — sigue pendiente de esta ronda, no depende de D3.
