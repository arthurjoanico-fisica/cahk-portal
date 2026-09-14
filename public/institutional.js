(() => {
  const tabs=[...document.querySelectorAll('[data-tab]')];
  const panels=[...document.querySelectorAll('[data-panel]')];
  if(!tabs.length||!panels.length) return;
  const activate=id=>{
    tabs.forEach(t=>t.classList.toggle('active',t.dataset.tab===id));
    panels.forEach(p=>p.classList.toggle('active',p.dataset.panel===id));
  };
  tabs.forEach(t=>t.addEventListener('click',()=>activate(t.dataset.tab)));
})();
