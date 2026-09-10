/* ═══════════════════════════════════
   JOGA MOTION — Creator Logic
   Connects to Kling AI via CF Worker
   ═══════════════════════════════════ */

// ── Config ──
var WORKER_URL = 'https://joga-motion-api.omhotien90.workers.dev';

// Each scene keeps its own inputs and provider task. Reordering never regenerates it.
var state = { scenes: [], activeId: null, busy: false, resultUrl: null };
var MAX_SCENES = 8;
function activeScene() { return state.scenes.find(s => s.id === state.activeId); }
function tr(es, en) { return getLang() === 'en' ? en : es; }

// ── Quick Prompts ──
var QUICK_PROMPTS = {
  es: [
    'Zoom suave hacia el horizonte con luz dorada al atardecer',
    'El viento mueve el cabello suavemente con bokeh de luz',
    'Cámara orbita lentamente alrededor del sujeto',
    'Partículas de luz flotan hacia arriba en el aire',
    'Niebla cinematográfica avanza desde el fondo',
  ],
  en: [
    'Gentle zoom toward horizon with golden sunset light',
    'Wind softly moves hair with light bokeh',
    'Camera slowly orbits around the subject',
    'Light particles float upward in the air',
    'Cinematic fog rolls in from the background',
  ],
};

function initCreator() {
  renderQuickPrompts();
  document.getElementById('promptInput').addEventListener('input', function() {
    updateScene('prompt', this.value);
  });
  document.querySelectorAll('#styleGrid .s-btn').forEach(btn => {
    btn.addEventListener('click', () => { updateScene('style', btn.dataset.style); renderEditor(); });
  });
  document.querySelectorAll('.dur-row .d-btn').forEach(btn => {
    btn.addEventListener('click', () => { updateScene('duration', Number(btn.dataset.dur)); renderEditor(); });
  });
  renderEditor();
}

function renderQuickPrompts() {
  var wrap = document.getElementById('quickPrompts');
  wrap.replaceChildren();
  (QUICK_PROMPTS[getLang()] || QUICK_PROMPTS.es).forEach(prompt => {
    var btn = document.createElement('button');
    btn.className = 'scene-action'; btn.textContent = prompt;
    btn.disabled = state.busy || !activeScene();
    btn.onclick = () => { updateScene('prompt', prompt); renderEditor(); };
    wrap.append(btn);
  });
}
window.onLangChange = function() { renderEditor(); };

function clearAssembly() {
  if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
  state.resultUrl = null;
  document.getElementById('resultVideo').removeAttribute('src');
  document.getElementById('resultPanel').classList.remove('show');
}
function updateScene(key, value) {
  var scene = activeScene();
  if (!scene || state.busy || scene[key] === value) return;
  scene[key] = value;
  scene.taskId = null; scene.videoUrl = null; scene.status = 'draft'; scene.error = '';
  clearAssembly();
  document.getElementById('exportBtn').disabled = true;
  renderScenes();
}
function updateSlider(el) {
  updateScene('intensity', Number(el.value));
  el.style.background = 'linear-gradient(to right, var(--violet) ' + ((el.value - 1) / 9 * 100) + '%, var(--border) 0%)';
}
function action(label, fn, disabled) {
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'scene-action'; btn.textContent = label;
  btn.disabled = Boolean(disabled); btn.onclick = fn; return btn;
}
function renderScenes() {
  var list = document.getElementById('sceneList');
  list.replaceChildren();
  state.scenes.forEach((scene, index) => {
    var row = document.createElement('div'); row.className = 'scene-row' + (scene.id === state.activeId ? ' selected' : '');
    var select = action('', () => { state.activeId = scene.id; renderEditor(); }, state.busy);
    select.classList.add('scene-select'); select.setAttribute('aria-pressed', String(scene.id === state.activeId));
    var img = document.createElement('img'); img.src = scene.preview; img.alt = '';
    var text = document.createElement('span');
    var labels = {draft: tr('Pendiente', 'Draft'), processing: tr('Generando', 'Generating'), completed: tr('Lista', 'Ready'), failed: tr('Error', 'Failed'), waiting: tr('En espera', 'Waiting')};
    text.textContent = (index + 1) + '. ' + scene.file.name + ' · ' + scene.duration + ' s · ' + labels[scene.status];
    select.append(img, text); row.append(select);
    row.append(action('↑', () => moveScene(index, -1), state.busy || index === 0), action('↓', () => moveScene(index, 1), state.busy || index === state.scenes.length - 1));
    row.children[1].setAttribute('aria-label', tr('Mover antes', 'Move earlier'));
    row.children[2].setAttribute('aria-label', tr('Mover después', 'Move later'));
    row.append(action(tr('Quitar', 'Remove'), () => {
      URL.revokeObjectURL(scene.preview); state.scenes.splice(index, 1);
      if (state.activeId === scene.id) state.activeId = state.scenes[Math.min(index, state.scenes.length - 1)]?.id || null;
      clearAssembly(); renderEditor();
    }, state.busy));
    if (scene.videoUrl) row.append(action(tr('Ver clip', 'View clip'), () => {
      document.getElementById('resultVideo').src = scene.videoUrl;
      document.getElementById('resultPanel').classList.add('show');
      document.getElementById('dlBtn').onclick = () => downloadClip(scene);
    }, state.busy));
    if (scene.error) { var error = document.createElement('p'); error.className = 'scene-error'; error.textContent = (scene.taskId ? tr('No se pudo confirmar el resultado. Pulsa generar para volver a consultar.', 'Could not confirm the result. Press generate to check again.') : t('c_err_api')); error.title = scene.error; row.append(error); }
    list.append(row);
  });
  document.getElementById('sceneSummary').textContent = state.scenes.length + '/' + MAX_SCENES + tr(' escenas · ', ' scenes · ') + state.scenes.reduce((n, s) => n + s.duration, 0) + ' s';
}
function moveScene(index, direction) {
  if (state.busy) return;
  var other = index + direction;
  if (other < 0 || other >= state.scenes.length) return;
  [state.scenes[index], state.scenes[other]] = [state.scenes[other], state.scenes[index]];
  clearAssembly(); renderEditor();
}
function renderEditor() {
  if (!document.getElementById('sceneList')) return;
  var scene = activeScene();
  document.getElementById('editorTitle').textContent = scene ? tr('Editar escena ', 'Edit scene ') + (state.scenes.indexOf(scene) + 1) : tr('Añade imágenes para comenzar', 'Add images to begin');
  document.getElementById('promptInput').value = scene?.prompt || '';
  document.querySelectorAll('.ctrl-panel textarea, .ctrl-panel input, .ctrl-panel .s-btn, .ctrl-panel .d-btn').forEach(el => el.disabled = state.busy || !scene);
  document.querySelectorAll('#styleGrid .s-btn').forEach(btn => btn.classList.toggle('on', btn.dataset.style === scene?.style));
  document.querySelectorAll('.dur-row .d-btn').forEach(btn => btn.classList.toggle('on', Number(btn.dataset.dur) === scene?.duration));
  var slider = document.getElementById('intensitySlider'); slider.value = scene?.intensity || 5;
  slider.style.background = 'linear-gradient(to right, var(--violet) ' + ((slider.value - 1) / 9 * 100) + '%, var(--border) 0%)';
  document.getElementById('genBtn').disabled = state.busy || !scene;
  document.getElementById('exportBtn').disabled = state.busy || !state.scenes.length || state.scenes.some(s => !s.videoUrl);
  document.getElementById('fileInput').disabled = state.busy;
  document.getElementById('uploadZone').disabled = state.busy;
  renderScenes(); renderQuickPrompts();
  if (typeof renderComposer === 'function') renderComposer();
}
function triggerUpload() { if (!state.busy) document.getElementById('fileInput').click(); }
function handleFile(input) { addFiles(Array.from(input.files)); input.value = ''; }
function addFiles(files) {
  if (state.busy) return;
  var errors = [];
  files.forEach(file => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { errors.push(file.name + ': ' + t('c_err_type')); return; }
    if (!file.size || file.size > 10 * 1024 * 1024) { errors.push(file.name + ': ' + t('c_err_big')); return; }
    if (state.scenes.length >= MAX_SCENES) { errors.push(tr('Máximo 8 escenas.', 'Maximum 8 scenes.')); return; }
    var scene = { id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), prompt: '', style: 'cinematic', duration: 5, intensity: 5, status: 'draft', taskId: null, videoUrl: null, error: '' };
    state.scenes.push(scene); state.activeId = scene.id; clearAssembly();
  });
  renderEditor(); if (errors.length) showToast(errors.join(' '));
}
function onDragOver(e) { e.preventDefault(); if (!state.busy) document.getElementById('uploadZone').classList.add('drag'); }
function onDragLeave() { document.getElementById('uploadZone').classList.remove('drag'); }
function onDrop(e) { e.preventDefault(); onDragLeave(); addFiles(Array.from(e.dataTransfer.files)); }

var STYLE_MAP = {
  cinematic: 'cinematic camera motion, film look, depth of field',
  smooth: 'smooth gentle movement, slow motion feel',
  dynamic: 'dynamic energetic motion, quick camera movements',
  dreamy: 'dreamy ethereal motion, soft glowing particles',
  zoom: 'slow zoom in, subtle push forward',
  pan: 'slow panoramic camera pan, sweeping landscape motion'
};
async function api(path, options) {
  var response = await fetch(WORKER_URL + path, { ...options, signal: AbortSignal.timeout(60000) });
  var data;
  try { data = await response.json(); } catch { throw new Error(tr('Respuesta inválida del servidor.', 'Invalid server response.')); }
  if (!response.ok) { console.error(data.error || ('HTTP ' + response.status)); throw new Error(tr('El servicio no pudo completar la solicitud. Código: ', 'The service could not complete the request. Code: ') + response.status); }
  return data;
}
async function generateVideo() {
  if (state.busy || !state.scenes.length) return;
  var missing = state.scenes.find(s => !s.prompt.trim());
  if (missing) { state.activeId = missing.id; renderEditor(); showToast(t('c_err_no_prompt')); document.getElementById('promptInput').focus(); return; }
  state.busy = true; clearAssembly(); renderEditor();
  document.getElementById('progPanel').classList.add('show');
  try {
    for (var i = 0; i < state.scenes.length; i++) {
      var scene = state.scenes[i];
      if (scene.videoUrl) continue;
      scene.status = 'processing'; scene.error = ''; renderScenes();
      setStep(tr('Escena ', 'Scene ') + (i + 1) + '/' + state.scenes.length + ' · ' + t('c_step_uploading'), i / state.scenes.length * 100);
      try {
        if (!scene.taskId) {
          var fd = new FormData(); fd.append('image', scene.file);
          fd.append('prompt', scene.prompt.trim() + '. ' + STYLE_MAP[scene.style] + '. Motion intensity: ' + scene.intensity + '/10.');
          fd.append('duration', String(scene.duration));
          var data = await api('/generate', { method: 'POST', body: fd });
          if (!data.task_id) throw new Error(tr('El servidor no devolvió el identificador de la generación.', 'The server did not return a generation ID.'));
          scene.taskId = data.task_id;
        }
        await pollTask(scene, i);
      } catch (err) {
        scene.status = scene.taskId ? 'waiting' : 'failed'; scene.error = err.message;
        showToast(err.message); break;
      }
    }
  } finally {
    state.busy = false; document.getElementById('progPanel').classList.remove('show'); renderEditor();
  }
}
async function pollTask(scene, index) {
  // Sequential polling prevents overlapping requests. A timeout preserves the task for resuming.
  for (var attempt = 0; attempt < 120; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    setStep(tr('Escena ', 'Scene ') + (index + 1) + '/' + state.scenes.length + ' · ' + t('c_step_animating'), index / state.scenes.length * 100);
    var data = await api('/status?task_id=' + encodeURIComponent(scene.taskId));
    if (data.status === 'completed' && data.video_url) { scene.videoUrl = data.video_url; scene.status = 'completed'; renderScenes(); return; }
    if (data.status === 'failed') { scene.taskId = null; console.error(data.error); throw new Error(t('c_err_api')); }
  }
  throw new Error(tr('Sigue procesando. Pulsa generar para consultar de nuevo sin repetir el cargo.', 'Still processing. Press generate to check again without submitting a new job.'));
}
function setStep(label, pct) { document.getElementById('progStep').textContent = label; document.getElementById('progBar').style.width = pct + '%'; }
function downloadClip(scene) {
  var a = document.createElement('a'); a.href = WORKER_URL + '/download?task_id=' + encodeURIComponent(scene.taskId); a.target = '_blank'; a.rel = 'noopener'; a.click();
}
function downloadVideo() {
  if (!state.resultUrl) return;
  var a = document.createElement('a'); a.href = state.resultUrl; a.download = 'joga-motion.' + state.exportExtension; a.click();
}
function resetCreator() { if (!state.busy) { clearAssembly(); document.querySelector('.creator-hero').scrollIntoView({ behavior: 'smooth' }); } }
var toastTimer;
function showToast(msg) {
  var toast = document.getElementById('toast'); toast.textContent = msg; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 8000);
}

// Assemble actual generated clips locally; never substitute still images for AI output.
async function exportVideo() {
  if (state.busy || !state.scenes.length || state.scenes.some(s => !s.videoUrl)) return;
  var canvas = document.createElement('canvas');
  var mime = typeof MediaRecorder !== 'undefined' && ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
  if (!mime || !canvas.captureStream) { showToast(tr('Este navegador no permite unir videos. Descarga los clips individuales.', 'This browser cannot join videos. Download individual clips.')); return; }
  state.busy = true; clearAssembly(); renderEditor();
  document.getElementById('progPanel').classList.add('show');
  var video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'auto';
  // Keep decoding active on browsers that suspend detached video elements.
  video.className = 'export-source'; document.body.append(video);
  var urls = [], stream, recorder, frame, stopped, exportError;
  function checkVisible() { if (document.hidden) { exportError = new Error(tr('Exportación detenida: mantén la pestaña visible e intenta de nuevo.', 'Export stopped: keep this tab visible and try again.')); video.pause(); } }
  document.addEventListener('visibilitychange', checkVisible);
  function waitMedia(event, start) {
    return new Promise((resolve, reject) => {
      var timeout = setTimeout(() => finish(new Error(tr('No se pudo leer el clip.', 'Could not read the clip.'))), 120000);
      function finish(err) { clearTimeout(timeout); video.removeEventListener(event, done); video.removeEventListener('error', fail); err ? reject(err) : resolve(); }
      function done() { finish(); } function fail() { console.error('Clip decode error', video.error?.code, video.error?.message); finish(new Error(tr('Formato de clip incompatible.', 'Unsupported clip format.'))); }
      video.addEventListener(event, done, {once: true}); video.addEventListener('error', fail, {once: true});
      start();
    });
  }
  try {
    checkVisible(); if (exportError) throw exportError;
    // Download through the existing trusted task endpoint, avoiding remote canvas CORS.
    for (var i = 0; i < state.scenes.length; i++) {
      setStep(tr('Preparando clip ', 'Preparing clip ') + (i + 1), i / state.scenes.length * 20);
      var response = await fetch(WORKER_URL + '/download?task_id=' + encodeURIComponent(state.scenes[i].taskId), {signal: AbortSignal.timeout(120000)});
      if (!response.ok) throw new Error(tr('No se pudo descargar el clip. Código: ', 'Could not download the clip. Code: ') + response.status);
      urls.push(URL.createObjectURL(await response.blob()));
    }
    await waitMedia('loadeddata', () => { video.src = urls[0]; video.load(); });
    var portrait = video.videoHeight > video.videoWidth;
    canvas.width = portrait ? 720 : 1280; canvas.height = portrait ? 1280 : 720;
    var ctx = canvas.getContext('2d');
    function draw() {
      if (video.readyState >= 2) {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        var scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
        var w = video.videoWidth * scale, h = video.videoHeight * scale;
        ctx.drawImage(video, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      }
      stream?.getVideoTracks()[0]?.requestFrame?.();
      frame = setTimeout(draw, 1000 / 30);
    }
    stream = canvas.captureStream(30); draw();
    recorder = new MediaRecorder(stream, {mimeType: mime, videoBitsPerSecond: 5000000});
    var chunks = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    stopped = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.onerror = () => { exportError = new Error(tr('Falló la exportación.', 'Export failed.')); };
    // Start only once the first clip plays; avoid an empty recording from an immediate pause.
    for (var j = 0; j < urls.length; j++) {
      if (j) await waitMedia('loadeddata', () => { video.src = urls[j]; video.load(); });
      if (exportError) throw exportError;
      setStep(tr('Uniendo escena ', 'Joining scene ') + (j + 1), 20 + j / urls.length * 80);
      // Pausing while loading excludes network/decode gaps from the final edit.
      await video.play();
      if (j === 0) recorder.start(1000); else recorder.resume();
      var deadline = Date.now() + 120000;
      while (!video.ended) {
        if (exportError) throw exportError;
        if (video.error || Date.now() > deadline) throw new Error(tr('El clip no se pudo reproducir.', 'The clip could not be played.'));
        await new Promise(resolve => setTimeout(resolve, 40));
      }
      if (j < urls.length - 1) recorder.pause();
    }
    recorder.stop(); await stopped;
    if (exportError) throw exportError;
    var blob = new Blob(chunks, {type: mime});
    if (!blob.size) throw new Error(tr('El video exportado está vacío.', 'The exported video is empty.'));
    state.resultUrl = URL.createObjectURL(blob); state.exportExtension = mime.includes('mp4') ? 'mp4' : 'webm';
    document.getElementById('resultVideo').src = state.resultUrl;
    document.getElementById('dlBtn').onclick = downloadVideo;
    document.getElementById('resultPanel').classList.add('show');
  } catch (err) { showToast(err.message); }
  finally {
    if (recorder && recorder.state !== 'inactive') { recorder.stop(); await stopped; }
    clearTimeout(frame); stream?.getTracks().forEach(track => track.stop());
    video.pause(); video.removeAttribute('src'); video.load(); video.remove();
    urls.forEach(url => URL.revokeObjectURL(url)); document.removeEventListener('visibilitychange', checkVisible);
    state.busy = false; document.getElementById('progPanel').classList.remove('show'); renderEditor();
  }
}
