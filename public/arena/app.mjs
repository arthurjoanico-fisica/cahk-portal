import {createGame,stepGame,swing,restoreGame} from './engine.mjs';
import {createTournament,nextMatch,completeMatch} from './tournament.mjs';
import {createScene} from './scene.mjs';
import {newestCheckpoint,LinkWatch} from './session.mjs';
import {spectatorChannel,spectatorSnapshot} from './broadcast.mjs';
import {playerRelativeShot} from './viewports.mjs';
import QR from './vendor/qrcode.mjs';

export function startArena(){
const $=id=>document.getElementById(id),KEY='cahk-arena-session-v1',BACKUP='cahk-arena-checkpoint-v1';
let mode='quick',session=null,ws=null,presence={host:false,pads:[false,false],ready:[false,false]},game=null,tournament=null,matchId=null,scene=null,running=false,manualPause=false,serverReady=false,reconnectTimer=null,leaving=false,finishedHandled=false,last=0,accumulator=0,botAt=0,toastTimer=null,sound=false,audio=null,recovering=false,heartbeat=null;
let racketPoses=[null,null],poseReceived=[0,0];
let view='players',localScreen=null,broadcastAt=0,localPulse=null,lastPaint=0;
const read=key=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{notify('O navegador bloqueou o backup local. Mantenha esta aba aberta.');}};
const send=m=>{if(ws?.readyState===1)ws.send(JSON.stringify(m));};
function notify(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function tone(freq=400,duration=.07){if(!sound)return;try{audio??=new AudioContext();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.connect(gain);gain.connect(audio.destination);osc.frequency.value=freq;gain.gain.setValueAtTime(.07,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.start();osc.stop(audio.currentTime+duration);}catch{}}
function chooseMode(value){mode=value;document.querySelectorAll('[data-mode]').forEach(b=>{const selected=b.dataset.mode===mode;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});$('tournament-setup').hidden=mode!=='tournament';$('duel-names').hidden=mode==='tournament';$('name2').disabled=mode==='training';$('mode-description').textContent={quick:'Uma partida entre duas pessoas, na mesma tela.',training:'Pratique com um celular contra o adversário automático.',tournament:'Organize de 4 a 16 participantes nesta estação.'}[mode];}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>chooseMode(b.dataset.mode));
function canPlay(){return serverReady&&presence.host&&presence.pads[0]&&presence.ready[0]&&(mode==='training'||presence.pads[1]&&presence.ready[1]);}
function refreshPresence(){
  ['1','2'].forEach((n,i)=>{$('pad-status'+n).textContent=presence.pads[i]?(presence.ready[i]?'Conectado e calibrado ✓':'Conectado · calibre no celular'):'Aguardando celular';});
  $('start').disabled=!canPlay()||game?.phase==='finished';
  $('pair-note').textContent=canPlay()?'Controles prontos. Podem começar.':mode==='training'?'Conecte e calibre o celular do Jogador 1.':'Os dois controles precisam estar conectados e calibrados.';
  if(game&&running&&!canPlay()){game.paused=true;$('game-call').textContent='PARTIDA PAUSADA\nReconecte e calibre os controles';}
  $('pause').disabled=!running||game?.phase==='finished'||!canPlay();
  $('connection').textContent=!serverReady?'Reconectando à sala…':mode==='training'?`Sala ${session?.room} · treino`:`Sala ${session?.room} · ${presence.pads.filter(Boolean).length}/2 celulares`;
  // A reconnect always requires an explicit resume on the shared screen.
  if(game?.paused&&canPlay())$('game-call').textContent='CONTROLES PRONTOS\nToque em Retomar';
  $('pause').textContent=game?.paused?'Retomar':'Pausar';
}
function checkpoint(){if(!game)return;const state={version:1,mode,game,tournament,matchId,savedAt:Date.now()};write(BACKUP,state);send({type:'checkpoint',state});publishLocalFrame();$('save-status').textContent=ws?.readyState===1?'Salvando placar…':'Backup neste computador';}
function restore(state){
  if(!state||state.version!==1||!['quick','training','tournament'].includes(state.mode))return false;
  try{const restored=restoreGame(state.game);if(state.mode==='tournament'){
    if(!state.tournament||!Array.isArray(state.tournament.rounds)||!Array.isArray(state.tournament.players)||state.tournament.players.length>16)return false;
    const candidate=state.tournament.rounds.flat().find(m=>m.id===state.matchId);
    if(!candidate||!Array.isArray(candidate.players))return false;
  }
  mode=state.mode;game=restored;tournament=state.tournament||null;matchId=state.matchId||null;finishedHandled=false;running=game.phase!=='finished';manualPause=true;$('name1').value=game.names[0];$('name2').value=game.names[1];showCourt();renderBracket();drawHud();return true;}catch{return false;}
}
function openHost(){
  clearTimeout(reconnectTimer);if(!session||leaving)return;
  const socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/arena/api/rooms/${encodeURIComponent(session.room)}/ws?role=host&token=${encodeURIComponent(session.hostToken)}`);ws=socket;
  socket.onopen=()=>{if(ws!==socket)return;serverReady=true;clearInterval(heartbeat);const link=new LinkWatch(performance.now());socket.link=link;let lastPing=performance.now(),wasActive=false;heartbeat=setInterval(()=>{if(ws!==socket)return;const now=performance.now(),active=running&&game&&!game.paused;if(active&&!wasActive){link.heard(now);send({type:'ping'});lastPing=now;}wasActive=active;link.timeout=active?3000:45000;if(link.expired(now)){serverReady=false;refreshPresence();socket.close();}else if(now-lastPing>=(active?1000:15000)){send({type:'ping'});lastPing=now;}},1000);};
  socket.onmessage=e=>{if(ws!==socket)return;let m;try{m=JSON.parse(e.data);}catch{return;}
    socket.link?.heard(performance.now());
    if(m.type==='presence'){presence=m;for(let i=0;i<2;i++)if(!m.pads[i]||!m.ready[i])racketPoses[i]=null;refreshPresence();}
    else if(m.type==='pose'&&[0,1].includes(m.player)&&presence.ready[m.player]){racketPoses[m.player]=m.q;poseReceived[m.player]=performance.now();}
    else if(m.type==='restore'){
      if(recovering){const chosen=newestCheckpoint(read(BACKUP),m.state);if(chosen)restore(chosen);recovering=false;if(chosen&&(!m.state||chosen.savedAt>m.state.savedAt))checkpoint();}
      else if(!game&&m.state)restore(m.state);
      else if(game&&!m.state)checkpoint();
      refreshPresence();
    }
    else if(m.type==='swing'&&game&&running&&canPlay()){
      const didHit=swing(game,m.player,playerRelativeShot(m,m.player));if(didHit){tone(360+m.power*300);send({type:'feedback',player:m.player,event:'hit',power:m.power});}else if(!game.paused)notify('Rebata quando a bola estiver ao alcance do seu personagem.');
    }
    else if(m.type==='checkpoint-saved'||m.type==='saved')$('save-status').textContent='Placar salvo na sala e neste computador';
    else if(m.type==='error')notify(m.message||'Não foi possível atualizar a sala.');
  };
  socket.onclose=()=>{if(ws!==socket)return;clearInterval(heartbeat);if(leaving)return;serverReady=false;racketPoses=[null,null];presence={host:false,pads:[false,false],ready:[false,false]};refreshPresence();reconnectTimer=setTimeout(openHost,1800);};
  socket.onerror=()=>{if(ws===socket){serverReady=false;refreshPresence();socket.close();$('connection').textContent='Falha na conexão · tentando novamente';}};
}
function padLink(i){return `${location.origin}/arena/pad/?room=${encodeURIComponent(session.room)}&player=${i+1}#token=${encodeURIComponent(session.padTokens[i])}`;}
async function drawPairing(){
  $('pair-card2').hidden=mode==='training';
  for(let i=0;i<2;i++){$('pair-name'+(i+1)).textContent=game.names[i];await QR.toCanvas($('qr'+(i+1)),padLink(i),{width:210,margin:2,errorCorrectionLevel:'M',color:{dark:'#181124',light:'#ffffff'}});}
  refreshPresence();
}
function showCourt(){
  $('home').hidden=true;$('court-view').hidden=false;
  try{scene??=createScene($('court'));}catch(e){notify('A renderização 3D não iniciou. Ative a aceleração gráfica do navegador.');$('game-call').textContent='Não foi possível abrir a quadra 3D.';return;}
  $('bracket-button').hidden=mode!=='tournament';drawPairing();
  connectLocalScreen();
}
function publishLocalFrame(){if(localScreen&&game)localScreen.postMessage(spectatorSnapshot(game,mode,Date.now(),racketPoses));}
function connectLocalScreen(){
  if(!session||!('BroadcastChannel'in window))return;
  const name=spectatorChannel(session.room);if(localScreen?.name===name)return;
  localScreen?.close();clearInterval(localPulse);localScreen=new BroadcastChannel(name);
  localScreen.onmessage=event=>{if(event.data?.type==='hello')publishLocalFrame();};
  // Background tabs suspend animation frames. Paused state stays alive locally.
  localPulse=setInterval(()=>{if(game?.paused||document.hidden)publishLocalFrame();},1000);
}
$('view-toggle').onclick=()=>{view=view==='players'?'overview':'players';$('view-toggle').textContent=view==='players'?'Visão geral':'Visão do jogador';$('view-toggle').setAttribute('aria-pressed',String(view==='overview'));};
$('open-spectator').onclick=()=>{
  if(!session)return;if(!('BroadcastChannel'in window)){notify('Este navegador não suporta o telão local. Use um navegador atualizado.');return;}
  const url=`/arena/?spectator=1#room=${encodeURIComponent(session.room)}`;
  // No host or phone token is ever put into the spectator URL or channel.
  const extra=window.open(url,'cahk-arena-local-screen','popup,width=1280,height=850');
  if(!extra)notify('Permita a abertura da janela do telão neste navegador.');
};
function newGame(){
  let names=[$('name1').value.trim()||'Jogador 1',mode==='training'?'Kremer Bot':$('name2').value.trim()||'Jogador 2'],target=11;
  if(mode==='tournament'){
    const m=nextMatch(tournament);if(!m)return false;names=m.players.map(p=>p.name);matchId=m.id;target=tournament.rounds.at(-1).length===1&&tournament.rounds.at(-1).includes(m)?11:7;
  }
  game=createGame({target,names});game.paused=true;running=false;manualPause=true;finishedHandled=false;drawHud();return true;
}
async function createSession(resume=false){
  $('home-error').textContent='';$('create').disabled=true;$('resume').disabled=true;
  try{
    if(resume){session=read(KEY);if(!session?.hostToken||!Array.isArray(session.padTokens))throw Error('Não há uma sessão válida salva.');const local=read(BACKUP);
      const status=await fetch(`/arena/api/rooms/${encodeURIComponent(session.room)}/status`,{method:'POST',headers:{Authorization:`Bearer ${session.hostToken}`}});
      if([403,404,410].includes(status.status)){
        const fresh=await fetch('/arena/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!fresh.ok)throw Error('Não foi possível recuperar a sala. Tente novamente.');session=await fresh.json();write(KEY,session);notify('Sala recuperada. Conecte os celulares pelos novos QR codes.');
      }else if(!status.ok)throw Error('Não foi possível consultar a sala. Verifique a conexão.');
      if(local)restore(local);recovering=true;
    }
    else{
      const nextTournament=mode==='tournament'?createTournament($('names').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)):null;
      const response=await fetch('/arena/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      const data=await response.json().catch(()=>null);if(!response.ok||!data?.room)throw Error(data?.error||'O servidor da Arena não está disponível. Verifique a publicação do Worker.');
      session=data;write(KEY,session);tournament=nextTournament;matchId=null;newGame();
    }
    leaving=false;serverReady=false;openHost();if(game){showCourt();await drawPairing();if(game.phase!=='finished')$('pair-dialog').showModal();}else{game=createGame();game.paused=true;showCourt();$('pair-dialog').showModal();}
  }catch(e){$('home-error').textContent=e.message;$('home').hidden=false;$('court-view').hidden=true;}
  finally{$('create').disabled=false;$('resume').disabled=false;}
}
$('create').onclick=()=>createSession();$('resume').hidden=!read(KEY);$('resume').onclick=()=>createSession(true);
$('start').onclick=()=>{if(!canPlay())return;running=true;manualPause=false;game.paused=false;$('pair-dialog').close();$('game-call').textContent='';tone(650);checkpoint();refreshPresence();};
$('pairing').onclick=()=>{if(game&&running){game.paused=true;manualPause=true;checkpoint();}drawPairing();$('pair-dialog').showModal();};
$('pause').onclick=()=>{if(!canPlay()||!running)return;manualPause=!game.paused;game.paused=!game.paused;checkpoint();refreshPresence();};
document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
for(let i=0;i<2;i++)$('copy'+(i+1)).onclick=async()=>{try{await navigator.clipboard.writeText(padLink(i));notify('Link copiado. Envie somente ao jogador correspondente.');}catch{notify('Não foi possível copiar. Escaneie o QR code na tela.');}};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.body.requestFullscreen();}catch{notify('Use a opção de tela cheia do navegador.');}};
$('sound').onclick=()=>{sound=!sound;$('sound').textContent=`Som: ${sound?'on':'off'}`;$('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',sound?'Desativar som':'Ativar som');tone(550);};
$('leave').onclick=()=>{if(game?.phase==='rally'&&!confirm('Pausar e voltar ao início? O placar ficará salvo.'))return;if(game){game.paused=true;manualPause=true;checkpoint();}clearInterval(localPulse);localScreen?.close();localScreen=null;leaving=true;clearTimeout(reconnectTimer);ws?.close();$('court-view').hidden=true;$('home').hidden=false;$('resume').hidden=false;game=null;running=false;};
function drawHud(){if(!game)return;$('show-result').hidden=game.phase!=='finished';for(let i=0;i<2;i++){$('player'+(i+1)).textContent=game.names[i];$('score'+(i+1)).textContent=game.scores[i];}
 $('view-player1').textContent=`01 · ${game.names[0]}`;$('view-player2').textContent=`02 · ${game.names[1]}`;
 $('match-label').textContent=mode==='tournament'?`${game.target===11?'FINAL':'CAMPEONATO'} · ATÉ ${game.target}`:mode==='training'?'TREINO CAHK':`DUELO · ATÉ ${game.target}`;
 $('rally').textContent=game.rally?`RALLY ${game.rally}`:'PREPARE SUA RAQUETE';
}
function handleFinish(){
  finishedHandled=true;running=false;manualPause=true;
  if(tournament&&matchId){const m=tournament.rounds.flat().find(m=>m.id===matchId);if(m&&!m.winner)completeMatch(tournament,matchId,m.players[game.winner].id,game.scores);renderBracket();}
  $('winner').textContent=`${game.names[game.winner]} venceu!`;$('result-score').textContent=`${game.scores[0]} × ${game.scores[1]} · maior rally: ${game.bestRally}`;
  $('next').textContent=tournament?(tournament.champion?'Ver campeão e chave →':'Preparar próxima partida →'):'Jogar novamente →';$('result-dialog').showModal();tone(900,.25);checkpoint();
}
$('next').onclick=()=>{$('result-dialog').close();if(tournament?.champion){renderBracket();$('bracket-dialog').showModal();return;}newGame();drawPairing();$('pair-dialog').showModal();checkpoint();};
$('show-result').onclick=()=>{$('result-dialog').showModal();};
function renderBracket(){
  const root=$('bracket');root.replaceChildren();if(!tournament)return;
  tournament.rounds.forEach((round,i)=>{const column=document.createElement('section');column.className='bracket-round';const title=document.createElement('h3');title.textContent=round.length===1?'FINAL':`RODADA ${i+1}`;column.append(title);round.forEach(m=>{const box=document.createElement('div');box.className='bracket-match';m.players.forEach((p,j)=>{const row=document.createElement('div');row.textContent=p?`${p.name}${m.scores?' · '+m.scores[j]:''}`:'Avanço livre';if(p&&m.winner?.id===p.id)row.className='won';box.append(row);});column.append(box);});root.append(column);});
  if(tournament.champion){const e=document.createElement('p');e.textContent=`Campeão: ${tournament.champion.name}`;e.style.color='var(--lime)';root.append(e);}
}
$('bracket-button').onclick=()=>{if(game&&running){game.paused=true;manualPause=true;checkpoint();refreshPresence();}renderBracket();$('bracket-dialog').showModal();};
$('export').onclick=()=>{const b=new Blob([JSON.stringify({tournament,game,savedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download='campeonato-cahk.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game&&running){game.paused=true;manualPause=true;checkpoint();refreshPresence();}});
window.addEventListener('pagehide',()=>{if(game){game.paused=true;write(BACKUP,{version:1,mode,game,tournament,matchId,savedAt:Date.now()});publishLocalFrame();}clearInterval(localPulse);localScreen?.close();localScreen=null;});
window.addEventListener('pageshow',event=>{if(event.persisted&&game&&session)connectLocalScreen();});
window.addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;if(e.code==='Space'){e.preventDefault();$('pause').click();}if(e.key.toLowerCase()==='f')$('fullscreen').click();if(e.key.toLowerCase()==='c'){send({type:'calibrate',player:0});if(mode!=='training')send({type:'calibrate',player:1});}});
function frame(now){
 const dt=last?Math.min((now-last)/1000,.1):0;last=now;
 if(game){
   for(let i=0;i<2;i++)if(now-poseReceived[i]>2500)racketPoses[i]=null;
   accumulator+=dt;while(accumulator>=1/120){stepGame(game,1/120);accumulator-=1/120;}
   if(mode==='training'&&running&&!game.paused&&now>botAt){
     const p=game.players[1],b=game.ball;
     if(game.phase==='serve'&&game.serving===1&&game.timer>1.2||game.phase==='rally'&&game.lastHit===0&&Math.abs(b.z-p.z)<1.05&&Math.abs(b.x-p.x)<1){swing(game,1,{power:.45,aim:Math.sin(now*.0009)*.75,lob:.2});botAt=now+400;}
   }
   if(game.event){const ev=game.event;game.event=null;if(ev.type==='point'){checkpoint();send({type:'feedback',player:ev.player,event:'point',power:1});tone(550,.15);}else if(ev.type==='bounce')tone(200,.035);}
   drawHud();if(scene&&!$('court-view').hidden&&!document.hidden&&now-lastPaint>1000/(game.paused?10:60)){scene.draw(game,now/1000,{layout:view==='overview'?'overview':mode==='training'?'player':'split',overview:true,poses:racketPoses});lastPaint=now;}
   if(localScreen&&!game.paused&&now-broadcastAt>1000/12){publishLocalFrame();broadcastAt=now;}
   if(game.phase==='finished'&&!finishedHandled)handleFinish();
   if(!game.paused&&running){$('game-call').textContent=game.phase==='serve'?`${game.names[game.serving]}\nFaça o movimento para sacar`:game.phase==='point'?'PONTO!':'';}
   if(game.paused&&!running&&game.phase!=='finished')$('game-call').textContent=canPlay()?'CONTROLES PRONTOS\nInicie pela tela de pareamento':'CONECTEM OS CELULARES';
 }
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Test automation can observe behavior through DOM and actual sockets; no privileged debug API.

}
