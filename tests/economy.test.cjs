const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=require('node:path').resolve(__dirname,'../public');
function setup(shared=new Map()){
 let now=Date.parse('2026-10-05T18:00:00Z');
 const FakeDate=class extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
 const c={window:{},Date:FakeDate,Map,localStorage:{getItem:k=>shared.get(k)||null,setItem:(k,v)=>shared.set(k,v),removeItem:k=>shared.delete(k)}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(root+'/public-cache.js','utf8'),c);
 return {cache:c.window.CAHKPublicCache,advance:n=>now+=n,shared};
}
test('daily RU cache survives navigation, is shared between pages and expires next day',async()=>{
 const a=setup();let calls=0;const load=async()=>({ru:{date:'2026-10-05'},n:++calls});
 assert.equal((await a.cache.get('campus:'+a.cache.day(),86400000,load)).n,1);
 const b=setup(a.shared);assert.equal((await b.cache.get('campus:'+b.cache.day(),86400000,load)).n,1);
 b.advance(86400000);await b.cache.get('campus:'+b.cache.day(),86400000,load);assert.equal(calls,2);
});
test('cache coalesces concurrent requests, expires and retries errors only after cooldown',async()=>{
 const a=setup();let calls=0;const load=async()=>({n:++calls});
 await Promise.all([a.cache.get('events',600000,load),a.cache.get('events',600000,load)]);assert.equal(calls,1);
 a.advance(600001);await a.cache.get('events',600000,load);assert.equal(calls,2);
 let failures=0;const fail=async()=>{failures++;throw Object.assign(new Error('Quota'),{status:402});};
 await assert.rejects(a.cache.get('weather',600000,fail));await assert.rejects(a.cache.get('weather',600000,fail));assert.equal(failures,1);
 const b=setup(a.shared);await assert.rejects(b.cache.get('weather',600000,fail));assert.equal(failures,1);
 a.advance(6*3600000+1);await assert.rejects(a.cache.get('weather',600000,fail));assert.equal(failures,2);
});
test('radio schedule polling cannot call more than once a minute and pauses after quota error',async()=>{
 const source=fs.readFileSync(root+'/radio/player.html','utf8');
 const part=source.slice(source.indexOf('async function checkScheduled()'),source.indexOf('function prepareScheduled'));
 let calls=0,now=100000;
 const c={started:true,scheduledActive:false,scheduledPending:null,scheduleCheckLock:false,scheduleNextCheckAt:0,radioPausedUntil:0,Date:{now:()=>now},console:{warn:()=>{}},prepareScheduled:()=>{},fn:async()=>{calls++;return {type:'none'};}};
 vm.createContext(c);vm.runInContext(part,c);
 await c.checkScheduled();await c.checkScheduled();now+=59999;await c.checkScheduled();assert.equal(calls,1);
 now++;await c.checkScheduled();assert.equal(calls,2);
 c.radioPausedUntil=now+21600000;now+=60000;await c.checkScheduled();assert.equal(calls,2);
});
test('radio quota failure blocks further network calls for six hours',async()=>{
 const source=fs.readFileSync(root+'/radio/player.html','utf8');
 const part=source.slice(source.indexOf('async function fn('),source.indexOf('async function qload'));
 let now=100000,calls=0;
 const c={C:{SUPABASE_URL:'https://example.test',SUPABASE_PUBLISHABLE_KEY:'public'},token:()=>'',radioPausedUntil:0,Date:{now:()=>now},localStorage:{setItem:()=>{}},fetch:async()=>{calls++;return {status:402,ok:false,json:async()=>({error:'Quota'})};}};
 vm.createContext(c);vm.runInContext(part,c);
 await assert.rejects(c.fn('radio-next'));await assert.rejects(c.fn('radio-schedule-check'));assert.equal(calls,1);
 now+=21600001;await assert.rejects(c.fn('radio-next'));assert.equal(calls,2);
});
test('radio retries stay single and cannot interrupt resumed music',async()=>{
 const source=fs.readFileSync(root+'/radio/player.html','utf8');
 const part=source.slice(source.indexOf('function retryNext('),source.indexOf('async function finishVideo'));
 let now=100000,calls=0;const timers=new Map();let serial=0;
 const c={started:true,nextLock:false,scheduledActive:false,scheduledPending:null,radioPausedUntil:0,nextRetryAt:0,nextRetryTimer:null,idle:true,current:null,currentType:null,Date:{now:()=>now},$:()=>({textContent:''}),setTimeout:(fn)=>{const id=++serial;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),fn:async()=>{calls++;c.radioPausedUntil=now+21600000;throw Object.assign(new Error('Quota'),{status:402});}};
 vm.createContext(c);vm.runInContext(part,c);await c.next();
 for(let i=0;i<10;i++)await c.next();assert.equal(calls,1);assert.equal(timers.size,1);
 now+=21600000;c.idle=false;[...timers.values()][0]();assert.equal(calls,1);
});
test('quota failure from schedule checking still schedules playback recovery when a track ends',async()=>{
 const source=fs.readFileSync(root+'/radio/player.html','utf8');
 const part=source.slice(source.indexOf('function retryNext('),source.indexOf('async function finishVideo'));
 let now=100000,calls=0,callback;
 const c={started:true,nextLock:false,scheduledActive:false,scheduledPending:null,radioPausedUntil:now+21600000,nextRetryAt:0,nextRetryTimer:null,idle:false,current:null,currentType:null,Date:{now:()=>now},$:()=>({textContent:''}),setTimeout:fn=>{callback=fn;return 1;},clearTimeout:()=>{},qload:()=>{},showVideo:()=>{c.idle=false;},fn:async()=>{calls++;return {type:'video',item:{}};}};
 vm.createContext(c);vm.runInContext(part,c);await c.next();assert.equal(c.idle,true);assert.equal(calls,0);assert.equal(typeof callback,'function');
 now+=21600000;callback();await new Promise(r=>setImmediate(r));assert.equal(calls,1);assert.equal(c.idle,false);
});
test('31 days of panel operation use daily RU and fewer than 11000 Edge calls',async()=>{
 let now=Date.parse('2026-10-05T18:00:00Z');const shared=new Map(),counts={};
 const FakeDate=class extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
 const elements=new Map();const element=s=>{if(!elements.has(s))elements.set(s,{textContent:'',innerHTML:'',classList:{add:()=>{},remove:()=>{}},src:'',hidden:false});return elements.get(s);};
 let refresh;
 const c={window:{},Date:FakeDate,Map,localStorage:{getItem:k=>shared.get(k)||null,setItem:(k,v)=>shared.set(k,v)},document:{querySelector:element,documentElement:{dataset:{}}},setInterval:(fn,ms)=>{if(ms===60000)refresh=fn;},fetch:async(url,options)=>{
  let result=[];
  if(url.includes('/functions/')){
   const body=JSON.parse(options.body),key=url.endsWith('portal-public')?body.action:url.split('/').pop();counts[key]=(counts[key]||0)+1;
   result=key==='campus-info'?{ru:{date:body.date,menu:{almoco:'Arroz'}},intercampi:{}}:key==='weather-info'?{current:{temperature:20},day:{},hourly:[]}:key==='events'?{events:[]}:{notices:[]};
  }
  return {ok:true,status:200,json:async()=>result};
 }};
 vm.createContext(c);vm.runInContext(fs.readFileSync(root+'/public-cache.js','utf8'),c);vm.runInContext(fs.readFileSync(root+'/painel/app.js','utf8'),c);
 await new Promise(r=>setImmediate(r));
 for(let minute=1;minute<=31*24*60;minute++){now+=60000;await refresh();}
 assert.equal(counts['campus-info'],32); // Starts at midday and crosses 31 midnights.
 assert.ok(counts.notices<=4465);assert.ok(counts.events<=4465);assert.ok(counts['weather-info']<=1489);
 assert.ok(Object.values(counts).reduce((a,b)=>a+b,0)<11000,JSON.stringify(counts));
});
