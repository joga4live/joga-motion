const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
const page=await browser.newPage({viewport:{width:1440,height:1100}});let submits=0,statuses=0,videoCalls=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfGQAAAAASUVORK5CYII=','base64');
await page.route('https://scene.test/**',r=>{const f=new URL(r.request().url()).pathname.slice(1)||'creator.html';return r.fulfill({body:fs.readFileSync(path.join(__dirname,'..',f)),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});});
await page.route('https://images.test/**',r=>r.fulfill({body:png,contentType:'image/png'}));
await page.route('https://fonts.googleapis.com/**',r=>r.abort());
await page.route('https://joga-motion-api.omhotien90.workers.dev/**',async r=>{
const u=new URL(r.request().url());
if(u.pathname==='/compose'){submits++;assert.match(r.request().postDataBuffer().toString(),/mountain/);return r.fulfill({json:{task_id:'scene-1'}});}
if(u.pathname==='/compose-status'){statuses++;return statuses===1?r.fulfill({status:502,json:{error:'temporary'}}):r.fulfill({json:{status:'completed',image_url:'https://images.test/result.png'}});}
if(u.pathname==='/compose-image')return r.fulfill({body:png,contentType:'image/png'});
if(u.pathname==='/generate')videoCalls++;
return r.abort();});
await page.goto('https://scene.test/creator.html');
assert.equal(await page.locator('#composeBtn').isEnabled(),false);
await page.setInputFiles('#refInput0',{name:'person.png',mimeType:'image/png',buffer:png});
await page.locator('#composePrompt').fill('A person on a mountain');assert.equal(await page.locator('#composeBtn').isEnabled(),true);
await page.setInputFiles('#refInput1',{name:'person.png',mimeType:'image/png',buffer:png});
await page.locator('#composePrompt').fill('Both people walking on a mountain');
await page.locator('#lang-toggle').click();assert.equal(await page.locator('#composeTitle').textContent(),'Your photos. Your story.');assert.equal(await page.locator('#composePrompt').inputValue(),'Both people walking on a mountain');
await page.locator('#composeBtn').click();await page.waitForFunction(()=>!state.busy);assert.equal(await page.evaluate(()=>composition.phase),'waiting');
await page.locator('#composeBtn').click();await page.waitForFunction(()=>!state.busy);assert.equal(submits,1);assert.equal(await page.locator('#composePreview').isVisible(),true);
await page.locator('#useComposition').click();await page.waitForFunction(()=>!state.busy);assert.equal(await page.locator('.scene-row').count(),1);assert.equal(await page.locator('#promptInput').inputValue(),'Both people walking on a mountain');assert.equal(videoCalls,0);assert.equal(await page.locator('#useComposition').isEnabled(),false);
await page.locator('#composePrompt').fill('A different scene');assert.equal(await page.locator('#composePreview').isVisible(),false);assert.equal(await page.locator('.scene-row').count(),1);
await page.setInputFiles('#refInput0',{name:'bad.gif',mimeType:'image/gif',buffer:png});assert.equal(await page.evaluate(()=>composition.files[0].name),'person.png');
await page.locator('#lang-toggle').click();assert.equal(await page.locator('#composeTitle').textContent(),'Tus fotos. Tu historia.');
await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.resolve(__dirname,'../../../outputs/estudio-dos-personas.png'),fullPage:true});
await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
assert.deepEqual(errors,[]);console.log('PASS: two photos, bilingual form, resume without duplicate jobs, preview approval, prompt transfer, no automatic video charge, mobile layout');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
