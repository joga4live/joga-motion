// ═══════════════════════════════════════════════
// JOGA MOTION — Cloudflare Worker
// Proxy: Higgsfield AI image-to-video
// Deploy at: Cloudflare Dashboard → Workers & Pages
// Secrets: HF_API_KEY_ID, HF_API_KEY_SECRET
// ═══════════════════════════════════════════════

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const HF_BASE = 'https://api.higgsfield.ai';
const HF_PLATFORM = 'https://platform.higgsfield.ai';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// Style → Higgsfield model map
const STYLE_MODEL = {
  cinematic: 'kling-video/v2.1/pro/image-to-video',
  smooth:    'higgsfield-ai/dop/standard',
  dynamic:   'kling-video/v2.1/pro/image-to-video',
  dreamy:    'higgsfield-ai/dop/standard',
  zoom:      'kling-video/v2.1/pro/image-to-video',
  pan:       'kling-video/v2.1/pro/image-to-video',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const authHeader = `Key ${env.HF_API_KEY_ID}:${env.HF_API_KEY_SECRET}`;

    // ── POST /generate ──────────────────────────
    // Accepts: { image_url OR image_b64, prompt, duration, style }
    if (request.method === 'POST' && url.pathname === '/generate') {
      const body = await request.json();
      const { image_url, image_b64, prompt, duration, style } = body;

      if (!prompt) return json({ error: 'prompt required' }, 400);
      if (!image_url && !image_b64) return json({ error: 'image_url or image_b64 required' }, 400);

      const model = STYLE_MODEL[style] || STYLE_MODEL.cinematic;
      const endpoint = `${HF_PLATFORM}/${model}`;

      // Build request body
      const reqBody = { prompt };
      if (image_url) {
        reqBody.image_url = image_url;
      } else {
        // If base64, we need to upload first via Higgsfield storage
        // For simplicity, use data URI — some models accept it
        reqBody.image_url = `data:image/jpeg;base64,${image_b64}`;
      }
      if (duration) reqBody.duration = String(duration);

      const hfRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(reqBody),
      });

      const data = await hfRes.json();

      if (data.request_id) {
        return json({ task_id: data.request_id, status_url: data.status_url });
      }
      return json({ error: data.message || data.error || 'Higgsfield API error', raw: data }, 500);
    }

    // ── GET /status?task_id=xxx ──────────────────
    if (request.method === 'GET' && url.pathname === '/status') {
      const taskId = url.searchParams.get('task_id');
      if (!taskId) return json({ error: 'task_id required' }, 400);

      const statusRes = await fetch(`${HF_BASE}/requests/${taskId}/status`, {
        headers: { 'Authorization': authHeader },
      });

      const data = await statusRes.json();

      // Higgsfield statuses: queued | processing | completed | failed
      if (data.status === 'completed') {
        // Output is in data.output or data.outputs array
        const videoUrl = data.output?.url || data.outputs?.[0]?.url || data.output;
        return json({ status: 'completed', video_url: videoUrl });
      }
      if (data.status === 'failed') {
        return json({ status: 'failed', error: data.error });
      }
      // queued or processing
      return json({ status: 'processing', hf_status: data.status });
    }

    return json({ error: 'Not found' }, 404);
  },
};
