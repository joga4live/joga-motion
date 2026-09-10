import assert from 'node:assert/strict';
import worker from '../worker.js';
const env={HF_API_KEY_ID:'test',HF_API_KEY_SECRET:'test'};
const saved=globalThis.fetch;let calls=[],outage=false,finished=true;
globalThis.fetch=async (url,opts={})=>{
 calls.push({url,opts});
 if(url.endsWith('/files/generate-upload-url'))return Response.json({upload_url:'https://upload.test/file',public_url:'https://images.test/ref.jpg'});
 if(url.startsWith('https://upload.test/'))return new Response('');
 if(url.endsWith('/higgsfield-ai/soul/reference')){let d=JSON.parse(opts.body);assert.equal(d.image_reference_url,'https://images.test/ref.jpg');assert.match(d.prompt,/mountain/);assert.equal(d.aspect_ratio,'9:16');assert.equal(d.resolution,'720p');assert.equal(d.batch_size,1);return Response.json({request_id:'scene-1'});}
 if(url.endsWith('/status'))return outage?Response.json({error:'outage'},{status:503}):Response.json(finished?{status:'completed',images:[{url:'https://images.test/result.jpg'}]}:{status:'in_progress'});
 if(url==='https://images.test/result.jpg')return new Response('image',{headers:{'Content-Type':'image/jpeg'}});
 throw new Error('Unexpected URL '+url);
};
function form(n=1){let f=new FormData();for(let i=0;i<n;i++)f.append('images',new File(['image'],'person.jpg',{type:'image/jpeg'}));f.append('prompt','on a mountain at sunset');f.append('aspect_ratio','9:16');return f;}
try{
 let r=await worker.fetch(new Request('https://worker/compose',{method:'POST',body:form(0)}),env);assert.equal(r.status,400);assert.equal(calls.length,0);
 r=await worker.fetch(new Request('https://worker/compose',{method:'POST',body:form(2)}),env);assert.equal(r.status,400);assert.equal(calls.length,0);
 r=await worker.fetch(new Request('https://worker/compose',{method:'POST',body:form(1)}),env);assert.equal((await r.json()).task_id,'scene-1');assert.equal(calls.length,3);
 r=await worker.fetch(new Request('https://worker/compose-status?task_id=scene-1'),env);assert.equal((await r.json()).image_url,'https://images.test/result.jpg');
 outage=true;r=await worker.fetch(new Request('https://worker/compose-status?task_id=scene-1'),env);assert.equal(r.status,502);assert.equal((await r.json()).status,undefined);outage=false;
 r=await worker.fetch(new Request('https://worker/compose-image?task_id=scene-1&url=https://untrusted.test'),env);assert.equal(r.headers.get('Content-Type'),'image/jpeg');assert.equal(await r.text(),'image');assert.ok(calls.every(c=>!c.url.includes('untrusted')));
 r=await worker.fetch(new Request('https://worker/compose-image?task_id=../bad'),env);assert.equal(r.status,400);
 console.log('PASS: single reference contract, validation, result retrieval, transient failures and trusted image download');
}finally{globalThis.fetch=saved;}
