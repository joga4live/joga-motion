# Revisión — ronda motion-contraste-10sep

**Veredicto: APROBADO**

Commit auditado: `f5bec3c` sobre `0bdd31a`. Auditoría en solo lectura. Ningún archivo del repo
fue modificado por mí; mi único archivo es este.

Cero defectos. Los siete pares de texto pasan WCAG AA con los colores **computados en la página**
(no los del plan), la geometría es idéntica a la base en los dos anchos medidos, y el uso real no
produce una sola línea de consola. Hay **dos observaciones fuera del alcance** al final, ninguna
bloqueante.

---

## 1. Alcance — exacto

`git show f5bec3c --stat`: tres archivos, ni uno más.

```
A  .joga/handoff/implementacion-motion-contraste-10sep.md
A  .joga/handoff/plan-motion-contraste-10sep.md
M  studio.css   (2 +/-, el archivo vive en una línea)
```

No bastaba con mirar el `--word-diff`, porque en un archivo minificado de una sola línea el diff
por palabras puede esconder cambios. Hice la prueba fuerte, a nivel de byte:

```
base.css = git show 0bdd31a:studio.css      sha256 633dfe9a…e826   8225 bytes
new.css  = git show f5bec3c:studio.css      sha256 1b1dd6f0…cd05   8225 bytes

base.css con las 6 sustituciones del plan (y NADA más)  ==  new.css   →  True
```

Es decir: aplicar las seis sustituciones literales del plan al archivo base produce el archivo
nuevo **byte a byte**. No cambió ni un carácter fuera de esas seis declaraciones `color`. Cada
cadena buscada aparecía exactamente una vez en el base y cada cadena nueva aparece exactamente una
vez en el nuevo (verificado con `assert`, no a ojo). Mismo tamaño de archivo (8225 = 8225), como
corresponde a seis hex de seis dígitos.

`node --check` sobre `studio.js`, `i18n.js` y `worker.js`: los tres OK. (No se tocaron, pero la
regla 3 se comprueba igual.)

Reglas de oro: este repo **no tiene** `gate.js` ni service worker (verificado con `ls`), así que
esas dos no aplican. i18n y branding, más abajo.

---

## 2. Los siete ratios, remedidos por mi cuenta

Servidor local `preview_start` name `joga-motion`, puerto 8856 (`reused: false` → lo arranqué yo
y lo apagué yo). El `launch.json` vive en la carpeta **padre**, no escribí nada dentro del repo.

Comprobación de que el servidor sirve el árbol y no una copia vieja:

```
local   studio.css   1b1dd6f0ec561ba671a3c8fe1ca04db7f7551b74fd9ea0a85a469d1b5ee2cd05
servido studio.css   1b1dd6f0ec561ba671a3c8fe1ca04db7f7551b74fd9ea0a85a469d1b5ee2cd05   igual
(idem creator.html y studio.js)
```

Idioma fijado explícitamente: `localStorage.setItem('jiLang','es')` + recarga, y confirmado
leyendo `document.documentElement.lang` → `"es"` en cada medición. `document.fonts.check('600 14px
Inter')` → `true`: Inter cargó de verdad, las medidas no salieron con una tipografía de repuesto.
Esperas con `setTimeout`, nunca con `requestAnimationFrame`.

Los colores salen de `getComputedStyle(...).color` sobre la página real; el placeholder de
`getComputedStyle($('description'),'::placeholder').color`; `#create` con `disabled === true`
confirmado (sin foto cargada). El fondo de cada texto no lo supuse: lo obtuve caminando hacia
arriba por los ancestros hasta el primer fondo no transparente.

| # | Texto | Color computado | Fondo (medido) | Ratio | Mín. | Veredicto |
|---|---|---|---|---|---|---|
| 1 | `01` (`#photosTitle > span`) | `rgb(126,105,169)` = `#7e69a9` | `#ffffff` (`section.editor`) | **4,69:1** | 4,5 | PASA |
| 2 | `02` (`.prompt-title .label > span`) | `rgb(126,105,169)` = `#7e69a9` | `#ffffff` (`section.editor`) | **4,69:1** | 4,5 | PASA |
| 3 | «VISTA PREVIA» (`.preview-tag`) | `rgb(124,112,138)` = `#7c708a` | `#ffffff` (`section.preview`) | **4,62:1** | 4,5 | PASA |
| 4 | «Mantén esta página abierta…» (`.footer-note`) | `rgb(107,112,128)` = `#6b7080` | `#f6f7fb` (`html`) | **4,61:1** | 4,5 | PASA |
| 5 | «Añade tus imágenes…» (`#emptyPreview p`) | `rgb(104,98,116)` = `#686274` | gradiente → peor parada `#e9e1fa` | **≥ 4,63:1** | 4,5 | PASA |
| 6 | Nota de progreso (`#progress p`) | `rgb(104,98,116)` = `#686274` | gradiente → peor parada `#e9e1fa` | **≥ 4,63:1** | 4,5 | PASA |
| 7 | Placeholder del textarea (`::placeholder`) | `rgb(107,114,131)` = `#6b7283` | `#fcfcfe` (`textarea`) | **4,70:1** | 4,5 | PASA |
| 8 | «Crear video» desactivado (`#create:disabled`) | `rgb(106,101,117)` = `#6a6575` | `#eae8f0` (el propio botón) | **4,64:1** | 4,5 | PASA |

Los siete valores coinciden con los que reportó Tavo, calculados otra vez con `contraste.py` desde
cero.

**Sobre el gradiente (regla de mi lección 1).** El fondo de `.preview-screen` **no es medible**
como color plano: mi medidor lo detecta y lo declara así en lugar de inventar un número. El
computado es

```
radial-gradient(at 30% 20%, rgb(233,225,250), rgba(0,0,0,0) 70%),
linear-gradient(135deg, rgb(249,247,252), rgb(240,242,249))
```

Verifiqué **cuál** es la peor parada en vez de heredar la suposición del plan:

```
luminancia #e9e1fa = 0.78076   ← la más oscura, la peor para texto oscuro
luminancia #f0f2f9 = 0.88869
luminancia #f9f7fc = 0.93690
```

`#e9e1fa` es en efecto el peor punto: el plan acertaba. Y el 4,63 es una **cota inferior**
rigurosa, no una estimación: la mezcla del gradiente en cualquier píxel es una combinación convexa
por canal de las tres paradas, y la transferencia sRGB→lineal es monótona creciente, así que la
luminancia real en cualquier punto está entre la mínima y la máxima de las paradas. El contraste
real en cualquier píxel es **≥ 4,63**. Marcado como «no medible en píxel, acotado por el peor
punto», no como medido.

### Barrido completo de la familia (no solo los siete)

No me quedé con la lista del plan. Recorrí **todos** los nodos de texto de `creator.html`,
resolviendo fondo por ancestros y componiendo los fondos semitransparentes (`.nav` a 0,93 de alfa
sobre `#f6f7fb` → `#fefeff`; `.film-icon` a 0,69 sobre el peor punto del gradiente → `#f8f6fd`).
32 pares de texto/fondo, con el umbral correcto para cada uno (3,0 para texto grande o negrita
≥18,66 px, 4,5 para el resto):

**FALLAN: ninguno.** Los más ajustados, por si alguien vuelve a tocar estos colores:

| Texto | Ratio | Margen sobre el mínimo |
|---|---|---|
| icono de película `▷` (35 px, mín. 3,0) | 3,36:1 | +0,36 |
| `.footer-note` | 4,61:1 | +0,11 |
| «VISTA PREVIA» | 4,62:1 | +0,12 |
| `#emptyPreview p` / `#progress p` | 4,63:1 | +0,13 |
| «Crear video» desactivado | 4,64:1 | +0,14 |
| `01` / `02` | 4,69:1 | +0,19 |
| placeholder | 4,70:1 | +0,20 |
| `#photoCount` (`#646b7b` sobre `#f3f4f8`) | 4,86:1 | +0,36 |

(El icono de película me da 3,36 y no el 3,52 del plan porque yo compuse el fondo real del propio
recuadro `#ffffffb0` **sobre el peor punto del gradiente**, que es más duro que el fondo que usó
el plan. Sigue pasando con holgura para su tamaño. No es un defecto: es una medición más estricta
del mismo elemento, y quiero que quede el número más conservador en el expediente.)

Estados que no salen en el árbol en reposo, medidos aparte: `.upload:hover` (4,55 el texto de
formatos, 10,08 «Subir imagen», 5,48 el `+`), `.examples button:hover` (5,28), `.primary:hover`
(8,13). Todos pasan.

### Confirmación de que el problema existía

Para no dar por bueno el diagnóstico de la vuelta anterior sin comprobarlo, remedí los colores
viejos contra los mismos fondos medidos:

| Color viejo | Fondo | Ratio viejo | Ratio nuevo |
|---|---|---|---|
| `#9685b9` | `#ffffff` | 3,31 | 4,69 |
| `#81758f` | `#ffffff` | 4,31 | 4,62 |
| `#777d8e` | `#f6f7fb` | 3,84 | 4,61 |
| `#7a7388` | `#e9e1fa` | 3,58 | 4,63 |
| `#7a8192` | `#fcfcfe` | 3,81 | 4,70 |
| `#777183` | `#eae8f0` | 3,87 | 4,64 |

Los seis fallaban de verdad. El arreglo era necesario, no cosmético.

### El tono sí se conservó

El mensaje del commit afirma «mismo tono, solo más oscuro». Lo verifiqué en HLS en vez de creerlo:

| Viejo → nuevo | Δ tono | L | S |
|---|---|---|---|
| `#9685b9` → `#7e69a9` | 0,07° | 0,624 → 0,537 | 0,271 → 0,271 |
| `#81758f` → `#7c708a` | 0,00° | 0,510 → 0,490 | 0,104 → 0,104 |
| `#777d8e` → `#6b7080` | 1,37° | 0,512 → 0,461 | 0,092 → 0,089 |
| `#7a7388` → `#686274` | 0,00° | 0,492 → 0,420 | 0,084 → 0,084 |
| `#7a8192` → `#6b7283` | 0,00° | 0,525 → 0,467 | 0,099 → 0,101 |
| `#777183` → `#6a6575` | 1,25° | 0,478 → 0,427 | 0,074 → 0,073 |

Desviación máxima de tono: 1,37°, invisible a ojo. La afirmación del commit es cierta.

---

## 3. Comparación de cajas base vs. nuevo — 0 diferencias

Método: **no toqué el árbol de archivos.** Traje el CSS base a la página así:

1. `fetch('/studio.css')` → el CSS servido; `sha256` en el navegador = `1b1dd6f0…cd05`, igual al
   del árbol.
2. Le apliqué las seis sustituciones **al revés** (nuevo → viejo), verificando que cada una
   coincidía exactamente 1 vez.
3. `sha256` del resultado = **`633dfe9a138b743279740cc29ac2497f7280e55ec64d0dc8d1dc42d0e6aea826`**,
   idéntico al `sha256` de `git show 0bdd31a:studio.css`. Es decir: el CSS que inyecté en el
   `<style>` es el de `0bdd31a`, demostrado por hash, no por parecido.
4. `<style>` con ese contenido en `<head>` + `link[href="studio.css"].disabled = true`, medir,
   restaurar.

Comparé **los 75 elementos del documento**, no los 12 de la lista del plan. Por cada uno:
`getBoundingClientRect` (x, y, ancho, alto con 3 decimales) y doce propiedades computadas
(`font-size`, `font-weight`, `line-height`, `letter-spacing`, `padding`, `margin`, `border-width`,
`display`, `grid-template-columns`, `flex-direction`, `min-height`, `aspect-ratio`).

| Ancho | Elementos | Dif. geometría | Dif. tipografía | Dif. color |
|---|---|---|---|---|
| 1280 × 900 | 75 | **0** | **0** | 7 (+ el placeholder) |
| 320 × 700 | 75 | **0** | **0** | 7 (+ el placeholder) |

**Control positivo — mi comparador no está ciego.** Las 7 diferencias de color que detectó son
exactamente los 7 elementos esperados, con los valores viejos del lado base:

```
SPAN (01)          rgb(150,133,185) → rgb(126,105,169)
SPAN (02)          rgb(150,133,185) → rgb(126,105,169)
BUTTON#create      rgb(119,113,131) → rgb(106,101,117)
SPAN.preview-tag   rgb(129,117,143) → rgb(124,112,138)
P (#emptyPreview)  rgb(122,115,136) → rgb(104,98,116)
P (#progress)      rgb(122,115,136) → rgb(104,98,116)
P.footer-note      rgb(119,125,142) → rgb(107,112,128)
placeholder (pseudo, medido aparte)  rgb(122,129,146) → rgb(107,114,131)
```

**Control de estabilidad.** Medí el estado nuevo dos veces (antes y después de la pasada con el
CSS base, ya restaurado): 0 diferencias de geometría, tipografía y color entre las dos. Si mi
arnés tuviera ruido de medición, ese control lo habría delatado. No lo hay.

**Un tropiezo de mi propio arnés, y cómo lo cacé.** La primera pasada devolvió «distinto número de
elementos: 75 vs 76». No era una regresión del código: era que mi `<style id="__baseCss">`
inyectado **se contaba a sí mismo** en `querySelectorAll('*')`. Lo filtré y las dos pasadas dan
75. Exactamente el caso de «sospecha del arnés antes que del código»; si me hubiera dado prisa,
esto era una falsa alarma reportada como defecto.

---

## 4. Uso real, sin errores de consola

A 320 px y en español fijado, sobre la página servida:

| Paso | Resultado medido |
|---|---|
| 0. Estado inicial | `#create.disabled = true`, color `rgb(106,101,117)`, fondo `rgb(234,232,240)`, contador `0 / 1` |
| 1. Subir foto (canvas 64×64 → `File` PNG → `addPhotos`) | 1 miniatura, contador `1 / 1`, sin mensaje de error |
| 2. Elegir un ejemplo | textarea se llena, `#create.disabled = false`, color `rgb(255,255,255)` sobre `rgb(105,65,207)` |
| 3. Escribir a mano + evento `input` | texto actualizado, botón sigue activo |
| 4. Cambiar de modo (Animar / Crear escena) ida y vuelta | sin errores |
| 5. Quitar con la × (`aria-label="Quitar imagen 1"`) | 0 miniaturas, contador `0 / 1`, botón vuelve a desactivado con `rgb(106,101,117)` |
| 6. Cambiar idioma es → en → es | `lang` pasa a `en` y vuelve a `es`, textos y placeholder traducidos |

**Consola: 0 entradas.** Las dos pasadas completas del flujo (una tras otra, con recarga en medio).

**Control del instrumento de consola.** Antes de creerme ese cero, emití a propósito
`console.error`, `console.warn`, `console.log` y una excepción no capturada (`null.x` dentro de un
`setTimeout`). Las cuatro aparecieron en el lector. El lector funciona; el cero es real, no un
lector mudo. (El buffer sobrevive a las recargas, así que además pude confirmar que la segunda
pasada del flujo no añadió ni una línea nueva.)

**Red:** todas las peticiones `200 OK` (`creator.html`, `studio.css`, `studio.js`, la portada JPG,
los `blob:` de las miniaturas). Ningún 404.

**Regresiones de rondas anteriores que volví a comprobar:**

- **i18n (regla de oro 3):** los 20 `[data-copy]` tienen texto no vacío en **es** y en **en**; el
  `lang` del documento cambia; el `placeholder` se traduce; el botón alterna «English» ↔
  «Español». Toggle vivo, sin recarga. Paridad completa.
- **Branding (regla de oro 4):** `--accent: #6941cf`, `--muted: #646b7b`, `--line: #e2e5ef` y el
  degradado del `.brand-icon` (`#9878eb → #6840c8`) **sin tocar** (lo garantiza la prueba byte a
  byte del punto 1). La marca aparece una sola vez: el `▶` del icono es `aria-hidden="true"`, así
  que un lector de pantalla oye «Joga Motion», no «triángulo Joga Motion».
- **Accesibilidad:** los cuatro decorativos (`.brand-icon`, `.upload-icon`, `.film-icon`,
  `.spinner`) llevan `aria-hidden="true"`; la × de la miniatura tiene `aria-label` traducido; el
  `#message` conserva `role="status"` y `aria-live="polite"`.
- **`localStorage`:** la única llave del creador sigue siendo `jiLang`; no se renombró nada (el
  diff no toca JS).
- **La regresión de `#again` / `.primary` de la ronda anterior** sigue bien: `#again` mantiene
  `appearance:none` sin `font:inherit`, y su tamaño no cambió (está entre los 75 elementos
  comparados, 0 diferencias).

---

## 5. Lo que NO pude medir

1. **El color de píxel real del texto sobre el gradiente.** No tengo forma de leer píxeles
   rasterizados de la página (el canvas no puede capturar el render, y reconstruir el gradiente en
   un canvas propio mediría mi reconstrucción, no la página). Declarado «no medible» y sustituido
   por la **cota inferior demostrada** contra la parada más oscura, `#e9e1fa`. El contraste real es
   ≥ 4,63 en todo píxel; no invento un número puntual.
2. **Anchos entre 321 y 1279 px, y tablet 481–900.** Medí exactamente los dos anchos que pedía el
   plan. El cambio es de color puro y demostrado byte a byte, así que no hay mecanismo por el que
   un ancho intermedio se comporte distinto — pero no lo medí, y lo digo en vez de afirmarlo.
3. **`index.html` / `style.css` (la portada).** Fuera de alcance por el plan. Su contraste sigue
   **sin medir**; no sé si está bien.
4. **Navegadores distintos del motor del panel.** Una sola máquina, un solo motor. Sin Safari ni
   Firefox, y sin dispositivo físico.
5. **Modo oscuro / alto contraste del sistema.** El sitio declara `color-scheme: light` y no tiene
   bloque `prefers-color-scheme`; no lo probé.

---

## 6. Observaciones fuera del alcance (no bloquean esta ronda)

**a) El anillo de foco no llega a 3:1 — preexistente, no es de esta ronda.**

`button:focus-visible, a:focus-visible { outline: 3px solid #b79aea; outline-offset: 3px }`.
Medido en vivo, no leído del CSS: pulsé `Tab` de verdad (control previo: confirmé que el `Tab`
movía el foco fuera de `BODY`, y lo hizo → `a.brand`, con `:focus-visible` activo) y leí
`getComputedStyle(activo).outlineColor` → `rgb(183,154,234)` = `#b79aea`.

```
#b79aea sobre #ffffff  →  2,38:1   (WCAG 2.1 SC 1.4.11 pide 3,0:1 para el indicador de foco)
```

Quien navegue con teclado ve un anillo que apenas se distingue del fondo blanco. **No lo introdujo
`f5bec3c`** (la prueba byte a byte demuestra que solo cambiaron seis declaraciones `color`), y el
plan lo dejó explícitamente fuera. Lo dejo anotado para que Kimo MD decida si abre una ronda; con
`#8f6fd6` ya daría 3,05:1 conservando el tono.

Los bordes (`--line: #e2e5ef` sobre blanco, 1,26:1; el punteado `#c9bce6` de `.upload`, 1,65:1)
también quedan por debajo de 3:1, pero son decorativos o acompañan a un texto que sí contrasta;
solo el del anillo de foco me parece un problema real.

**b) «7 pares» son en realidad 8 textos visibles.** El plan habla de 6 reglas / 7 pares contando
`01` y `02` como un solo elemento. Medidos en la página, los textos cuyo color cambió son **ocho**:
`01`, `02`, «VISTA PREVIA», `.footer-note`, `#emptyPreview p`, `#progress p`, el placeholder y
`#create` desactivado. Es una diferencia de conteo, no un defecto: `01` y `02` comparten regla,
color y fondo, así que su ratio es idéntico (4,69) y nada queda sin medir. Lo anoto solo para que
el número que circule en los documentos sea el mismo.

---

## 7. Lecciones de esta vuelta

No hubo defectos de código, así que estas lecciones salen de tropiezos de **proceso** y de mi
propio instrumento. Para `AGENTS.md` §9:

1. **Un comparador de DOM debe excluir lo que el propio comparador inyecta.** Mi primera pasada
   dio «75 vs 76 elementos» y parecía una regresión estructural; era el `<style>` que yo mismo
   había metido, contándose en `querySelectorAll('*')`. *Regla: todo elemento que el arnés añada a
   la página lleva un `id` reservado y se filtra explícitamente en cada snapshot; y una diferencia
   de **número de elementos** se investiga como fallo del arnés antes que como fallo del código.*

2. **Un «cero errores de consola» sin control es humo.** *Regla: antes de reportar «sin errores de
   consola», emitir a propósito un `console.error` y una excepción no capturada y comprobar que el
   lector las ve. Si no aparecen, el cero no vale.* (Misma familia que la lección del `Tab`: aquí
   también pulsé `Tab` de verdad y verifiqué primero que movía el foco.)

3. **En un CSS minificado de una línea, el `--word-diff` no es prueba de alcance.** Un cambio
   colado en medio de la línea puede pasar desapercibido entre miles de caracteres de contexto.
   *Regla: para archivos de una sola línea, la prueba de alcance es «base + las sustituciones
   declaradas == nuevo, byte a byte» y la igualdad de `sha256`, no la lectura del diff.*

4. **Inyectar el CSS de la base se demuestra por hash, no por construcción.** Reconstruí el base
   dentro del navegador invirtiendo las sustituciones, pero solo me lo creí cuando su `sha256`
   coincidió con el de `git show 0bdd31a:studio.css`. *Regla: cuando se compara contra una versión
   anterior sin tocar el árbol, el CSS inyectado debe coincidir por hash con el del commit base
   antes de medir nada.*

5. **El «peor punto» de un gradiente se calcula, no se hereda.** El plan afirmaba que `#e9e1fa` era
   el peor punto y acertaba, pero yo lo comprobé calculando la luminancia de las tres paradas.
   *Regla: quien mida contra un gradiente ordena las paradas por luminancia y justifica por qué la
   elegida es la peor; y reporta el resultado como cota («≥ X»), no como medición puntual.*

6. **El plan de esta ronda le pidió a Tavo trabajo de navegador que el reparto de roles le asigna
   a Nico**, y él mismo lo dejó anotado en su nota. Duplicó el trabajo (Tavo midió, yo volví a
   medir) y, peor, si sus números hubieran sido los únicos, la ronda habría quedado verificada por
   quien la construyó. *Regla: el plan no le pide al implementador que mida en navegador lo que el
   revisor va a medir igual; Tavo entrega el código y su razonamiento, Nico entrega la medición.
   Si un plan lo pide, el implementador lo señala antes de hacerlo, no después.* (Tavo lo señaló
   después; hizo bien en señalarlo.)

7. **Un veredicto anterior que anota «tres» puede quedarse corto.** Yo anoté 3 problemas de
   contraste en `revision-motion-legible-movil-10sep.md`; el plan midió la familia entera y
   encontró 7. Tenía razón el plan. *Regla: cuando el revisor detecte un defecto de una clase que
   se puede enumerar (colores, tamaños de toque, `aria-label`), barre la familia completa en esa
   misma vuelta en vez de listar los ejemplos que vio.* En esta vuelta lo apliqué: barrí los 32
   pares de texto/fondo de la página, no los 7 de la lista.

---

## 8. Estado del repo al cerrar

```
HEAD    f5bec3ccf41890cae1b91ebf125b55f08922e6ae
        fix: contraste de siete textos en el creador, mismo tono mas oscuro / …
status  limpio (sin archivos modificados ni sin seguir)
studio.css  sha256 1b1dd6f0ec561ba671a3c8fe1ca04db7f7551b74fd9ea0a85a469d1b5ee2cd05
            (idéntico al del inicio de la auditoría)
.claude/  no existe dentro de joga-motion — no escribí configuración en el repo
```

Mismo commit y mismo hash que al empezar: ninguna sesión en paralelo tocó el archivo mientras
auditaba. `resize_window` devuelto a `desktop` y `preview_stop` del servidor que arranqué yo
(`reused: false`). Mis archivos temporales viven fuera del repo, en el directorio de trabajo de la
sesión.

**Listo para publicar.**
