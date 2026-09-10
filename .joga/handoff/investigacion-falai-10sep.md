# Investigación fal.ai para "8 fotos → escena → video" — 10-sep-2026

Investigador: Sol. Método: lectura de fal.ai/models y fal.ai/docs vía WebFetch + verificación cruzada con WebSearch (sin cuenta, sin gasto, sin generar nada). Todas las fuentes y fechas de consulta están citadas. Donde la doc oficial no dio el dato, lo digo explícito — no lo relleno con la respuesta de un buscador de terceros sin marcarlo.

## 1. Modelos de imagen con múltiples referencias

| Modelo | Campo de entrada | Fotos admitidas | Precio/imagen | Resolución | Fuente | Consulta |
|---|---|---|---|---|---|---|
| `fal-ai/nano-banana/edit` (Gemini 2.5 Flash Image) | `image_urls` (array de strings) | La doc NO fija un máximo numérico. Ejemplo oficial usa 2 URLs; búsquedas de terceros hablan de "varias", ninguna oficial dice "8". **No verificado para 8.** | **$0.039/imagen** (bulk: 25 por $1) — confirmado en dos páginas de fal.ai (ficha del modelo y /pricing, que redondea a $0.0398) | `aspect_ratio`: auto/21:9…9:16; `output_format`: jpeg/png/webp | fal.ai/models/fal-ai/nano-banana/edit, fal.ai/models/fal-ai/nano-banana/edit/api, fal.ai/pricing | 10-sep-2026 |
| `fal-ai/nano-banana-pro/edit` (Gemini "Nano Banana Pro" / gemini-3-pro-image-preview) | `image_urls` (array, sin máximo declarado en la doc oficial que leí) | Un resultado de búsqueda (no la doc oficial de fal) afirma "hasta 14 imágenes" para la versión Pro. **No lo pude confirmar en la página oficial** — la ficha `/api` que leí no menciona ningún número. | **$0.15/imagen** en 1K/2K; **$0.30/imagen** en salida 4K (+$0.015 si se activa `enable_web_search`) — vía búsqueda, no vi la tabla de precios oficial completa | `resolution`: 1K/2K/4K | fal.ai/models/fal-ai/nano-banana-pro/edit/api; precio vía WebSearch (no oficial verificado en la propia página) | 10-sep-2026 |
| `fal-ai/flux-pro/kontext/max/multi` | No confirmé el nombre exacto del campo (la doc que cargué no lo mostró) | Ejemplo de la interfaz muestra 2 imágenes; "experimental... multi image", sin tope documentado | **$0.08/imagen** (la versión no-multi Kontext Pro es $0.04) — vía búsqueda, no vi la ficha completa | No verificado | fal.ai/models/fal-ai/flux-pro/kontext/max/multi (solo listado, no abrí el detalle completo) | 10-sep-2026 |
| Seedream 4 edit, Qwen-Image-Edit, Ideogram character | — | — | — | — | **No los alcancé a verificar en esta ronda.** Quedan pendientes si se quiere comparar más a fondo. |

**Sobre "mantiene el parecido de las personas":** ningún modelo de edición de fal.ai publica un benchmark propio de identidad facial con varias personas en una imagen. Es la pregunta que NINGUNA doc contesta — solo una prueba real con las fotos de la familia de José lo va a decir. No lo afirmo ni lo descarto.

## 2. Modelos de video con varias referencias directas

| Modelo | Campo | Imágenes admitidas | Precio | Duración | Audio | Fuente |
|---|---|---|---|---|---|---|
| `fal-ai/kling-video/o1/reference-to-video` | `elements[].reference_image_urls` + `image_urls` (adicionales de estilo) | "Hasta 7 entradas combinadas" (elementos + referencias + frame inicial), según ficha del modelo | **$0.112/segundo** → $0.56 por clip de 5s, $1.12 por 10s (dato de búsqueda; no vi la tabla de precios en la página oficial que cargué) | 3–10s (default 5) | No mencionado en lo que leí | fal.ai/models/fal-ai/kling-video/o1/reference-to-video y /api | 10-sep-2026 |
| `fal-ai/kling-video/v1.6/standard/elements` | — | Hasta 4 imágenes, en el orden en que aparecen en el video (según búsqueda) | $0.056/segundo → $0.28 por 5s (vía búsqueda) | — | — | Solo vía WebSearch, no abrí la ficha directamente | 10-sep-2026 |
| Veo 3.1 reference-to-video en fal.ai | — | — | — | — | **La URL que probé (`fal-ai/veo3/reference-to-video`) dio 404.** No encontré la ficha correcta en esta ronda — no puedo afirmar que exista o no exista en fal.ai sin buscar el slug exacto. |
| Vidu reference-to-video, Pixverse | — | — | — | — | **No los alcancé a verificar en esta ronda.** |

## 3. Forma de la API — SÍ encaja con el patrón del Worker actual

Confirmado en `fal.ai/docs/model-apis/queue` (la URL `docs.fal.ai/...` redirige ahí con 308):

- **Auth:** header `Authorization: Key $FAL_KEY` (una sola cadena, no dos partes como Higgsfield `Key ID:SECRET`).
- **Envío:** `POST https://queue.fal.run/{model}` → responde con `request_id`.
- **Estado:** `GET https://queue.fal.run/{model}/requests/{request_id}/status`.
- **Resultado:** `GET https://queue.fal.run/{model}/requests/{request_id}` (sin `/status`).
- **Extras:** `?logs=1` para logs, `?fal_webhook=` para webhook, endpoint de cancelación (`PUT .../cancel`) y de streaming de estado.

Ejemplo real de la doc:
```
curl -X POST https://queue.fal.run/fal-ai/flux/schnell \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a sunset over mountains"}'
```

Este es el mismo esqueleto que ya usa `worker.js` para Higgsfield (submit → `request_id` → poll status → leer `url` del resultado). **El Worker se podría adaptar cambiando: el header de auth, la base URL (`queue.fal.run` en vez de `api.higgsfield.ai`), y el nombre del campo de salida** (fal usa `images[0].url` también en varios modelos, hay que confirmarlo modelo por modelo). No es una reescritura grande.

**Subida de imágenes:** no llegué a confirmar en esta ronda si `image_urls` acepta URLs públicas arbitrarias (como las que ya sube el Worker vía Higgsfield) o si fal.ai exige subir a su propio storage primero. Es un punto a probar antes de construir, porque si exige su propio upload, hay que añadir un paso más al Worker.

## 4. Cuenta y créditos — aquí está la bandera roja

- Fal.ai usa **prepago**: se compran créditos por adelantado y se consumen con el uso. Sin mínimo mensual (dato de búsqueda, no de la página oficial de billing, que me devolvió solo la pantalla de login).
- Créditos expiran a los 365 días de comprados (90 días si son promocionales) — dato de búsqueda, no confirmado en doc oficial.
- **No encontré, ni en la doc oficial ni por búsqueda, un tope de gasto configurable (hard spending cap) en fal.ai.** Una fuente de terceros (costbench.com, no es fal.ai) afirma explícitamente que "fal.ai no ofrece topes de gasto integrados". Encontré además un issue público en GitHub (`fal-ai/fal#922`) de un usuario con la cuenta bloqueada pese a tener saldo positivo — señal de que el sistema de créditos tiene fricciones, no de que exista o falte el tope.
- **Esto es justo el susto que José ya tuvo en agosto.** Sin un tope de gasto confirmado, la única protección real sería no dejar cargado más saldo del que se está dispuesto a perder en una sesión de pruebas (p. ej. cargar $5–10 y ya, no $50).

## 5. Comparación con Higgsfield para "1 foto → escena → video"

| Paso | Higgsfield (hoy) | fal.ai (si se usa nano-banana/edit + Kling en fal) |
|---|---|---|
| Foto → escena | `higgsfield-ai/soul/reference`, $0.094 | `fal-ai/nano-banana/edit`, $0.039 |
| Escena → video 5s | Kling 2.5 turbo $0.21 / Kling 2.1 pro $0.49 (ya medido con tu llave) | Kling en fal varía por versión; el que sí acepta referencias múltiples directo (`kling-video/o1/reference-to-video`) sale ~$0.56/5s — más caro que hacerlo en dos pasos |
| Total aproximado | ~$0.30–0.58 por clip | ~$0.25 (nano-banana fal) + precio del video que ya tienes en Higgsfield, si solo se usa fal.ai para el paso de la imagen |

Para el flujo de **1 foto**, Higgsfield ya funciona y está medido con datos reales — no hay urgencia de moverlo a fal.ai. Donde fal.ai aporta algo que Higgsfield hoy no tiene (según lo que me diste) es en el **paso de imagen con varias fotos de referencia**, porque el `nano-banana` de Higgsfield da 404 y el de fal.ai sí responde con un `image_urls` real.

## 6. Riesgos

1. **Parecido facial no garantizado** — ningún modelo de ningún proveedor lo promete por escrito; solo una prueba con fotos reales de la familia lo confirma o lo descarta.
2. **Sin tope de gasto confirmado en fal.ai** — mismo riesgo que ya vivió José en agosto con Anthropic, y aquí no hay ni siquiera evidencia de que exista la opción.
3. **Filtros de contenido** — no verifiqué la política de fal.ai para fotos de personas reales ni su umbral de NSFW; dado que Higgsfield ya marcó `nsfw` en un caso inocente (paisaje, mujer descalza), es razonable esperar falsos positivos también aquí. No lo pude probar sin gastar.
4. **Términos de uso con fotos de personas reales** — no leí los TOS de fal.ai en esta ronda; falta revisarlos antes de subir fotos de la familia de José.
5. **Latencia** — no medí tiempos reales de fal.ai (necesita una llamada de prueba); la doc no publica SLA de tiempo.
6. **Máximo real de imágenes en `image_urls`** — la doc oficial de fal.ai no declara un número para nano-banana/edit ni para nano-banana-pro/edit. El "hasta 14" que circula es de un tercero, no de fal.ai. **Esto hay que probarlo con una llamada real antes de prometerle a José "8 fotos" con este modelo.**

## Recomendación

Probar primero `fal-ai/nano-banana/edit` (Gemini 2.5 Flash Image) para el paso "N fotos → una escena": es el más barato ($0.039/imagen), su API está confirmada y documentada (`image_urls`, cola async idéntica en forma al Worker actual), y ya se sabe con certeza que el `nano-banana` de Higgsfield no sirve (404). **No se puede afirmar sin gastar:** (a) si acepta las 8 fotos que José quiere — la doc no fija el máximo; (b) si mantiene el parecido de cada persona; (c) si hay tope de gasto real en la cuenta de fal.ai antes de cargarle saldo.

**Antes de construir nada:** cargar el mínimo posible de saldo (no $50), hacer UNA llamada de prueba con 3–4 fotos reales para confirmar que `image_urls` las acepta todas y que el resultado se ve bien, y solo entonces decidir si fal.ai reemplaza el paso de imagen de Higgsfield o si se queda solo como opción para el caso de "varias personas" que Higgsfield no cubre.
