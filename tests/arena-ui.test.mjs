import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {createPreviewServer} from '../scripts/arena-preview.mjs';
let browser,server,base;
before(async()=>{server=await createPreviewServer();base=String(await server.ready).replace(/\/$/,'');browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});await mkdir('test-results',{recursive:true});});
after(async()=>{await browser?.close();await server?.dispose();});
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
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{
   class Sensors {static async requestPermission(){return 'granted';}}Object.defineProperty(window,'DeviceMotionEvent',{value:Sensors});Object.defineProperty(window,'DeviceOrientationEvent',{value:Sensors});
   window.__reading={alpha:0,beta:0,gamma:0};window.__rate={alpha:0,beta:0,gamma:0};
   setInterval(()=>{const orientation=new Event('deviceorientation');for(const k of ['alpha','beta','gamma'])Object.defineProperty(orientation,k,{value:window.__reading[k]});dispatchEvent(orientation);const motion=new Event('devicemotion');Object.defineProperty(motion,'rotationRate',{value:{...window.__rate}});dispatchEvent(motion);},16);
 });
 const phone=await context.newPage();await phone.goto(`${base}/arena/pad/?room=${session.room}&player=1#token=${session.padTokens[0]}`);await phone.locator('#start').click();await host.waitForFunction(()=>!document.getElementById('start').disabled);await phone.screenshot({path:'test-results/arena-phone.png',fullPage:true});await host.locator('#start').click();
 await phone.evaluate(()=>{let n=0;const timer=setInterval(()=>{window.__rate={alpha:0,beta:n<12?300:0,gamma:0};window.__reading.beta=Math.min(65,n*5);if(++n>22){clearInterval(timer);window.__rate={alpha:0,beta:0,gamma:0};}},16);});
 await host.waitForFunction(()=>document.getElementById('rally').textContent==='RALLY 1',{},{timeout:5000});await context.close();await host.close();
});
test('closing a tournament result keeps the next-round action accessible',async()=>{
 const host=await browser.newPage({viewport:{width:1280,height:900}});await host.goto(base+'/arena/');await host.locator('[data-mode="tournament"]').click();await host.locator('#names').fill('Ana\nBia\nCaio\nDani');await host.locator('#create').click();await host.waitForFunction(()=>localStorage.getItem('cahk-arena-checkpoint-v1'));
 await host.evaluate(()=>{const key='cahk-arena-checkpoint-v1',s=JSON.parse(localStorage.getItem(key));s.game.phase='finished';s.game.scores=[7,0];s.game.winner=0;s.savedAt+=100;localStorage.setItem(key,JSON.stringify(s));window.addEventListener('pagehide',()=>localStorage.setItem(key,JSON.stringify(s)),{once:true});});await host.reload();await host.locator('#resume').click();await host.locator('#result-dialog').waitFor({state:'visible'});await host.locator('#result-dialog .close-dialog').click();await host.locator('#show-result').click();await host.locator('#next').click();assert.equal(await host.locator('#pair-dialog').isVisible(),true);assert.equal(await host.locator('#player1').textContent(),'Caio');await host.close();
});
