// Joga Motion — Bilingual i18n (ES/EN)
const JM_LANG_KEY = 'jiLang';

const STRINGS = {
  es: {
    // Nav
    nav_back: 'Joga Intelligence',
    nav_books: 'Joga Books',
    nav_create: 'Crear Video',

    // Hero
    hero_tag: 'Imagen a Video con IA',
    hero_h1_1: 'JOGA',
    hero_h1_2: 'MOTION',
    hero_sub: 'Sube cualquier imagen. Describe el movimiento. Obtén un video que cobra vida.',
    hero_cta: 'CREAR MI VIDEO',
    hero_scroll: 'Ver cómo funciona',

    // How it works
    how_title: 'Tres pasos. Un video.',
    step1_n: '01',
    step1_title: 'Sube tu imagen',
    step1_desc: 'Cualquier foto, ilustración o arte. Desde tu teléfono, cámara o diseño propio.',
    step2_n: '02',
    step2_title: 'Describe el movimiento',
    step2_desc: 'Escribe cómo quieres que se mueva. El viento, el zoom, la cámara — tú decides.',
    step3_n: '03',
    step3_title: 'Descarga tu video',
    step3_desc: 'IA genera el video en segundos. Descárgalo en HD y compártelo donde quieras.',

    // Features
    features_title: 'Movimiento sin límites',
    feat1_title: 'Cualquier imagen',
    feat1_desc: 'JPG, PNG, WebP. Fotos personales, arte digital, portadas de libros.',
    feat2_title: 'IA de punta',
    feat2_desc: 'Kling AI — el motor más avanzado del mundo para imagen a video.',
    feat3_title: 'Calidad HD',
    feat3_desc: 'Videos listos para Instagram, TikTok, presentaciones y más.',
    feat4_title: 'Descarga inmediata',
    feat4_desc: 'Sin esperas. Tu video listo en segundos, tuyo para siempre.',

    // Ecosystem
    eco_title: 'Parte del ecosistema Joga',
    eco_sub: 'Joga Motion potencia todos tus proyectos creativos',
    eco_intelligence: 'Joga Intelligence',
    eco_intelligence_desc: 'La plataforma central de crecimiento personal. Anima tus metas.',
    eco_books: 'Joga Books',
    eco_books_desc: 'Da vida a las portadas de tus libros. Videos para cada título.',
    eco_audio: 'Joga Audio',
    eco_audio_desc: 'Crea visuales para tus audiolibros. Motion + sonido = impacto.',

    // Pricing
    price_title: 'Empieza gratis hoy',
    price_free: 'GRATIS',
    price_free_desc: '3 videos / mes · Calidad estándar · Marca de agua',
    price_pro: 'PRO',
    price_pro_desc: 'Videos ilimitados · HD sin marca · Prioridad de procesamiento',
    price_pro_price: '$19 / mes',
    price_cta: 'CREAR AHORA — ES GRATIS',

    // Creator page
    c_title: 'Joga Motion Creator',
    c_upload_title: 'Tu imagen',
    c_upload_hint: 'Arrastra aquí o haz clic para subir',
    c_upload_sub: 'JPG, PNG, WebP · Máx 10MB',
    c_prompt_label: 'Describe el movimiento',
    c_prompt_ph: 'Ej: La cámara hace zoom lento hacia adelante mientras el viento mueve el cabello suavemente...',
    c_style_label: 'Estilo de movimiento',
    c_style_cinematic: 'Cinemático',
    c_style_smooth: 'Suave',
    c_style_dynamic: 'Dinámico',
    c_style_dreamy: 'Onírico',
    c_style_zoom: 'Zoom In',
    c_style_pan: 'Panorámica',
    c_duration_label: 'Duración',
    c_dur_5: '5 segundos',
    c_dur_10: '10 segundos',
    c_motion_label: 'Intensidad del movimiento',
    c_motion_low: 'Suave',
    c_motion_high: 'Intensa',
    c_generate: 'GENERAR VIDEO',
    c_processing: 'Generando tu video...',
    c_download: 'DESCARGAR VIDEO',
    c_new: 'CREAR OTRO',
    c_result_title: 'Tu video está listo',
    c_error_no_image: 'Por favor sube una imagen primero.',
    c_error_no_prompt: 'Describe cómo quieres que se mueva tu imagen.',
    c_error_api: 'Error al generar el video. Intenta de nuevo.',
    c_step_uploading: 'Subiendo imagen...',
    c_step_queued: 'En cola...',
    c_step_processing: 'La IA está animando tu imagen...',
    c_step_finalizing: 'Finalizando video...',

    // Footer
    footer_tagline: 'Imágenes que cobran vida.',
    footer_part: 'Parte de',
  },
  en: {
    nav_back: 'Joga Intelligence',
    nav_books: 'Joga Books',
    nav_create: 'Create Video',
    hero_tag: 'Image to Video with AI',
    hero_h1_1: 'JOGA',
    hero_h1_2: 'MOTION',
    hero_sub: 'Upload any image. Describe the movement. Get a video that comes to life.',
    hero_cta: 'CREATE MY VIDEO',
    hero_scroll: 'See how it works',
    how_title: 'Three steps. One video.',
    step1_n: '01',
    step1_title: 'Upload your image',
    step1_desc: 'Any photo, illustration or art. From your phone, camera or own design.',
    step2_n: '02',
    step2_title: 'Describe the motion',
    step2_desc: 'Write how you want it to move. Wind, zoom, camera — you decide.',
    step3_n: '03',
    step3_title: 'Download your video',
    step3_desc: 'AI generates the video in seconds. Download in HD and share anywhere.',
    features_title: 'Motion without limits',
    feat1_title: 'Any image',
    feat1_desc: 'JPG, PNG, WebP. Personal photos, digital art, book covers.',
    feat2_title: 'Cutting-edge AI',
    feat2_desc: "Kling AI — the world's most advanced image-to-video engine.",
    feat3_title: 'HD quality',
    feat3_desc: 'Videos ready for Instagram, TikTok, presentations and more.',
    feat4_title: 'Instant download',
    feat4_desc: 'No waiting. Your video ready in seconds, yours forever.',
    eco_title: 'Part of the Joga ecosystem',
    eco_sub: 'Joga Motion powers all your creative projects',
    eco_intelligence: 'Joga Intelligence',
    eco_intelligence_desc: 'The central personal growth platform. Animate your goals.',
    eco_books: 'Joga Books',
    eco_books_desc: 'Bring your book covers to life. Videos for every title.',
    eco_audio: 'Joga Audio',
    eco_audio_desc: 'Create visuals for your audiobooks. Motion + sound = impact.',
    price_title: 'Start free today',
    price_free: 'FREE',
    price_free_desc: '3 videos / month · Standard quality · Watermark',
    price_pro: 'PRO',
    price_pro_desc: 'Unlimited videos · HD no watermark · Priority processing',
    price_pro_price: '$19 / month',
    price_cta: 'CREATE NOW — IT\'S FREE',
    c_title: 'Joga Motion Creator',
    c_upload_title: 'Your image',
    c_upload_hint: 'Drag here or click to upload',
    c_upload_sub: 'JPG, PNG, WebP · Max 10MB',
    c_prompt_label: 'Describe the motion',
    c_prompt_ph: 'E.g.: The camera slowly zooms forward while the wind gently moves the hair...',
    c_style_label: 'Motion style',
    c_style_cinematic: 'Cinematic',
    c_style_smooth: 'Smooth',
    c_style_dynamic: 'Dynamic',
    c_style_dreamy: 'Dreamy',
    c_style_zoom: 'Zoom In',
    c_style_pan: 'Pan',
    c_duration_label: 'Duration',
    c_dur_5: '5 seconds',
    c_dur_10: '10 seconds',
    c_motion_label: 'Motion intensity',
    c_motion_low: 'Subtle',
    c_motion_high: 'Intense',
    c_generate: 'GENERATE VIDEO',
    c_processing: 'Generating your video...',
    c_download: 'DOWNLOAD VIDEO',
    c_new: 'CREATE ANOTHER',
    c_result_title: 'Your video is ready',
    c_error_no_image: 'Please upload an image first.',
    c_error_no_prompt: 'Describe how you want your image to move.',
    c_error_api: 'Error generating video. Please try again.',
    c_step_uploading: 'Uploading image...',
    c_step_queued: 'In queue...',
    c_step_processing: 'AI is animating your image...',
    c_step_finalizing: 'Finalizing video...',
    footer_tagline: 'Images that come to life.',
    footer_part: 'Part of',
  }
};

function getLang() { return localStorage.getItem(JM_LANG_KEY) || 'es'; }
function t(key) { return STRINGS[getLang()]?.[key] || STRINGS.es[key] || key; }
function toggleLang() {
  localStorage.setItem(JM_LANG_KEY, getLang() === 'es' ? 'en' : 'es');
  applyLang();
}
function applyLang() {
  document.querySelectorAll('[data-t]').forEach(el => {
    const key = el.getAttribute('data-t');
    const attr = el.getAttribute('data-t-attr');
    if (attr) el.setAttribute(attr, t(key));
    else el.textContent = t(key);
  });
  const toggle = document.getElementById('lang-toggle');
  if (toggle) toggle.textContent = getLang() === 'es' ? 'EN' : 'ES';
  if (typeof onLangChange === 'function') onLangChange();
}
