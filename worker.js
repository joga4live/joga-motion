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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

const MODEL = 'kling-video/v2.1/pro/image-to-video';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

async function uploadImage(b64, contentType, authHeader) {
  const type = IMAGE_TYPES.has(contentType) ? contentType : 'image/jpeg';
  const presign = await fetch(`${HF_BASE}/files/generate-upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
    body: JSON.stringify({ content_type: type }),
  });
  const p = await presign.json();
  if (!presign.ok || !p.upload_url || !p.public_url) {
    throw new Error(`upload-url failed (${presign.status}): ${p.message || p.error || JSON.stringify(p)}`);
  }
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const put = await fetch(p.upload_url, { method: 'PUT', headers: p.upload_headers || { 'Content-Type': type }, body: bytes });
  if (!put.ok) throw new Error(`image PUT failed (${put.status})`);
  return p.public_url;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const authHeader = `Key ${env.HF_API_KEY_ID}:${env.HF_API_KEY_SECRET}`;

    // ── POST /generate ──────────────────────────
    // Accepts: { image_url OR image_b64, prompt, duration, style }
    if (request.method === 'POST' && url.pathname === '/generate') {
      const body = await request.json();
      const { image_url, image_b64, content_type, prompt, duration } = body;

      if (!prompt) return json({ error: 'prompt required' }, 400);
      if (!image_url && !image_b64) return json({ error: 'image_url or image_b64 required' }, 400);

      const endpoint = `${HF_BASE}/${MODEL}`;

      let imageUrl = image_url;
      try {
        if (!imageUrl) imageUrl = await uploadImage(image_b64, content_type, authHeader);
      } catch (e) {
        return json({ error: e.message }, 502);
      }
      const reqBody = {
        prompt,
        image_url: imageUrl,
        duration: duration === 10 ? 10 : 5,
      };

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
      return json({ error: data.message || data.error || 'Higgsfield API error', hf_status: hfRes.status, raw: data }, 502);
    }

    // ── GET /status?task_id=xxx ──────────────────
    if (request.method === 'GET' && url.pathname === '/status') {
      const taskId = url.searchParams.get('task_id');
      if (!taskId) return json({ error: 'task_id required' }, 400);

      const statusRes = await fetch(`${HF_BASE}/requests/${taskId}/status`, {
        headers: { 'Authorization': authHeader },
      });

      const data = await statusRes.json();
      const videoUrl = data.video?.url;
      if (data.status === 'completed') {
        if (videoUrl) return json({ status: 'completed', video_url: videoUrl });
        return json({ status: 'failed', error: 'completed without video url', raw: data });
      }
      if (data.status === 'failed' || data.status === 'nsfw' || data.status === 'canceled') {
        return json({ status: 'failed', error: data.error || data.status });
      }
      return json({ status: 'processing', hf_status: data.status });
    }

    // ── GET /download?task_id=xxx ────────────────
    if (request.method === 'GET' && url.pathname === '/download') {
      const taskId = url.searchParams.get('task_id');
      if (!taskId) return json({ error: 'task_id required' }, 400);
      const st = await fetch(`${HF_BASE}/requests/${taskId}/status`, { headers: { 'Authorization': authHeader } });
      const data = await st.json();
      const videoUrl = data.video?.url;
      if (data.status !== 'completed' || !videoUrl) return json({ error: 'video not ready' }, 409);
      const v = await fetch(videoUrl);
      if (!v.ok) return json({ error: `video fetch failed (${v.status})` }, 502);
      return new Response(v.body, {
        headers: {
          ...CORS,
          'Content-Type': v.headers.get('Content-Type') || 'video/mp4',
          'Content-Disposition': `attachment; filename="joga-motion-${taskId}.mp4"`,
        },
      });
    }

    return json({ error: 'Not found' }, 404);
  },
};
