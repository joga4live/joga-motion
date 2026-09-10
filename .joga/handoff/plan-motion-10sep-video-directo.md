# Plan — Joga Motion, ronda motion-10sep: que el estudio nuevo genere videos (diseño intacto)

Base: `45538fa` (estudio nuevo de hoy). Decisión de José (10-sep): **conservar el diseño nuevo tal cual**; solo arreglar que los videos salgan.

## Qué está roto hoy (medido)

- `POST /compose` → Worker → Higgsfield responde **`404 model_not_found`** para `/nano-banana` con la llave de José (el modelo está en el catálogo pero no disponible en su cuenta). Medido con `curl` (1 imagen real) y en la página de producción (clic real en «Crear video»: una sola petición, 502 `{"error":"404: model_not_found"}` en 3,3 s).
- `studio.js:28` `request()` descarta el cuerpo del error y lanza `Request failed`; el 502 con `submitting=true` cae en `uncertain` → la página muestra **«No se pudo confirmar el envío… podría haberse generado un cargo»**. Falso: un 404 no cobra. El usuario nunca ve el motivo real.
- Llave válida (subida a URL firmada funcionó), Worker nuevo desplegado, Pages al día. `/generate`, `/status`, `/download` del Worker nuevo: pendiente el veredicto de Nico sobre si son idénticos a los aprobados anoche (`588299f`).

## Qué se hace

**Ruta directa:** la foto que sube el usuario va **directo a `/generate`** (Kling, contrato probado anoche). Se elimina del flujo el paso de imagen (`/compose*`). La interfaz acepta **una imagen** por ahora. Las rutas `/compose*` del Worker se dejan como están (no se llaman; se retomarán cuando haya modelo de imagen disponible) — salvo que Nico las marque como riesgo.

### `studio.js`

**A. Estado.** En `studio` (línea 2) quitar `imageTask`, `imageReady`. Mantener `videoTask`, `videoUrl`, `stage`, `message`, `uncertain`.

**B. Una imagen.** `addPhotos` (línea 27): el tope pasa de 8 a **1** — si ya hay una foto, la nueva la **reemplaza** (revocar la URL anterior) en vez de dar error `limit`. `render()` línea 14: `photoCount` → `studio.photos.length + ' / 1'`; `upload.disabled = studio.busy` (siempre se puede reemplazar). `$('photos')`: el `<input>` en `creator.html` deja de ser `multiple` (ver E).

**C. Flujo.** `createVideo()` (líneas 30-48) queda así — sin `/compose`, sin `/compose-status`, sin `/compose-image`:
```js
async function createVideo(){
 if(studio.busy||!studio.photos.length||!$('description').value.trim())return;
 if(studio.uncertain&&!window.confirm(t('uncertain')))return;
 if(studio.videoUrl)resetGeneration();studio.busy=true;studio.message='';studio.detail='';let submitting=false;
 const prompt=$('description').value.trim();
 try{
  studio.stage='video';render();
  if(!studio.videoTask){const form=new FormData();form.append('image',studio.photos[0].file);form.append('prompt',prompt);form.append('duration','5');submitting=true;const job=await(await request('/generate',{method:'POST',body:form})).json();if(!job.task_id)throw new Error('Missing task');studio.videoTask=job.task_id;submitting=false;}
  const video=await status('/status',studio.videoTask);if(!video.video_url)throw new Error('Missing video');studio.videoUrl=video.video_url;$('video').src=studio.videoUrl;$('download').href=WORKER+'/download?task_id='+encodeURIComponent(studio.videoTask);$('download').target='_blank';$('download').rel='noopener';studio.message='ready';studio.uncertain=false;
 }catch(e){
  if(e.terminal){studio.videoTask=null;studio.message='failed';studio.detail=e.detail||'';}
  else if(e.outdated)studio.message='outdated';
  else if(e.detail){studio.message='error';studio.detail=e.detail;}
  else if(submitting){studio.uncertain=true;studio.message='uncertain';}
  else studio.message=studio.videoTask?'waiting':'error';
 }finally{studio.busy=false;render();}
}
```
`resetGeneration()` (línea 9): quitar `imageTask`/`imageReady`; añadir `studio.detail=''`.

**D. Mostrar el motivo real.** `request()` (línea 28):
```js
async function request(path,options){const res=await fetch(WORKER+path,{...options,signal:AbortSignal.timeout(120000)});if(!res.ok){let detail='';try{detail=String((await res.clone().json()).error||'');}catch{}const e=new Error('Request failed');e.outdated=res.status===404&&!detail;e.rejected=res.status>=400&&res.status<500;e.detail=detail;throw e;}return res;}
```
(Un 404 **del Worker** trae `{"error":"Not found"}`; un 404 de Pages/Cloudflare no trae JSON — por eso `outdated` solo cuando no hay `detail`.) En `status()` (línea 29), cuando `data.status==='failed'`: `e.detail=String(data.error||'')`.
En `render()` línea 20: `$('message').textContent=(studio.message?t(studio.message):'')+(studio.detail?' ('+studio.detail+')':'');`
Con esto, el caso de hoy habría mostrado «No se pudo completar la solicitud. (404: model_not_found)» y no la frase del cargo.

**D2. Errores pasajeros durante el sondeo (bloqueante de Nico).** Hoy `worker.js:155` responde **502** cuando Higgsfield falla de forma transitoria, y `status()` (`studio.js:29`) aborta todo el sondeo al primer `!res.ok`. Anoche `creator.js:214` los ignoraba y seguía. Nuevo `status()`:
```js
async function status(path,id){let fallos=0;for(let i=0;i<120;i++){let data;try{data=await(await request(path+'?task_id='+encodeURIComponent(id))).json();fallos=0;}catch(e){if(e.rejected||e.outdated)throw e;if(++fallos>=12){const w=new Error('Status unavailable');w.detail=e.detail||'';throw w;}await new Promise(r=>setTimeout(r,5000));continue;}if(data.status==='completed')return data;if(data.status==='failed'){const e=new Error('Generation failed');e.terminal=true;e.detail=String(data.error||'');throw e;}await new Promise(r=>setTimeout(r,5000));}throw new Error('Still processing');}
```
Un 5xx o un corte de red **no** abandona el trabajo: se reintenta cada 5 s; solo tras 12 fallos seguidos (1 min) se cae en `waiting` (el `task_id` se conserva y «Continuar video» reanuda sin reenviar). Un 4xx (`rejected`) sí aborta, con su `detail`.

**D4 — corrección tras la revisión de Nico (`revision-motion-10sep-video-directo.md`).** El bloque `catch` de §C tenía dos fallos míos: perdió el guardián `!e.rejected` en la rama `uncertain` (un 4xx sin JSON —413, 429, WAF— volvía a mostrar la falsa alarma de cobro) y la rama `e.detail` tapaba a `waiting` (tras 12 fallos de sondeo el usuario leía «No se pudo completar…» con el botón «Continuar video»). El `catch` correcto, que sustituye al de §C:
```js
 }catch(e){
  if(e.terminal){studio.videoTask=null;studio.message='failed';studio.detail=e.detail||'';}
  else if(e.outdated)studio.message='outdated';
  else if(!submitting&&studio.videoTask&&!e.rejected){studio.message='waiting';studio.detail=e.detail||'';}
  else if(e.detail){studio.message='error';studio.detail=e.detail;}
  else if(submitting&&!e.rejected){studio.uncertain=true;studio.message='uncertain';}
  else studio.message=studio.videoTask?'waiting':'error';
 }
```
Casos que debe cumplir (Nico los midió): 413 `text/plain` durante el envío → `error`, `uncertain=false`; 502 con `error` durante el envío → `error` + motivo; corte de red durante el envío → `uncertain` (único camino a esa alarma); 12 fallos de sondeo → `waiting` + motivo, `videoTask` conservado, «Continuar video» sin nuevo `POST /generate`.

**D3.** `resetGeneration()` debe limpiar también `studio.message` y `studio.detail` (Nico: escribir un carácter borraba el aviso pero dejaba el texto).

**E. Textos (ES y EN, mismo estilo).**
- `formats`: «1 imagen · JPG, PNG o WebP · 10 MB» / «1 image · JPG, PNG or WebP · 10 MB».
- `photos`: «Añade tu imagen» / «Add your image». `upload`: «Subir imagen» / «Upload image».
- `referenceHint`: «Describe el movimiento que quieres ver en esta imagen.» / «Describe the motion you want to see in this image.»
- `cost`: «Cada creación usa una generación de video.» / «Each creation uses one video generation.»
- `limit`: eliminar (ya no aplica). `composing`: eliminar. `uncertain`: dejar igual (solo aparece si el envío se perdió de verdad).
- `placeholder` y `samples` (línea 24): reescribir para una sola imagen y movimiento de cámara, p. ej. «La persona de la foto sonríe y la cámara se acerca lentamente», «El paisaje cobra vida con viento suave y luz de amanecer», «Zoom lento hacia el centro con partículas de luz».

### `creator.html`
**F.** El `<input id="photos">` pierde el atributo `multiple`. Si hay un texto fijo «Hasta 8 imágenes» fuera de `data-copy`, ajustarlo. Nada más: **no se toca el diseño**.

### `worker.js`
**G.** Sin cambios en esta ronda, salvo lo que Nico exija en su veredicto sobre `/generate`, `/status`, `/download`.

### `tests/`
**H.** `tests/studio.cjs` (Playwright) quedará desactualizado: actualizarlo si Playwright está disponible; si no, anotar en la nota de implementación qué casos cambian (1 imagen, sin `/compose`). `tests/worker.mjs` y `tests/composer-worker.mjs` no se tocan.

## Cómo se comprueba (Nico)
1. `node --check studio.js`; `node tests/worker.mjs`.
2. `creator.html` en local con Worker simulado: subir 1 imagen → aparece miniatura «1 / 1»; subir otra → la reemplaza, sin error; `Crear video` habilitado con descripción.
3. Clic en Crear video con Worker simulado que devuelva `{"task_id":"abc"}` → en Red: **una sola** petición `POST /generate` multipart con `image`, `prompt`, `duration=5`; luego `/status?task_id=abc` cada 5 s; con `{"status":"completed","video_url":…}` aparece el video y Descargar con `target=_blank`.
4. Worker simulado que devuelva `502 {"error":"404: model_not_found"}` → mensaje visible «No se pudo completar la solicitud. (404: model_not_found)», **nunca** la frase del cargo; `uncertain=false`.
5. Worker simulado que devuelva `{"status":"failed","error":"nsfw"}` → «El proveedor no pudo completar… (nsfw)».
6. ES/EN: textos nuevos en los dos idiomas; consola limpia; móvil 390 px sin desbordes.
7. Producción, tras Push: una generación real (autoriza José) con la misma foto de anoche.

## Publicación
Push origin en GitHub Desktop (solo archivos estáticos). El Worker no cambia salvo que Nico lo pida; si cambia, José lo pega en Cloudflare.
