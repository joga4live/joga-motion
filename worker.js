// JOGA MOTION — Cloudflare Worker
// Proxy: Higgsfield AI image-to-video (Kling v2.1 pro)
// Secrets: HF_API_KEY_ID, HF_API_KEY_SECRET

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const HF_BASE = 'https://api.higgsfield.ai';
const MODEL = 'kling-video/v2.1/pro/image-to-video';
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const TASK_ID = /^[A-Za-z0-9-]{1,80}$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function readJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { detail: text.slice(0, 200) }; }
}

function hfError(status, data) {
  const d = data?.detail ?? data?.message ?? data?.error ?? 'Higgsfield API error';
  return `${status}: ${typeof d === 'string' ? d : JSON.stringify(d)}`;
}

async function uploadImage(file, authHeader) {
  const presign = await fetch(`${HF_BASE}/files/generate-upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
    body: JSON.stringify({ content_type: file.type }),
  });
  const p = await readJson(presign);
  if (!presign.ok || !p.upload_url || !p.public_url) {
    throw new Error('upload-url ' + hfError(presign.status, p));
  }
  const put = await fetch(p.upload_url, {
    method: 'PUT',
    headers: p.upload_headers || { 'Content-Type': file.type },
    body: await file.arrayBuffer(),
  });
  if (!put.ok) throw new Error(`image PUT failed (${put.status})`);
  return p.public_url;
}

async function fetchStatus(taskId, authHeader) {
  const st = await fetch(`${HF_BASE}/requests/${taskId}/status`, {
    headers: { 'Authorization': authHeader },
  });
  return { ok: st.ok, code: st.status, data: await readJson(st) };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const authHeader = `Key ${env.HF_API_KEY_ID}:${env.HF_API_KEY_SECRET}`;

    // Up to eight reference photos -> one reviewable image, using the documented Nano Banana contract.
    if (request.method === 'POST' && url.pathname === '/compose') {
      try {
        let form;
        try { form = await request.formData(); } catch { return json({ error: 'multipart form required' }, 400); }
        const photos = form.getAll('images');
        const prompt = String(form.get('prompt') || '').trim();
        const aspect = String(form.get('aspect_ratio') || '16:9');
        if (photos.length < 1 || photos.length > 8) return json({ error: 'one to eight reference photos required' }, 400);
        if (!prompt || prompt.length > 1800) return json({ error: 'prompt required (max 1800 characters)' }, 400);
        if (!['16:9', '9:16', '1:1'].includes(aspect)) return json({ error: 'invalid aspect ratio' }, 400);
        for (const file of photos) {
          if (!(file instanceof File) || !IMAGE_TYPES.has(file.type) || !file.size || file.size > MAX_IMAGE_BYTES) {
            return json({ error: 'each photo must be JPEG, PNG or WebP, between 1 byte and 10MB' }, 400);
          }
        }
        const inputImages = [];
        for (const file of photos) inputImages.push({ type: 'image_url', image_url: await uploadImage(file, authHeader) });
        const result = await fetch(`${HF_BASE}/nano-banana`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
          body: JSON.stringify({
            prompt: 'Create a single coherent photographic scene, not a collage or split screen. '
              + 'Use the supplied photos as subject references; include the referenced people, objects and places as described by the user. '
              + 'Keep the referenced subjects recognizable, with distinct faces and natural anatomy. '
              + 'Show the referenced subjects in the setting and action described below, composed as a starting frame for a video. '
              + 'User scene: ' + prompt,
            input_images: inputImages, num_images: 1, aspect_ratio: aspect, output_format: 'jpeg',
          }),
        });
        const data = await readJson(result);
        if (result.ok && data.request_id) return json({ task_id: data.request_id });
        return json({ error: hfError(result.status, data) }, 502);
      } catch { return json({ error: 'Scene service unavailable. Submission may have been accepted; do not retry automatically.' }, 502); }
    }

    if (request.method === 'GET' && ['/compose-status', '/compose-image'].includes(url.pathname)) {
      const taskId = url.searchParams.get('task_id') || '';
      if (!TASK_ID.test(taskId)) return json({ error: 'task_id required' }, 400);
      try {
        const { ok, code, data } = await fetchStatus(taskId, authHeader);
        if (!ok) return json({ error: hfError(code, data) }, 502);
        const imageUrl = data.images?.[0]?.url;
        if (['failed', 'nsfw', 'canceled'].includes(data.status)) return json({ status: 'failed', error: data.error || data.status });
        if (data.status !== 'completed') return json({ status: 'processing' });
        if (!imageUrl) return json({ status: 'failed', error: 'completed without image url' });
        if (url.pathname === '/compose-status') return json({ status: 'completed', image_url: imageUrl });
        // The client sends only a task ID, never an arbitrary download URL.
        const image = await fetch(imageUrl);
        if (!image.ok) return json({ error: 'Could not retrieve scene image' }, 502);
        return new Response(image.body, { headers: { ...CORS, 'Content-Type': image.headers.get('Content-Type') || 'image/jpeg' } });
      } catch { return json({ error: 'Scene status temporarily unavailable' }, 502); }
    }

    // POST /generate — multipart/form-data: image (file), prompt, duration (5|10)
    if (request.method === 'POST' && url.pathname === '/generate') {
      let form;
      try { form = await request.formData(); } catch { return json({ error: 'multipart form required' }, 400); }

      const file = form.get('image');
      const prompt = String(form.get('prompt') || '').trim();
      const duration = Number(form.get('duration'));
      if (![5, 10].includes(duration)) return json({ error: 'duration must be 5 or 10' }, 400);
      if (prompt.length > 2500) return json({ error: 'prompt too long (max 2500 characters)' }, 400);

      if (!prompt) return json({ error: 'prompt required' }, 400);
      if (!(file instanceof File) || !IMAGE_TYPES.has(file.type)) return json({ error: 'image must be JPEG, PNG or WebP' }, 400);
      if (file.size > MAX_IMAGE_BYTES) return json({ error: 'image too large (max 10MB)' }, 400);

      let imageUrl;
      try { imageUrl = await uploadImage(file, authHeader); }
      catch (e) { return json({ error: e.message }, 502); }

      const hfRes = await fetch(`${HF_BASE}/${MODEL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({ prompt, image_url: imageUrl, duration }),
      });
      const data = await readJson(hfRes);
      if (hfRes.ok && data.request_id) return json({ task_id: data.request_id });
      return json({ error: hfError(hfRes.status, data), hf_status: hfRes.status }, 502);
    }

    // GET /status?task_id=xxx
    if (request.method === 'GET' && url.pathname === '/status') {
      const taskId = url.searchParams.get('task_id') || '';
      if (!TASK_ID.test(taskId)) return json({ error: 'task_id required' }, 400);

      const { ok, code, data } = await fetchStatus(taskId, authHeader);
      if (!ok) return json({ error: hfError(code, data) }, 502);

      if (data.status === 'completed') {
        const videoUrl = data.video?.url;
        if (videoUrl) return json({ status: 'completed', video_url: videoUrl });
        return json({ status: 'failed', error: 'completed without video url' });
      }
      if (data.status === 'failed' || data.status === 'nsfw' || data.status === 'canceled') {
        return json({ status: 'failed', error: data.error || data.status });
      }
      return json({ status: 'processing', hf_status: data.status });
    }

    // GET /download?task_id=xxx — el Worker relee video.url; el cliente nunca manda URLs
    if (request.method === 'GET' && url.pathname === '/download') {
      const taskId = url.searchParams.get('task_id') || '';
      if (!TASK_ID.test(taskId)) return json({ error: 'task_id required' }, 400);

      const { ok, code, data } = await fetchStatus(taskId, authHeader);
      if (!ok) return json({ error: hfError(code, data) }, 502);
      const videoUrl = data.video?.url;
      if (data.status !== 'completed' || !videoUrl) return json({ error: `video not ready (${data.status})` }, 409);

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
