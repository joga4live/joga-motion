// Two people, one scene: review the generated image before requesting a video.
var composition = { files: [null, null], previews: [null, null], taskId: null, imageUrl: null, prompt: '', aspect: '16:9', phase: 'draft', imported: false, error: '' };
Object.assign(STRINGS.es, {
  co_badge: 'ESTUDIO CREATIVO', co_title: 'Tus fotos. Tu historia.',
  co_intro: 'Sube una o dos fotos de referencia y describe qué sucede, dónde ocurre y cómo se mueve la cámara.',
  co_person1: 'Foto de referencia 1', co_person2: 'Foto de referencia 2 · Opcional', co_formats: 'JPG, PNG o WebP · Hasta 10 MB',
  co_prompt: '¿Dónde están y qué hacen?', co_placeholder: 'Las dos personas caminan juntas por un sendero de montaña al amanecer. Conversan y sonríen; la cámara las sigue suavemente.',
  co_format: 'Formato de la escena', co_landscape: 'Horizontal · 16:9', co_portrait: 'Vertical · 9:16', co_square: 'Cuadrado · 1:1',
  co_note: 'Crear la escena consume una generación de imagen. Animarla consume otra de video. El parecido y las acciones pueden variar: revisa la vista previa. Mantén esta página abierta; el proyecto no se guarda al recargar.',
  co_review: 'Vista previa de tu escena', co_empty: 'Aquí aparecerá la escena creada con tus fotos y tu descripción.',
  co_preview_alt: 'Escena creada con tus fotos de referencia', co_next: 'Si te gusta, añádela al editor. Allí podrás elegir la duración y generar el video con la misma acción.',
  co_use: 'Usar esta escena en el video', co_create: 'Crear escena con mis fotos', co_resume: 'Consultar escena pendiente', co_recreate: 'Crear otra versión',
  co_added: 'Escena añadida al editor', co_ready: 'Tu escena está lista. Revisa los rostros y la acción antes de animarla.',
  co_working: 'Creando la escena con tus fotos…', co_waiting: 'La escena sigue en proceso. Puedes consultar de nuevo sin crear otra generación.',
  co_failed: 'No se pudo crear la escena. Revisa las fotos y la descripción antes de volver a intentar.',
  co_unknown: 'No se pudo confirmar el envío. El servicio podría haberlo aceptado. Revisa tu actividad de Higgsfield antes de volver a generar para evitar cargos duplicados.',
  co_oldworker: 'Esta función requiere actualizar el Worker de Cloudflare. La animación de imágenes individuales sigue disponible.',
  co_importerror: 'No se pudo añadir la imagen. Puedes volver a intentarlo sin generar otra escena.',
});
Object.assign(STRINGS.en, {
  co_badge: 'CREATIVE STUDIO', co_title: 'Your photos. Your story.',
  co_intro: 'Upload one or two reference photos and describe what happens, where it takes place and how the camera moves.',
  co_person1: 'Reference photo 1', co_person2: 'Reference photo 2 · Optional', co_formats: 'JPG, PNG or WebP · Up to 10 MB',
  co_prompt: 'Where are they and what are they doing?', co_placeholder: 'Both people walk together along a mountain trail at sunrise. They talk and smile as the camera gently follows them.',
  co_format: 'Scene format', co_landscape: 'Landscape · 16:9', co_portrait: 'Portrait · 9:16', co_square: 'Square · 1:1',
  co_note: 'Creating the scene uses one image generation. Animating it uses a separate video generation. Likeness and actions may vary: review the preview. Keep this page open; reloading does not save the project.',
  co_review: 'Your scene preview', co_empty: 'The scene created from your photos and description will appear here.',
  co_preview_alt: 'Scene created from your reference photos', co_next: 'If you like it, add it to the editor. Then choose the duration and generate the video with the same action.',
  co_use: 'Use this scene in the video', co_create: 'Create scene from my photos', co_resume: 'Check pending scene', co_recreate: 'Create another version',
  co_added: 'Scene added to the editor', co_ready: 'Your scene is ready. Review the faces and action before animating it.',
  co_working: 'Creating the scene from your photos…', co_waiting: 'The scene is still processing. Check again without creating another generation.',
  co_failed: 'Could not create the scene. Review the photos and description before trying again.',
  co_unknown: 'Could not confirm submission. The service may have accepted it. Check your Higgsfield activity before generating again to avoid duplicate charges.',
  co_oldworker: 'This feature requires updating the Cloudflare Worker. Individual image animation is still available.',
  co_importerror: 'Could not add the image. You can retry without generating another scene.',
});
var COMPOSE_EXAMPLES = [
  ['En la montaña', 'On a mountain', 'Las dos personas caminan por un sendero de montaña al amanecer. Conversan y sonríen mientras la cámara las sigue.', 'Both people walk along a mountain trail at sunrise. They talk and smile as the camera follows them.'],
  ['En un carro', 'In a car', 'Las dos personas viajan juntas en un carro por una carretera costera. Una conduce mirando al frente y la otra disfruta del paisaje. Toma desde el tablero.', 'Both people travel together in a car on a coastal road. One drives looking ahead and the other enjoys the view. Dashboard camera shot.'],
  ['Nadando', 'Swimming', 'Las dos personas nadan juntas en una piscina tranquila a plena luz del día, con los rostros visibles sobre el agua. La cámara las acompaña desde el borde.', 'Both people swim together in a calm pool in daylight, their faces visible above the water. The camera follows from the pool edge.'],
  ['A caballo', 'Horse riding', 'Las dos personas cabalgan lado a lado, cada una en su propio caballo, por una pradera al atardecer. La cámara las sigue lateralmente.', 'Both people ride side by side, each on their own horse, through a meadow at sunset. The camera tracks alongside them.'],
];
function invalidateComposition() {
  composition.taskId = null; composition.imageUrl = null; composition.phase = 'draft'; composition.imported = false; composition.error = '';
  renderComposer();
}
function renderComposer() {
  if (!document.getElementById('composeBtn')) return;
  var pending = composition.taskId && !composition.imageUrl;
  document.querySelectorAll('.compose-panel input, .compose-panel textarea, .compose-panel select, .compose-examples button').forEach(el => el.disabled = state.busy);
  var create = document.getElementById('composeBtn');
  create.disabled = state.busy || !composition.files.some(Boolean) || !composition.prompt.trim();
  create.textContent = t(pending ? 'co_resume' : composition.imageUrl ? 'co_recreate' : 'co_create');
  var use = document.getElementById('useComposition');
  use.disabled = state.busy || !composition.imageUrl || composition.imported || state.scenes.length >= MAX_SCENES;
  use.textContent = t(composition.imported ? 'co_added' : 'co_use');
  var preview = document.getElementById('composePreview');
  preview.hidden = !composition.imageUrl;
  if (composition.imageUrl) { if (preview.getAttribute('src') !== composition.imageUrl) preview.src = composition.imageUrl; }
  else preview.removeAttribute('src');
  document.getElementById('composeEmpty').hidden = Boolean(composition.imageUrl);
  var messages = {creating:'co_working', waiting:'co_waiting', ready:'co_ready', failed:'co_failed', unknown:'co_unknown', outdated:'co_oldworker', importerror:'co_importerror'};
  var status = document.getElementById('composeStatus');
  status.textContent = composition.imported ? t('co_added') : messages[composition.phase] ? t(messages[composition.phase]) : '';
  status.classList.toggle('scene-error', ['failed','unknown','outdated','importerror'].includes(composition.phase));
  COMPOSE_EXAMPLES.forEach((example, i) => { var el = document.getElementById('composeExample' + i); if (el) el.textContent = getLang() === 'en' ? example[1] : example[0]; });
}
async function composeRequest(path, options) {
  var response = await fetch(WORKER_URL + path, {...options, signal: AbortSignal.timeout(60000)});
  if (response.status === 404) { var err = new Error('Worker update required'); err.outdated = true; throw err; }
  var data = await response.json();
  if (!response.ok) throw new Error('Scene request failed: ' + response.status);
  return data;
}
async function createComposition() {
  if (state.busy || !composition.files.some(Boolean) || !composition.prompt.trim()) return;
  // A retained ID always resumes polling; no automatic resubmission after an uncertain response.
  if (composition.imageUrl) invalidateComposition();
  state.busy = true; composition.phase = 'creating'; renderEditor();
  try {
    if (!composition.taskId) {
      var form = new FormData(); composition.files.filter(Boolean).forEach(file => form.append('images', file));
      form.append('prompt', composition.prompt.trim()); form.append('aspect_ratio', composition.aspect);
      var job = await composeRequest('/compose', {method:'POST', body:form});
      if (!job.task_id) throw new Error('Missing scene request ID');
      composition.taskId = job.task_id;
    }
    for (var attempt = 0; attempt < 120; attempt++) {
      var result = await composeRequest('/compose-status?task_id=' + encodeURIComponent(composition.taskId));
      if (result.status === 'completed' && result.image_url) { composition.imageUrl = result.image_url; composition.phase = 'ready'; return; }
      if (result.status === 'failed') { composition.taskId = null; composition.phase = 'failed'; return; }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    composition.phase = 'waiting';
  } catch (error) {
    composition.phase = error.outdated ? 'outdated' : composition.taskId ? 'waiting' : 'unknown';
  } finally { state.busy = false; renderEditor(); }
}
async function useComposition() {
  if (state.busy || !composition.imageUrl || composition.imported) return;
  if (state.scenes.length >= MAX_SCENES) { showToast(tr('Máximo 8 escenas. Quita una para continuar.', 'Maximum 8 scenes. Remove one to continue.')); return; }
  state.busy = true; renderEditor();
  try {
    var response = await fetch(WORKER_URL + '/compose-image?task_id=' + encodeURIComponent(composition.taskId), {signal: AbortSignal.timeout(60000)});
    if (!response.ok) throw new Error('Image download failed');
    var blob = await response.blob();
    if (!['image/jpeg','image/png','image/webp'].includes(blob.type) || !blob.size || blob.size > 10 * 1024 * 1024) throw new Error('Invalid generated image');
    var file = new File([blob], 'joga-scene.' + (blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'), {type:blob.type});
    state.busy = false; addFiles([file]);
    updateScene('prompt', composition.prompt); composition.imported = true; composition.phase = 'ready';
    document.getElementById('editorTitle').scrollIntoView({behavior:'smooth', block:'center'});
  } catch { composition.phase = 'importerror'; }
  finally { state.busy = false; renderEditor(); }
}
document.addEventListener('DOMContentLoaded', () => {
  [0,1].forEach(index => document.getElementById('refInput' + index).addEventListener('change', function() {
    if (state.busy) return;
    var file = this.files[0]; this.value = '';
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { showToast(t('c_err_type')); return; }
    if (!file.size || file.size > 10 * 1024 * 1024) { showToast(t('c_err_big')); return; }
    if (composition.previews[index]) URL.revokeObjectURL(composition.previews[index]);
    composition.files[index] = file; composition.previews[index] = URL.createObjectURL(file);
    var img = document.getElementById('refPreview' + index); img.src = composition.previews[index]; img.hidden = false;
    invalidateComposition();
  }));
  document.getElementById('composePrompt').addEventListener('input', function() { if (!state.busy) { composition.prompt = this.value; invalidateComposition(); } });
  document.getElementById('composeAspect').addEventListener('change', function() { if (!state.busy) { composition.aspect = this.value; invalidateComposition(); } });
  COMPOSE_EXAMPLES.forEach((example, index) => {
    var button = action('', () => {
      composition.prompt = getLang() === 'en' ? example[3] : example[2];
      document.getElementById('composePrompt').value = composition.prompt; invalidateComposition();
    });
    button.id = 'composeExample' + index; document.getElementById('composeExamples').append(button);
  });
  document.getElementById('composeBtn').onclick = createComposition;
  document.getElementById('useComposition').onclick = useComposition;
  applyLang(); renderComposer();
});
