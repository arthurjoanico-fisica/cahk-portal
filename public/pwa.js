(()=>{
  const VERSION='6.0.7';
  if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js?v='+VERSION).then(r=>r.update().catch(()=>{})).catch(()=>{}));}

  if(!document.querySelector('link[rel="manifest"]')){
    const m=document.createElement('link');m.rel='manifest';m.href='/site.webmanifest';document.head.appendChild(m);
  }
  if(!document.querySelector('link[href^="/install-app.css"]')){
    const c=document.createElement('link');c.rel='stylesheet';c.href='/install-app.css?v='+VERSION;document.head.appendChild(c);
  }
  if(!document.querySelector('meta[name="apple-mobile-web-app-capable"]')){
    const m=document.createElement('meta');m.name='apple-mobile-web-app-capable';m.content='yes';document.head.appendChild(m);
  }
  if(!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')){
    const m=document.createElement('meta');m.name='apple-mobile-web-app-status-bar-style';m.content='black';document.head.appendChild(m);
  }

  let deferredPrompt=null;
  const ua=navigator.userAgent||'';
  const isIOS=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const isAndroid=/Android/i.test(ua);
  const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;

  const icon=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 20h14"/></svg>`;

  function phone(type,step){
    if(type==='ios'){
      if(step===1)return `<div class="cahk-phone-shot"><div class="cahk-shot-status"><span>9:41</span><span>● ● ●</span></div><div class="cahk-shot-page"></div><div class="cahk-safari-bar"><span>‹</span><span>›</span><span class="cahk-icon-box cahk-highlight">↥</span><span>▣</span><span>◫</span></div></div>`;
      if(step===2)return `<div class="cahk-phone-shot"><div class="cahk-shot-status"><span>9:41</span><span>● ● ●</span></div><div class="cahk-shot-page"></div><div class="cahk-share-sheet"><div class="cahk-share-row"><span class="mini">☆</span>Adicionar aos Favoritos</div><div class="cahk-share-row active cahk-highlight"><span class="mini">＋</span>Adicionar à Tela de Início</div><div class="cahk-share-row"><span class="mini">⌕</span>Buscar na Página</div></div></div>`;
      return `<div class="cahk-phone-shot"><div class="cahk-shot-status"><span>9:41</span><span>● ● ●</span></div><div class="cahk-shot-page"></div><div class="cahk-confirm-card"><div class="cahk-app-preview"><img src="/assets/favicon-192.png" alt=""><div><strong>CAHK</strong><div style="font:500 8px system-ui;color:#777">cahk.app</div></div></div><div class="cahk-confirm-actions"><span>Cancelar</span><span class="primary">Adicionar</span></div></div></div>`;
    }
    if(step===1)return `<div class="cahk-phone-shot"><div class="cahk-shot-status"><span>10:08</span><span>● ● ●</span></div><div class="cahk-chrome-bar"><div class="cahk-address">cahk.app</div><div class="cahk-kebab cahk-highlight">⋮</div></div><div class="cahk-shot-page"></div></div>`;
    if(step===2)return `<div class="cahk-phone-shot"><div class="cahk-shot-status"><span>10:08</span><span>● ● ●</span></div><div class="cahk-chrome-bar"><div class="cahk-address">cahk.app</div><div class="cahk-kebab">⋮</div></div><div class="cahk-shot-page"></div><div class="cahk-android-menu"><div class="cahk-menu-row"><span class="mi">☆</span>Favoritos</div><div class="cahk-menu-row active cahk-highlight"><span class="mi">⇩</span>Instalar app</div><div class="cahk-menu-row"><span class="mi">□</span>Compartilhar</div></div></div>`;
    return `<div class="cahk-phone-shot"><div class="cahk-shot-status"><span>10:08</span><span>● ● ●</span></div><div class="cahk-shot-page"></div><div class="cahk-confirm-card"><div class="cahk-app-preview"><img src="/assets/favicon-192.png" alt=""><div><strong>Instalar CAHK?</strong><div style="font:500 8px system-ui;color:#777">Abrir como aplicativo</div></div></div><div class="cahk-confirm-actions"><span>Cancelar</span><span class="primary">Instalar</span></div></div></div>`;
  }

  const steps={
    ios:[
      ['Toque em Compartilhar','No Safari, toque no ícone de compartilhar na barra do navegador.'],
      ['Escolha “Adicionar à Tela de Início”','Role o menu de compartilhamento até encontrar essa opção.'],
      ['Confirme em “Adicionar”','O ícone do CAHK aparecerá na sua Tela de Início.']
    ],
    android:[
      ['Toque em “Instalar agora”','Quando disponível, nosso botão abre diretamente a instalação do Android.'],
      ['Se necessário, abra o menu ⋮','No Chrome, escolha “Instalar app” ou “Adicionar à tela inicial”.'],
      ['Confirme a instalação','Toque em “Instalar” e o CAHK ficará disponível como aplicativo.']
    ]
  };

  function stepsMarkup(type){return steps[type].map((s,i)=>`<article class="cahk-step"><span class="cahk-step-no">${i+1}</span>${phone(type,i+1)}<div><h3>${s[0]}</h3><p>${s[1]}</p></div></article>`).join('');}

  function ensureModal(){
    let modal=document.getElementById('cahkInstallModal');if(modal)return modal;
    modal=document.createElement('div');modal.id='cahkInstallModal';modal.className='cahk-install-modal';modal.hidden=true;
    modal.innerHTML=`<div class="cahk-install-dialog" role="dialog" aria-modal="true" aria-labelledby="cahkInstallTitle">
      <div class="cahk-install-head"><div><h2 id="cahkInstallTitle">Instalar o CAHK</h2><p>Adicione o portal à tela inicial e abra como um aplicativo. As telas podem variar um pouco conforme a versão do sistema.</p></div><button class="cahk-install-close" type="button" aria-label="Fechar">×</button></div>
      <div class="cahk-install-tabs"><button class="cahk-install-tab" data-tab="ios">iPhone / iPad</button><button class="cahk-install-tab" data-tab="android">Android</button></div>
      <div class="cahk-install-panel"><div class="cahk-install-native"><div><strong id="cahkNativeTitle">Instalação rápida</strong><span id="cahkNativeText">Se o navegador oferecer instalação direta, use o botão ao lado.</span></div><button class="cahk-native-install-btn" type="button">Instalar agora</button></div><div class="cahk-install-steps"></div><div class="cahk-installed-note" hidden>O CAHK já está aberto como aplicativo neste dispositivo.</div></div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.cahk-install-close').addEventListener('click',closeModal);
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
    modal.querySelectorAll('.cahk-install-tab').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.tab)));
    modal.querySelector('.cahk-native-install-btn').addEventListener('click',tryInstall);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)closeModal();});
    return modal;
  }

  function selectTab(type){
    const modal=ensureModal();
    modal.querySelectorAll('.cahk-install-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===type));
    modal.querySelector('.cahk-install-steps').innerHTML=stepsMarkup(type);
    const title=modal.querySelector('#cahkNativeTitle'),text=modal.querySelector('#cahkNativeText'),btn=modal.querySelector('.cahk-native-install-btn');
    if(type==='ios'){
      title.textContent='No iPhone, a instalação termina pelo menu Compartilhar';
      text.textContent='Por regra do iOS, o site não consegue concluir a instalação sozinho. O passo a passo abaixo mostra exatamente onde tocar.';
      btn.textContent='Ver passo a passo';btn.disabled=true;btn.style.opacity='.55';
    }else{
      title.textContent=deferredPrompt?'Seu Android permite instalação direta':'Instalação no Android';
      text.textContent=deferredPrompt?'Toque em “Instalar agora” para abrir a confirmação do navegador.':'Se a instalação direta não aparecer, use o menu ⋮ do Chrome conforme as imagens abaixo.';
      btn.textContent='Instalar agora';btn.disabled=!deferredPrompt;btn.style.opacity=deferredPrompt?'1':'.55';
    }
  }

  function openModal(type){const modal=ensureModal();modal.hidden=false;document.documentElement.style.overflow='hidden';selectTab(type||(isIOS?'ios':'android'));if(isStandalone())modal.querySelector('.cahk-installed-note').hidden=false;}
  function closeModal(){const modal=document.getElementById('cahkInstallModal');if(modal)modal.hidden=true;document.documentElement.style.overflow='';}

  async function tryInstall(){
    if(isStandalone()){closeModal();return;}
    if(deferredPrompt){
      const p=deferredPrompt;deferredPrompt=null;await p.prompt();
      try{const choice=await p.userChoice;if(choice?.outcome==='accepted'){hideInstallButtons();closeModal();}}catch(e){}
      refreshButtons();return;
    }
    openModal(isIOS?'ios':(isAndroid?'android':'android'));
  }

  function trigger(e){e?.preventDefault?.();if(isStandalone())return; if(deferredPrompt&&!isIOS){tryInstall();}else{openModal(isIOS?'ios':'android');}}
  function hideInstallButtons(){document.querySelectorAll('[data-cahk-install],.cahk-install-fab').forEach(el=>el.hidden=true);}
  function refreshButtons(){if(isStandalone())hideInstallButtons();}

  function createFab(){
    if(document.querySelector('.cahk-install-fab'))return;
    const b=document.createElement('button');b.type='button';b.className='cahk-install-fab';b.dataset.cahkInstall='';b.setAttribute('aria-label','Instalar CAHK como aplicativo');b.innerHTML=icon+'<span>Instalar app</span>';document.body.appendChild(b);
  }

  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;refreshButtons();const m=document.getElementById('cahkInstallModal');if(m&&!m.hidden)selectTab(isIOS?'ios':'android');});
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;hideInstallButtons();closeModal();});
  window.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('[data-cahk-install]').forEach(el=>el.addEventListener('click',trigger));
    if(!document.body.classList.contains('cahk-install-page-body'))createFab();
    refreshButtons();
  });
  window.CAHKInstall={open:openModal,install:tryInstall,isInstalled:isStandalone,renderSteps:stepsMarkup};
})();
