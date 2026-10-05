import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../supabase/functions/cahk-denuncias/handler.js';
import { validateSubmission, validateImage, cleanJpeg } from '../supabase/functions/cahk-denuncias/core.js';

const origin='https://cahk.app';
const key='12345678-1234-4234-8234-123456789012';
const uuid='11111111-1111-4111-8111-111111111111';
const jpeg=new Uint8Array([255,216,255,224,0,6,65,66,67,68,255,218,0,2,1,2,255,217]);
function form(text='Relato de uma situação ocorrida no campus.',files=[]){const f=new FormData();f.set('text',text);f.set('submission_key',key);for(const b of files)f.append('images',new Blob([b],{type:'image/jpeg'}),'foto.jpg');return f;}
function request(action='submit',body=form(),token=''){return new Request(`https://backend.test/?action=${action}`,{method:'POST',headers:{origin,...(token?{Authorization:`Bearer ${token}`}:{})},body:body instanceof FormData?body:JSON.stringify(body)});}
function fixture({role='admin',active=true,uploadFail=false,saveFail=false,uncertainSave=false,lostUploadOnce=false,rate=true}={}){
 const state={reports:[],files:new Set(),history:[]};
 async function fetcher(url,opts={}){
  const u=new URL(url),p=u.pathname,m=opts.method||'GET',body=typeof opts.body==='string'?JSON.parse(opts.body):opts.body;
  const json=(x,s=200)=>Response.json(x,{status:s});
  if(p==='/auth/v1/user')return opts.headers.Authorization==='Bearer valid'?json({id:uuid}):json({error:'invalid'},401);
  if(p==='/rest/v1/profiles')return json([{id:uuid,role,ativo:active}]);
  if(p==='/rest/v1/rpc/cahk_complaint_take_slot')return json(rate);
  if(p==='/rest/v1/cahk_complaints'){
   if(m==='POST'){if(state.reports.some(r=>r.id===body.id))return json({message:'duplicate'},409);if(saveFail)return json({message:'db offline'},503);const row={...body,protocol:'CAHK-000001',created_at:'2026-10-02T22:00:00Z',version:1,status:'recebida',internal_notes:''};state.reports.push(row);if(uncertainSave)return json({message:"timeout"},503);return json([row],201);}
   if(uncertainSave&&state.reports.length)throw Error('connection lost');
   const id=u.searchParams.get('id')?.slice(3),k=u.searchParams.get('submission_key')?.slice(3);
   return json(state.reports.filter(r=>(!id||r.id===id)&&(!k||r.submission_key===k)));
  }
  if(p==='/rest/v1/cahk_complaint_history')return json(state.history);
  if(p==='/rest/v1/rpc/cahk_complaint_update')return json(null);
  if(p.startsWith('/storage/v1/object/cahk-private-complaints/')){if(uploadFail)return json({error:'failure'},500);const storagePath=p.split('/cahk-private-complaints/')[1];if(state.files.has(storagePath))return json({error:'duplicate'},409);state.files.add(storagePath);if(lostUploadOnce){lostUploadOnce=false;throw Error('lost upload response');}return json({Key:'file'},200);}
  if(p==='/storage/v1/object/cahk-private-complaints'&&m==='DELETE'){for(const path of body.prefixes)state.files.delete(path);return json([]);}
  if(p.startsWith('/storage/v1/object/sign/'))return json({signedURL:'/storage/v1/object/sign/example?token=secret'});
  throw Error(`unexpected ${m} ${p}`);
 }
 return {state,handler:createHandler({url:'https://backend.test',serviceKey:'server-only-secret',fetcher,origins:[origin],now:()=>Date.parse('2026-10-02T22:00:00Z')})};
}
test('rejects empty, too short and too long text; accepts legitimate reports',async()=>{
 for(const t of ['', '123', 'a'.repeat(10001)])assert.throws(()=>validateSubmission(t,key,[]));
 assert.equal(validateSubmission('a'.repeat(20),key,[]).text.length,20);
 assert.throws(()=>validateSubmission('a'.repeat(20),'invalid',[]));
 assert.throws(()=>validateSubmission('a'.repeat(20),key,[1,2,3,4]));
});
test('rejects active content pretending to be a photograph and empty images',()=>{
 assert.throws(()=>validateImage(new TextEncoder().encode('<svg onload="alert(1)">'),'image/jpeg'));
 assert.throws(()=>validateImage(new Uint8Array(), 'image/jpeg'));
 assert.throws(()=>validateImage(new Uint8Array(2*1024*1024+1),'image/jpeg'));
 assert.equal(validateImage(jpeg,'image/jpeg'),'jpg');
});
test('removes JPEG application metadata while preserving image payload',()=>{
 assert.deepEqual([...cleanJpeg(jpeg)],[255,216,255,218,0,2,1,2,255,217]);
 assert.throws(()=>cleanJpeg(new Uint8Array([255,216,255,225,255,255])));
});
test('admin endpoint blocks missing, invalid, inactive and ordinary profiles',async()=>{
 for(const [args,token,status] of [[{},'',401],[{},'wrong',401],[{role:'caixa'},'valid',403],[{active:false},'valid',403]]){
  const {handler}=fixture(args);const r=await handler(request('list',{page:0},token));assert.equal(r.status,status);assert.equal((await r.json()).items,undefined);
 }
});
test('accepts text without image and returns receipt only after persisted',async()=>{
 const {handler,state}=fixture();const r=await handler(request());assert.equal(r.status,201);assert.equal((await r.json()).protocol,'CAHK-000001');assert.equal(state.reports.length,1);assert.equal(state.files.size,0);
 assert.equal(state.reports[0].sender_id,undefined);assert.equal(state.reports[0].ip,undefined);
});
test('retries return same receipt without duplicate records; altered retry rejected',async()=>{
 const {handler,state}=fixture();await handler(request());const r=await handler(request());assert.equal(r.status,200);assert.equal((await r.json()).protocol,'CAHK-000001');assert.equal(state.reports.length,1);
 assert.equal((await handler(request('submit',form('Um relato completamente diferente aqui.')))).status,409);
});
test('image upload failure never confirms receipt',async()=>{
 const {handler,state}=fixture({uploadFail:true});const r=await handler(request('submit',form(undefined,[jpeg])));assert.equal(r.status,503);assert.equal(state.reports.length,0);
});
test('ambiguous database failure preserves private image and never confirms receipt',async()=>{
 const {handler,state}=fixture({saveFail:true});const r=await handler(request('submit',form(undefined,[jpeg])));assert.equal(r.status,503);assert.equal(state.reports.length,0);assert.equal(state.files.size,1);
});
test('foreign origins, abuse and invalid body are rejected',async()=>{
 const {handler}=fixture();assert.equal((await handler(new Request('https://backend.test/?action=submit',{method:'POST',headers:{origin:'https://evil.test'},body:form()}))).status,403);
 assert.equal((await fixture({rate:false}).handler(request())).status,429);
 assert.equal((await handler(request('submit',form('short')))).status,400);
});
test('admin edit conflict is reported instead of overwriting a newer record',async()=>{
 const {handler}=fixture();const r=await handler(request('update',{id:uuid,version:1,status:'encerrada',notes:'Registro interno.'},'valid'));assert.equal(r.status,409);
});

test('lost insert response and failed reconciliation never delete committed evidence',async()=>{
 const {handler,state}=fixture({uncertainSave:true});const r=await handler(request('submit',form(undefined,[jpeg])));assert.equal(r.status,503);assert.equal(state.reports.length,1);assert.equal(state.files.size,1);
});

test('retry succeeds after a stored upload response is lost',async()=>{
 const {handler,state}=fixture({lostUploadOnce:true});assert.equal((await handler(request('submit',form(undefined,[jpeg])))).status,503);const retry=await handler(request('submit',form(undefined,[jpeg])));assert.equal(retry.status,201);assert.equal(state.reports.length,1);assert.equal(state.files.size,2);
});
test('simultaneous identical submissions create one report and remove duplicate attempt images',async()=>{
 const {handler,state}=fixture();const responses=await Promise.all([handler(request('submit',form(undefined,[jpeg]))),handler(request('submit',form(undefined,[jpeg])))]);for(const r of responses)assert.ok([200,201].includes(r.status));assert.equal(state.reports.length,1);assert.equal(state.files.size,1);
});
