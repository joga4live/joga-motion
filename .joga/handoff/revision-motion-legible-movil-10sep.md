# Revisión — ronda `motion-legible-movil-10sep` (Nico)

**Veredicto: APROBADO.**

Commit auditado: `bb683e9` sobre `b6555e0`. Auditoría en solo lectura; no modifiqué ni un archivo
del proyecto. Este reporte es mi único archivo escrito.

Cero defectos atribuibles a esta ronda. El commit hace exactamente lo que el plan dictó, ni un
carácter más, y las tres afirmaciones fuertes de Tavo (0 textos bajo 12 px, 0 botones bajo 44×44,
escritorio idéntico) las medí yo por mi cuenta y **se sostienen todas**.

Hay cuatro fallos de contraste reales en la página, pero **medí que son idénticos antes y después
de este commit** — son preexistentes y el plan los declaró fuera de alcance. Van al final, para la
siguiente ronda.

---

## 0. Integridad de lo que medí

Antes de creer ningún número:

| Comprobación | Resultado |
|---|---|
| `shasum -a 256` de `studio.css` en el árbol | `6c2fb353…c6d3` |
| El mismo archivo servido por `http://localhost:8856/studio.css` | `6c2fb353…c6d3` **idéntico** |
| El mismo archivo en `git show bb683e9:studio.css` | `6c2fb353…c6d3` **idéntico** |
| CSSOM de la página cargada contiene el bloque nuevo | sí (`repeat(2,` y `width:44px;height:44px` presentes) |
| `git status --porcelain` al terminar | vacío (árbol limpio, no lo toqué) |

**Ojo, un movimiento a mitad de la auditoría:** mientras yo medía, la otra sesión commiteó
`ded929e` (su propio reporte de revisión de la ronda `motion-portada-10sep`). Comprobé que solo
añade un `.md` y que `git diff bb683e9 HEAD -- studio.css` da **0 líneas**: el `studio.css` que
medí durante toda la sesión es exactamente el de `bb683e9`. Ninguna medición quedó invalidada.
No audité `creator.html` ni `style.css` (los tocó `b6555e0`, que es de esa otra ronda).

---

## 1. Alcance — PASA

`git show bb683e9 --stat`: `studio.css` (1 línea cambiada) más los dos handoffs de la ronda.
Nada en `studio.js`, `creator.html`, `index.html` ni `style.css`. No hay `.claude/` en el repo
(Tavo lo dejó fuera como pedía el plan; verificado, y no hay `.gitignore` que lo esconda).

`studio.css` está minificado en 3 líneas. Comparé texto contra texto con Python, no a ojo:

| Región del archivo | base `b6555e0` vs. nuevo `bb683e9` |
|---|---|
| Línea 1, **antes** del `@media(max-width:480px)` | **idéntica** carácter por carácter |
| Línea 1, **dentro** del `@media(max-width:480px)` | 378 → 1076 caracteres (los 2 cambios del plan) |
| Línea 1, **después** de ese bloque (`@media(prefers-reduced-motion)`) | **idéntica** |
| Líneas 2 y 3 (el bloque del hero, incluido su propio `@media(max-width:480px)`) | **idénticas** |
| Balance de llaves del archivo completo | base 100/100, nuevo 116/116, ambos balanceados |

El bloque añadido lo comparé **byte por byte contra el bloque literal del plan**: 698 caracteres
en ambos, `IDENTICOS: True`. Tavo no improvisó ni una declaración.

`node --check` sobre `studio.js`, `i18n.js` y `worker.js`: los tres pasan.
`node tests/worker.mjs`: `PASS: provider outage preserves task, invalid duration and task IDs rejected`.

---

## 2. Control del arnés — antes de creer un solo "PASA"

No mido nada sin demostrar primero que el instrumento detecta lo que dice detectar. Cargué en la
página **el `studio.css` base** (de `git show b6555e0:studio.css`, inyectado en un `<style>` que
sustituye al `<link>`; jamás toqué el archivo del repo) y corrí el mismo auditor:

| Medida a 320 px ES, CSS **base** | Lo que decía el plan | Lo que midió mi arnés |
|---|---|---|
| Textos bajo 12 px | 11 de 19 (58 %) | **11 de 19 (58 %)** |
| El más chico | 9 px («VISTA PREVIA») | **9 px («VISTA PREVIA»)** |
| Botones bajo 44×44 | 8 | **8** |
| El peor botón | × de quitar: 23×23 | **× de quitar: 23×23** |
| Desbordes / scroll lateral | 0 / no | **0 / no** |

Reproduce el "antes" clavado. **El instrumento detecta.** Sin este control, todos los ceros de
abajo serían humo.

Segundo control, para la comparación de escritorio: la misma comparación base-vs-nuevo corrida a
**320 px** debe encontrar diferencias. Encontró **17 de 18 claves distintas**. También detecta.

Idioma fijado explícitamente en cada pasada y `document.fonts.ready` esperado antes de medir
(la página venía con `jiLang=en` persistido en `localStorage`; si no lo fijo, comparo español
contra inglés y me invento una regresión).

---

## 3. Medición móvil — PASA

Navegador real, `http://localhost:8856/creator.html`, foto sintética cargada y descripción escrita
(para que exista la ×), auditor de la habilidad `revisar-en-celular`.

| Medida | ES 320 | ES 375 | ES 430 | EN 320 | EN 375 | EN 430 |
|---|---|---|---|---|---|---|
| scroll horizontal | no | no | no | no | no | no |
| exceso px | 0 | 0 | 0 | 0 | 0 | 0 |
| Desbordes | 0 | 0 | 0 | 0 | 0 | 0 |
| Textos bajo 12 px (script) | **0/19** | **0/19** | **0/19** | **0/19** | **0/19** | **0/19** |
| Botones bajo 44×44 | **0** | **0** | **0** | **0** | **0** | **0** |
| Miniatura | 119×119 | 146×146 | 174×174 | 119×119 | 146×146 | 174×174 |
| Botón × | 44×44 | 44×44 | 44×44 | 44×44 | 44×44 | 44×44 |
| % de la foto que tapa la × | 13,8 % | 9,1 % | 6,4 % | 13,8 % | 9,1 % | 6,4 % |

**El script de la habilidad ignora los textos de menos de 10 letras**, así que no me fié de su
conteo: medí **todos** los nodos hoja con texto, cortos incluidos.

| Barrido exhaustivo a 320 px | ES | EN |
|---|---|---|
| Textos visibles medidos | 31 | 31 |
| Bajo 12 px | **0** | **0** |
| El más chico | **12 px** | **12 px** |
| Botones medidos | 9 | 9 |
| Botones bajo 44×44 | **0** | **0** |

Los cuatro que el script no contaba y que estaban mal, ahora medidos uno por uno a 320 px:
`01` y `02` 11→**12 px**; `1 / 1` 11→**12 px**; `Imagen 1` / `Image 1` 10→**12 px**;
`VISTA PREVIA` 9→**12 px**; `PREVIEW` 9→**12 px**.

Botones a 320 px ES, todos con su medida real: marca 152,3×**44** (era 152×32), «English»
76,3×**44** (era 73×35), «Crear mi video» 132,1×**44** (era 132×42), zona de subida 246×160,
**× 44×44** (era 23×23), los tres ejemplos 174,3/141,5/155,7 ×**44** (eran ×29), «Crear video»
246×**44** (era 43,5). Los nueve pasan en las dos dimensiones, en los dos idiomas.

### El eyebrow en una línea — PASA

| | ES | EN |
|---|---|---|
| Texto | «TU ESTUDIO DE VIDEO CON IA» | «YOUR AI VIDEO STUDIO» |
| font-size | 12 px (era 10) | 12 px |
| letter-spacing | 1,2 px (era 2) | 1,2 px |
| Ancho ocupado a 320 px | **208,4 px** | **162,4 px** |
| Ancho disponible (320 − 32 de padding) | 288 px | 288 px |
| Alto de la caja | 14,5 px | 14,5 px |
| **Líneas** | **1,0** | **1,0** |

Sobran 79,6 px en español a 320 px. Una línea con holgura, medido, no supuesto. Idéntico a 375 y 430.

### La × no tapa la miniatura — PASA

A 320 px la imagen ocupa 119×119 en `(37, 327)` y la × ocupa 44×44 en `(106, 333)`: queda
**entera dentro** de la esquina superior derecha de la foto y cubre **13,8 %** de su área. Con el
CSS base la foto medía 55×55 y la × 23×23 — el botón era casi intocable con el dedo (le faltaban
21 px por lado). El `aria-label` está y es correcto: `"Quitar imagen 1"` / `"Remove image 1"`.

**Captura tomada** a 320 px con la foto cargada y la miniatura a la vista: confirma la ×
como círculo blanco en la esquina, la foto completa visible debajo, y todo el texto legible.
No pude guardarla como archivo (la herramienta de captura del panel devuelve la imagen a la
conversación, no al disco); la reporto con los números de arriba, que es lo que decide.

---

## 4. Escritorio intacto — PASA

Comparé las 14 cajas (`getBoundingClientRect` con x, y, ancho y alto, a centésimas) y los 4
`font-size` que pedía el plan, entre el `studio.css` de `b6555e0` y el de `bb683e9`, con el idioma
fijado en español en ambas pasadas:

| Ancho | Claves comparadas | Diferencias |
|---|---|---|
| **1280 px** (el que pedía el plan) | 18 | **0** |
| 1440 px | 18 | **0** |
| 900 px (tableta) | 18 | **0** |
| 481 px (primer ancho fuera del `@media`) | 18 | **0** |
| 320 px (**control positivo**) | 18 | **17** |

El diseño del creador en escritorio no se movió ni una centésima de píxel. `.preview-tag` sigue en
9 px, `.eyebrow` en 10, `.hint` en 11, `.examples button` en 11 — exactamente como a José le gusta.

**El corte del media query es limpio.** A 481 px (un píxel fuera del bloque) vuelven de golpe los
valores viejos: 10 textos bajo 12 px, el más chico 9 px, 8 botones bajo 44×44, la × otra vez
23×23. Nada del bloque nuevo se filtró fuera de los 480 px.

### Branding — PASA

La lección del emblema que salió 26 % más chico. Medido en los tres anchos:

| Elemento | 320 px | 481 px | 1280 px |
|---|---|---|---|
| `.brand-icon` (el emblema ▶) | **32×32**, 12 px | **32×32**, 12 px | **32×32**, 12 px |
| `.brand strong` («Motion») | **60,8×23**, 19 px | **60,8×23**, 19 px | **60,8×23**, 19 px |
| `.brand` (el enlace completo) | 152,3×**44** | 152,3×32 | 152,3×32 |

El emblema y la palabra «Motion» **no cambian de tamaño en ningún ancho**. Lo único que crece en
móvil es la caja tocable del enlace (32→44 de alto), que es área de dedo, no marca. `flex-shrink`
sigue en 1 en todos, ninguno se comprime. Sin marca duplicada.

---

## 5. Uso real, sin errores — PASA

Ejercí el flujo completo a 320 px con eventos de puntero despachados sobre los elementos reales,
con un control positivo en el primer paso para demostrar que mis eventos llegan:

| Paso | Resultado |
|---|---|
| 1. Clic en el ejemplo «Sonrisa y acercamiento» | textarea `""` → «La persona de la foto sonríe y la cámara se acerca lentamente.» — **control positivo: mi clic sí llega** |
| 2. Escribir a mano en la descripción | valor puesto; «Crear video» pasa a **habilitado** |
| 3. Quitar con la × | miniatura desaparece, contador `1 / 1` → `0 / 1`, «Crear video» vuelve a **deshabilitado** |
| 4. Cambiar idioma | `es` → `en`, el texto escrito **se conserva**, el toggle pasa a «Español» |
| 5. Volver a español y subir otra foto | `en` → `es`, miniatura de vuelta, contador `1 / 1`, botón habilitado |

`read_console_messages`: **sin ningún mensaje**, ni error ni warning, en toda la sesión.

### Las otras reglas de oro

- **Service worker**: este repo **no tiene** (`sw.js`/`service-worker.js` no existen, no hay
  `caches.open` ni registro de `serviceWorker` en ningún archivo). No aplica, y por tanto no hay
  riesgo de que el CSS nuevo se quede cacheado.
- **Gate**: este repo **no tiene** `gate.js` ni candado. No aplica.
- **i18n**: paridad **76 claves en `es` y 76 en `en`**, ninguna sobrante en ninguno de los dos
  lados, ninguna sin traducir. El toggle funciona en vivo (paso 4). El commit no toca textos.
- **`localStorage`**: la única llave de la app es `jiLang`, y es la misma en los dos sitios que la
  usan (`studio.js:7,50` y `i18n.js:2` vía `JM_LANG_KEY = 'jiLang'`). El commit es solo CSS: **no
  se renombró ninguna llave**, nadie pierde su progreso.
- **Contaminación cruzada con la portada**: `studio.css` lo carga **únicamente** `creator.html`;
  `index.html` carga `style.css`. Los cambios móviles no tocan la portada. Verificado.

### Un efecto secundario buscado, pero que conviene que José sepa

Las reglas nuevas de `.eyebrow` y `.hero-action` viven en la línea 1, y el hero del creador (de la
otra ronda, línea 3) usa esas mismas clases. Así que **en móvil el hero también cambia un poco**:
su eyebrow pasa de 10 a 12 px y su botón «Crear mi video» de 42 a 44 px de alto, con lo que el
hero crece **2,5 px** (507,46 → 509,96). Está en el plan (`.eyebrow` y `.hero-action` figuran en
el bloque aprobado), es la mejora que se buscaba, y **no afecta a escritorio** (0 diferencias a
1280/1440). No es defecto; lo anoto porque es un cambio visible que el plan no explicitó como
"esto también toca el hero".

### La decisión de 2 columnas es segura

`addPhotos` en `studio.js:27` reemplaza la foto anterior y hace `break`: el máximo real es **1
imagen** y el contador siempre dice `n / 1`. La grilla de 2 columnas nunca tendrá más de un
elemento. Si algún día se admiten varias imágenes, esta regla habrá que revisarla.

---

## 6. Fuera de alcance, medido, para José

No cambian el veredicto — el plan los declaró fuera de esta ronda y **medí que no son regresiones**
— pero son reales y no quiero que se pierdan.

### Contraste: 4 textos por debajo del mínimo (preexistentes)

| Texto | Color | Fondo | Contraste | Necesita | A 320 px (nuevo) | A 481 px (base) |
|---|---|---|---|---|---|---|
| `01` / `02` | `#9685b9` | blanco | **3,31:1** | 4,5:1 | falla | falla, mismo ratio |
| «VISTA PREVIA» | `#81758f` | blanco | **4,31:1** | 4,5:1 | falla | falla, mismo ratio |
| «Mantén esta página abierta…» | `#777d8e` | `#f6f7fb` | **3,84:1** | 4,5:1 | falla | falla, mismo ratio |

Los ratios son **idénticos con el CSS base y con el nuevo**, porque este commit no toca ni un
color. Son de antes. Y al crecer la letra, los tres se leen mejor hoy que ayer. Arreglarlos es
oscurecer tres colores conservando el tono — la habilidad trae `contraste.py` para eso.

### El escalón de 481 a 900 px

En ese rango la letra sigue con los valores de escritorio: 10 textos bajo 12 px, el más chico
9 px, 8 botones bajo 44×44, la × de vuelta en 23×23. Es un teléfono grande en horizontal o una
tableta chica. El plan lo declaró fuera de alcance y así queda, pero es el mismo defecto que
acabamos de arreglar, viviendo un píxel más allá.

### Lo que NO pude medir — declarado, no escondido

- **No pude hacer clics reales de ratón.** El panel del navegador estaba oculto y todo `computer`
  que necesita que la página se dibuje (clic, scroll, hover) agotó los 30 s. Ejercí el flujo con
  eventos de puntero despachados desde JS: recorren los mismos listeners, pero no son
  `isTrusted`. Un `:hover`, un `:active` o un gesto táctil real quedan sin comprobar.
- **No pude guardar la captura como archivo.** La tengo vista y descrita con números; no quedó en
  disco para José.
- **No probé en un iPhone de verdad**: ni teclado en pantalla, ni barra de Safari, ni zonas
  seguras del notch.
- **No medí `index.html`/`style.css`** (la portada) ni el rango 481–900 px como objetivo.
- **No apagué el servidor de `localhost:8856`.** No lo levanté yo y puede ser de la otra sesión;
  matarlo a ciegas es exactamente el error que ya costó dos procesos del sistema. Lo dejo
  corriendo y lo declaro.

---

## Lecciones de esta vuelta

**No hubo ningún defecto de código en esta ronda.** Las lecciones son de proceso y de arnés.

1. **Mi medidor de contraste dio un falso positivo de 1,00:1 y casi lo reporto como defecto
   crítico.** El emblema `▶` es blanco sobre un gradiente morado; mi función subía por el árbol
   buscando `background-color` y se saltaba `background-image`, así que midió blanco sobre blanco.
   → **Regla: un medidor de contraste que no lea `background-image` debe devolver "no medible", no
   un número.** Un fondo que el instrumento no sabe leer es un hueco declarado, jamás un ratio.

2. **Un `requestAnimationFrame` colgó mi script 45 segundos y el mensaje de error hablaba de
   promesas que no resuelven, no del panel oculto.** Con el panel del navegador oculto la página no
   se pinta y el rAF nunca dispara. → **Regla: al medir con el panel oculto, esperar con
   `setTimeout`, nunca con `requestAnimationFrame` ni con nada atado al pintado.**

3. **La página venía con `jiLang=en` guardado de una sesión anterior y arrancó en inglés sin que
   yo lo pidiera.** Es exactamente el arnés que ya produjo una "regresión de layout" inexistente
   por comparar un idioma contra otro. → **Regla: fijar el idioma explícitamente al principio de
   cada pasada y volver a leer `documentElement.lang` para confirmarlo; nunca heredar el que dejó
   `localStorage`.**

4. **El `HEAD` se movió a mitad de mi auditoría** (la otra sesión commiteó `ded929e`), y si no lo
   hubiera notado habría reportado sobre un árbol distinto del que creía. → **Regla: con dos
   sesiones en vuelo, volver a comprobar `git log -1` y el hash del archivo auditado al cerrar, no
   solo al abrir.** El hash de `studio.css` idéntico en las tres fuentes (árbol, servidor, commit)
   fue lo que me dejó afirmar que ninguna medición se invalidó.

5. **El script de la habilidad descarta los textos de menos de 10 letras**, y ahí se escondían
   `01`, `02`, `1 / 1` e `Imagen 1` — cuatro etiquetas que estaban a 10 y 11 px. El plan ya lo
   había avisado, y aun así el conteo "0 de 19" del script solo cubre 19 de los 31 textos reales.
   → **Regla: el conteo del auditor es un cribado, no un censo. Antes de firmar un "0 textos bajo
   12 px", barrer todos los nodos hoja con texto, cortos incluidos.**

6. **Tavo no remidió el "antes" en vivo**: lo dio por bueno de la tabla del plan, razonando que era
   el mismo archivo. Tenía razón — lo remedí yo y salió clavado (11/19, 58 %, 9 px, 8 botones).
   Pero eso solo se supo porque alguien lo midió. → **Regla: el "antes" y el "después" los mide la
   misma persona con el mismo instrumento en la misma sesión; heredar el "antes" de otro documento
   deja el control positivo sin correr, y sin control positivo el "después" no prueba nada.**

7. **Una regla del plan casi tapa a otra.** «Reproduce exactamente la tabla de Nico» empuja a
   copiar números; «no te fíes del reporte del implementador» empuja a remedirlos. → **Regla: un
   plan que cita una tabla previa debe decir si es la referencia a reproducir o el dato a heredar.
   Por defecto: reproducir.**

8. **El plan listó `.eyebrow` y `.hero-action` sin decir que son clases del hero de la otra
   ronda.** El cambio es correcto y está aprobado, pero el hero móvil creció 2,5 px sin que ningún
   documento lo dijera. → **Regla: cuando dos rondas en paralelo comparten clases CSS, el plan
   nombra qué elementos de la otra ronda quedan afectados de rebote, para que el veredicto no
   parezca cubrir un cambio que nadie declaró.**
