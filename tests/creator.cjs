// Run: NODE_PATH=/path/to/node_modules node tests/creator.cjs
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error') console.log(msg.text()); });
  let submits = [], statuses = 0, clip;
  await page.route('https://motion.test/**', route => {
    const name = new URL(route.request().url()).pathname.slice(1) || 'creator.html';
    route.fulfill({body: fs.readFileSync(path.join(__dirname, '..', name)), contentType: name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html'});
  });
  await page.route('https://joga-motion-api.omhotien90.workers.dev/**', async route => {
    const url = route.request().url();
    if (url.includes('/generate')) {
      submits.push(route.request().postDataBuffer().toString());
      return route.fulfill({json: {task_id: 'task-' + submits.length}});
    }
    if (url.includes('/status')) {
      statuses++;
      // First task temporarily fails to respond; resuming must not resubmit it.
      if (statuses === 1) return route.fulfill({status: 503, json: {error: 'Temporary outage'}});
      return route.fulfill({json: {status: 'completed', video_url: 'https://motion.test/clip.webm'}});
    }
    if (url.includes('/download') && clip) return route.fulfill({body:clip, contentType:'video/webm'});
    return route.abort();
  });
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto('https://motion.test/creator.html', {waitUntil: 'domcontentloaded'});
  console.log('Page loaded');

  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfGQAAAAASUVORK5CYII=', 'base64');
  await page.setInputFiles('#fileInput', [1,2].map(n => ({name: `image${n}.png`, mimeType: 'image/png', buffer: image})));
  await page.locator('#promptInput').fill('Second scene');
  await page.locator('[data-dur="10"]').click();
  await page.locator('[data-style="pan"]').click();
  await page.locator('.scene-select').first().click();
  await page.locator('#promptInput').fill('First scene');
  await page.locator('#lang-toggle').click();
  assert.equal(await page.locator('#promptInput').inputValue(), 'First scene');
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('#exportBtn').textContent(), 'JOIN AND EXPORT VIDEO');
  await page.locator('#lang-toggle').click();
  assert.equal(await page.locator('html').getAttribute('lang'), 'es');
  assert.equal(await page.locator('#exportBtn').textContent(), 'UNIR Y EXPORTAR VIDEO');
  assert.equal(await page.locator('#promptInput').inputValue(), 'First scene');
  await page.locator('#lang-toggle').click();
  await page.locator('.scene-select').nth(1).click();
  assert.equal(await page.locator('#promptInput').inputValue(), 'Second scene');
  assert.equal(await page.locator('.d-btn.on').getAttribute('data-dur'), '10');
  await page.locator('.scene-row').nth(1).getByRole('button', {name:'Move earlier', exact:true}).click();
  await page.locator('#genBtn').click();
  await page.waitForFunction(() => state.scenes.some(s => s.taskId));
  await page.waitForTimeout(5500);
  await page.waitForFunction(() => !state.busy, null, {timeout: 15000});
  assert.equal(submits.length, 1);
  assert.match(submits[0], /Second scene/);
  await page.locator('#genBtn').click();
  await page.waitForFunction(() => state.scenes.some(s => s.taskId));
  await page.waitForTimeout(5500);
  await page.waitForFunction(() => state.scenes[0].status === 'completed');
  await page.waitForFunction(() => state.scenes.some(s => s.taskId));
  await page.waitForTimeout(5500);
  await page.waitForFunction(() => !state.busy, null, {timeout: 15000});
  assert.equal(submits.length, 2, 'resume must not duplicate submission');
  assert.equal(await page.locator('#exportBtn').isEnabled(), true);
  // Real encoded test footage exercises the actual browser assembly path.
  clip = Buffer.from(await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width=160; c.height=90;
    const ctx = c.getContext('2d'); ctx.fillStyle='red'; ctx.fillRect(0,0,160,90);
    const stream = c.captureStream(0), recorder = new MediaRecorder(stream, {mimeType:'video/webm'}), chunks=[];
    recorder.ondataavailable = e => chunks.push(e.data);
    const done = new Promise(resolve => recorder.onstop=resolve);
    recorder.start();
    for(let i=0;i<60;i++) {ctx.fillStyle=i%2?'red':'blue';ctx.fillRect(0,0,160,90);stream.getVideoTracks()[0].requestFrame();await new Promise(r=>setTimeout(r,30));}
    recorder.stop(); await done; stream.getTracks().forEach(t=>t.stop());
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  }));
  fs.writeFileSync('/tmp/joga-test-clip.webm', clip);
  await page.locator('#exportBtn').click();
  await page.waitForFunction(() => !state.busy, null, {timeout:20000});
  assert.equal(await page.evaluate(() => Boolean(state.resultUrl)), true, 'assembly produces a downloadable video: ' + await page.locator('#toast').textContent());
  assert.equal(await page.evaluate(async () => (await (await fetch(state.resultUrl)).blob()).size > 0), true);
  await page.locator('#promptInput').fill('Changed scene');
  assert.equal(await page.locator('#exportBtn').isEnabled(), false);
  assert.equal(await page.evaluate(() => state.scenes[1].status), 'completed');
  await page.setInputFiles('#fileInput', {name:'bad.gif', mimeType:'image/gif', buffer: image});
  assert.equal(await page.locator('.scene-row').count(), 2);
  assert.equal(await page.locator('#toast').textContent(), 'bad.gif: Invalid format. Use JPG, PNG or WebP.');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({path:'/tmp/joga-motion-mobile.png', fullPage:true});
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS: scene inputs, ordering, language, multipart, resumable polling, invalidation, validation, mobile layout');
})().catch(err => {console.error(err); process.exit(1);});
