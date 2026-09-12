(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  if (menuButton && nav) {
    menuButton.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
    }));
  }

  const SUPABASE_URL='https://ekmzeqnnktdwvzxacbix.supabase.co';
  const KEY='sb_publishable_jeWoJ4G9UXN6ucS3WkZVzA_ytTEzuJz';
  const list=document.querySelector('#events-list');
  if(!list) return;

  const esc=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const month=d=>new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase();
  const day=d=>String(new Date(`${d}T12:00:00`).getDate()).padStart(2,'0');
  const time=t=>t?String(t).slice(0,5).replace(':','h'):'';

  async function loadEvents(){
    list.innerHTML='<div class="empty-events"><div><strong>Carregando agenda…</strong>Buscando os próximos eventos do CAHK.</div></div>';
    try{
      const r=await fetch(`${SUPABASE_URL}/functions/v1/portal-public`,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY},body:JSON.stringify({action:'events'})});
      const data=await r.json();
      if(!r.ok||data?.error) throw new Error(data?.error||'Falha ao carregar eventos');
      render(data.events||[]);
    }catch(e){
      console.error(e);
      list.innerHTML=`<div class="empty-events"><div><strong>Agenda em atualização</strong>Os próximos eventos do CAHK vão aparecer aqui.</div><a class="text-link" href="https://www.instagram.com/cahk.ufpr/" target="_blank" rel="noopener noreferrer">Acompanhar no Instagram →</a></div>`;
    }
  }

  function render(events){
    if(!events.length){
      list.innerHTML=`<div class="empty-events"><div><strong>Agenda em atualização</strong>Os próximos eventos do CAHK vão aparecer aqui.</div><a class="text-link" href="https://www.instagram.com/cahk.ufpr/" target="_blank" rel="noopener noreferrer">Acompanhar no Instagram →</a></div>`;
      return;
    }
    list.innerHTML=events.slice(0,6).map(ev=>{
      const url=ev.event_url||'#eventos';
      const external=/^https?:\/\//i.test(url)?' target="_blank" rel="noopener noreferrer"':'';
      const cover=ev.image_url
        ? `<div class="event-cover"><img src="${esc(ev.image_url)}" alt="${esc(ev.title)}" loading="lazy"><div class="event-cover-date"><strong>${day(ev.event_date)}</strong><span>${month(ev.event_date)}</span></div></div>`
        : `<div class="event-cover no-image">CAHK<div class="event-cover-date"><strong>${day(ev.event_date)}</strong><span>${month(ev.event_date)}</span></div></div>`;
      return `<a class="event-card-v5" href="${esc(url)}"${external}>${cover}<div class="event-card-body"><h3>${esc(ev.title)}</h3><div class="event-meta">${ev.place?`<span>⌖ ${esc(ev.place)}</span>`:''}${ev.start_time?`<span>◷ ${esc(time(ev.start_time))}</span>`:''}</div>${ev.description?`<p class="event-desc">${esc(ev.description)}</p>`:''}${ev.event_url?'<span class="event-action">Ver detalhes →</span>':''}</div></a>`;
    }).join('');
  }

  loadEvents();
})();