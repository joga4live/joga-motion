# Plan — Joga Motion, ronda motion-legible-movil-10sep: letra legible y botón de quitar tocable en celular

Base: `5e8b122` (árbol limpio). Regla de José (10-sep-2026): el diseño nuevo del creador le gusta y **NO se cambia en escritorio**. Todo lo de esta ronda vive dentro de `@media(max-width:480px)` en `studio.css`. Nada en `studio.js`, nada en `creator.html`, nada en `index.html`/`style.css`.

## Qué está mal hoy (medido, no mirado)

Habilidad `revisar-en-celular`, navegador real con viewport de 320/375/430, servidor local `http://localhost:8856` sirviendo el árbol de trabajo (hash de `studio.css` idéntico al archivo, verificado con `curl | shasum`), con una foto cargada y descripción escrita para que exista el botón «×». Reproduce **exactamente** la tabla de Nico en `revision-motion-10sep-video-directo.md`:

| Medida | ES (320/375/430) | EN (320) |
|---|---|---|
| Desbordes / scroll lateral | 0 / no | 0 / no |
| Textos bajo 12 px | **11 de 19 (58 %)** | 10 de 19 |
| El más chico | **9 px** («VISTA PREVIA») | 10 px («PREVIEW» tiene menos de 10 letras y el script no lo cuenta, pero mide 9 px igual) |
| Botones bajo 44×44 | **8** | 8 |
| El peor | **× de quitar imagen: 23×23** | igual |

Los 11 textos chicos y la regla CSS que los produce (todas en la línea 1 de `studio.css`, valores de escritorio):

| px | Elemento | Regla base |
|---|---|---|
| 9 | `.preview-tag` («VISTA PREVIA») | `.preview-tag{font-size:9px}` |
| 10 | `.eyebrow` («TU ESTUDIO DE VIDEO CON IA») | `.eyebrow{font-size:10px;letter-spacing:2px}` |
| 10 | `.footer-note` («Mantén esta página abierta…») | `.footer-note{font-size:10px}` |
| 11 | `.upload>span:last-child` («1 imagen · JPG…») | `.upload>span:last-child{font-size:11px}` |
| 11 | `.hint` («Describe el movimiento…») | `.hint,.cost-note{font-size:11px}` |
| 11 | `.examples button` ×3 (los tres ejemplos) | `.examples button{font-size:11px}` |
| 11 | `.video-spec` («Video de 5 s · Horizontal») | `.video-spec{font-size:11px}` |
| 11 | `.cost-note` («Cada creación usa…») | `.hint,.cost-note{font-size:11px}` |
| 11 | `.preview-footer p` («El resultado aparecerá aquí…») | `.preview-footer p{font-size:11px}` |

Textos cortos que el script no cuenta (menos de 10 letras) pero también están bajo 12 px y se corrigen en el mismo pase: `01`/`02` (11 px), `1 / 1` (11 px), `Imagen 1` (10 px), botón «English» (12 px, se sube a 13 por ser botón).

Los 8 botones bajo 44×44 a 320 px: marca «Joga Motion» 152×32, «English» 73×35, «Crear mi video» 132×42, **× 23×23**, los tres ejemplos 144×29 / 116×29 / 128×29, y «Crear video» 246×44 (en realidad 43,x: el script lo redondea a 44 pero reporta que le falta 1).

## Qué se hace: un solo bloque, ya medido

Dentro del bloque `@media(max-width:480px){…}` de la **línea 1** de `studio.css` (el que empieza con `.nav{height:66px;…}`), hacer dos cosas:

**1. Reemplazar** la regla `.thumbnails{grid-template-columns:repeat(4,minmax(0,1fr))}` por `.thumbnails{grid-template-columns:repeat(2,minmax(0,1fr))}`. Motivo: hoy solo se admite 1 imagen; a 4 columnas la miniatura mide 55 px y una × de 44 la tapa casi entera. A 2 columnas la miniatura mide 119 px y la × cabe en la esquina.

**2. Añadir**, al final del mismo bloque (antes de su `}` de cierre), exactamente esto:

```css
.nav button{font-size:13px;min-height:44px}.brand{min-height:44px}.eyebrow{font-size:12px;letter-spacing:1.2px}.hero-action{min-height:44px}.section-title h2>span:first-child,.section-title .label>span:first-child{font-size:12px}.section-title #photoCount{font-size:12px}.upload>span:last-child{font-size:12px}.hint,.cost-note,.preview-footer p,.footer-note{font-size:13px}.examples button{font-size:13px;min-height:44px;padding:10px 14px}.video-spec{font-size:12px}.primary{min-height:44px}.message{font-size:13px}.preview-tag{font-size:12px}.empty-preview p,.progress p{font-size:13px}.thumbnail figcaption{font-size:12px}.thumbnail button{width:44px;height:44px;font-size:22px;right:6px;top:6px}
```

Criterio de tamaños (de la habilidad): etiquetas y metadatos mínimo 12 px; frases que se leen (pistas, notas, mensajes) 13 px; botones mínimo 44 px de alto. El eyebrow baja su `letter-spacing` de 2 a 1.2 px para que a 320 siga en **una línea** (medido: 15 px de alto, una línea).

**No tocar** el segundo `@media(max-width:480px)` de la línea 3 (el del hero), ni ninguna regla fuera de un `@media`. No tocar `@media(max-width:900px)`.

Este bloque **ya se probó inyectado en la página** sobre el árbol actual. Resultado con él puesto:

| Medida | ES 320 | ES 375 | ES 430 | EN 320 |
|---|---|---|---|---|
| Desbordes / scroll lateral | 0 / no | 0 / no | 0 / no | 0 / no |
| Textos bajo 12 px | **0 de 19** | 0 | 0 | 0 |
| Distribución | 12px: 4 · 13px: 11 · 14px: 2 · 16px: 1 · 38px: 1 | — | — | — |
| Botones bajo 44×44 | **0** | 0 | 0 | 0 |

## Lo que Tavo entrega

1. `studio.css` con los dos cambios de arriba y **nada más** (`git diff --stat` debe mostrar solo `studio.css`, y `git diff` solo líneas dentro del bloque de 480 px de la línea 1).
2. Medición **después**, con la habilidad `revisar-en-celular`, en el servidor local ya levantado (`http://localhost:8856/creator.html`; antes de medir, `diff <(shasum -a 256 < studio.css | cut -d' ' -f1) <(curl -s http://localhost:8856/studio.css | shasum -a 256 | cut -d' ' -f1)` debe decir IDENTICOS). Con foto cargada y descripción escrita (para que exista la ×). Tres anchos, dos idiomas. Reportar la tabla, no una captura.
3. Prueba de que **escritorio no cambió**: a 1280 px de ancho, `getBoundingClientRect` de `.hero`, `.studio`, `.editor`, `.preview`, `.upload`, `#create`, `.create-row`, `.examples`, `.preview-screen`, `.preview-footer`, `.footer-note`, `.nav`, `.thumbnails`, `.thumbnail button` y `font-size` computado de `.preview-tag`, `.eyebrow`, `.hint`, `.examples button` **idénticos** entre `git stash` (base) y el árbol de trabajo. Cero diferencias o no se entrega.
4. Nota en `.joga/handoff/implementacion-motion-legible-movil-10sep.md` con las tablas antes/después y lo que no pudo medir.
5. **Un** commit local, sin push, con mensaje bilingüe (ES / EN) como los anteriores. **No** incluir `.claude/` (es una copia temporal del launch.json para el servidor de medición; se borra al cerrar la ronda).

## Lo que Nico audita (solo lectura)

- Alcance: solo `studio.css`, solo dentro del `@media(max-width:480px)` de la línea 1.
- Repetir la medición móvil por su cuenta (no fiarse de la tabla de Tavo): 320/375/430, ES y EN, con foto cargada.
- Repetir la comparación de escritorio base vs. árbol: 0 diferencias.
- Que el eyebrow quede en una línea a 320 y que la × no tape la miniatura (aquí sí vale una captura, para José).
- Que el sitio se pueda seguir usando: subir foto, quitar con la ×, elegir ejemplo, escribir; sin errores de consola.
- Veredicto en `.joga/handoff/revision-motion-legible-movil-10sep.md`.

## Fuera de esta ronda (declarado, no olvidado)

- Nada de escritorio ni de tableta (481–900 px): en ese rango la letra sigue con los valores de escritorio. Si José quiere, se mide aparte.
- `index.html`/`style.css` (la portada) no se midió en esta ronda.
- Contraste de colores: no se midió (la habilidad tiene `contraste.py`; queda para otra ronda si José lo pide).
