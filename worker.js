// ═══════════════════════════════════════════════
// JOGA MOTION — Cloudflare Worker
// Proxy: Kling AI image-to-video
// Deploy at: Cloudflare Dashboard → Workers & Pages
// Secrets: KLING_ACCESS_KEY, KLING_SECRET_KEY
// ═══════════════════════════════════════════════

import { createHmac } from 'node:crypto';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// Kling AI JWT auth
function buildJWT(accessKey, secretKey) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 }));
  const sig = createHmac('sha256', secretKey).update(header + '.' + payload).digest('base64url');
  return header + '.' + payload + '.' + sig;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const token = buildJWT(env.KLING_ACCESS_KEY, env.KLING_SECRET_KEY);

    // ── POST /generate ── Submit image-to-video task
    if (request.method === 'POST' && url.pathname === '/generate') {
      const body = await request.json();
      const { image_b64, prompt, duration } = body;

      if (!image_b64 || !prompt) return json({ error: 'image_b64 and prompt required' }, 400);

      const klingRes = await fetch('https://api.klingai.com/v1/videos/image2video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({
          model_name: 'kling-v1-6',
          image: image_b64,
          prompt: prompt,
          duration: String(duration || 5),
          cfg_scale: 0.5,
          mode: 'pro',
          aspect_ratio: '16:9',
        }),
      });

      const data = await klingRes.json();
      if (data.data?.task_id) {
        return json({ task_id: data.data.task_id });
      }
      return json({ error: data.message || 'Kling API error', raw: data }, 500);
    }

    // ── GET /status?task_id=xxx ── Poll task status
    if (request.method === 'GET' && url.pathname === '/status') {
      const taskId = url.searchParams.get('task_id');
      if (!taskId) return json({ error: 'task_id required' }, 400);

      const klingRes = await fetch('https://api.klingai.com/v1/videos/image2video/' + taskId, {
        headers: { 'Authorization': 'Bearer ' + token },
      });

      const data = await klingRes.json();
      const task = data.data;

      if (!task) return json({ status: 'error', error: 'No task data' }, 500);

      // Map Kling statuses
      // task_status: submitted | processing | succeed | failed
      if (task.task_status === 'succeed') {
        const videoUrl = task.task_result?.videos?.[0]?.url;
        return json({ status: 'completed', video_url: videoUrl });
      }
      if (task.task_status === 'failed') {
        return json({ status: 'failed', error: task.task_status_msg });
      }
      return json({ status: 'processing', task_status: task.task_status });
    }

    return json({ error: 'Not found' }, 404);
  },
};
