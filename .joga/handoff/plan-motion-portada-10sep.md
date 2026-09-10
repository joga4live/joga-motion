# Plan — ronda motion-portada-10sep (Kimo MD)

Fecha: 10 de septiembre de 2026. Origen: hallazgos S2 y S3 de la revisión de Nico
(`.joga/handoff/revision-motion-10sep.md`). Esta ronda NO toca nada del flujo de video
(`studio.js`, `worker.js`, `studio.css`). Solo peso de la imagen y CSS muerto.

Regla de José: el aspecto NO cambia. Misma imagen, mismo encuadre, mismo tamaño en pantalla.
Solo menos peso.

## Hechos medidos antes de empezar (Kimo, 10-sep)

- `joga-motion-brand-hero.png`: 2 161 578 bytes, 1672×941, sin transparencia (`sips -g hasAlpha: no`).
- Se referencia en UN solo sitio: `creator.html:18`. En `index.html`, `style.css`, `studio.css`,
  `studio.js`, `i18n.js`, `worker.js`: 0 apariciones. (Corrige el encargo: la imagen vive en el
  creador, no en la portada `index.html`.)
- Tamaño pintado en la página en vivo (`getBoundingClientRect`, DPR 2):
  - escritorio 1440 px de ancho: 740×522 px CSS (= 1480×1044 px de dispositivo).
  - celular 390 px de ancho: 356×210 px CSS.
- La imagen no lleva texto ni logo dentro (es un libro abierto con montañas), así que el
  `object-fit: cover` de `studio.css` no corta nada importante. Trampa 1 de `preparar-medios`
  no aplica.
- Candidatos generados con `sips` desde el PNG original:

  | versión | bytes | píxeles |
  |---|---|---|
  | PNG original | 2 161 578 | 1672×941 |
  | JPEG 1672 q80 | 369 946 | 1672×941 |
  | JPEG 1440 q80 | 270 135 | 1440×810 |
  | JPEG 1344 q80 | 243 608 | 1344×756 |

  Decisión: **JPEG a resolución nativa 1672×941, calidad 80 (≈370 KB, −83 %)**. En escritorio
  retina la imagen ya se pinta a 1044 px de alto, más que los 941 del original; reducir píxeles
  sí se notaría ahí. Se cumple la regla de José al pie de la letra: mismos píxeles, mismo encuadre.

- `style.css`: 923 líneas. El bloque muerto empieza en la línea 754 (comentario
  `/* Multi-image scene editor */`) y llega hasta el final (923). Las líneas 752–753 (`.nav .nav-link
  { display: none; }` y la llave que cierra el `@media` anterior) NO son parte del bloque y se quedan.
- Conteo de usos en `index.html + creator.html + studio.js + i18n.js + worker.js`:
  `page-creator`, `assembly-panel`, `creator-sub`, `creator-title`, `creator-word`, `export-source`,
  `scene-action`, `scene-error`, `scene-list`, `scene-note`, `scene-row`, `scene-select`,
  `upload-zone`, `u-hint`, `u-sub`, `ctrl-panel`, `btn-gen`, `creator-hero`, `toast`: **0 cada una**.
  `nav-link`: 4 (se usa). `lang-toggle`: 2 (se usa).
- Dentro del bloque hay dos reglas genéricas que SÍ aplican a botones de `index.html`
  (`#lang-toggle` es un `<button>`): `button:disabled { … }` y `button:focus-visible { … }`
  (líneas 768–769). Esas dos se conservan.

## Cambio A — la imagen del creador

1. Generar el JPEG desde el PNG original, sin recortar ni redimensionar:
   ```
   sips -Z 1672 -s format jpeg -s formatOptions 80 joga-motion-brand-hero.png --out joga-motion-brand-hero.jpg
   ```
   Verificar con `sips -g pixelWidth -g pixelHeight`: debe dar 1672×941. Anotar los bytes.
2. Quitar el PNG del repo con `git rm joga-motion-brand-hero.png`.
3. En `creator.html:18` cambiar `src="joga-motion-brand-hero.png"` por `src="joga-motion-brand-hero.jpg"`
   y añadir `width="1672" height="941"` (misma proporción; evita el salto de maquetación que
   señaló Nico; el CSS `width:100%;height:100%;object-fit:cover` de `studio.css` sigue mandando,
   así que el tamaño pintado no cambia). No tocar el `alt`.
4. No tocar `studio.css`. No tocar `index.html`.
5. Comprobar con grep que `brand-hero.png` ya no aparece en ningún archivo del repo (fuera de `.git`
   y de `.joga/handoff`).

## Cambio B — CSS muerto en `style.css`

1. Antes de borrar cada bloque, grep de cada selector de clase en `index.html`, `creator.html`,
   `studio.js`, `i18n.js`, `worker.js`. Si alguno da > 0, ese bloque se queda y se anota en la
   implementación.
2. Borrar de la línea 754 (`/* Multi-image scene editor */`) hasta el final del archivo, EXCEPTO
   las dos reglas `button:disabled` y `button:focus-visible`, que se conservan (pueden quedar al final
   del archivo, tras un comentario `/* Botones: estados genéricos */`).
3. El archivo debe terminar en salto de línea y con llaves balanceadas: `grep -o "{" | wc -l` igual a
   `grep -o "}" | wc -l`.
4. Medir bytes y líneas antes y después. Esperado: de 40 620 bytes / 923 líneas a ≈29 500 bytes /
   ≈757 líneas.

## Fuera de esta ronda (anotar, no tocar)

- `style.css` líneas 551–750 (`.creator-body`, `.prog-panel`, `.result-panel`, etc.) vienen del
  creador del 9-sep y también dan 0 usos hoy. Es más código muerto, pero de una ronda anterior ya
  aprobada; se decide en otra ronda.
- Todos los demás hallazgos de Nico (B1–B3, S1, S4–S9) van en la ronda de video, no aquí.

## Entrega

- Escribir `.joga/handoff/implementacion-motion-portada-10sep.md` con: comandos ejecutados, bytes y
  píxeles antes/después de la imagen, bytes y líneas antes/después de `style.css`, y el resultado
  de cada grep.
- UN commit local (no push). Mensaje bilingüe como los anteriores del repo, por ejemplo:
  `perf: hero del creador a JPEG (2,1 MB → ~370 KB) y CSS muerto fuera de style.css / creator hero to JPEG and dead CSS removed`
  con la línea `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` al final.
- NUNCA `git push`. José publica desde GitHub Desktop.
