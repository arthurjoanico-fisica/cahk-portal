export function computeViewports(width,height,{layout='split',overview=true}={}){
  width=Math.max(1,Math.round(width));height=Math.max(1,Math.round(height));
  if(layout==='overview')return [{kind:'overview',x:0,y:0,width,height}];
  if(layout==='player')return [{kind:'player',player:0,x:0,y:0,width,height}];
  const stacked=width/height<1.1,half=Math.floor((stacked?height:width)/2);
  const result=stacked?[
    {kind:'player',player:0,x:0,y:height-half,width,height:half},
    {kind:'player',player:1,x:0,y:0,width,height:height-half},
  ]:[
    {kind:'player',player:0,x:0,y:0,width:half,height},
    {kind:'player',player:1,x:half,y:0,width:width-half,height},
  ];
  if(overview){const w=Math.min(240,Math.round(width*.21)),h=Math.round(w*.68);result.push({kind:'overview',inset:true,x:Math.round((width-w)/2),y:height-h-14,width:w,height:h});}
  return result;
}
export function playerCameraPose(player,index){
  const side=index===0?1:-1;
  return {eye:{x:player.x,y:1.85,z:player.z+side*.9},target:{x:player.x*.25,y:.95,z:-side*5.6}};
}
export function playerRelativeShot(shot,index){
  const side=index===0?1:-1;
  return {...shot,aim:shot.aim*side,spin:shot.spin*side};
}
