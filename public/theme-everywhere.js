(()=>{
  const root=document.documentElement;
  const meta=document.querySelector('meta[name="theme-color"]');
  const read=()=>{try{return localStorage.getItem('cahk-theme')}catch{return null}};
  const apply=(value)=>{
    if(value==='dark')root.dataset.theme='dark';
    else delete root.dataset.theme;
    try{localStorage.setItem('cahk-theme',value)}catch{}
    if(meta)meta.setAttribute('content',value==='dark'?'#111015':'#5b2bbf');
    document.querySelectorAll('[data-cahk-theme-toggle]').forEach(btn=>{
      btn.setAttribute('aria-label',value==='dark'?'Ativar modo claro':'Ativar modo escuro');
      btn.setAttribute('title',value==='dark'?'Ativar modo claro':'Ativar modo escuro');
      btn.setAttribute('aria-pressed',String(value==='dark'));
      btn.innerHTML=value==='dark'
        ?'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
        :'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.3A8.8 8.8 0 0 1 8.7 3.5 8.9 8.9 0 1 0 20.5 15.3Z"/></svg>';
    });
  };
  let current=read();
  if(current!=='dark'&&current!=='light') current=(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';
  apply(current);

  if(!document.querySelector('[data-cahk-theme-toggle]')){
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='cahk-theme-mini';
    btn.setAttribute('data-cahk-theme-toggle','');
    const nav=document.querySelector('.cahk-subnav');
    if(nav)nav.appendChild(btn);
    else{
      btn.classList.add('cahk-theme-floating');
      document.body.appendChild(btn);
    }
  }
  apply(root.dataset.theme==='dark'?'dark':'light');

  document.querySelectorAll('[data-cahk-theme-toggle]').forEach(btn=>{
    btn.addEventListener('click',()=>apply(root.dataset.theme==='dark'?'light':'dark'));
  });
})();
