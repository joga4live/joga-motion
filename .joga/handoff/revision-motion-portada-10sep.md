# Revisión — ronda motion-portada-10sep (Nico)

Fecha: 10 de septiembre de 2026.
Commit auditado: **`b6555e0`** (`git diff 5e8b122 b6555e0`).
Plan: `.joga/handoff/plan-motion-portada-10sep.md` · Implementación: `.joga/handoff/implementacion-motion-portada-10sep.md`.

---

# VEREDICTO: **APROBADO**

Cero defectos. La regla de José se cumple al pie de la letra y lo comprobé midiendo, no leyendo:
**misma imagen, mismo encuadre, mismo tamaño en pantalla, 82,9 % menos peso.**

La única diferencia que encontré en toda la página es la que el plan pedía a propósito
(el `aspect-ratio` que reserva el hueco de la imagen), y no mueve ni un píxel.

Hay **tres avisos de proceso** al final que no bloquean este commit pero que José y Kimo MD
deben leer antes de publicar — sobre todo el aviso 1.

---

## 1. La imagen — APROBADO

### Píxeles idénticos, sin recorte

| | PNG original (`5e8b122`) | JPEG nuevo (`b6555e0`) |
|---|---|---|
| bytes | 2 161 578 | **369 946** (−82,9 %) |
| píxeles | 1672 × 941 | **1672 × 941** |
| alfa | no | no |
| dpi | 72 | 72 |

Recuperé el PNG original con `git show 5e8b122:joga-motion-brand-hero.png` y comparé **píxel a
píxel** con PIL:

- Tamaños iguales, **sin recorte y sin desplazamiento**: la diferencia media en las esquinas
  superior-izquierda (0,6), inferior-derecha (0,97) y el centro (1,87) es del mismo orden. Si
  hubiera recorte o corrimiento, un borde daría una diferencia enorme y el centro no.
- Diferencia media por canal: **R 1,33 / G 1,01 / B 1,63** sobre 255.
- Píxeles con diferencia de luminancia > 8: **147 de 1 573 352 (0,009 %)**. Ninguno por encima de 16.
- Esto es ruido de cuantización JPEG, no un cambio de imagen.

### No hubo remuestreo ni suavizado

`sips -Z 1672` sobre una imagen que ya mide 1672 de ancho podría haber resampleado y ablandado la
foto. **No lo hizo**: energía de bordes PNG = 11,1580 / JPEG = 11,1749, **ratio 1,0015**. Un
remuestreo habría dejado el ratio por debajo de 0,9.

### No hay bandeo en el cielo

El degradado del amanecer es el sitio donde un q80 suele hacer bandas. Conté valores distintos en
tres columnas verticales de 300 px de cielo:

| columna | PNG | JPEG |
|---|---|---|
| x=300 | 52 | 55 |
| x=900 | 69 | 67 |
| x=1500 | 101 | 104 |

Sin pérdida de gradación. **Sin bandeo.**

### Y la miré, no solo la medí

Generé una comparación lado a lado a tamaño completo y un zoom 2× sobre el peor mosaico de
200×200 px (el de mayor diferencia, en x=1200 y=400, media 2,56). A ojo son **indistinguibles**:
el libro, las páginas volando, las montañas, la pareja caminando, las flores moradas y la luz del
amanecer están igual. En el zoom al doble sobre la peor zona no se ven bloques ni artefactos.

### El binario no se corrompió en git

`.gitattributes` tiene `* text=auto` sin una línea `*.jpg binary`. Eso es un riesgo real de
normalización LF sobre un binario, así que lo comprobé en vez de suponerlo:

- `git check-attr` → `text: auto` (heurística de git, no marcado binario explícito).
- `git cat-file blob b6555e0:joga-motion-brand-hero.jpg | cmp - joga-motion-brand-hero.jpg`
  → **idénticos**, 369 946 bytes.
- El blob guardado en git **decodifica**: PIL lo abre como 1672×941 RGB.

La heurística de git acertó. No es un defecto, pero está anotado como riesgo latente abajo.

### `creator.html`

`creator.html:18` — línea única del cambio:

```html
<img class="hero-image" src="joga-motion-brand-hero.jpg" width="1672" height="941" alt="Un libro se transforma en una aventura cinematográfica entre montañas">
```

- Apunta al `.jpg`. Verificado en el navegador: `currentSrc` = `.../joga-motion-brand-hero.jpg`,
  `complete: true`, `naturalWidth: 1672`, `naturalHeight: 941`.
- **`alt` intacto**, byte por byte, en español.
- `width="1672" height="941"` = 1672/941, exactamente la proporción nativa.
- **Ningún otro sitio del repo apunta al `.png`.** Grepeé yo mismo: el único `brand-hero` en
  código vivo es esa línea. Los demás hits están en `.joga/handoff/` (histórico). Servido por
  HTTP local: `.jpg` → 200 con 369 946 bytes exactos; `.png` → **404**, como debe ser.

---

## 2. El tamaño en pantalla — APROBADO (medido, con control)

**No medí sobre el árbol de trabajo**, porque `studio.css` estaba sucio con el trabajo de la otra
sesión y habría contaminado la geometría. Exporté los dos commits limpios con `git archive` a un
directorio temporal fuera del repo y serví ambos desde el mismo origen, con el idioma fijado en
`es` (`localStorage.jiLang`) y esperando `document.fonts.ready` en las dos pasadas.

### `.hero-image` — `getBoundingClientRect()`

| ancho de ventana | ANTES (`5e8b122`) | DESPUÉS (`b6555e0`) | referencia del encargo |
|---|---|---|---|
| 1440 px (DPR 2) | x 586,75 · y 127 · **740,25 × 521,94** | x 586,75 · y 127 · **740,25 × 521,94** | 740 × 522 ✓ |
| 390 px | x 17 · y 392,46 · **356 × 210** | x 17 · y 392,46 · **356 × 210** | 356 × 210 ✓ |

Idénticos hasta el centésimo de píxel, posición incluida. `object-fit: cover` y
`object-position: 58% 50%` sin cambio. Sin desbordamiento horizontal (`scrollWidth` = 390 en móvil).

### Diferencia total de la página del creador: **1 propiedad en 70 elementos**

Comparé los **70 elementos** de `creator.html` en 35 propiedades computadas + rectángulo, a 1440 y
a 390. En ambos anchos aparece exactamente **una** diferencia, en el mismo elemento:

```
IMG  rect ANTES = rect DESPUÉS  (idéntico)
     aspectRatio:  ANTES = auto        DESPUÉS = auto 1672 / 941
```

Eso es **precisamente el efecto buscado** de `width`/`height`: el navegador reserva el hueco antes
de que baje la imagen. El rectángulo no se mueve porque `studio.css` fija
`width:100%; height:100%`, así que la pista es inocua. **Todo lo demás es idéntico.**

### Control que valida el instrumento

Un "todo idéntico" no vale nada si el instrumento siempre dice lo mismo. Preparé una tercera copia
(`ctrl`) con dos alteraciones deliberadas y pequeñas y volví a medir:

- `.nav{height:80px}` (2 px más) → detectado: `docH` 1409 → **1411**, hero y 127 → **129**.
- `.hero h1{font-size:41px}` en `index.html` → detectado: huella total `1dom5ux` → **`1792pol`**,
  `fontSize` leído = 41px.

El arnés **sí** detecta cambios de 2 px. Los "idénticos" de arriba son reales.

---

## 3. El CSS muerto — APROBADO

### Cada selector borrado, grepeado por mí (no me fié del reporte)

Extraje **programáticamente** todos los identificadores de clase/id del bloque borrado (123 tokens,
descartando colores hex) y conté usos en `index.html`, `creator.html`, `studio.js`, `i18n.js`,
`worker.js`. Resultado: **0 usos** en los 46 selectores del bloque
(`assembly-panel`, `btn-again`, `btn-dl`, `btn-gen`, `compose-badge`, `compose-examples`,
`compose-grid`, `compose-heading`, `compose-inputs`, `compose-panel`, `compose-photo`,
`compose-photos`, `compose-review`, `composeAspect`, `composeEmpty`, `composePreview`,
`creator-body`, `creator-hero`, `creator-hero-bg`, `creator-sub`, `creator-title`, `creator-word`,
`ctrl-box`, `ctrl-label`, `ctrl-panel`, `ctrl-textarea`, `d-btn`, `export-source`, `prog-panel`,
`result-panel`, `result-video-wrap`, `s-btn`, `scene-action`, `scene-error`, `scene-list`,
`scene-note`, `scene-row`, `scene-select`, `sl-label`, `slider-wrap`, `toast`, `u-hint`, `u-icon`,
`u-sub`, `upload-col`, `upload-zone`, `page-creator`).

Dos tokens del bloque **sí** existen en el HTML y merecen explicación explícita, porque el reporte
de Tavo no los distingue:

- **`nav-logo`: 1 uso** (`index.html:17`). Pero las reglas borradas eran
  `body:has(.page-creator) .nav-logo {…}`, colgadas de `.page-creator`, que tiene **0 usos**. Las
  reglas base `.nav-logo` (líneas 64–71 de `style.css`) **siguen ahí**. Comprobado en el navegador:
  el rect de `.nav-logo` es idéntico antes y después (40, 25, 141.92, 23.5) en escritorio y en móvil.
- **`intensity`: 1 uso**, pero en `i18n.js:158` es el texto `'Motion intensity'`, **no una clase**.
  Falso positivo del grep.

### Los tests tampoco lo usan

Grepeé `tests/composer-worker.mjs`, `tests/worker.mjs`, `tests/studio.cjs`: **0 referencias** a
selectores borrados, a `style.css` o a `brand-hero`. El plan no los mencionaba; los revisé igual.

### Qué página carga qué hoja

- `index.html` → **solo** `style.css`.
- `creator.html` → **solo** `studio.css`.

Es decir: el borrado en `style.css` solo puede afectar a `index.html`, y todo lo borrado estaba
colgado del creador. Coherente.

### Integridad del archivo

| | antes | después |
|---|---|---|
| bytes | 40 620 | **29 529** (−27,3 %) |
| líneas | 923 | **757** |
| `{` / `}` | — | **228 / 228** (balanceadas) |
| termina en `\n` | — | sí (`0a`) |
| reglas que el navegador parsea | 301 | **209** |

Que el navegador reporte 209 reglas es la prueba dura de que **el CSS parsea sin error**: si el
borrado hubiera dejado una llave suelta, el parser habría descartado reglas en cascada y el número
no cuadraría, además de romper la página.

### `button:disabled` y `button:focus-visible` — CONSERVADAS y VIVAS

Las dos están presentes al final del archivo (líneas 756 y 757), bajo
`/* Botones: estados genéricos */`. Comprobado en el CSSOM del navegador, con texto idéntico en
ANTES y DESPUÉS:

```
button:disabled { opacity: 0.45; cursor: not-allowed; }
button:focus-visible { outline: 2px solid var(--cyan); outline-offset: 3px; }
```

**La cascada no cambió.** Antes estaban en la línea 768 con 155 líneas después; ahora están al
final. Pero todo lo que las seguía fue borrado, así que su orden **relativo a todas las reglas que
sobreviven** (líneas 1–753) es exactamente el mismo. Ninguna regla superviviente vuelve a declarar
esos selectores.

Prueba funcional, no solo lectura: creé un `<button>` nuevo en la página **nueva** y lo deshabilité
→ `opacity: 0.45`, `cursor: not-allowed`. **La regla está viva.**

`var(--cyan)` sigue resolviendo: el bloque borrado redefinía `--cyan: #137c83` pero **solo dentro
de `body:has(.page-creator)`**. La definición base sobrevive. Verificadas idénticas en ANTES y
DESPUÉS: `--cyan #22D3EE`, `--violet #7B5CF6`, `--violet-2 #A78BFA`, `--border-v`, `--text`,
`--text-2`, `--sans`, `--r`, `--void`, `--dark`, `--gold`. **Ninguna variable quedó huérfana.**

---

## 4. `index.html` no cambió — APROBADO (comparado contra el sitio en vivo)

### El sitio en vivo *es* el commit anterior, byte por byte

Antes de medir por red, comprobé qué sirve `https://joga4live.github.io/joga-motion/`:

| archivo | vivo | `5e8b122` | `cmp` |
|---|---|---|---|
| `style.css` | 40 620 B | 40 620 B | **idéntico** |
| `index.html` | 14 843 B | 14 843 B | **idéntico** |
| `joga-motion-brand-hero.png` | 200, 2 161 578 B | igual | — |
| `joga-motion-brand-hero.jpg` | **404** | — | (aún no publicado ✓) |

Así que comparar mi export local de `5e8b122` contra el nuevo **es** comparar contra el sitio en
vivo, sin ruido de red ni de CDN.

### Huella completa de la página: 190 elementos, 32 propiedades

| medición (1440 px) | huella | elementos |
|---|---|---|
| sitio EN VIVO | `1dom5ux` | 190 |
| local ANTES (`5e8b122`) | `1dom5ux` | 190 |
| local DESPUÉS (`b6555e0`) | **`1dom5ux`** | 190 |
| copia de control alterada | `1792pol` ≠ | 190 |

Las **190 huellas individuales** también coinciden una por una. A 390 px: ANTES `1qazmhu` =
DESPUÉS `1qazmhu`. Altura total del documento: **4509 px** en los tres (escritorio) y **7450 px**
en ambos (móvil).

Posiciones de elementos clave, idénticas en vivo / antes / después a 1440:

| elemento | x, y, ancho, alto |
|---|---|
| `.nav` | 0, 0, 1440, 74.5 |
| `.nav-logo` | 40, 25, 141.92, 23.5 |
| `#lang-toggle` | 1163.8, 21.25, 77.79, 31 |
| `.hero-h1` | 413.05, 146.5, 613.89, 344.27 |
| `#how` | 0, 1331.12, 1440, 553.59 |
| `.pricing` | 0, 3418, 1440, 904.21 |

**Cero errores de consola** en `index.html` y en `creator.html`, en ambos anchos, antes y después.

---

## 5. Alcance, reglas de oro y publicación — APROBADO

- **Archivos del commit**: `creator.html` (M), `style.css` (M), `joga-motion-brand-hero.jpg` (A),
  `joga-motion-brand-hero.png` (D), y los dos `.md` de la ronda. **Nada más.**
- **`studio.js`, `worker.js`, `studio.css`, `i18n.js`, `index.html`, `tests/`: intactos.**
  Confirmado con `git diff --name-only 5e8b122 b6555e0 --` sobre esa lista: salida vacía.
- **Un solo commit**, como pedía el plan. Mensaje bilingüe correcto y termina en
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Sin push**: `origin/main` sigue en `5e8b122`. José publica desde GitHub Desktop.
- **Llaves de `localStorage`**: ninguna renombrada. `jiLang` sigue siendo la única
  (`i18n.js:2`, `studio.js:7`). Nadie pierde nada.
- **Reglas de oro**: `gate.js`, `sw.js`, `service-worker.js` y `manifest.json` **no existen en
  este repo** (`joga-motion`), así que las reglas del gate y del service worker no aplican aquí.
- **i18n**: `i18n.js` sin cambios. Paridad comprobada igual: **76 claves en `es`, 76 en `en`,
  ninguna suelta de ningún lado.** El `#lang-toggle` se pinta idéntico antes y después.
- **JS válido**: los archivos tocados no traen script inline. `creator.html` solo tiene
  `<script src="studio.js" defer>`; el cambio fue un atributo de `<img>`. `style.css` no es JS y
  parsea limpio (209 reglas). Nada que validar más allá de eso.
- **Marca**: no se alteró nada de branding. Lo borrado eran anulaciones de tema claro colgadas de
  `.page-creator`, que no casa con ningún elemento. El logo, el `pip`, los violetas y el dorado se
  computan idénticos (ver tabla de variables).

---

## Corrección al reporte de Tavo (no es un defecto del código)

Tavo escribió, en «PENDIENTE DE MEDICIÓN»:

> «ningún otro selector en el CSS restante compite por especificidad en
> `button:disabled`/`button:focus-visible`»

**Eso no es exacto y lo medí.** `#lang-toggle` (`style.css:94`) declara `cursor: pointer` con
especificidad de id (1,0,0), que **gana** a `button:disabled { cursor: not-allowed }` (0,1,1).
Medido con las transiciones neutralizadas:

| | ANTES (`5e8b122`) | DESPUÉS (`b6555e0`) |
|---|---|---|
| `#lang-toggle` normal | `opacity 1 / cursor pointer` | `opacity 1 / cursor pointer` |
| `#lang-toggle` deshabilitado | `opacity 0.45 / cursor pointer` | **`opacity 0.45 / cursor pointer`** |

O sea: el `opacity` sí le aplica, el `cursor` no. **Es idéntico antes y después, así que no es
regresión de esta ronda** — es un detalle preexistente. Lo dejo anotado para que la afirmación de
Tavo no se convierta en premisa incuestionada en la próxima vuelta. Además `#lang-toggle` nunca se
deshabilita hoy en la app, así que en la práctica no se ve.

Lo que **sí** acertó Tavo, y hace bien en decirlo: el comentario `/* Multi-image scene editor */`
estaba en la línea **755**, no en la 754 del plan. Corrigió el número en vez de dejar escrita una
premisa falsa. Verificado: el hunk arranca en la 752 de contexto y nada anterior se movió.

---

## Avisos antes de publicar (no bloquean este commit)

### AVISO 1 — hay un commit encima que esta ronda NO auditó

Mientras yo auditaba, la otra sesión commiteó **`bb683e9`** («letra legible y botón de quitar
tocable en el creador móvil (≤480px)»), que toca `studio.css` y añade sus dos `.md`. Ahora
`HEAD` = `bb683e9`, no `b6555e0`.

- Mi veredicto APROBADO cubre **`b6555e0` y solo `b6555e0`**. Lo medí aislado, con `git archive`,
  precisamente para que el trabajo de la otra sesión no contaminara ni ensuciara el resultado.
- **`bb683e9` no está revisado por esta ronda.** Si José publica desde GitHub Desktop, publica
  `HEAD`, y `bb683e9` se va con él sin haber pasado por revisión.
- Esto es la regla de «una ronda en vuelo a la vez» rompiéndose otra vez. **Kimo MD tiene que
  decidir**: o se revisa `bb683e9` antes de publicar, o se publica solo hasta `b6555e0`.

### AVISO 2 — el `.jpg` es un binario nuevo; tiene que subir con el commit

Hoy el sitio en vivo da **404** en `joga-motion-brand-hero.jpg` y 200 en el `.png`. Es lo esperado
(no está publicado). Pero el orden importa: si se publicara `creator.html` sin el binario, la
portada del creador quedaría rota. GitHub Desktop sube el commit entero, así que basta con no
publicar a medias.

### AVISO 3 — `.gitattributes` no marca los binarios (riesgo latente)

`.gitattributes` es solo `* text=auto`, sin `*.jpg binary` ni `*.png binary`. Esta vez la
heurística de git acertó (lo verifiqué byte a byte), pero es una red de seguridad que no está
puesta. Una línea `*.jpg -text` / `*.png -text` la pondría. **No es defecto de esta ronda** y no
lo toqué; lo dejo para que se decida en otra.

---

## Lecciones de esta vuelta

No hubo defectos de código, así que todas las lecciones son de **proceso y de instrumento**. Kimo
MD: éstas son las que valen para `AGENTS.md` §9.

1. **Cuando el árbol de trabajo esté sucio, no midas sobre él.** Iba a servir el repo tal cual, y
   `studio.css` tenía encima el cambio sin commitear de la otra sesión — habría medido geometría
   de móvil que no pertenece a este commit y podría haber reportado una regresión falsa.
   **Regla: para medir un commit, sírvelo con `git archive <commit>` a un directorio temporal
   fuera del repo, nunca desde el árbol de trabajo.**

2. **El panel del navegador oculto congela las transiciones CSS, y `getComputedStyle` devuelve el
   valor de antes.** Mi primera lectura de `button:disabled` dio `opacity: 1` y estuve a un paso de
   reportar que la regla conservada no funcionaba. `#lang-toggle` tiene `transition: all .2s`; con
   el panel oculto la transición nunca avanza, por más que esperes. Esperar más no lo arregla.
   **Regla: antes de leer cualquier estilo computado que pueda estar en transición, inyecta
   `*{transition:none!important;animation:none!important}`. Y desconfía de una lectura que
   coincida sospechosamente con el valor "de reposo".**

3. **Un `Tab` sintético no mueve el foco en este arnés.** Hice el control primero —`activeElement`
   se quedó en `BODY` tras 4 pulsaciones— así que **no** reporté nada sobre `:focus-visible` por
   teclado. Lo verifiqué por otra vía (regla presente en el CSSOM con texto idéntico, posición en
   cascada intacta, `var(--cyan)` resolviendo igual).
   **Regla: el control va ANTES que la medición, no después. Si el control falla, se cambia de
   método o se dice que no se pudo medir — nunca se reporta "PASA".**

4. **Un "todo idéntico" sin control positivo no es evidencia.** Preparé una copia con un cambio
   deliberado de 2 px y confirmé que el arnés lo detectaba antes de creerme los 190 hashes iguales.
   **Regla: toda comparación que concluya "sin cambios" debe ir acompañada de una copia alterada a
   propósito que el mismo instrumento sí detecte.**

5. **Antes de medir por red, comprueba si puedes medir en local.** El sitio en vivo resultó ser
   byte por byte igual a `5e8b122` (`cmp` sobre `style.css` e `index.html`), así que la
   comparación "vivo vs nuevo" se convirtió en una comparación local sin ruido de red, y aun así
   cerré el círculo midiendo el origen real. **Regla: `curl` + `cmp` contra el commit antes de
   abrir el navegador contra producción.**

6. **Comparar una huella de página exige fijar el idioma.** Fijé `localStorage.jiLang = 'es'` y
   esperé `document.fonts.ready` en las dos pasadas, y lo dejé registrado en cada medición
   (`lang`, `htmlLang`, un fragmento del `h1`) para poder demostrar que no se me coló una pasada
   en inglés. **Regla: toda medición de geometría lleva el idioma y la fuente registrados en la
   propia salida.**

7. **Limpieza sin matar por número.** El repo ya tenía un `.claude/launch.json` y un servidor en el
   puerto 8791, de la otra sesión. **No creé ningún `launch.json`** y no reutilicé ese puerto:
   levanté un `python3 -m http.server` en un puerto que verifiqué libre, guardé el PID en un
   archivo, y al terminar maté **por PID exacto** tras confirmar con `ps -p` que el proceso era el
   mío. El servidor ajeno del 8791 sigue vivo e intacto. **Regla: guarda el PID al arrancar, mata
   por PID y confirma con `ps -p` antes y después. Nunca `grep` por número de puerto.**

8. **Un grep de "0 usos" puede esconder un uso real que no importa, y un uso real que sí
   importaría.** `nav-logo` daba 1 uso y `intensity` daba 1 uso, y ninguno de los dos aparece como
   tal en el reporte de Tavo. Los dos resultaron inocuos (uno bajo un ancestro muerto, el otro un
   texto en inglés dentro de `i18n.js`), pero eso solo se sabe **abriendo cada hit**.
   **Regla: al borrar CSS, un selector con >0 usos no se descarta con una nota; se abre el hit y se
   escribe por qué no aplica.**

9. **La regla que faltó y que rompió la ronda: nadie impidió commitear encima de lo que se está
   auditando.** `bb683e9` aterrizó sobre `b6555e0` a mitad de mi revisión (ver Aviso 1).
   **Regla: mientras haya una ronda en revisión, la otra sesión no commitea en la misma rama — se
   queda en su árbol de trabajo, o usa una rama aparte, hasta que salga el veredicto.** Y del lado
   del revisor: **vuelve a comprobar `git log` y `git status` al cerrar el reporte, no solo al
   abrirlo** — yo abrí con `HEAD = b6555e0` y cerré con `HEAD = bb683e9`, y de no haberlo mirado
   dos veces habría dado por publicable algo que no revisé.
