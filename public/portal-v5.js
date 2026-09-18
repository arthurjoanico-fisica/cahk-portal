(() => {
  const root = document.documentElement;
  const themeToggle = document.querySelector('#themeToggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const storedTheme = (() => { try { return localStorage.getItem('cahk-theme'); } catch { return null; } })();
  if (storedTheme === 'dark' || storedTheme === 'light') root.dataset.theme = storedTheme === 'dark' ? 'dark' : '';
  const syncThemeUi = () => {
    const dark = root.dataset.theme === 'dark';
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
      themeToggle.setAttribute('title', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
      themeToggle.setAttribute('aria-pressed', String(dark));
    }
    if (themeMeta) themeMeta.setAttribute('content', dark ? '#111015' : '#5b2bbf');
  };
  if (themeToggle) themeToggle.addEventListener('click', () => {
    const dark = root.dataset.theme === 'dark';
    if (dark) delete root.dataset.theme; else root.dataset.theme = 'dark';
    try { localStorage.setItem('cahk-theme', dark ? 'light' : 'dark'); } catch {}
    syncThemeUi();
  });
  syncThemeUi();

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
  // Link Vida no Campus em todas as páginas que usam este script.
  if (nav && !nav.querySelector('a[href="/vida-campus/"]')) {
    const link=document.createElement('a');link.href='/vida-campus/';link.textContent='Vida no Campus';
    const historyLink=nav.querySelector('a[href="/historia/"]');
    if(historyLink) nav.insertBefore(link,historyLink); else nav.appendChild(link);
  }
  const ensureNav=(href,label,before='/historia/')=>{if(!nav||nav.querySelector(`a[href="${href}"]`))return;const a=document.createElement('a');a.href=href;a.textContent=label;const b=nav.querySelector(`a[href="${before}"]`);if(b)nav.insertBefore(a,b);else nav.appendChild(a)};
  ensureNav('/agenda/','Agenda');ensureNav('/transparencia/','Transparência');

  // Busca global do portal.
  const headerActions=document.querySelector('.header-actions');
  if(headerActions && !document.querySelector('#globalSearchToggle')){
    const btn=document.createElement('button');btn.id='globalSearchToggle';btn.className='search-toggle';btn.type='button';btn.title='Pesquisar no portal';btn.setAttribute('aria-label','Pesquisar no portal');
    btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>';
    headerActions.insertBefore(btn,headerActions.firstChild);
    const overlay=document.createElement('div');overlay.className='global-search-backdrop';overlay.id='globalSearchBackdrop';
    overlay.innerHTML='<div class="global-search-panel" role="dialog" aria-modal="true" aria-label="Busca no Portal CAHK"><div class="global-search-head"><input id="globalSearchInput" type="search" placeholder="Pesquisar livros, projetos, eventos e páginas…" autocomplete="off"><button class="global-search-close" id="globalSearchClose" type="button" aria-label="Fechar">×</button></div><div class="global-search-results" id="globalSearchResults"><div class="search-empty">Digite pelo menos 2 letras para pesquisar.</div></div></div>';
    document.body.appendChild(overlay);
    const input=overlay.querySelector('#globalSearchInput'),results=overlay.querySelector('#globalSearchResults');let timer=0,seq=0;
    const close=()=>{overlay.classList.remove('open');document.body.style.overflow=''};
    btn.onclick=()=>{overlay.classList.add('open');document.body.style.overflow='hidden';setTimeout(()=>input.focus(),20)};
    overlay.querySelector('#globalSearchClose').onclick=close;overlay.onclick=e=>{if(e.target===overlay)close()};document.addEventListener('keydown',e=>{if(e.key==='Escape')close();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();btn.click()}});
    const renderSearch=rows=>{results.innerHTML=rows.length?rows.map(x=>`<a class="search-result" href="${String(x.url||'/').replace(/"/g,'&quot;')}" ${/^https?:/i.test(x.url||'')?'target="_blank" rel="noopener"':''}><span class="search-result-type">${String(x.type||'Resultado')}</span><span><strong>${String(x.title||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}</strong><small>${String(x.subtitle||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}</small></span><span class="search-result-arrow">→</span></a>`).join(''):'<div class="search-empty">Nenhum resultado encontrado.</div>'};
    input.oninput=()=>{clearTimeout(timer);const q=input.value.trim();if(q.length<2){results.innerHTML='<div class="search-empty">Digite pelo menos 2 letras para pesquisar.</div>';return}const my=++seq;results.innerHTML='<div class="search-empty">Pesquisando…</div>';timer=setTimeout(async()=>{try{const r=await fetch(`${SUPABASE_URL}/functions/v1/portal-public`,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY},body:JSON.stringify({action:'search',q})});const d=await r.json();if(my!==seq)return;if(!r.ok||d.error)throw new Error(d.error||'Erro');renderSearch(d.results||[])}catch(e){if(my===seq)results.innerHTML='<div class="search-empty">Não foi possível pesquisar agora.</div>'}},220)};
  }
  const esc=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const noticeList=document.querySelector('#noticeList');
  if(noticeList){(async()=>{try{const r=await fetch(`${SUPABASE_URL}/functions/v1/portal-public`,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY},body:JSON.stringify({action:'notices'})});const d=await r.json();if(!r.ok||d.error)throw new Error(d.error||'Erro');const rows=d.notices||[];noticeList.innerHTML=rows.length?rows.map(n=>`<article class="notice-card ${esc(n.level||'info')}"><span class="notice-dot"></span><div><h3>${esc(n.title)}</h3>${n.body?`<p>${esc(n.body)}</p>`:''}</div>${n.link_url?`<a href="${esc(n.link_url)}" ${/^https?:/i.test(n.link_url)?'target="_blank" rel="noopener"':''}>${esc(n.link_label||'Saiba mais')} →</a>`:''}</article>`).join(''):'<div class="notice-empty">Nenhum aviso ativo no momento.</div>'}catch(e){noticeList.innerHTML='<div class="notice-empty">Avisos temporariamente indisponíveis.</div>'}})()}
  if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}
  const list=document.querySelector('#events-list');
  if(!list) return;

  const escEvents=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
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
        ? `<div class="event-cover"><img src="${escEvents(ev.image_url)}" alt="${escEvents(ev.title)}" loading="lazy"><div class="event-cover-date"><strong>${day(ev.event_date)}</strong><span>${month(ev.event_date)}</span></div></div>`
        : `<div class="event-cover no-image">CAHK<div class="event-cover-date"><strong>${day(ev.event_date)}</strong><span>${month(ev.event_date)}</span></div></div>`;
      return `<a class="event-card-v5" href="${escEvents(url)}"${external}>${cover}<div class="event-card-body"><h3>${escEvents(ev.title)}</h3><div class="event-meta">${ev.place?`<span>⌖ ${escEvents(ev.place)}</span>`:''}${ev.start_time?`<span>◷ ${escEvents(time(ev.start_time))}</span>`:''}</div>${ev.description?`<p class="event-desc">${escEvents(ev.description)}</p>`:''}${ev.event_url?'<span class="event-action">Ver detalhes →</span>':''}</div></a>`;
    }).join('');
  }

  loadEvents();
})();