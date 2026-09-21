(()=>{
const URL='https://ekmzeqnnktdwvzxacbix.supabase.co',
KEY='sb_publishable_jeWoJ4G9UXN6ucS3WkZVzA_ytTEzuJz',
$=s=>document.querySelector(s),
esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

const localDate=()=>{
  const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};

let ruDays={today:null,tomorrow:null};
let activeRuDay='today';

async function callCampus(){
  const body={date:localDate()};
  const headers={'Content-Type':'application/json','apikey':KEY};
  let r=await fetch(`${URL}/functions/v1/campus-info`,{method:'POST',headers,body:JSON.stringify(body)});
  if(r.ok)return r.json();

  // Fallback temporário para a função antiga.
  r=await fetch(`${URL}/functions/v1/portal-public`,{
    method:'POST',headers,
    body:JSON.stringify({action:'campus',date:body.date})
  });
  const d=await r.json();
  if(!r.ok||d.error)throw new Error(d.error||'Erro');
  return d;
}

async function load(){
  try{
    const d=await callCampus();
    ruDays.today=d.ru||null;
    ruDays.tomorrow=d.ruTomorrow||null;
    renderRuTabs();
    renderRuDay('today');
    renderBus(d.intercampi);
  }catch(e){
    $('#ruMenu').innerHTML='<div class="campus-empty">Não foi possível buscar o cardápio agora. Use a fonte oficial.</div>';
    $('#nextBuses').innerHTML='<span class="next-bus">Consulte o horário oficial</span>';
  }
}

function hasMenu(ru){
  return !!(ru?.menu&&(ru.menu.cafe||ru.menu.almoco||ru.menu.jantar));
}

function renderRuTabs(){
  const wrap=$('#ruTabs');
  if(!wrap)return;
  const hasTomorrow=hasMenu(ruDays.tomorrow);
  wrap.innerHTML=`
    <button type="button" class="ru-tab active" data-day="today">Hoje</button>
    <button type="button" class="ru-tab" data-day="tomorrow" ${hasTomorrow?'':'disabled'}>Amanhã</button>
  `;
  wrap.querySelectorAll('.ru-tab').forEach(b=>{
    b.addEventListener('click',()=>{
      if(b.disabled)return;
      renderRuDay(b.dataset.day);
    });
  });
}

function renderRuDay(day){
  const ru=day==='tomorrow'?ruDays.tomorrow:ruDays.today;
  activeRuDay=day;

  document.querySelectorAll('.ru-tab').forEach(b=>b.classList.toggle('active',b.dataset.day===day));
  if(ru?.source)$('#ruOfficial').href=ru.source;

  if(!ru){
    $('#ruDate').textContent=day==='tomorrow'?'Cardápio de amanhã':'Cardápio de hoje';
    $('#ruMenu').innerHTML='<div class="campus-empty">Cardápio não disponível.</div>';
    return;
  }

  $('#ruDate').textContent=new Date(`${ru.date}T12:00:00`).toLocaleDateString('pt-BR',{
    weekday:'long',day:'2-digit',month:'long'
  });

  if(!hasMenu(ru)){
    $('#ruMenu').innerHTML=`<div class="campus-empty">${
      day==='tomorrow'
        ? 'O cardápio de amanhã ainda não foi publicado na fonte oficial.'
        : 'O cardápio de hoje não pôde ser lido automaticamente. Clique em “Fonte oficial”.'
    }</div>`;
    return;
  }

  const meals=[
    ['Café da manhã',ru.menu.cafe],
    ['Almoço',ru.menu.almoco],
    ['Jantar',ru.menu.jantar]
  ].filter(x=>x[1]);

  $('#ruMenu').innerHTML=`<div class="meal-grid">${
    meals.map(([a,b])=>`<div class="meal"><span>${a}</span><p>${esc(b)}</p></div>`).join('')
  }</div>`;
}

function renderBus(bus){
  $('#busOfficial').href=bus.source;
  $('#busUpdated').textContent=`Fonte: CENTRAN/UFPR • atualização ${bus.updated}. ${bus.note}`;
  const now=new Date(),dow=now.getDay(),cur=now.getHours()*60+now.getMinutes();
  let rows=dow===6?bus.saturday:bus.weekdays;
  if(dow===3)rows=[...rows,...bus.wednesdayExtra];
  if(dow===0)rows=[];
  const all=rows.flatMap(r=>r.times.map(t=>({
    line:r.line,time:t,min:+t.slice(0,2)*60 + +t.slice(3,5)
  }))).filter(x=>x.min>=cur).sort((a,b)=>a.min-b.min).slice(0,5);

  $('#nextBuses').innerHTML=all.length
    ?all.map(x=>`<span class="next-bus"><strong>${esc(x.time)}</strong> · ${esc(x.line)}</span>`).join('')
    :'<span class="next-bus">Sem outros horários previstos hoje</span>';

  $('#busLines').innerHTML=rows.length
    ?rows.map(r=>`<div class="bus-line"><strong>${esc(r.line)}</strong><div class="bus-times">${
      r.times.map(t=>`<span class="bus-time">${esc(t)}</span>`).join('')
    }</div></div>`).join('')
    :'<div class="campus-empty">Sem linhas regulares listadas para hoje. Consulte a fonte oficial.</div>';
}

load();
})();