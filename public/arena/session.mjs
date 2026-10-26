import {restoreGame} from './engine.mjs';
function valid(value){
  if(value?.version!==1||!Number.isFinite(value.savedAt))return false;
  try{restoreGame(value.game);return true;}catch{return false;}
}
export function newestCheckpoint(local,remote){
  const candidates=[local,remote].filter(valid);
  return candidates.sort((a,b)=>b.savedAt-a.savedAt)[0]||null;
}
export class LinkWatch{
  constructor(now,timeout=3000){this.lastHeard=now;this.timeout=timeout;}
  heard(now){this.lastHeard=now;}
  expired(now){return now-this.lastHeard>this.timeout;}
}
