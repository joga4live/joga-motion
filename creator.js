/* ═══════════════════════════════════
   JOGA MOTION — Creator Logic
   Connects to Kling AI via CF Worker
   ═══════════════════════════════════ */

// ── Config ──
var WORKER_URL = 'https://joga-motion-api.omhotien90.workers.dev'; // ← replace after deploy

// ── State ──
var state = {
  imageFile: null,
  imageB64: null,
  selectedStyle: 'cinematic',
  selectedDuration: 5,
  intensity: 5,
  taskId: null,
  resultUrl: null,
};

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
  bindStyleBtns();
  bindDurBtns();
  updateSlider(document.getElementById('intensitySlider'));
}

function renderQuickPrompts() {
  var lang = getLang();
  var prompts = QUICK_PROMPTS[lang] || QUICK_PROMPTS.es;
  var wrap = document.getElementById('quickPrompts');
  if (!wrap) return;
  wrap.innerHTML = prompts.map(function(p) {
    return '<button onclick="usePrompt(this)" style="background:var(--dark-3);border:1px solid var(--border);color:var(--text-2);padding:7px 12px;border-radius:6px;font-size:.72rem;cursor:pointer;text-align:left;transition:border-color .18s" onmouseover="this.style.borderColor=\'var(--border-v)\';this.style.color=\'var(--text)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.color=\'var(--text-2)\'">' + p + '</button>';
  }).join('');
}

function usePrompt(btn) {
  var inp = document.getElementById('promptInput');
  if (inp) inp.value = btn.textContent;
}

// Re-render quick prompts on lang change
var _origOnLangChange = (typeof onLangChange === 'function') ? onLangChange : null;
window.onLangChange = function() {
  renderQuickPrompts();
  applyLang();
  if (_origOnLangChange) _origOnLangChange();
};

function bindStyleBtns() {
  document.querySelectorAll('#styleGrid .s-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#styleGrid .s-btn').forEach(function(b) { b.classList.remove('on'); });
      btn.classList.add('on');
      state.selectedStyle = btn.getAttribute('data-style');
    });
  });
}

function bindDurBtns() {
  document.querySelectorAll('.dur-row .d-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.dur-row .d-btn').forEach(function(b) { b.classList.remove('on'); });
      btn.classList.add('on');
      state.selectedDuration = parseInt(btn.getAttribute('data-dur'));
    });
  });
}

function updateSlider(el) {
  var pct = ((el.value - el.min) / (el.max - el.min)) * 100;
  el.style.background = 'linear-gradient(to right, var(--violet) ' + pct + '%, var(--border) ' + pct + '%)';
  state.intensity = parseInt(el.value);
}

// ── Upload ──
function triggerUpload() { document.getElementById('fileInput').click(); }

function handleFile(input) {
  var file = input.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { showToast(t('c_err_big') || 'Image too large (max 10MB)'); return; }
  state.imageFile = file;
  var reader = new FileReader();
  reader.onload = function(e) {
    state.imageB64 = e.target.result.split(',')[1]; // base64 only
    var img = document.getElementById('previewImg');
    img.src = e.target.result;
    img.style.display = 'block';
    document.querySelector('.u-icon').style.display = 'none';
    document.querySelector('.u-hint').style.display = 'none';
    document.querySelector('.u-sub').style.display = 'none';
    document.getElementById('imgBadge').style.display = 'block';
    document.getElementById('changeBtn').style.display = 'block';
    document.getElementById('uploadZone').classList.add('filled');
  };
  reader.readAsDataURL(file);
}

function onDragOver(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.add('drag');
}
function onDragLeave(e) {
  document.getElementById('uploadZone').classList.remove('drag');
}
function onDrop(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('drag');
  var file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    var dt = new DataTransfer();
    dt.items.add(file);
    var input = document.getElementById('fileInput');
    input.files = dt.files;
    handleFile(input);
  }
}

// ── Generate ──
function generateVideo() {
  if (!state.imageB64) { showToast(t('c_err_no_img')); return; }
  var prompt = document.getElementById('promptInput').value.trim();
  if (!prompt) { showToast(t('c_err_no_prompt')); return; }

  setGenerating(true);
  showProgress();

  // Build full prompt with style modifier
  var styleMap = {
    cinematic: 'cinematic camera motion, film look, depth of field',
    smooth: 'smooth gentle movement, slow motion feel',
    dynamic: 'dynamic energetic motion, quick camera movements',
    dreamy: 'dreamy ethereal motion, soft glowing particles',
    zoom: 'slow zoom in, Ken Burns effect, subtle push forward',
    pan: 'slow panoramic camera pan, sweeping landscape motion',
  };
  var fullPrompt = prompt + '. ' + (styleMap[state.selectedStyle] || '') + '. Motion intensity: ' + state.intensity + '/10.';

  setStep(t('c_step_uploading'), 15);

  fetch(WORKER_URL + '/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_b64: state.imageB64,
      prompt: fullPrompt,
      duration: state.selectedDuration,
    }),
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.task_id) {
      state.taskId = data.task_id;
      setStep(t('c_step_queued'), 30);
      pollTask(data.task_id);
    } else {
      throw new Error(data.error || 'No task_id returned');
    }
  })
  .catch(function(err) {
    console.error(err);
    showToast(t('c_err_api'));
    setGenerating(false);
    hideProgress();
  });
}

function pollTask(taskId) {
  setStep(t('c_step_animating'), 55);
  var attempts = 0;
  var maxAttempts = 60; // 5 min max (5s intervals)

  var interval = setInterval(function() {
    attempts++;
    if (attempts > maxAttempts) {
      clearInterval(interval);
      showToast(t('c_err_api'));
      setGenerating(false);
      hideProgress();
      return;
    }

    var pct = Math.min(55 + (attempts / maxAttempts) * 35, 90);
    setStep(t('c_step_animating'), pct);

    fetch(WORKER_URL + '/status?task_id=' + taskId)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.status === 'completed' && data.video_url) {
        clearInterval(interval);
        setStep(t('c_step_finalizing'), 95);
        setTimeout(function() {
          showResult(data.video_url);
          setGenerating(false);
          hideProgress();
        }, 800);
      } else if (data.status === 'failed') {
        clearInterval(interval);
        showToast(t('c_err_api'));
        setGenerating(false);
        hideProgress();
      }
      // else still processing — continue polling
    })
    .catch(function() { /* ignore transient errors */ });
  }, 5000);
}

// ── UI helpers ──
function setGenerating(isGen) {
  document.getElementById('genBtn').disabled = isGen;
}

function showProgress() {
  document.getElementById('progPanel').classList.add('show');
  document.getElementById('resultPanel').classList.remove('show');
  document.getElementById('progBar').style.width = '0%';
}
function hideProgress() {
  document.getElementById('progPanel').classList.remove('show');
}
function setStep(label, pct) {
  document.getElementById('progStep').textContent = label;
  document.getElementById('progBar').style.width = pct + '%';
}

function showResult(url) {
  state.resultUrl = url;
  var video = document.getElementById('resultVideo');
  video.src = url;
  document.getElementById('resultPanel').classList.add('show');
}

function downloadVideo() {
  if (!state.resultUrl) return;
  var a = document.createElement('a');
  a.href = state.resultUrl;
  a.download = 'joga-motion-' + Date.now() + '.mp4';
  a.click();
}

function resetCreator() {
  document.getElementById('resultPanel').classList.remove('show');
  document.getElementById('resultVideo').src = '';
  state.resultUrl = null;
  state.taskId = null;
  // Scroll back to top of creator
  document.querySelector('.creator-hero').scrollIntoView({ behavior: 'smooth' });
}

function showToast(msg) {
  var toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(function() { toast.classList.remove('show'); }, 4000);
}
