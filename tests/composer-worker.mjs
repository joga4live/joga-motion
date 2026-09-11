import assert from 'node:assert/strict';
import worker from '../worker.js';
const env={HF_API_KEY_ID:'test',HF_API_KEY_SECRET:'test',FAL_KEY:'test-fal-key'};
const saved=globalThis.fetch;let calls=[],falStatusValue='COMPLETED',falEditError=null;
globalThis.fetch=async (url,opts={})=>{
 calls.push({url,opts});
 if(url.endsWith('/files/generate-upload-url'))return Response.json({upload_url:'https://upload.test/file',public_url:'https://images.test/ref.jpg'});
 if(url.startsWith('https://upload.test/'))return new Response('');
 if(url.endsWith('/fal-ai/nano-banana/edit')){
  if(falEditError)return Response.json({detail:falEditError.detail},{status:falEditError.status});
  let d=JSON.parse(opts.body);
  assert.ok(Array.isArray(d.image_urls)&&d.image_urls.length>0&&d.image_urls.every(u=>u==='https://images.test/ref.jpg'));
  assert.match(d.prompt,/mountain/);assert.equal(d.aspect_ratio,'9:16');assert.equal(d.num_images,1);assert.equal(d.output_format,'jpeg');
  return Response.json({request_id:'01a0-test',status_url:'https://queue.fal.run/fal-ai/nano-banana/requests/01a0-test/status',response_url:'https://queue.fal.run/fal-ai/nano-banana/requests/01a0-test'});
 }
 if(url.endsWith('/fal-ai/nano-banana/requests/01a0-test/status'))return Response.json({status:falStatusValue});
 if(url.endsWith('/fal-ai/nano-banana/requests/01a0-test'))return Response.json({images:[{url:'https://v3b.fal.media/x.jpg'}]});
 if(url==='https://v3b.fal.media/x.jpg')return new Response('image',{headers:{'Content-Type':'image/jpeg'}});
 throw new Error('Unexpected URL '+url);
};
function form(n=1){let f=new FormData();for(let i=0;i<n;i++)f.append('images',new File(['image'],'person.jpg',{type:'image/jpeg'}));f.append('prompt','on a mountain at sunset');f.append('aspect_ratio','9:16');return f;}
try{
 let r=await worker.fetch(new Request('https://worker/compose',{method:'POST',body:form(0)}),env);assert.equal(r.status,400);assert.equal(calls.length,0);
 r=await worker.fetch(new Request('https://worker/compose',{method:'POST',body:form(9)}),env);assert.equal(r.status,400);assert.equal(calls.length,0);
 r=await worker.fetch(new Request('https://worker/compose',{method:'POST',body:form(1)}),env);assert.equal((await r.json()).task_id,'01a0-test');assert.equal(calls.length,3);
 calls=[];
 r=await worker.fetch(new Request('https://worker/compose',{method:'POST',body:form(2)}),env);assert.equal((await r.json()).task_id,'01a0-test');assert.equal(calls.length,5);
 calls=[];
 r=await worker.fetch(new Request('https://worker/compose',{method:'POST',body:form(1)}),{HF_API_KEY_ID:'test',HF_API_KEY_SECRET:'test'});assert.equal(r.status,502);assert.match((await r.json()).error,/FAL_KEY missing/);assert.equal(calls.length,0);
 falEditError={status:422,detail:'bad image'};
 r=await worker.fetch(new Request('https://worker/compose',{method:'POST',body:form(1)}),env);assert.equal(r.status,502);assert.match((await r.json()).error,/bad image/);
 falEditError=null;
 falStatusValue='IN_PROGRESS';
 r=await worker.fetch(new Request('https://worker/compose-status?task_id=01a0-test'),env);assert.equal((await r.json()).status,'processing');
 falStatusValue='COMPLETED';
 r=await worker.fetch(new Request('https://worker/compose-image?task_id=../bad'),env);assert.equal(r.status,400);
 r=await worker.fetch(new Request('https://worker/compose-image?task_id=01a0-test'),env);assert.equal(r.headers.get('Content-Type'),'image/jpeg');assert.equal(await r.text(),'image');
 console.log('PASS: fal.ai nano-banana/edit image contract, one-to-eight validation, FAL_KEY guard, transient failures and trusted image download');
}finally{globalThis.fetch=saved;}
