// Validation-only production probes: no report or uploaded image is created.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const config=fs.readFileSync(new URL('../public/gestao/config.js',import.meta.url),'utf8');
const url=config.match(/SUPABASE_URL:\s*"([^"]+)/)[1];const key=config.match(/SUPABASE_PUBLISHABLE_KEY:\s*"([^"]+)/)[1];
for (const [name,action,body,want,origin] of [
 ['missing admin session','list','{}',401,'https://cahk.app'],
 ['invalid admin token','list','{}',401,'https://cahk.app'],
 ['foreign origin','list','{}',403,'https://foreign.example'],
 ['invalid public text','submit',null,400,'https://cahk.app']
]){
 const f=new FormData();f.set('text','short');f.set('submission_key',crypto.randomUUID());
 const r=await fetch(url+'/functions/v1/cahk-denuncias?action='+action,{method:'POST',headers:{apikey:key,Origin:origin,...(name==='invalid admin token'?{Authorization:'Bearer invalid'}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body||f});
 assert.equal(r.status,want,`${name}: ${await r.text()}`);console.log(name, 'PASS',want);
}
