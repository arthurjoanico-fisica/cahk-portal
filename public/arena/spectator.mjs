import {createScene} from './scene.mjs';
import {spectatorChannel,validSpectatorSnapshot} from './broadcast.mjs';

export function startSpectator(){
const $=id=>document.getElementById(id),room=new URLSearchParams(location.hash.slice(1)).get('room');
document.body.classList.add('spectator-mode');$('home').hidden=true;$('court-view').hidden=false;
$('match-label').textContent='TELÃO LOCAL · SOMENTE VISUALIZAÇÃO';$('connection').textContent='Conectando à janela da partida…';
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.body.requestFullscreen();}catch{}};
$('sound').hidden=true;$('court').setAttribute('aria-label','Visão geral da partida no telão local');
let scene=null,lastFrame=null,lastReceived=0,channel=null,lastPaint=0;
try{scene=createScene($('court'));}catch{$('game-call').textContent='Ative a aceleração gráfica para abrir o telão.';}
if(room&&/^[a-f0-9]{32}$/.test(room)&&'BroadcastChannel'in window){
  channel=new BroadcastChannel(spectatorChannel(room));
  channel.onmessage=event=>{if(!validSpectatorSnapshot(event.data))return;lastFrame=event.data;lastReceived=performance.now();
    const g=lastFrame.game;for(let i=0;i<2;i++){$('player'+(i+1)).textContent=g.names[i];$('score'+(i+1)).textContent=g.scores[i];}
    $('rally').textContent=g.rally?'RALLY '+g.rally:'PRÓXIMA REBATIDA';$('connection').textContent='Visão geral · ligada à partida neste navegador';
  };channel.postMessage({type:'hello'});
}else $('game-call').textContent='Abra o telão pelo botão na tela da partida.';
function frame(now){
  if(lastFrame){const g=lastFrame.game,stale=now-lastReceived>3500;
    $('game-call').textContent=stale?'SINAL INTERROMPIDO\nVerifique a janela da partida':g.paused?'PARTIDA PAUSADA':g.phase==='finished'?'FIM DE JOGO':g.phase==='point'?'PONTO!':'';
    if(!document.hidden&&now-lastPaint>1000/(g.paused?8:30)){scene?.draw(g,now/1000,{layout:'overview',overview:false,poses:lastFrame.poses});lastPaint=now;}
  }else if(scene)$('game-call').textContent='AGUARDANDO A PARTIDA\nMantenha a janela principal aberta';
  requestAnimationFrame(frame);
}requestAnimationFrame(frame);
window.addEventListener('pagehide',()=>{channel?.close();scene?.dispose();});

}
