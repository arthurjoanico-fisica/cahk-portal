export function createTournament(names){
  if(!Array.isArray(names)||names.length<4||names.length>16)throw Error('Inscreva de 4 a 16 participantes.');
  names=names.map(n=>String(n).trim().slice(0,28));
  if(names.some(n=>!n)||new Set(names.map(n=>n.toLocaleLowerCase('pt-BR'))).size!==names.length)throw Error('Use nomes diferentes para cada participante.');
  const players=names.map((name,i)=>({id:'p'+i,name}));let size=4;while(size<names.length)size*=2;
  const t={version:1,players,rounds:[],champion:null};
  // Spread byes across the first round; bracket order follows registration order.
  const first=[];let k=0,byes=size-names.length;
  for(let i=0;i<size/2;i++)first.push({id:`r0m${i}`,players:[players[k++],i<byes?null:players[k++]],winner:null,scores:null});
  t.rounds.push(first);advance(t);return t;
}
function advance(t){
  for(let r=0;r<t.rounds.length;r++){
    const round=t.rounds[r];for(const m of round)if(m.players[0]&&!m.players[1])m.winner=m.players[0];
    if(round.every(m=>m.winner)){
      if(round.length===1){t.champion=round[0].winner;return;}
      if(!t.rounds[r+1])t.rounds.push(Array.from({length:round.length/2},(_,i)=>({id:`r${r+1}m${i}`,players:[round[i*2].winner,round[i*2+1].winner],winner:null,scores:null})));
    }
  }
}
export function nextMatch(t){return t.rounds.flat().find(m=>!m.winner&&m.players.every(Boolean))||null;}
export function completeMatch(t,id,winnerId,scores){
  const m=t.rounds.flat().find(m=>m.id===id);
  if(!m||m.winner||!m.players.every(Boolean))throw Error('Partida indisponível.');
  const winner=m.players.find(p=>p.id===winnerId);
  if(!winner||!Array.isArray(scores)||scores.length!==2||scores.some(n=>!Number.isInteger(n)||n<0||n>15)||scores[0]===scores[1]||m.players[scores[0]>scores[1]?0:1].id!==winnerId)throw Error('Resultado inválido.');
  m.winner=winner;m.scores=[...scores];advance(t);return t;
}
