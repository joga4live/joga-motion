const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));let images=0,videos=0,checks=0;
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfGQAAAAASUVORK5CYII=','base64');
 await page.route('https://studio.test/**',r=>{const f=new URL(r.request().url()).pathname.slice(1)||'creator.html';return r.fulfill({body:fs.readFileSync(path.join(__dirname,'..',f)),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});});
 await page.route('https://fonts.googleapis.com/**',r=>r.abort());
 await page.route('https://joga-motion-api.omhotien90.workers.dev/**',async r=>{const p=new URL(r.request().url()).pathname;
 if(p==='/compose'){images++;const body=r.request().postDataBuffer().toString();assert.equal((body.match(/name="images"/g)||[]).length,8);assert.match(body,/mountain/);return r.fulfill({json:{task_id:'image-1'}});}
 if(p==='/compose-status')return r.fulfill({json:{status:'completed',image_url:'https://media.test/scene.png'}});
 if(p==='/compose-image')return r.fulfill({body:png,contentType:'image/png'});
 if(p==='/generate'){videos++;assert.match(r.request().postDataBuffer().toString(),/mountain/);return r.fulfill({json:{task_id:'video-1'}});}
 if(p==='/status'){checks++;return checks===1?r.fulfill({status:502,json:{error:'outage'}}):r.fulfill({json:{status:'completed',video_url:'https://media.test/video.mp4'}});}
 return r.abort();});
 await page.route('https://media.test/**',r=>r.fulfill({status:204}));
 await page.goto('https://studio.test/creator.html');
 await page.screenshot({path:path.resolve(__dirname,'../../../outputs/joga-motion-unificado.png'),fullPage:true});
 assert.equal(await page.locator('textarea').count(),1);assert.equal(await page.locator('input[type=file]').count(),1);assert.equal(await page.locator('#create').isEnabled(),false);
 const photos=Array.from({length:9},(_,i)=>({name:'photo'+i+'.png',mimeType:'image/png',buffer:png}));
 await page.setInputFiles('#photos',photos);assert.equal(await page.locator('.thumbnail').count(),8);assert.equal(await page.locator('#message').textContent(),'Puedes añadir hasta 8 imágenes.');
 await page.locator('#description').fill('Together on a mountain');await page.locator('#language').click();assert.equal(await page.locator('#description').inputValue(),'Together on a mountain');
 await page.locator('#create').click();await page.waitForFunction(()=>!studio.busy);assert.equal(images,1);assert.equal(videos,1);assert.match(await page.locator('#message').textContent(),/interrupted/);
 await page.locator('#create').click();await page.waitForFunction(()=>!studio.busy);assert.equal(images,1);assert.equal(videos,1);assert.equal(await page.locator('#video').isVisible(),true);assert.match(await page.locator('#download').getAttribute('href'),/download\?task_id=video-1/);
 await page.locator('#description').fill('Changed action');assert.equal(await page.locator('#video').isVisible(),false);assert.equal(await page.evaluate(()=>studio.videoTask),null);
 await page.locator('.thumbnail button').first().click();assert.equal(await page.locator('.thumbnail').count(),7);
 await page.setInputFiles('#photos',{name:'bad.gif',mimeType:'image/gif',buffer:png});assert.equal(await page.locator('.thumbnail').count(),7);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:path.resolve(__dirname,'../../../outputs/joga-motion-unificado-movil.png'),fullPage:true});assert.deepEqual(errors,[]);
 console.log('PASS: single upload and prompt, 8-photo limit, bilingual inputs, image-to-video pipeline, retry without duplicate charges, download, invalidation and mobile layout');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
