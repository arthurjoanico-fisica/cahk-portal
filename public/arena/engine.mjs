// Original deterministic simulation. Coordinates: metres; player 0 faces -Z.
export const COURT={halfWidth:3.05,halfLength:6.7,netHeight:.91};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(n,d=0)=>Number.isFinite(n)?n:d;
export function createGame({target=11,names=['Jogador 1','Jogador 2']}={}){
  return {version:1,target:[7,11].includes(target)?target:11,names:names.map(n=>String(n).slice(0,28)),scores:[0,0],players:[{x:0,z:4.6,pose:0},{x:0,z:-4.6,pose:0}],ball:{x:0,y:1,z:4.2,vx:0,vy:0,vz:0,bounces:0},phase:'serve',serving:0,lastHit:0,rally:0,bestRally:0,timer:0,paused:false,winner:null,event:null};
}
export function awardPoint(g,player){
  if(g.phase==='finished'||![0,1].includes(player))return;
  g.scores[player]++;g.bestRally=Math.max(g.bestRally,g.rally);
  g.event={type:'point',player};g.timer=0;
  if((g.scores[player]>=g.target&&g.scores[player]-g.scores[1-player]>=2)||g.scores[player]>=15){g.phase='finished';g.winner=player;}
  else {g.phase='point';g.serving=1-g.serving;}
}
function prepareServe(g){g.phase='serve';g.rally=0;g.timer=0;g.players.forEach((p,i)=>{p.x=0;p.z=i?-4.6:4.6;});g.ball={x:0,y:1,z:g.serving?-4.2:4.2,vx:0,vy:0,vz:0,bounces:0};}
export function swing(g,player,shot={}){
  if(g.paused||!g.players[player]||g.phase==='finished'||g.phase==='point')return false;
  const p=g.players[player],b=g.ball;p.pose=1;
  const serve=g.phase==='serve';
  if(serve&&g.serving!==player)return false;
  if(!serve&&(g.lastHit===player||Math.abs(b.x-p.x)>1.2||Math.abs(b.z-p.z)>1.35||b.y>2.8||b.y<.05))return false;
  const power=clamp(finite(shot.power,.4),0,1),aim=clamp(finite(shot.aim),-1,1),lob=clamp(finite(shot.lob,.25),0,1),spin=clamp(finite(shot.spin),-1,1);
  const sign=player===0?-1:1, speed=7+power*6, targetZ=sign*(4.8+power*.7),tx=aim*2.65;
  if(serve){b.x=p.x;b.y=1;b.z=p.z+sign*.4;}
  // A lob increases flight time and height while retaining the same landing target.
  const t=Math.max(.5,Math.abs(targetZ-b.z)/speed)*(1+lob*.45),desiredVy=(.12-b.y+4.9*t*t)/t;
  b.vx=(tx-b.x)/t;b.vz=(targetZ-b.z)/t;b.vy=desiredVy;b.spin=spin;b.bounces=0;
  g.lastHit=player;g.phase='rally';g.rally++;g.timer=0;g.event={type:'hit',player,power};
  return true;
}
export function stepGame(g,dt){
  if(g.paused||g.phase==='finished')return;
  dt=clamp(finite(dt),0,.05);g.timer+=dt;
  g.players.forEach(p=>p.pose=Math.max(0,p.pose-dt*4));
  if(g.phase==='point'){if(g.timer>1.5)prepareServe(g);return;}
  if(g.phase==='serve'){const p=g.players[g.serving];g.ball.x=p.x;g.ball.z=p.z+(g.serving?.4:-.4);if(g.timer>9)swing(g,g.serving,{power:.35});return;}
  const b=g.ball;
  g.players.forEach((p,i)=>{
    const inbound=i===0?b.vz>0:b.vz<0,sign=i===0?1:-1;
    const projectedX=b.x+b.vx*clamp(Math.abs(p.z-b.z)/Math.max(.1,Math.abs(b.vz)),0,.9);
    const targetX=inbound?clamp(projectedX,-2.9,2.9):0;
    const targetZ=inbound?sign*clamp(sign*(b.z+b.vz*.32),1.1,5.55):sign*4.3;
    p.x+=clamp(targetX-p.x,-3.9*dt,3.9*dt);p.z+=clamp(targetZ-p.z,-3.3*dt,3.3*dt);
  });
  const oldZ=b.z;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.vy-=9.8*dt;b.vx+=finite(b.spin)*.7*dt;
  if(oldZ*b.z<0&&b.y<COURT.netHeight){awardPoint(g,1-g.lastHit);return;}
  if(b.y<=.08&&b.vy<0){
    if(Math.abs(b.x)>COURT.halfWidth||Math.abs(b.z)>COURT.halfLength){awardPoint(g,1-g.lastHit);return;}
    b.bounces++;if(b.bounces>=2){awardPoint(g,g.lastHit);return;}
    b.y=.08;b.vy=Math.abs(b.vy)*.72;b.vx+=finite(b.spin)*.8;g.event={type:'bounce'};
  }
  if(Math.abs(b.z)>8.2||Math.abs(b.x)>5){awardPoint(g,b.bounces>0?g.lastHit:1-g.lastHit);}
}
export function restoreGame(s){
  if(!s||s.version!==1||!Array.isArray(s.scores)||s.scores.length!==2||s.scores.some(v=>!Number.isInteger(v)||v<0||v>15)||!['serve','point','rally','finished'].includes(s.phase))throw Error('Checkpoint inválido');
  const g=createGame({target:s.target,names:Array.isArray(s.names)&&s.names.length===2?s.names:undefined});
  g.scores=[...s.scores];g.serving=s.serving===1?1:0;g.bestRally=clamp(finite(s.bestRally),0,100000);g.paused=true;
  if(s.phase==='finished'){g.phase='finished';g.winner=s.winner===1?1:0;}else prepareServe(g);
  return g;
}
