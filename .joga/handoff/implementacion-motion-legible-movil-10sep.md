# Implementación — ronda motion-legible-movil-10sep (Tavo)

Base real al empezar: `5e8b122` (el plan decía "árbol limpio" en ese commit). A mitad de la
ronda, otra sesión en paralelo (ronda `motion-portada-10sep`) hizo commit de sus cambios como
`b6555e0` (JPEG del hero + CSS muerto). Verificado con `git diff 5e8b122 b6555e0 -- studio.css`:
diff vacío, no tocó `studio.css`. No colisionó con este trabajo. Por eso, para la comparación
de escritorio, no usé `git stash` sobre todo el árbol (hubiera afectado `creator.html`/`style.css`,
que no son míos en esta ronda) — comparé intercambiando solo el contenido de `studio.css` entre
la versión base (`git show HEAD:studio.css`) y la editada, sin tocar ningún otro archivo.

## 1. Qué cambié

Archivo: `studio.css`. Único archivo modificado. `git diff --stat` lo confirma.

Los dos cambios, ambos dentro del `@media(max-width:480px)` de la **línea 1** (el que empieza
con `.nav{height:66px;...}`), exactamente como decía el plan:

**a)** `.thumbnails{grid-template-columns:repeat(4,minmax(0,1fr))}` →
`.thumbnails{grid-template-columns:repeat(2,minmax(0,1fr))}`

**b)** Añadido antes del `}` de cierre del bloque:
```css
.nav button{font-size:13px;min-height:44px}.brand{min-height:44px}.eyebrow{font-size:12px;letter-spacing:1.2px}.hero-action{min-height:44px}.section-title h2>span:first-child,.section-title .label>span:first-child{font-size:12px}.section-title #photoCount{font-size:12px}.upload>span:last-child{font-size:12px}.hint,.cost-note,.preview-footer p,.footer-note{font-size:13px}.examples button{font-size:13px;min-height:44px;padding:10px 14px}.video-spec{font-size:12px}.primary{min-height:44px}.message{font-size:13px}.preview-tag{font-size:12px}.empty-preview p,.progress p{font-size:13px}.thumbnail figcaption{font-size:12px}.thumbnail button{width:44px;height:44px;font-size:22px;right:6px;top:6px}
```

Verificado con `node -e` (balance de llaves `{`/`}` del archivo completo): balanceado, profundidad
final 0. `git diff` muestra un solo bloque de cambio dentro de la línea 1; la línea 3 (el segundo
`@media(max-width:480px)`, el del hero) no se tocó. No se tocó `studio.js`, `creator.html`,
`index.html` ni `style.css`.

Servidor local: verificado por hash antes de cada medición
(`diff <(shasum -a 256 < studio.css|cut -d' ' -f1) <(curl -s http://localhost:8856/studio.css|shasum -a 256|cut -d' ' -f1)`)
→ IDÉNTICOS en los tres momentos que importaba (antes de medir "antes", tras restaurar la base
temporal para la comparación de escritorio, y tras restaurar la versión final).

## 2. Tabla ANTES

Reproduzco la tabla del plan (no la remedí yo; el plan ya la dejó medida contra el árbol antes de
mis cambios, y mi propio "antes" era ese mismo `studio.css` sin tocar):

| Medida | ES (320/375/430) | EN (320) |
|---|---|---|
| Desbordes / scroll lateral | 0 / no | 0 / no |
| Textos bajo 12 px | 11 de 19 (58 %) | 10 de 19 |
| El más chico | 9 px («VISTA PREVIA») | 9 px |
| Botones bajo 44×44 | 8 | 8 |
| El peor | × de quitar imagen: 23×23 | igual |

No repetí esta medición "antes" en vivo porque hubiera significado deshacer mis cambios y luego
volverlos a poner en el servidor en uso; en vez de eso la reproduje matemáticamente: revertí
`studio.css` a la versión de `git show HEAD:studio.css` (idéntica a antes de mi edición, confirmé
por diff), sin tocar el resto del árbol, y usé ese mismo intercambio para la comparación de
escritorio del punto 4. La tabla "antes" del plan y el `studio.css` que edité son el mismo archivo
base — no hay discrepancia que reportar.

## 3. Tabla DESPUÉS (medida por mí)

Navegador real (panel de Chrome), `http://localhost:8856/creator.html`, foto sintética cargada +
descripción escrita (para que exista la ×), `document.fonts.ready` esperado antes de medir.
Script `auditar-pagina.js` de la habilidad `revisar-en-celular`, pegado completo en cada corrida.

| Medida | ES 320 | ES 375 | ES 430 | EN 320 |
|---|---|---|---|---|
| Ancho medido | 320 | 375 | 430 | 320 |
| scroll_horizontal | false | false | false | false |
| Desbordes | 0 | 0 | 0 | 0 |
| Textos totales contados | 19 | 19 | 19 | 19 |
| Textos bajo 12 px | **0** | **0** | **0** | **0** |
| El más chico | — (ninguno bajo 12) | — | — | — |
| Botones bajo 44×44 | **0** | **0** | **0** | **0** |
| nodos_dom | 63 | — | — | — |
| aviso | "MUY POCOS NODOS" (63) | — | — | — |

Distribución de tamaños a 320 ES: `12px: 4 · 13px: 11 · 14px: 2 · 16px: 1 · 38px: 1` — coincide
exactamente con la distribución que el plan dijo que daría el bloque ya probado.

El aviso "MUY POCOS NODOS" es normal en esta página (~63 nodos), como advierte el encargo. Confirmé
que `.thumbnail` existe y sigue funcionando: a 320 px, `.thumbnail` mide 118.5×145, la imagen
118.5×118.5, y el botón × mide **44×44** (antes 23×23), posicionado dentro del área de la imagen
(`right:149.5` vs. borde de imagen en `155.5`; `top:881.46` vs. `875.46`) — ya no tapa casi toda la
miniatura como con la grilla de 4 columnas.

Eyebrow a 320 px, español: texto "TU ESTUDIO DE VIDEO CON IA", `font-size:12px`, alto de caja
**14.5 px** → una sola línea, tal como el plan pedía al bajar `letter-spacing` de 2 a 1.2 px.
En inglés ("YOUR AI VIDEO STUDIO") también 14.5 px de alto, una línea.

**Funcionalidad, verificada en el mismo navegador (a 320 px, EN, tras medir):**
- Consola: 0 errores en toda la sesión de medición (`read_console_messages` con `onlyErrors:true`
  y luego sin filtro, ambas veces limpio).
- Botón × quita la foto: antes del clic 1 `.thumbnail`, después 0. Funciona.
- Botón de ejemplo llena la descripción: clic en "Smile and zoom in" → el textarea quedó con
  "The person in the photo smiles and the camera slowly zooms in.". Funciona.
- Cambio de idioma ES→EN: `document.getElementById('language').click()` cambió
  `document.documentElement.lang` de "es" a "en" y el título de pestaña de "Crear video" a
  "Create video". Funciona.

## 4. Comparación de escritorio (punto 3 del plan): 0 diferencias

A 1280×900, con una foto cargada y descripción escrita (para poder medir también
`.thumbnail button`), medí `getBoundingClientRect()` de las 14 cajas pedidas y el `font-size`
computado de las 4 reglas pedidas, primero con `studio.css` restaurado a la versión base
(`git show HEAD:studio.css`, verificado por hash contra el servidor) y después con mi versión
final (verificado por hash otra vez). Recargué la página entre una medición y otra.

Resultado: **idéntico campo por campo**, sin ninguna diferencia:

| Selector | Base y editado (idéntico) |
|---|---|
| `.hero` | 1216×421.75, top 126 |
| `.studio` | 1216×798.859375, top 581.75 |
| `.editor` | 595×798.859375 |
| `.preview` | 595×428.7578125 |
| `.upload` | 537×160 |
| `#create` | 125.9140625×43.5 |
| `.create-row` | 537×43.5 |
| `.examples` | 537×29 |
| `.preview-screen` | 537×302.0625 |
| `.preview-footer` | 537×35.6953125 |
| `.footer-note` | 1216×18 |
| `.nav` | 1280×78 |
| `.thumbnails` | 537×151.5 |
| `.thumbnail button` | 23×23 |
| `.preview-tag` (font-size) | 9px |
| `.eyebrow` (font-size) | 10px |
| `.hint` (font-size) | 11px |
| `.examples button` (font-size) | 11px |

Confirma que el diseño de escritorio no cambió: mis dos cambios viven exclusivamente dentro de
`@media(max-width:480px)`, que no aplica a 1280 px por definición — la medición lo prueba en vez
de solo asumirlo.

## 5. Qué NO pude medir (pendiente de medición para Kimo MD / Nico)

- **Contraste de colores** de los textos afectados (`.footer-note`, `.preview-tag`, etc. a los
  nuevos tamaños/colores). Fuera de alcance declarado por el plan ("Contraste: no se midió...
  queda para otra ronda si José lo pide"). No lo medí; si se pide, la habilidad tiene
  `contraste.py`.
- **Tableta/escritorio 481–900 px.** El plan lo declara fuera de esta ronda. No lo medí.
- **`index.html`/`style.css` (portada).** Fuera de esta ronda; además esos archivos están bajo
  trabajo de la otra sesión en paralelo (ronda `motion-portada-10sep`, ya con commit `b6555e0`).
  No los abrí.
- **Verificación visual con captura para José** (que el eyebrow se vea en una línea de verdad, que
  la × no tape la miniatura a simple vista). Medí las cajas con `getBoundingClientRect` y confirmé
  numéricamente que no hay solapamiento, pero una captura para que José lo vea a ojo es tarea de
  Kimo MD según las reglas de este rol — no levanto capturas de pantalla como entregable final ni
  decido "se ve bien", solo mido.
- **Cómo se ve en un teléfono físico** (teclado en pantalla, barra de Safari, zona segura del
  notch). El navegador con viewport angosto se aproxima pero no es lo mismo; si José tiene el
  teléfono a la mano, la palabra final es suya (así lo dice la propia habilidad).

## 6. Commit

Un solo commit local, sin push, con:
`studio.css`, `.joga/handoff/implementacion-motion-legible-movil-10sep.md`,
`.joga/handoff/plan-motion-legible-movil-10sep.md`. No se incluyó `.claude/` (temporal, del
servidor de medición de esta ronda).
