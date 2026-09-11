# Implementación — ronda motion-fal-escena-11sep (segunda vuelta: D2)

Commit `4d3e519` sobre `d7cb443` (base `1529c4c`). Solo `worker.js` y `tests/composer-worker.mjs`, como pidió Kimo MD para esta segunda vuelta. No toqué `studio.js`, `creator.html`, `studio.css`, `index.html`, `style.css`, `i18n.js`.

## Contexto

Mi commit anterior (`d7cb443`) señaló que el plan no contemplaba un fallo terminal de fal: el mapeo de estados trataba todo lo no-`COMPLETED` como `processing`, así que un error real dejaría al cliente sondeando para siempre. Kimo MD verificó en la doc oficial de fal (`fal.ai/docs/documentation/model-apis/inference/queue`) que fal solo tiene tres estados (`IN_QUEUE`, `IN_PROGRESS`, `COMPLETED`) y que **un fallo llega como `COMPLETED` con `error`/`error_type`**, y lo dejó como punto D2 en `.joga/handoff/plan-motion-fal-escena-11sep.md`. Esta vuelta aplica exactamente eso.

## `worker.js`

En el bloque de `/compose-status` y `/compose-image`, entre el `if (data.status !== 'COMPLETED') return json({ status: 'processing' })` y la llamada a `falResult`, agregué:

```js
if (data.error) {
  return json({ status: 'failed', error: data.error_type ? `${data.error_type}: ${data.error}` : String(data.error) });
}
```

Esto corta antes de pedir `falResult` — tal como pide D2 — devolviendo `failed` con `error_type: error` cuando ambos vienen, o solo el texto de `error` si no hay `error_type`. El resto del bloque (falResult, `images?.[0]?.url`, reenvío de bytes en `/compose-image`) queda igual que en `d7cb443`. Nada más se tocó en el archivo: confirmado con `git diff` (4 líneas agregadas, 0 borradas fuera de ese punto).

## `tests/composer-worker.mjs`

- Agregué `falStatusError` (variable de control del mock) y lo enchufé en el `if` de `.../status`: cuando está seteado, la respuesta simulada es `{status:'COMPLETED', error, error_type}` en vez de `{status: falStatusValue}`.
- Caso nuevo, con `calls=[]` justo antes para poder contar: `falStatusError={error:'content policy', error_type:'CONTENT_FILTER'}` → `GET /compose-status` responde exactamente `{status:'failed', error:'CONTENT_FILTER: content policy'}` (`assert.deepEqual`) y `calls.length === 1` — es decir, **no** se llamó al endpoint de resultado (`falResult`), que habría sido una segunda llamada.
- Reseteo `falStatusError=null` después, para no interferir con los casos siguientes (`/compose-image` con id inválido/válido).

## Verificación con comandos

- `node --check worker.js`: OK.
- `node tests/worker.mjs`: PASS, intacto (no toca `/compose` ni fal).
- `node tests/composer-worker.mjs`: PASS, incluyendo el caso nuevo D2.
- `git status --short` antes de commitear: solo `worker.js` y `tests/composer-worker.mjs` fueron a `git add`/commit. `.joga/handoff/plan-motion-niveles-10sep.md` sigue modificado sin commitear — es de la otra sesión en paralelo (ronda `motion-niveles-10sep`), no lo tocо ni lo incluí. Tampoco commiteo los `.md`/sondas untracked de esta ronda (eso es de Kimo MD).
- `git diff 4d3e519^ -- studio.js creator.html studio.css index.html style.css i18n.js`: vacío (nada fuera de las dos rutas asignadas).

## Desviación anterior, resuelta

El punto de deviación 1 del reporte previo (fallo terminal de fal sin caso `failed` explícito) queda cerrado con este cambio: ya no depende de que fal invente un cuarto estado — se lee `error` dentro de `COMPLETED`, como documenta fal.

## Pendiente de medición (no lo puedo comprobar yo — no levanto servidores ni navegadores, ni gasto real)

1. Punto 4 del plan original («Cómo se comprueba»): `creator.html` en local contra un Worker simulado, confirmando que el flujo de escena desde la página no cambió (1 `/compose` → sondeo `/compose-status` → `/compose-image` → «Animar esta escena» → 1 `/generate`). Esperado: idéntico a antes, porque no toqué `studio.js` ni `creator.html`, y para el cliente el nuevo caso `failed` usa el mismo shape de respuesta (`{status:'failed', error}`) que ya manejaba antes de esta ronda.
2. Provocar un fallo terminal real contra la cuenta de fal (p. ej. una imagen que dispare `CONTENT_FILTER`) para confirmar que el `error`/`error_type` reales tienen la forma que asumió D2 — solo lo puede hacer quien tenga la llave y autorice el gasto/riesgo.
3. Punto 5 del plan original (producción, gasto real): una escena con la foto de playa vía fal (~$0,04) para confirmar visualmente que la persona aparece reubicada en la escena.
