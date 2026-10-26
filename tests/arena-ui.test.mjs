import test,{before,after,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {createPreviewServer} from '../scripts/arena-preview.mjs';
let browser,server,base;
before(async()=>{server=await createPreviewServer();base=String(await server.ready).replace(/\/$/,'');browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});await mkdir('test-results',{recursive:true});});
after(async()=>{await browser?.close();await server?.dispose();});
afterEach(async()=>{for(const context of browser?.contexts()||[]){for(const page of context.pages()){if(await page.locator('#home-error').count()){const error=await page.locator('#home-error').textContent();if(error)console.error('Arena setup error:',error);}}await context.close();}});
test('arena home is integrated and remains usable on mobile',async()=>{const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto(base+'/arena/');await page.getByRole('button',{name:'Campeonato',exact:true}).click();assert.equal(await page.locator('#names').isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'test-results/arena-mobile.png',fullPage:true});await page.goto(base+'/');assert.equal(await page.locator('a[href="/arena/"]').count(),2);await page.close();});
test('two actual phone clients pair, play, disconnect and restore a saved host',async()=>{
 const host=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];host.on('pageerror',e=>errors.push(e.message));
 await host.goto(base+'/arena/');await host.locator('#name1').fill('Ana');await host.locator('#name2').fill('Bia');await host.locator('#create').click();await host.locator('#pair-dialog').waitFor({state:'visible'});
 const session=await host.evaluate(()=>JSON.parse(localStorage.getItem('cahk-arena-session-v1')));assert.ok(session?.room);
 const phones=[];
 for(let i=0;i<2;i++){const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await context.newPage();await p.goto(`${base}/arena/pad/?room=${session.room}&player=${i+1}#token=${session.padTokens[i]}`);await p.locator('#manual-mode').click();phones.push({context,page:p});}
 await host.waitForFunction(()=>!document.getElementById('start').disabled);await host.screenshot({path:'test-results/arena-pairing.png'});await host.locator('#start').click();await host.waitForFunction(()=>document.getElementById('game-call').textContent.includes('sacar'));
 await phones[0].page.locator('#manual-shot').click();await host.waitForFunction(()=>document.getElementById('rally').textContent==='RALLY 1');
 await host.waitForFunction(()=>Number(document.getElementById('score1').textContent)+Number(document.getElementById('score2').textContent)>0,{},{timeout:15000});
 const score=await host.locator('#score1').textContent()+':'+await host.locator('#score2').textContent();await host.screenshot({path:'test-results/arena-court.png'});
 await phones[1].context.close();await host.waitForFunction(()=>document.getElementById('game-call').textContent.includes('PAUSADA'));
 assert.equal(await host.locator('#pause').isDisabled(),true);
 await host.reload();await host.locator('#resume').click();await host.locator('#pair-dialog').waitFor({state:'visible'});assert.equal(await host.locator('#score1').textContent()+':'+await host.locator('#score2').textContent(),score);
 assert.deepEqual(errors,[]);await phones[0].context.close();await host.close();
});

test('motion permission and calibration reach a real host through the controller page',async()=>{
 const host=await browser.newPage({viewport:{width:1280,height:900}});await host.goto(base+'/arena/');await host.locator('[data-mode="training"]').click();await host.locator('#create').click();await host.locator('#pair-dialog').waitFor({state:'visible'});const session=await host.evaluate(()=>JSON.parse(localStorage.getItem('cahk-arena-session-v1')));
 await host.evaluate(room=>{window.__racketFrames=[];window.__observer=new BroadcastChannel('cahk-arena-local-view-v1:'+room);window.__observer.onmessage=e=>window.__racketFrames.push(e.data);},session.room);
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{
   class Sensors {static async requestPermission(){return 'granted';}}Object.defineProperty(window,'DeviceMotionEvent',{value:Sensors});Object.defineProperty(window,'DeviceOrientationEvent',{value:Sensors});
   window.__reading={alpha:0,beta:0,gamma:0};window.__rate={alpha:0,beta:0,gamma:0};
   setInterval(()=>{const orientation=new Event('deviceorientation');for(const k of ['alpha','beta','gamma'])Object.defineProperty(orientation,k,{value:window.__reading[k]});dispatchEvent(orientation);const motion=new Event('devicemotion');Object.defineProperty(motion,'rotationRate',{value:{...window.__rate}});dispatchEvent(motion);},16);
 });
 const phone=await context.newPage();await phone.goto(`${base}/arena/pad/?room=${session.room}&player=1#token=${session.padTokens[0]}`);await phone.locator('#start').click();await host.waitForFunction(()=>!document.getElementById('start').disabled);await phone.screenshot({path:'test-results/arena-phone.png',fullPage:true});
 await host.waitForFunction(()=>window.__racketFrames.some(f=>f.poses?.[0]));
 await host.locator('#pair-dialog .close-dialog').click();
 const beforePose=await host.locator('#court').screenshot();
 await phone.evaluate(()=>window.__reading.alpha=45);
 await host.waitForFunction(()=>window.__racketFrames.some(f=>f.poses?.[0]?.[1]>.35));
 await host.waitForTimeout(250);
 const afterPose=await host.locator('#court').screenshot({path:'test-results/arena-racket-live.png'});
 assert.equal(beforePose.equals(afterPose),false,'live orientation changes rendered racket');
 assert.equal(await host.locator('#rally').textContent(),'PREPARE SUA RAQUETE','pose alone never hits the ball');
 const saved=await host.evaluate(()=>JSON.parse(localStorage.getItem('cahk-arena-checkpoint-v1')));
 assert.equal(saved.game.poses,undefined);assert.equal(saved.racketPoses,undefined);
 await host.locator('#pairing').click();await host.locator('#start').click();
 await phone.evaluate(()=>{let n=0;const timer=setInterval(()=>{window.__rate={alpha:0,beta:n<12?300:0,gamma:0};window.__reading.beta=Math.min(65,n*5);if(++n>22){clearInterval(timer);window.__rate={alpha:0,beta:0,gamma:0};}},16);});
 await host.waitForFunction(()=>document.getElementById('rally').textContent==='RALLY 1',{},{timeout:5000});await context.close();await host.close();
});
test('closing a tournament result keeps the next-round action accessible',async()=>{
 const host=await browser.newPage({viewport:{width:1280,height:900}});await host.goto(base+'/arena/');await host.locator('[data-mode="tournament"]').click();await host.locator('#names').fill('Ana\nBia\nCaio\nDani');await host.locator('#create').click();await host.waitForFunction(()=>localStorage.getItem('cahk-arena-checkpoint-v1'));
 await host.evaluate(()=>{const key='cahk-arena-checkpoint-v1',s=JSON.parse(localStorage.getItem(key));s.game.phase='finished';s.game.scores=[7,0];s.game.winner=0;s.savedAt+=100;localStorage.setItem(key,JSON.stringify(s));window.addEventListener('pagehide',()=>localStorage.setItem(key,JSON.stringify(s)),{once:true});});await host.reload();await host.locator('#resume').click();await host.locator('#result-dialog').waitFor({state:'visible'});await host.locator('#result-dialog .close-dialog').click();await host.locator('#show-result').click();await host.locator('#next').click();assert.equal(await host.locator('#pair-dialog').isVisible(),true);assert.equal(await host.locator('#player1').textContent(),'Caio');await host.close();
});
test('split player views and local extra screen share a state without Supabase or new room',async()=>{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),host=await context.newPage();const traffic=[];context.on('request',r=>traffic.push(r.url()));await host.goto(base+'/arena/');await host.locator('#name1').fill('Perspectiva 1');await host.locator('#name2').fill('Perspectiva 2');await host.locator('#create').click();await host.locator('#pair-dialog').waitFor({state:'visible'});await host.locator('#pair-dialog .close-dialog').click();await host.waitForFunction(()=>document.getElementById('court').dataset.layout==='split',{},{timeout:1500});
 const popup=context.waitForEvent('page');await host.locator('#open-spectator').click({timeout:1500});const viewer=await popup;await viewer.waitForLoadState('domcontentloaded');await viewer.waitForFunction(()=>document.getElementById('player1').textContent==='Perspectiva 1',{},{timeout:4000});assert.equal(await viewer.locator('#court').getAttribute('data-layout'),'overview');assert.equal(new URL(viewer.url()).hash.includes('token'),false);assert.equal(traffic.filter(u=>/supabase\.(co|com)/.test(u)).length,0);assert.equal(traffic.filter(u=>u.endsWith('/arena/api/rooms')).length,1);await host.screenshot({path:'test-results/arena-split.png'});await viewer.screenshot({path:'test-results/arena-extra-screen.png'});await host.evaluate(()=>{window.requestAnimationFrame=()=>0;Object.defineProperty(document,'hidden',{get:()=>true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await viewer.waitForTimeout(4200);assert.equal((await viewer.locator('#game-call').textContent()).includes('SINAL INTERROMPIDO'),false);await context.close();
});
test('fractional canvas size does not reallocate the drawing buffer every frame',async()=>{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();try{await page.goto(base+'/arena/');await page.locator('#create').click();await page.locator('#pair-dialog').waitFor({state:'visible'});await page.locator('#pair-dialog .close-dialog').click();const writes=await page.evaluate(async()=>{const canvas=document.getElementById('court');canvas.style.width='calc(100% - 0.3px)';await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const descriptor=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,'width');let writes=0;Object.defineProperty(canvas,'width',{get(){return descriptor.get.call(this)},set(v){writes++;descriptor.set.call(this,v)},configurable:true});await new Promise(r=>setTimeout(r,500));delete canvas.width;return writes;});assert.equal(writes,0);}finally{await context.close();}
});
test('initial mode controls work when the application module loads slowly',async()=>{
 const context=await browser.newContext();const page=await context.newPage();await page.route('**/arena/app.mjs',async route=>{const response=await route.fetch();await new Promise(r=>setTimeout(r,250));await route.fulfill({response});});await page.goto(base+'/arena/');await page.locator('[data-mode="tournament"]').click();assert.equal(await page.locator('#names').isVisible(),true);await context.close();
});
