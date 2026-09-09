// ═══════════════════════════════════════════════
// JOGA MOTION — Cloudflare Worker v3
// Proxy: Higgsfield AI image-to-video
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

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url   = new URL(request.url);
    const keyId = (env.HF_API_KEY_ID || '').trim();
    const keySecret = (env.HF_API_KEY_SECRET || '').trim();
    const auth  = `Key ${keyId}:${keySecret}`;

    // ── GET /ping ────────────────────────────────
    if (url.pathname === '/ping') {
      return json({ ok: true, key_id_preview: keyId.slice(0, 8) + '...', key_id_len: keyId.length });
    }

    // ── POST /upload — store image temporarily ───
    // Receives base64, caches image at /img/:id, returns public URL
    if (request.method === 'POST' && url.pathname === '/upload') {
      const body = await request.json();
      const { image_b64, mime } = body;
      if (!image_b64) return json({ error: 'image_b64 required' }, 400);

      const id = crypto.randomUUID();
      const imgType = mime || 'image/jpeg';
      const binary = Uint8Array.from(atob(image_b64), c => c.charCodeAt(0));

      // Cache the image for 10 minutes
      const imgResponse = new Response(binary, {
        headers: {
          'Content-Type': imgType,
          'Cache-Control': 'public, max-age=600',
          'Access-Control-Allow-Origin': '*',
        },
      });

      const cacheKey = new Request(`${url.origin}/img/${id}`, { method: 'GET' });
      const cache = caches.default;
      ctx.waitUntil(cache.put(cacheKey, imgResponse.clone()));

      return json({ image_url: `${url.origin}/img/${id}`, id });
    }

    // ── GET /img/:id — serve cached image ────────
    if (request.method === 'GET' && url.pathname.startsWith('/img/')) {
      const cache = caches.default;
      const cached = await cache.match(request);
      if (cached) return cached;
      return new Response('Image not found or expired', { status: 404 });
    }

    // ── POST /generate ───────────────────────────
    if (request.method === 'POST' && url.pathname === '/generate') {
      const body = await request.json();
      const { image_url, prompt, duration } = body;

      if (!prompt) return json({ error: 'prompt required' }, 400);
      if (!image_url) return json({ error: 'image_url required' }, 400);

      const endpoint = `${HF_BASE}/higgsfield-ai/dop/standard`;
      const reqBody = {
        image_url,
        prompt,
      };
      if (duration) reqBody.duration = String(duration);

      const hfRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': auth,
        },
        body: JSON.stringify(reqBody),
      });

      const data = await hfRes.json();

      if (data.request_id) {
        return json({ task_id: data.request_id });
      }
      return json({ error: 'Higgsfield error', raw: data }, 500);
    }

    // ── GET /status?task_id=xxx ──────────────────
    if (request.method === 'GET' && url.pathname === '/status') {
      const taskId = url.searchParams.get('task_id');
      if (!taskId) return json({ error: 'task_id required' }, 400);

      const res = await fetch(`${HF_BASE}/requests/${taskId}/status`, {
        headers: { 'Authorization': auth },
      });
      const data = await res.json();

      if (data.status === 'completed') {
        const videoUrl = data.output?.url || data.outputs?.[0]?.url || data.output;
        return json({ status: 'completed', video_url: videoUrl });
      }
      if (data.status === 'failed') {
        return json({ status: 'failed', error: data.error });
      }
      return json({ status: 'processing' });
    }

    return json({ error: 'Not found' }, 404);
  },
};
