import assert from 'node:assert/strict';
import worker from '../worker.js';
const env={HF_API_KEY_ID:'test',HF_API_KEY_SECRET:'test',FAL_KEY:'test-fal-key'};
const saved=globalThis.fetch;
let calls=[],falStatusValue='COMPLETED',falEditError=null,falStatusError=null,
    initiateStatus=null,initiatePutStatus=null,falResultOverride=null,
    hfPresignStatus=null,hfPutStatuses=null;
globalThis.fetch=async (url,opts={})=>{
 calls.push({url,opts});
 if(url.startsWith('https://rest.fal.ai/storage/upload/initiate')){
  assert.equal(opts.headers['Authorization'],'Key test-fal-key');
  if(initiateStatus)return Response.json({detail:'Invalid credentials'},{status:initiateStatus});
  return Response.json({file_url:'https://v3b.fal.media/files/x.png',upload_url:'https://up.test/x'});
 }
 if(url==='https://up.test/x'){
  assert.equal(opts.headers['Authorization'],undefined);
  assert.equal(opts.headers['Content-Type'],'image/jpeg');
  if(initiatePutStatus)return new Response('',{status:initiatePutStatus});
  return new Response('');
 }
 if(url.endsWith('/files/generate-upload-url')){
  if(hfPresignStatus)return Response.json({detail:'Invalid credentials'},{status:hfPresignStatus});
  return Response.json({upload_url:'https://hf-upload.test/file',public_url:'https://images.test/ref.jpg'});
 }
 if(url==='https://hf-upload.test/file'){
  const status=(hfPutStatuses&&hfPutStatuses.length)?hfPutStatuses.shift():200;
  return new Response('',{status});
 }
 if(url.endsWith('/kling-video/v2.1/pro/image-to-video'))return Response.json({request_id:'hf-task-1'});
 if(url.endsWith('/fal-ai/nano-banana/edit')){
  if(falEditError)return Response.json({detail:falEditError.detail},{status:falEditError.status});
  let d=JSON.parse(opts.body);
  assert.ok(Array.isArray(d.image_urls)&&d.image_urls.length>0&&d.image_urls.every(u=>u==='https://v3b.fal.media/files/x.png'));
  assert.match(d.prompt,/mountain/);assert.equal(d.aspect_ratio,'9:16');assert.equal(d.num_images,1);assert.equal(d.output_format,'jpeg');
  return Response.json({request_id:'01a0-test',status_url:'https://queue.fal.run/fal-ai/nano-banana/requests/01a0-test/status',response_url:'https://queue.fal.run/fal-ai/nano-banana/requests/01a0-test'});
 }
 if(url.endsWith('/fal-ai/nano-banana/requests/01a0-test/status')){
  if(falStatusError)return Response.json({status:'COMPLETED',error:falStatusError.error,error_type:falStatusError.error_type});
  return Response.json({status:falStatusValue});
 }
 if(url.endsWith('/fal-ai/nano-banana/requests/01a0-test')){
  if(falResultOverride)return Response.json(falResultOverride.body,{status:falResultOverride.status});
  return Response.json({images:[{url:'https://v3b.fal.media/x.jpg'}]});
 }
 if(url==='https://v3b.fal.media/x.jpg')return new Response('image',{headers:{'Content-Type':'image/jpeg'}});
 throw new Error('Unexpected URL '+url);
};
function form(n=1){let f=new FormData();for(let i=0;i<n;i++)f.append('images',new File(['image'],'person.jpg',{type:'image/jpeg'}));f.append('prompt','on a mountain at sunset');f.append('aspect_ratio','9:16');return f;}
function generateForm(){let f=new FormData();f.append('image',new File(['image'],'person.jpg',{type:'image/jpeg'}));f.append('prompt','a scene');f.append('duration','5');return f;}
try{
 let r=await worker.fetch(new Request('https://worker/compose',{method:'POST',body:form(0)}),env);assert.equal(r.status,400);assert.equal(calls.length,0);
 r=await worker.fetch(new Request('https://worker/compose',{method:'POST',body:form(9)}),env);assert.equal(r.status,400);assert.equal(calls.length,0);
 r=await worker.fetch(new Request('https://worker/compose',{method:'POST',body:form(1)}),env);assert.equal((await r.json()).task_id,'01a0-test');assert.equal(calls.length,3);
 assert.ok(calls.every(c=>!c.url.includes('api.higgsfield.ai')),'compose must never call Higgsfield');
 calls=[];
 r=await worker.fetch(new Request('https://worker/compose',{method:'POST',body:form(2)}),env);assert.equal((await r.json()).task_id,'01a0-test');assert.equal(calls.length,5);
 calls=[];
 r=await worker.fetch(new Request('https://worker/compose',{method:'POST',body:form(1)}),{HF_API_KEY_ID:'test',HF_API_KEY_SECRET:'test'});assert.equal(r.status,502);assert.match((await r.json()).error,/FAL_KEY missing/);assert.equal(calls.length,0);
 falEditError={status:422,detail:'bad image'};
 r=await worker.fetch(new Request('https://worker/compose',{method:'POST',body:form(1)}),env);assert.equal(r.status,502);assert.match((await r.json()).error,/bad image/);
 falEditError=null;
 initiateStatus=401;
 r=await worker.fetch(new Request('https://worker/compose',{method:'POST',body:form(1)}),env);assert.equal(r.status,502);assert.match((await r.json()).error,/fal upload-url 401/);
 initiateStatus=null;
 initiatePutStatus=500;
 r=await worker.fetch(new Request('https://worker/compose',{method:'POST',body:form(1)}),env);assert.equal(r.status,502);assert.match((await r.json()).error,/fal image PUT failed \(500\)/);
 initiatePutStatus=null;
 falStatusValue='IN_PROGRESS';
 r=await worker.fetch(new Request('https://worker/compose-status?task_id=01a0-test'),env);assert.equal((await r.json()).status,'processing');
 falStatusValue='COMPLETED';
 falStatusError={error:'content policy',error_type:'CONTENT_FILTER'};
 calls=[];
 r=await worker.fetch(new Request('https://worker/compose-status?task_id=01a0-test'),env);
 assert.deepEqual(await r.json(),{status:'failed',error:'CONTENT_FILTER: content policy'});
 assert.equal(calls.length,1);
 falStatusError=null;
 // fal's own content filter: COMPLETED without error/error_type, but the result read is a 422 with an array `detail`.
 falResultOverride={status:422,body:{detail:[{loc:['body','prompt'],msg:'The content could not be processed because it contained material flagged by a content checker.',type:'content_policy_violation',url:'https://docs.fal.ai/errors#content_policy_violation',input:{prompt:'DONOTLEAK barefoot woman walks on a beach at sunrise DONOTLEAK'}}]}};
 r=await worker.fetch(new Request('https://worker/compose-status?task_id=01a0-test'),env);
 const filtered=await r.json();
 assert.deepEqual(filtered,{status:'failed',error:'content_policy_violation: The content could not be processed because it contained material flagged by a content checker.'});
 assert.ok(!JSON.stringify(filtered).includes('DONOTLEAK'),'the rejected prompt must never leak into the error text');
 falResultOverride={status:503,body:{detail:'temporarily unavailable'}};
 r=await worker.fetch(new Request('https://worker/compose-status?task_id=01a0-test'),env);assert.equal(r.status,502);assert.match((await r.json()).error,/503: temporarily unavailable/);
 falResultOverride=null;
 r=await worker.fetch(new Request('https://worker/compose-image?task_id=../bad'),env);assert.equal(r.status,400);
 r=await worker.fetch(new Request('https://worker/compose-image?task_id=01a0-test'),env);assert.equal(r.headers.get('Content-Type'),'image/jpeg');assert.equal(await r.text(),'image');
 // /generate stays on Higgsfield; a single 5xx/524 PUT retries once before giving up.
 hfPutStatuses=[524,200];
 r=await worker.fetch(new Request('https://worker/generate',{method:'POST',body:generateForm()}),env);assert.equal((await r.json()).task_id,'hf-task-1');
 hfPutStatuses=[524,524];
 r=await worker.fetch(new Request('https://worker/generate',{method:'POST',body:generateForm()}),env);assert.equal(r.status,502);assert.match((await r.json()).error,/image PUT failed \(524\)/);
 hfPutStatuses=null;
 console.log('PASS: fal.ai storage upload for /compose, readable fal errors (content-policy and transient), and /generate PUT retry');
}finally{globalThis.fetch=saved;}
