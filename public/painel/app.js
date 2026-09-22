(()=>{
const PORTAL='https://ekmzeqnnktdwvzxacbix.supabase.co',PKEY='sb_publishable_jeWoJ4G9UXN6ucS3WkZVzA_ytTEzuJz';
const RADIO='https://jcxzlbhwkhtxsabcewuk.supabase.co',RKEY='sb_publishable_bRJFBGZdq1pOVpej6ZS7mw_9v24g69Y';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
async function portal(action,extra={}){const r=await fetch(`${PORTAL}/functions/v1/portal-public`,{method:'POST',headers:{'Content-Type':'application/json','apikey':PKEY},body:JSON.stringify({action,...extra})});const d=await r.json();if(!r.ok||d.error)throw new Error(d.error||'Erro');return d}
async function campus(){let r=await fetch(`${PORTAL}/functions/v1/campus-info`,{method:'POST',headers:{'Content-Type':'application/json','apikey':PKEY},body:JSON.stringify({date:localDate()})});if(r.ok)return r.json();return portal('campus',{date:localDate()})}
let weatherCache=null,weatherLast=0;
async function weather(){
  if(weatherCache&&(Date.now()-weatherLast)<10*60*1000)return weatherCache;
  const r=await fetch(`${PORTAL}/functions/v1/weather-info`,{method:'POST',headers:{'Content-Type':'application/json','apikey':PKEY},body:'{}'});
  const d=await r.json();
  if(!r.ok||d.error)throw new Error(d.error||'Clima');
  weatherCache=d;weatherLast=Date.now();return d;
}
async function radio(){const url=`${RADIO}/rest/v1/queue?select=id,youtube_id,title,channel,thumbnail,status,position,requested_by,source,started_at&status=in.(playing,queued)&order=position.asc&limit=12`;const r=await fetch(url,{headers:{apikey:RKEY,Authorization:`Bearer ${RKEY}`}});if(!r.ok)throw new Error('Rádio');return r.json()}
function clock(){const d=new Date();$('#clock').textContent=d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});$('#date').textContent=d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}
function buses(bus){const d=new Date(),dow=d.getDay(),cur=d.getHours()*60+d.getMinutes();let rows=dow===6?bus?.saturday:bus?.weekdays;if(dow===3)rows=[...(rows||[]),...(bus?.wednesdayExtra||[])];if(dow===0)rows=[];return (rows||[]).flatMap(r=>r.times.map(t=>({line:r.line,time:t,min:+t.slice(0,2)*60 + +t.slice(3,5)}))).filter(x=>x.min>=cur).sort((a,b)=>a.min-b.min).slice(0,5)}
function renderRadio(rows=[]){const playing=rows.find(x=>x.status==='playing'),queued=rows.filter(x=>x.status==='queued').slice(0,3);const img=$('#nowImg'),ph=$('#nowPlaceholder');if(playing){$('#nowTitle').textContent=playing.title||'Música';$('#nowChannel').textContent=playing.channel||'YouTube';$('#nowRequest').textContent=playing.requested_by?`Pedido por ${playing.requested_by}`:(playing.source==='auto'?'Programação automática':'Rádio CAHK');if(playing.thumbnail){img.src=playing.thumbnail;img.hidden=false;ph.hidden=true}else{img.hidden=true;ph.hidden=false}}else{$('#nowTitle').textContent='Aguardando próxima música';$('#nowChannel').textContent='Rádio CAHK';$('#nowRequest').textContent='Player pronto';img.hidden=true;ph.hidden=false}
$('#queue').innerHTML=queued.length?queued.map((q,i)=>`<div class="queue-mini"><span>Próxima ${i+1}</span><strong>${esc(q.title)}</strong><small>${esc(q.channel||'YouTube')}</small></div>`).join(''):'<div class="tv-empty">Nenhum pedido aguardando.</div>'}
function renderCampus(d){const ru=d?.ru,menu=ru?.menu;$('#ruDate').textContent=ru?.date?new Date(`${ru.date}T12:00:00`).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'}):'Hoje';const meals=[['Café',menu?.cafe],['Almoço',menu?.almoco],['Jantar',menu?.jantar]].filter(x=>x[1]);$('#meals').innerHTML=meals.length?meals.map(([a,b])=>`<div class="meal-mini"><span>${a}</span><p>${esc(b)}</p></div>`).join(''):'<div class="tv-empty">Cardápio não disponível.</div>';const next=buses(d?.intercampi);$('#buses').innerHTML=next.length?next.map(x=>`<span class="bus-chip"><strong>${esc(x.time)}</strong>${esc(x.line)}</span>`).join(''):'<span class="tv-empty">Sem outros horários hoje.</span>'}
function renderNotices(d){const rows=(d?.notices||[]).slice(0,4);$('#notices').innerHTML=rows.length?rows.map(n=>`<div class="notice-mini"><strong>${esc(n.title)}</strong>${n.body?`<p>${esc(n.body)}</p>`:''}</div>`).join(''):'<div class="tv-empty">Nenhum aviso ativo.</div>'}
function renderAgenda(d){const rows=(d?.events||[]).slice(0,4);$('#agenda').innerHTML=rows.length?rows.map(e=>`<div class="agenda-chip"><span>${new Date(`${e.event_date}T12:00:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}${e.start_time?' • '+String(e.start_time).slice(0,5):''}</span><strong>${esc(e.title)}</strong></div>`).join(''):'<div class="tv-empty">Agenda sem próximos eventos.</div>'}
function renderWeather(d){
  const c=d?.current||{},day=d?.day||{},hours=(d?.hourly||[]).slice(0,8);
  $('#weatherSource').textContent=d?.source||'Previsão';
  $('#weatherIcon').textContent=c.icon||'🌤️';
  $('#weatherTemp').textContent=Number.isFinite(Number(c.temperature))?`${Math.round(Number(c.temperature))}°`:'--°';
  $('#weatherLabel').textContent=c.label||'Tempo variável';
  const rain=Number(day.rain_probability_max||0);
  $('#weatherMeta').textContent=`Sens. ${Math.round(Number(c.apparent||c.temperature||0))}° · Máx ${Math.round(Number(day.max||0))}° · Mín ${Math.round(Number(day.min||0))}° · Chuva ${Math.round(rain)}%`;
  $('#weatherHours').innerHTML=hours.length?hours.map(h=>`<div class="weather-hour"><span>${esc(h.hour)}</span><b>${esc(h.icon||'🌤️')}</b><strong>${Math.round(Number(h.temperature||0))}°</strong><small>${Math.round(Number(h.rain_probability||0))}% chuva</small></div>`).join(''):'<div class="tv-empty">Previsão horária indisponível.</div>';
}
async function refresh(){try{const [r,c,n,a,w]=await Promise.allSettled([radio(),campus(),portal('notices'),portal('events'),weather()]);if(r.status==='fulfilled')renderRadio(r.value);if(c.status==='fulfilled')renderCampus(c.value);if(n.status==='fulfilled')renderNotices(n.value);if(a.status==='fulfilled')renderAgenda(a.value);if(w.status==='fulfilled')renderWeather(w.value);$('#updated').textContent='Atualizado '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}catch{}}
$('#fullscreen').onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{}};
$('#theme').onclick=()=>{const dark=document.documentElement.dataset.theme==='dark';if(dark)delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme='dark';try{localStorage.setItem('cahk-theme',dark?'light':'dark')}catch{}};
clock();setInterval(clock,1000);refresh();setInterval(refresh,30000);
})();
