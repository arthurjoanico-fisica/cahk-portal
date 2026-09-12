(() => {
  const cfg=window.CAIXAFLEX_CONFIG||{};
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const brl=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  if(!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY){document.body.innerHTML='<main style="padding:30px;font-family:system-ui">Loja temporariamente indisponível.</main>';return}
  const sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
  let products=[],cart=[];
  function toast(msg,type='ok'){const n=document.createElement('div');n.className=`toast ${type}`;n.textContent=msg;$('#toast').appendChild(n);setTimeout(()=>n.remove(),3500)}
  function errMsg(e){return e?.message||String(e)}
  async function api(action,payload={}){const {data,error}=await sb.functions.invoke('loja-public',{body:{action,...payload}});if(error)throw error;if(data?.error)throw new Error(data.error);return data}

  async function load(){
    try{const data=await api('catalog');products=data.products||[];renderProducts();renderCart()}catch(e){$('#storeProducts').innerHTML=`<div class="card empty">${esc(errMsg(e))}</div>`}
  }
  $('#storeSearch').oninput=renderProducts;
  function renderProducts(){
    const term=$('#storeSearch').value.trim().toLowerCase();
    const list=products.filter(p=>!term||p.nome.toLowerCase().includes(term)||String(p.categoria||'').toLowerCase().includes(term));
    $('#storeProducts').innerHTML=list.length?list.map(p=>{
      const unavailable=p.loja_modo==='estoque'&&Number(p.estoque)<=0;
      const variants=(p.variants||[]).length?`<select data-variant-for="${p.id}"><option value="">Escolha uma opção</option>${p.variants.map(v=>`<option value="${v.id}">${esc(v.nome)}</option>`).join('')}</select>`:'';
      const img=p.loja_imagem_url?`<div class="store-product-image"><img src="${esc(p.loja_imagem_url)}" alt="${esc(p.nome)}" loading="lazy"></div>`:'<div class="store-product-image placeholder">CAHK</div>';
      const meta=p.loja_modo==='encomenda'?(Number(p.loja_prazo_dias)>0?`Sob encomenda • prazo estimado ${Number(p.loja_prazo_dias)} dias`:'Sob encomenda'):`Pronta entrega • ${Number(p.estoque).toLocaleString('pt-BR')} disponível`;
      return `<article class="store-product card ${p.loja_destaque?'featured':''}">${img}<div class="store-product-body"><div class="muted small">${esc(p.categoria||'Produto CAHK')}</div><h3>${esc(p.nome)}</h3>${p.loja_descricao?`<p>${esc(p.loja_descricao)}</p>`:''}<div class="muted small">${esc(meta)}</div><div class="store-product-footer"><strong>${brl(p.preco_venda)}</strong>${variants}<button class="primary" data-store-add="${p.id}" ${unavailable?'disabled':''}>${unavailable?'Sem estoque':'Adicionar'}</button></div></div></article>`;
    }).join(''):'<div class="card empty">Nenhum produto encontrado.</div>';
    $$('[data-store-add]').forEach(b=>b.onclick=()=>add(b.dataset.storeAdd));
  }
  function add(productId){
    const p=products.find(x=>x.id===productId);if(!p)return;
    const sel=$(`[data-variant-for="${productId}"]`);let variant=null;
    if((p.variants||[]).length){if(!sel?.value)return toast('Escolha uma opção/tamanho','error');variant=p.variants.find(v=>v.id===sel.value)}
    const key=`${productId}|${variant?.id||''}`;const x=cart.find(i=>i.key===key);
    if(x)x.quantidade++;else cart.push({key,produto_id:p.id,nome:p.nome,preco:Number(p.preco_venda),variante_id:variant?.id||null,variante_nome:variant?.nome||null,quantidade:1});
    renderCart();toast('Adicionado à encomenda');
  }
  function renderCart(){
    $('#cartCount').textContent=String(cart.reduce((s,x)=>s+x.quantidade,0));
    $('#storeCartItems').innerHTML=cart.length?cart.map((x,i)=>`<div class="cart-item"><div><strong>${esc(x.nome)}</strong>${x.variante_nome?`<div class="muted small">${esc(x.variante_nome)}</div>`:''}<div class="muted small">${brl(x.preco)} × ${x.quantidade}</div></div><div class="cart-item-actions"><button class="qty-btn" data-store-dec="${i}">−</button><strong>${x.quantidade}</strong><button class="qty-btn" data-store-inc="${i}">+</button><button class="qty-btn" data-store-del="${i}">×</button></div></div>`).join(''):'<div class="empty">Sua encomenda está vazia.</div>';
    $$('[data-store-dec]').forEach(b=>b.onclick=()=>{const i=+b.dataset.storeDec;cart[i].quantidade--;if(cart[i].quantidade<=0)cart.splice(i,1);renderCart()});
    $$('[data-store-inc]').forEach(b=>b.onclick=()=>{cart[+b.dataset.storeInc].quantidade++;renderCart()});
    $$('[data-store-del]').forEach(b=>b.onclick=()=>{cart.splice(+b.dataset.storeDel,1);renderCart()});
    $('#storeCartTotal').textContent=brl(cart.reduce((s,x)=>s+x.preco*x.quantidade,0));
  }
  $('#openCart').onclick=()=>$('#storeCart').classList.add('open');$('#closeCart').onclick=()=>$('#storeCart').classList.remove('open');
  $('#orderForm').onsubmit=async e=>{
    e.preventDefault();if(!cart.length)return toast('Adicione pelo menos um produto','error');
    const btn=$('#sendOrder');btn.disabled=true;btn.textContent='Enviando…';
    try{
      const data=await api('create_order',{customer:{nome:$('#orderName').value.trim(),telefone:$('#orderPhone').value.trim(),email:$('#orderEmail').value.trim()||null,turma:$('#orderClass').value.trim()||null,observacao:$('#orderNote').value.trim()||null},items:cart.map(x=>({produto_id:x.produto_id,variante_id:x.variante_id,quantidade:x.quantidade}))});
      cart=[];renderCart();$('#orderForm').reset();$('#orderForm').classList.add('hidden');const id=String(data.order?.id||'').slice(0,8);$('#orderSuccess').classList.remove('hidden');$('#orderSuccess').innerHTML=`<strong>Encomenda enviada!</strong><p>Seu código é <strong>#${esc(id)}</strong>. A gestão do CAHK recebeu o pedido e poderá entrar em contato pelo telefone informado.</p>`;
    }catch(e){toast(errMsg(e),'error')}finally{btn.disabled=false;btn.textContent='Enviar encomenda'}
  };
  load();
})();
