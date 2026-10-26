const phases=['serve','rally','point','finished'];
export const spectatorChannel=room=>'cahk-arena-local-view-v1:'+room;
export function spectatorSnapshot(game,mode,at=Date.now()){
  return {type:'frame',version:1,at,mode,game:{
    names:game.names.map(n=>String(n).slice(0,28)),scores:[...game.scores],
    players:game.players.map(p=>({x:p.x,z:p.z,pose:p.pose})),
    ball:{x:game.ball.x,y:game.ball.y,z:game.ball.z},phase:game.phase,
    serving:game.serving,rally:game.rally,paused:game.paused,target:game.target,
  }};
}
export function validSpectatorSnapshot(s){
  const g=s?.game;
  return s?.type==='frame'&&s.version===1&&Number.isFinite(s.at)&&
    ['quick','training','tournament'].includes(s.mode)&&phases.includes(g?.phase)&&
    Array.isArray(g.names)&&g.names.length===2&&g.names.every(n=>typeof n==='string'&&n.length<=28)&&
    Array.isArray(g.scores)&&g.scores.length===2&&g.scores.every(n=>Number.isInteger(n)&&n>=0&&n<=15)&&
    Array.isArray(g.players)&&g.players.length===2&&g.players.every(p=>['x','z','pose'].every(k=>Number.isFinite(p?.[k])))&&
    ['x','y','z'].every(k=>Number.isFinite(g.ball?.[k]))&&typeof g.paused==='boolean';
}
