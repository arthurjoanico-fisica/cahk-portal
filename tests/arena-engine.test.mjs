import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,stepGame,swing,awardPoint,restoreGame} from '../public/arena/engine.mjs';
import {createTournament,nextMatch,completeMatch} from '../public/arena/tournament.mjs';
test('match requires two point lead and stops at cap',()=>{const g=createGame({target:7});g.scores=[6,6];awardPoint(g,0);assert.equal(g.phase,'point');awardPoint(g,0);assert.equal(g.phase,'finished');assert.equal(g.winner,0); const h=createGame();h.scores=[14,14];awardPoint(h,1);assert.equal(h.winner,1);});
test('automatic movement pursues ball and does not require webcam',()=>{const g=createGame();g.phase='rally';g.ball={x:2,y:2,z:2,vx:0,vy:0,vz:3,bounces:0};g.players[0].x=-2;stepGame(g,.1);assert.ok(g.players[0].x>-2);});
test('valid timed swing returns ball while early swing does not',()=>{const g=createGame();g.phase='rally';g.lastHit=1;g.ball={x:0,y:1,z:4.3,vx:0,vy:0,vz:5,bounces:0};g.players[0].x=0;assert.equal(swing(g,0,{power:.5,aim:0,lob:.2,spin:0}),true);assert.ok(g.ball.vz<0);assert.equal(g.rally,1);assert.equal(swing(g,0,{power:.5}),false);});
test('serve belongs only to serving player',()=>{const g=createGame();assert.equal(swing(g,1,{power:.5}),false);assert.equal(swing(g,0,{power:.5,aim:0}),true);assert.equal(g.phase,'rally');});
test('second bounce awards point to opponent',()=>{const g=createGame();g.phase='rally';g.lastHit=1;g.ball={x:0,y:.07,z:3,vx:0,vy:-3,vz:0,bounces:1};stepGame(g,.02);assert.deepEqual(g.scores,[0,1]);});
test('restoring checkpoint validates data and always pauses',()=>{const g=createGame();g.scores=[3,4];const r=restoreGame(JSON.parse(JSON.stringify(g)));assert.deepEqual(r.scores,[3,4]);assert.equal(r.paused,true);assert.throws(()=>restoreGame({scores:[-1,Infinity]}));});
test('odd bracket advances byes and creates one champion',()=>{const t=createTournament(['Ana','Bia','Caio','Dani','Eva']);let count=0;while(!t.champion){const m=nextMatch(t);assert.ok(m);completeMatch(t,m.id,m.players[0].id,[7,2]);if(++count>10)throw Error('loop');}assert.equal(count,4);assert.ok(t.champion.name);});
test('bracket rejects outsiders and duplicate results',()=>{const t=createTournament(['A','B','C','D']);const m=nextMatch(t);assert.throws(()=>completeMatch(t,m.id,'outsider',[7,0]));completeMatch(t,m.id,m.players[0].id,[7,0]);assert.throws(()=>completeMatch(t,m.id,m.players[0].id,[7,0]));});
test('bracket requires unique names and 4 to 16 players',()=>{assert.throws(()=>createTournament(['a','b']));assert.throws(()=>createTournament(['Ana','ana','B','C']));});
test('high lob serve lands inside the baseline for either player',()=>{for(const serving of [0,1]){const g=createGame();g.serving=serving;g.players[serving].z=serving?-4.6:4.6;swing(g,serving,{power:.65,aim:0,lob:.8,spin:0});let n=0;while(g.phase==='rally'&&g.ball.bounces===0&&n++<500)stepGame(g,1/120);assert.equal(g.phase,'rally');assert.equal(g.ball.bounces,1);assert.ok(Math.abs(g.ball.z)<6.7);}});
test('topspin and backspin change flight and forward bounce without changing the target',()=>{
 for(const serving of [0,1]){
  function flight(topspin){const g=createGame();g.serving=serving;swing(g,serving,{power:.5,aim:0,lob:.1,spin:0,topspin});const initialVy=g.ball.vy;let n=0;while(g.phase==='rally'&&g.ball.bounces===0&&n++<500)stepGame(g,1/120);return {initialVy,g};}
  const top=flight(1),back=flight(-1);assert.ok(top.initialVy>back.initialVy);assert.equal(top.g.ball.bounces,1);assert.equal(back.g.ball.bounces,1);assert.ok(Math.abs(top.g.ball.vz)>Math.abs(back.g.ball.vz));assert.ok(Math.abs(top.g.ball.z)<6.7&&Math.abs(back.g.ball.z)<6.7);assert.ok(Math.abs(top.g.ball.z-back.g.ball.z)<.2);
 }
});
test('opposite lateral effects produce opposite flight and bounce deviations',()=>{
 function shot(spin){const g=createGame();swing(g,0,{power:.5,aim:0,lob:.1,spin});let n=0;while(g.phase==='rally'&&g.ball.bounces===0&&n++<500)stepGame(g,1/120);assert.equal(g.ball.bounces,1);return g.ball;}
 const a=shot(1),b=shot(-1);assert.ok(a.x>0&&b.x<0);assert.ok(a.vx>0&&b.vx<0);
});
test('missing vertical effect preserves the zero-effect shot of older controllers',()=>{
 const a=createGame(),b=createGame();swing(a,0,{power:.6,aim:.3,lob:.2,spin:.1});swing(b,0,{power:.6,aim:.3,lob:.2,spin:.1,topspin:0});
 for(let i=0;i<130;i++){stepGame(a,1/120);stepGame(b,1/120);}assert.deepEqual(a,b);
});
