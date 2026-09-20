---
name: verify
description: Cómo ejecutar de verdad el Worker de Joga Motion y la página del creador para verificar un cambio (no tests): wrangler dev local con llaves falsas, huellas por ruta, y qué NO se puede medir sin gastar.
---

# Verificar Joga Motion en ejecución

## Worker (`worker.js`) — superficie: HTTP

No hace falta cuenta ni token. `node` existe en el Mac; `wrangler` no está global, `npx` lo baja (~40 s la primera vez).

```bash
V=/tmp/verify-joga-motion && mkdir -p $V && git show <commit>:worker.js > $V/worker.js && cd $V
npx --yes wrangler@4 dev worker.js --local --port 8799 --ip 127.0.0.1 \
  --var HF_API_KEY_ID:fake-id --var HF_API_KEY_SECRET:fake-secret --var FAL_KEY:fake-fal-key
# espera "[wrangler:info] Ready on http://127.0.0.1:8799"
```

- Correrlo fuera del repo: `wrangler dev` crea `.wrangler/` en el cwd.
- Puerto 8799 estaba libre el 11-sep; otros (8791, 8794, 8850…) son de otras sesiones. Apagar por PID: `kill $(lsof -nP -iTCP:8799 -sTCP:LISTEN -t)`.
- Con llaves falsas las rutas ejecutan hasta el proveedor y devuelven su 401 real (sin costo): sirve para ver que el error llega al usuario y qué host se llama.
- Trazas: `POST http://127.0.0.1:8799/cdn-cgi/local/explorer/api/local/observability/query` con `{"sql":"SELECT name,outcome,duration_ms FROM spans ..."}`.

Huellas por ruta (curl):

| Ruta | Espera |
|---|---|
| `POST /compose` sin fotos | 400 `one to eight reference photos required` (fal) / `one reference photo required` (versión soul/reference) / `one to eight…` (versión nano-banana de Codex) — ojo: la 1.ª y la 3.ª coinciden; distinguirlas por `/compose` con 2 fotos y llave real |
| `POST /compose` sin `FAL_KEY` | 502 `FAL_KEY missing in Worker secrets` antes de leer el form |
| `GET /compose-status?task_id=<uuid>` | 502 `401: …` con llave falsa; `processing`/`completed`/`failed` con real |
| `POST /generate` JSON | 400 `multipart form required` |
| `GET /download?task_id=<uuid falso>` | 502 `{"error":"404: Not found"}` (llave real) |
| `GET /` o `/diag` | 404 `Not found` (si dice «modo sonda», hay una sonda pegada) |

Lo que NO se mide sin gastar: la subida real a Higgsfield + fal leyendo esa `public_url` ($0,04), Kling ($0,21–0,49). Solo en producción con OK de José.

## Producción

- Worker: `https://joga-motion-api.omhotien90.workers.dev`. Comprobar la versión desplegada SIEMPRE con una huella que solo la versión nueva pueda dar; José pega el código a mano y la pegada falla en silencio con frecuencia.
- Página: `https://joga4live.github.io/joga-motion/creator.html`. Pages tarda 1–2 min tras el Push; comprobar con `curl …/studio.js?nc=$(date +%s) | grep -c <cadena nueva>`.

## Página (`studio.js`) — superficie: navegador

Servir local: `python3 -m http.server <puerto>` en el repo (Nico usa un Worker simulado). En el navegador integrado, con ventana emulada a 1280×900 el frame de captura es 800×563: el clic por `ref` no escala; clic por coordenada × 0,625, o `resize_window preset desktop` antes. Estado: `studio.*`; peticiones: envolver `window.fetch` y guardar en `window.__log`. Un `<video>` cargado en pausa sale negro en captura: leer `readyState/duration/videoWidth`.
