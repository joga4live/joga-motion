# Implementación — ronda motion-portada-10sep (Tavo)

Ejecuté el plan `.joga/handoff/plan-motion-portada-10sep.md` tal cual, con una corrección menor de
línea que anoto abajo. No toqué `studio.js`, `worker.js`, `studio.css`, `i18n.js` ni `index.html`.

## Cambio A — imagen del creador a JPEG

Comandos:
```
sips -g pixelWidth -g pixelHeight -g hasAlpha joga-motion-brand-hero.png
  -> pixelWidth: 1672, pixelHeight: 941, hasAlpha: no   (confirma lo medido por Kimo)

sips -Z 1672 -s format jpeg -s formatOptions 80 joga-motion-brand-hero.png --out joga-motion-brand-hero.jpg

sips -g pixelWidth -g pixelHeight -g hasAlpha joga-motion-brand-hero.jpg
  -> pixelWidth: 1672, pixelHeight: 941, hasAlpha: no

git rm joga-motion-brand-hero.png
```

Medición bytes:
- PNG original: **2 161 578 bytes** (antes)
- JPEG nuevo: **369 946 bytes** (después) — reducción del 82,9 %, coincide exactamente con la
  tabla de candidatos del plan (369 946 bytes, JPEG 1672 q80).
- Píxeles: 1672×941 en ambos → **sin cambio de encuadre ni de resolución**, tal como exige la
  regla de José.

`creator.html:18` cambió de:
```html
<img class="hero-image" src="joga-motion-brand-hero.png" alt="Un libro se transforma en una aventura cinematográfica entre montañas">
```
a:
```html
<img class="hero-image" src="joga-motion-brand-hero.jpg" width="1672" height="941" alt="Un libro se transforma en una aventura cinematográfica entre montañas">
```
El `alt` no se tocó. Se añadió `width`/`height` en proporción nativa (evita el salto de
maquetación que señaló Nico); `studio.css` sigue mandando el tamaño pintado
(`width:100%;height:100%;object-fit:cover`), así que en pantalla no cambia nada.

Grep de verificación (fuera de `.git` y `.joga/handoff`):
```
grep -rn "brand-hero.png" . --exclude-dir=.git --exclude-dir=.joga
  -> 0 resultados (exit 1)
```
Los dos únicos hits de `brand-hero.png` que quedan en el repo están en `.joga/handoff/` y son
histórico (el propio `plan-motion-portada-10sep.md` y `revision-motion-10sep.md`), no código vivo.

## Cambio B — CSS muerto en `style.css`

**Corrección de línea sobre el plan:** el plan decía que el comentario `/* Multi-image scene
editor */` empezaba en la línea 754. Medido de nuevo con `grep -n`, ese comentario está en la
**línea 755** (754 es una línea en blanco justo después del `}` que cierra el `@media` anterior,
línea 753). No afecta el resultado — el bloque muerto sigue siendo el mismo texto, solo corrijo
el número de línea para no dejar una premisa falsa escrita. Medí antes de tocar nada.

Grep de verificación de cada clase/selector del bloque, contra `index.html + creator.html +
studio.js + i18n.js + worker.js` (conteo de apariciones, no de líneas):

| selector | usos |
|---|---|
| page-creator | 0 |
| assembly-panel | 0 |
| creator-sub | 0 |
| creator-title | 0 |
| creator-word | 0 |
| export-source | 0 |
| scene-action | 0 |
| scene-error | 0 |
| scene-list | 0 |
| scene-note | 0 |
| scene-row | 0 |
| scene-select | 0 |
| upload-zone | 0 |
| u-hint | 0 |
| u-sub | 0 |
| ctrl-panel | 0 |
| btn-gen | 0 |
| creator-hero | 0 |
| toast | 0 |
| nav-link | 4 (se usa) |
| lang-toggle | 2 (se usa) |

Todos coinciden con lo medido por Kimo. Ningún selector del bloque muerto obligó a conservar más
de lo previsto. Las dos reglas genéricas `button:disabled` (línea 768 original) y
`button:focus-visible` (línea 769 original) sí aplican fuera del bloque (a cualquier `<button>`,
incluido `#lang-toggle` en `index.html`) y se conservaron, ahora al final del archivo bajo el
comentario `/* Botones: estados genéricos */`.

Comando de borrado (extracción de líneas 1–753 + footer con las dos reglas conservadas):
```
sed -n '1,753p' style.css > style_new.css
printf '\n/* Botones: estados genéricos */\nbutton:disabled { opacity: .45; cursor: not-allowed; }\nbutton:focus-visible { outline: 2px solid var(--cyan); outline-offset: 3px; }\n' >> style_new.css
```

Medición antes/después:

| | antes | después |
|---|---|---|
| bytes | 40 620 | 29 529 |
| líneas | 923 | 757 |

Coincide con el estimado del plan (≈29 500 bytes / ≈757 líneas).

Balance de llaves tras el borrado:
```
grep -o "{" style.css | wc -l  -> 228
grep -o "}" style.css | wc -l  -> 228
```
Iguales. El archivo termina en salto de línea (`tail -c 1 | xxd` → `0a`).

`git diff style.css` confirma que el único hunk tocado empieza en la línea 752 (contexto) y llega
al final del archivo original (923) — nada antes de la línea 752 se movió. Eso incluye que las
líneas 551–750 (`.creator-body`, `.prog-panel`, `.result-panel`, etc., código muerto de una ronda
anterior ya aprobada) **no se tocaron**, como pedía el plan.

## Fuera de esta ronda (sin tocar, anotado)

- `style.css` líneas ~551–750 con selectores como `.creator-body`, `.prog-panel`, `.result-panel`:
  siguen dando 0 usos hoy, pero son de una ronda ya aprobada; se decide en otra ronda, como dijo
  el plan.
- Hallazgos B1–B3, S1, S4–S9 de la revisión de Nico del 10-sep: pertenecen a la ronda de video, no
  a esta.
- Vi aparecer `.joga/handoff/plan-motion-legible-movil-10sep.md` durante el trabajo — es de otra
  sesión en paralelo. No lo abrí ni lo toqué, y no lo incluyo en mi commit.

## Verificación que SÍ pude medir (con comandos)

- Bytes y píxeles de la imagen: medidos con `sips`, antes y después. Confirmado.
- Bytes, líneas y balance de llaves de `style.css`: medidos con `wc` y `grep -o`. Confirmado.
- Ausencia de `brand-hero.png` fuera de `.git`/`.joga`: confirmado con `grep -r`.
- Sintaxis de `creator.html` y `style.css`: no hay linter instalado en este Mac (sin node); validé
  a ojo con `git diff` que el hunk es exactamente el esperado y que las llaves balancean.

## PENDIENTE DE MEDICIÓN (requiere navegador — no es mi rol)

- Que la imagen del creador se siga viendo igual en pantalla (mismo encuadre, sin salto de
  maquetación al cargar) en escritorio y celular. Esperado: sin cambio, porque `object-fit: cover`
  de `studio.css` no se tocó y los píxeles/proporción de la imagen son idénticos al PNG original.
- Que `#lang-toggle` en `index.html` (el único `<button>` real que usa `button:disabled` /
  `button:focus-visible` hoy) se siga viendo con el mismo foco visible y el mismo estado
  deshabilitado tras el reordenamiento de esas dos reglas al final del archivo. Esperado: sin
  cambio, porque el orden relativo entre esas dos reglas no cambió entre sí, y ningún otro
  selector en el CSS restante compite por especificidad en `button:disabled`/`button:focus-visible`
  (grep no encontró otras reglas con esos selectores en el archivo).
- Que `creator.html` cargue el JPEG sin error 404 (nombre de archivo, mayúsculas/minúsculas)
  cuando se sirva desde GitHub Pages. Esperado: sin problema — mismo directorio, mismo caso
  (`joga-motion-brand-hero.jpg` en minúsculas, coincide con el archivo generado).

## Comando final

`bash init.sh`: no existe ese script en este repo (`joga-motion`), así que no lo pude correr. Lo
anoto para que Kimo MD lo confirme si esperaba que existiera.
