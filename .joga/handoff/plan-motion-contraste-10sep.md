# Plan — Joga Motion, ronda motion-contraste-10sep: siete colores de texto que no se leen

Base: `0bdd31a` (árbol limpio, ya en origin). Pedido de José (10-sep-2026): «arregla el contraste que dejó anotado Nico» (`revision-motion-legible-movil-10sep.md`, sección «Contraste»). Nico anotó tres; medí la familia entera de `studio.css` con `contraste.py` de la habilidad `revisar-en-celular` y son **siete**.

**Sobre la regla de «no cambiar el diseño de escritorio»:** un color no se puede arreglar solo en móvil sin que quede distinto en cada pantalla, y José pidió el arreglo explícitamente. Los siete cambios conservan el **tono** exacto y solo bajan la luminosidad hasta pasar 4,5:1. Nada de tamaños, cajas ni tipografía. Se declara en la nota y en el mensaje a José.

## Qué falla hoy (medido con `contraste.py`, mínimo WCAG AA 4,5:1 para texto normal)

| # | Texto | Regla en `studio.css` (línea 1) | Color hoy | Fondo | Hoy | Nuevo | Con el nuevo |
|---|---|---|---|---|---|---|---|
| 1 | `01` / `02` | `.section-title h2>span:first-child,.section-title .label>span:first-child{color:#9685b9;…}` | `#9685b9` | blanco | **3,31** | `#7E69A9` | 4,69 |
| 2 | «VISTA PREVIA» | `.preview-tag{…color:#81758f}` | `#81758f` | blanco | **4,31** | `#7C708A` | 4,62 |
| 3 | «Mantén esta página abierta…» | `.footer-note{…color:#777d8e;…}` | `#777d8e` | `#f6f7fb` | **3,84** | `#6B7080` | 4,61 |
| 4 | «Añade tus imágenes, describe…» y la nota de progreso | `.empty-preview p,.progress p{…color:#7a7388;…}` | `#7a7388` | `.preview-screen` (gradiente; peor punto `#e9e1fa`) | **3,58** | `#686274` | 4,63 en el peor punto |
| 5 | Placeholder del cuadro de texto | `textarea::placeholder{color:#7a8192}` | `#7a8192` | `#fcfcfe` | **3,81** | `#6B7283` | 4,70 |
| 6 | Botón «Crear video» deshabilitado | `.primary:disabled{background:#eae8f0;color:#777183}` | `#777183` | `#eae8f0` | **3,87** | `#6A6575` | 4,64 |

(#6 WCAG lo exime por estar deshabilitado, pero es el estado en que **siempre** se ve el botón al entrar, y la gente lo lee. Se arregla igual; cuesta un color.)

Son 6 reglas y 7 pares (la regla 4 cubre dos textos). Todo lo demás pasa: `--muted #646b7b` da 5,34 en blanco, 4,86 en `#f3f4f8` y 4,97 en el recuadro de subida; ejemplos 5,86; «English» 6,50; mensaje de error 6,67; hero 9,79 y 13,28; acento `#6941cf` 6,45 en blanco y 5,48 en `#f0eafb` (`#modes .on`); la × 9,74; el icono de película 3,52 (icono grande, mínimo 3,0).

## Qué se hace

En `studio.css`, línea 1, **seis sustituciones literales** y nada más:

| Buscar (exacto) | Reemplazar por |
|---|---|
| `span:first-child{color:#9685b9;` | `span:first-child{color:#7e69a9;` |
| `.preview-tag{font-size:9px;letter-spacing:1px;color:#81758f}` | `.preview-tag{font-size:9px;letter-spacing:1px;color:#7c708a}` |
| `color:#777d8e;margin:25px 0}` | `color:#6b7080;margin:25px 0}` |
| `color:#7a7388;margin:0}` | `color:#686274;margin:0}` |
| `textarea::placeholder{color:#7a8192}` | `textarea::placeholder{color:#6b7283}` |
| `.primary:disabled{background:#eae8f0;color:#777183}` | `.primary:disabled{background:#eae8f0;color:#6a6575}` |

Antes de sustituir, confirmar con `grep -c` que cada cadena «Buscar» aparece **exactamente una vez**. Si alguna aparece 0 o 2 veces, parar y anotarlo (el archivo cambió en la ronda de escena; los fragmentos se tomaron de `0bdd31a`). No tocar `--muted`, `--accent`, ningún fondo, ningún tamaño, ni `style.css`/`index.html`.

## Lo que Tavo entrega

1. `studio.css` con las seis sustituciones. `git diff --stat` = solo `studio.css`; `git diff --word-diff` debe mostrar únicamente los seis valores hex (control: `git diff | grep -o '#[0-9a-f]\{6\}' | sort | uniq -c`).
2. Verificación en navegador real (servidor local: `preview_start` con name `joga-motion`, puerto 8856; comprobar hash con `curl | shasum` antes de creer nada) de que el color **computado** de cada uno de los 7 textos es el nuevo: `getComputedStyle(el).color` de `.section-title h2>span:first-child`, `.preview-tag`, `.footer-note`, `#emptyPreview p`, `#create` (deshabilitado, sin foto), y el placeholder (`getComputedStyle($('description'),'::placeholder').color`). Reportar los siete `rgb(...)` y su equivalente hex.
3. Recalcular los 7 ratios con `contraste.py` sobre los colores computados (no sobre los del plan). Los siete ≥ 4,5.
4. Prueba de que **nada más cambió**: a 1280 y a 320 px, `getBoundingClientRect` de `.hero`, `.studio`, `.editor`, `.preview`, `#create`, `.examples`, `.preview-screen`, `.footer-note`, `.thumbnails` y `font-size` de `.preview-tag`, `.eyebrow`, `.hint` idénticos entre `git show 0bdd31a:studio.css` y el nuevo (cargar el CSS base en un `<style>` en lugar del link, como hizo Nico). Cero diferencias de tamaño; las únicas diferencias permitidas son los 7 `color`.
5. Nota `.joga/handoff/implementacion-motion-contraste-10sep.md`: la tabla antes/después con ratios, los colores computados, la comparación de cajas, y lo que no pudo medir.
6. **Un** commit local con `studio.css` + el plan + la nota. Mensaje bilingüe como los del repo; última línea `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Sin push. `resize_window` preset desktop y `preview_stop` al terminar.

## Lo que Nico audita (solo lectura)

- Que el diff sean exactamente 6 declaraciones `color` y ningún otro carácter.
- Repetir los 7 ratios por su cuenta, sobre colores computados en la página, con `contraste.py`. Regla de su propia lección 1: si su medidor no sabe leer el fondo (gradiente del `.preview-screen`), que declare «no medible» y use el peor punto del gradiente (`#e9e1fa`), no un número inventado.
- Repetir la comparación de cajas base vs. nuevo a 1280 y 320: 0 diferencias de tamaño.
- Control positivo: que su comparador detecte los 7 cambios de color.
- Que el sitio siga usándose sin errores de consola: subir foto, ejemplo, escribir, quitar, idioma.
- Veredicto en `.joga/handoff/revision-motion-contraste-10sep.md`.

## Fuera de esta ronda (declarado)

- `index.html`/`style.css` (la portada): sin medir su contraste.
- El icono de película (3,52, pasa como icono grande) y el placeholder de color en `.upload` no se tocan.
- Tableta 481–900 px: sigue con los tamaños de escritorio (ronda aparte si José la pide).
