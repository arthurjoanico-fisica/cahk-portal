(() => {
  const cfg=window.CAIXAFLEX_CONFIG||{};
  if(!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY||cfg.SUPABASE_URL.includes("COLE_AQUI")){
    document.body.innerHTML='<div style="font-family:system-ui;padding:32px"><h1>CaixaFlex 2</h1><p>Configure <code>public/config.js</code> com a URL e a chave publishable do Supabase.</p></div>';
    return;
  }
  const sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const brl=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const dt=v=>new Date(v).toLocaleString('pt-BR');
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const dateInput=d=>{const x=d?new Date(d):new Date(),y=x.getFullYear(),m=String(x.getMonth()+1).padStart(2,'0'),day=String(x.getDate()).padStart(2,'0');return `${y}-${m}-${day}`};

  let session=null,profile=null,products=[],sellers=[],clients=[],config=null,cart=[],openCash=null,salesCache=[],ordersCache=[],productVariants=[],libraryCache=[],projectsCache=[],reportCache=[];
  const roleLabels={admin:'Administrador',tesouraria:'Tesouraria',caixa:'Caixa',loja:'Loja',comunicacao:'Comunicação',biblioteca:'Biblioteca',pesquisa:'Pesquisa / IC'};
  const roleDefaults={admin:['*'],tesouraria:['dashboard','pdv','cash','stock','inventory','sales','fiado','clients','reports','backup'],caixa:['dashboard','pdv','cash','sales','fiado','clients'],loja:['dashboard','orders','mltn','products','stock','inventory','clients'],comunicacao:['dashboard','notices','transparency'],biblioteca:['dashboard','library'],pesquisa:['dashboard','projects']};
  const can=code=>!!profile&&(profile.role==='admin'||(roleDefaults[profile.role]||[]).includes(code)||(profile.permissions||[]).includes(code));

  function toast(msg,type='ok'){const n=document.createElement('div');n.className=`toast ${type}`;n.textContent=msg;$('#toast').appendChild(n);setTimeout(()=>n.remove(),3500)}
  const errMsg=e=>e?.message||e?.error_description||String(e);
  async function adminApi(action,payload={}){
    const {data,error}=await sb.functions.invoke('encomendas-admin',{body:{action,...payload}});
    if(error) throw error;
    if(data?.error) throw new Error(data.error);
    return data;
  }

  async function portalAdminApi(action,payload={}){
    const {data,error}=await sb.functions.invoke('portal-admin',{body:{action,...payload}});
    if(error) throw error;
    if(data?.error) throw new Error(data.error);
    return data;
  }
  async function uploadPublicImage(file,kind='media'){
    if(!file)return null;
    if(file.size>5*1024*1024)throw new Error('A imagem deve ter até 5 MB');
    const mime=String(file.type||'').toLowerCase();
    const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[mime];
    if(!ext)throw new Error('Use uma imagem JPG, PNG ou WebP');
    const now=new Date();const ym=`${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}`;
    const path=`${kind}/${ym}/${crypto.randomUUID()}.${ext}`;
    const {error}=await sb.storage.from('cahk-public-media').upload(path,file,{contentType:mime,upsert:false,cacheControl:'31536000'});
    if(error)throw error;
    return sb.storage.from('cahk-public-media').getPublicUrl(path).data.publicUrl;
  }
  async function uploadPublicPdf(file){
    if(!file)return null;
    if(file.size>50*1024*1024)throw new Error('O PDF deve ter até 50 MB');
    if(String(file.type||'')!=='application/pdf'&&!String(file.name||'').toLowerCase().endsWith('.pdf'))throw new Error('Envie um arquivo PDF');
    const now=new Date();const ym=`${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}`;
    const path=`library/${ym}/${crypto.randomUUID()}.pdf`;
    const {error}=await sb.storage.from('cahk-public-library').upload(path,file,{contentType:'application/pdf',upsert:false,cacheControl:'31536000'});
    if(error)throw error;
    return sb.storage.from('cahk-public-library').getPublicUrl(path).data.publicUrl;
  }
  function setMediaPreview(selector,url){
    const el=$(selector);if(!el)return;
    if(!url){el.classList.add('hidden');el.innerHTML='';return}
    el.classList.remove('hidden');el.innerHTML=`<img src="${esc(url)}" alt="Prévia"><div class="muted small">Imagem atual</div>`;
  }

  async function init(){
    $('#salesDate').value=dateInput();
    $('#reportStart').value=dateInput(new Date(new Date().getFullYear(),new Date().getMonth(),1));
    $('#reportEnd').value=dateInput();
    const tick=()=>$('#clock').textContent=new Date().toLocaleString('pt-BR');tick();setInterval(tick,30000);
    const {data:{session:s}}=await sb.auth.getSession();session=s;
    if(!session)return showLogin();
    await loadProfileAndApp();
  }
  function showLogin(){$('#loginView').classList.remove('hidden');$('#appView').classList.add('hidden')}
  function showApp(){$('#loginView').classList.add('hidden');$('#appView').classList.remove('hidden')}

  $('#loginForm').addEventListener('submit',async e=>{
    e.preventDefault();$('#loginMsg').textContent='Entrando…';
    const {data,error}=await sb.auth.signInWithPassword({email:$('#loginEmail').value.trim(),password:$('#loginPassword').value});
    if(error){$('#loginMsg').textContent=errMsg(error);return}
    session=data.session;await loadProfileAndApp();
  });
  $('#logoutBtn').onclick=async()=>{await sb.auth.signOut();location.reload()};

  async function loadProfileAndApp(){
    const {data,error}=await sb.from('profiles').select('*').eq('id',session.user.id).single();
    if(error||!data?.ativo){await sb.auth.signOut();$('#loginMsg').textContent='Usuário sem perfil ativo.';showLogin();return}
    profile=data;$('#userName').textContent=profile.nome||session.user.email;$('#userRole').textContent=roleLabels[profile.role]||profile.role;
    $$('[data-perm]').forEach(x=>x.classList.toggle('hidden',!can(x.dataset.perm)));
    $$('[data-admin="1"]').forEach(x=>x.classList.toggle('hidden',profile.role!=='admin'));
    window.dispatchEvent(new CustomEvent('cahk-profile-ready',{detail:{...profile,email:session.user.email}}));
    showApp();
    await Promise.all([loadConfig(),loadProducts(),loadSellers(),loadClients(),loadCash()]);
    renderCart();renderProducts();loadDashboard();
  }

  async function loadConfig(){
    const {data,error}=await sb.from('configuracoes').select('*').eq('id',1).single();if(error)throw error;config=data;
    $('#companyMini').textContent=(config.nome_empresa||'CAHK').slice(0,34);
    $('#cfgName').value=config.nome_empresa||'';$('#cfgCnpj').value=config.cnpj||'';$('#cfgPhone').value=config.telefone||'';
    $('#cfgAddress').value=config.endereco||'';$('#cfgFooter').value=config.mensagem_rodape||'';$('#cfgWidth').value=String(config.largura_impressao||80);
  }
  async function loadProducts(){const {data,error}=await sb.from('produtos').select('*').order('nome');if(error)throw error;products=data||[];renderProducts();renderAdminProducts();renderStockEntryProducts()}
  async function loadSellers(){const {data,error}=await sb.from('vendedores').select('*').order('nome');if(error)throw error;sellers=data||[];$('#saleSeller').innerHTML=sellers.filter(x=>x.ativo).map(x=>`<option value="${x.id}">${esc(x.codigo)} — ${esc(x.nome)}</option>`).join('');renderSellerList()}
  async function loadClients(){const {data,error}=await sb.from('clientes').select('*').order('nome');if(error)throw error;clients=data||[];$('#saleClient').innerHTML='<option value="">Selecione…</option>'+clients.filter(x=>x.ativo).map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('');renderClientList()}
  async function loadCash(){const {data,error}=await sb.from('caixas').select('*').eq('status','aberto').order('aberto_em',{ascending:false}).limit(1);if(error)throw error;openCash=data?.[0]||null;renderCash()}

  const titles={dashboard:'Visão geral',pdv:'Balcão / PDV',caixa:'Caixa',entrada:'Entrada de estoque',inventario:'Inventário físico',vendas:'Vendas',fiado:'Fiado',encomendas:'Encomendas',mltn:'MLTN / POD',avisos:'Avisos do Portal',biblioteca:'Biblioteca Virtual',projetos:'Projetos / IC',produtos:'Produtos / Loja',vendedores:'Vendedores',clientes:'Clientes',relatorios:'Relatórios',transparencia:'Transparência',usuarios:'Usuários e permissões',auditoria:'Registro de alterações',backup:'Backup / Exportação',config:'Configurações'};
  function switchView(v){
    $$('.view').forEach(x=>x.classList.add('hidden'));$(`#view-${v}`).classList.remove('hidden');
    $$('#nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===v));$('#pageTitle').textContent=titles[v]||v;
    if(v==='dashboard')loadDashboard();if(v==='vendas')loadSales();if(v==='fiado')loadFiado();if(v==='encomendas')loadOrders();if(v==='entrada')loadStockEntryHistory();if(v==='biblioteca')loadLibraryAdmin();if(v==='projetos')loadProjectsAdmin();if(v==='relatorios')loadReports();if(v==='caixa')loadCash().then(loadCashSummary);window.CAHKV6?.load?.(v);
  }
  $$('#nav button').forEach(b=>b.onclick=()=>switchView(b.dataset.view));

  // DASHBOARD
  async function loadDashboard(){
    const metrics=$('#dashboardMetrics');if(!metrics)return;metrics.innerHTML='<div class="metric"><span>Carregando</span><strong>…</strong></div>';
    try{
      const start=new Date();start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1);
      const [salesR,ordersR,eventsR,libR,projR]=await Promise.all([
        sb.from('vw_vendas_resumo').select('*').gte('created_at',start.toISOString()).lt('created_at',end.toISOString()).eq('status','concluida').order('created_at',{ascending:false}),
        adminApi('list').catch(()=>({orders:[]})),portalAdminApi('list_notices').catch(()=>({notices:[]})),portalAdminApi('list_library').catch(()=>({items:[]})),portalAdminApi('list_projects').catch(()=>({projects:[]}))
      ]);
      if(salesR.error)throw salesR.error;const sales=salesR.data||[],fat=sales.reduce((a,b)=>a+Number(b.total||0),0),low=products.filter(p=>p.ativo&&Number(p.estoque)<=Number(p.estoque_minimo||0)),openOrders=(ordersR.orders||[]).filter(o=>!['entregue','cancelada'].includes(o.status)),stockValue=products.filter(p=>p.ativo).reduce((a,p)=>a+Number(p.estoque||0)*Number(p.preco_compra||0),0);
      metrics.innerHTML=[['Caixa',openCash?'Aberto':'Fechado'],['Vendas hoje',sales.length],['Faturamento hoje',brl(fat)],['Estoque baixo',low.length],['Encomendas abertas',openOrders.length],['Valor em estoque',brl(stockValue)]].map(([a,b])=>`<div class="metric"><span>${a}</span><strong>${b}</strong></div>`).join('');
      $('#dashboardLowStock').innerHTML=low.length?low.slice(0,10).map(p=>`<div class="compact-item"><div><strong>${esc(p.nome)}</strong><div class="muted small">${Number(p.estoque).toLocaleString('pt-BR')} em estoque • mínimo ${Number(p.estoque_minimo||0).toLocaleString('pt-BR')}</div></div><button class="ghost" data-dash-entry="${p.id}">Entrada</button></div>`).join(''):'<div class="empty">Estoque em níveis normais.</div>';
      $$('[data-dash-entry]').forEach(b=>b.onclick=()=>{switchView('entrada');$('#stockEntryProduct').value=b.dataset.dashEntry;syncStockEntryCurrent()});
      $('#dashboardRecentSales').innerHTML=sales.length?sales.slice(0,8).map(v=>`<div class="compact-item"><div><strong>Venda #${v.id}</strong><div class="muted small">${esc(v.vendedor_nome||'')} • ${dt(v.created_at)}</div></div><strong>${brl(v.total)}</strong></div>`).join(''):'<div class="empty">Nenhuma venda hoje.</div>';
      const upcoming=(eventsR.notices||[]).filter(e=>e.active&&e.show_in_agenda&&String(e.event_date||'')>=dateInput()).length,books=(libR.items||[]).filter(x=>x.active).length,projects=(projR.projects||[]).filter(x=>x.active).length;
      $('#dashboardPortal').innerHTML=`<div class="compact-item"><span>Itens na Agenda</span><strong>${upcoming}</strong></div><div class="compact-item"><span>Materiais na biblioteca</span><strong>${books}</strong></div><div class="compact-item"><span>Projetos / IC publicados</span><strong>${projects}</strong></div><div class="compact-item"><span>Encomendas aguardando ação</span><strong>${openOrders.length}</strong></div>`;
    }catch(e){metrics.innerHTML=`<div class="empty">${esc(errMsg(e))}</div>`}
  }
  $('#dashboardGoStock')?.addEventListener('click',()=>switchView('produtos'));$('#dashboardGoSales')?.addEventListener('click',()=>switchView('vendas'));$$('[data-dash-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.dashView));

  // PDV
  $('#productSearch').addEventListener('input',renderProducts);
  function renderProducts(){
    if(!$('#productGrid'))return;
    const term=$('#productSearch').value.trim().toLowerCase();
    const list=products.filter(p=>p.ativo&&(!term||p.nome.toLowerCase().includes(term)||String(p.codigo_barras||'').includes(term)));
    $('#productGrid').innerHTML=list.length?list.map(p=>`<button class="product ${Number(p.estoque)<=Number(p.estoque_minimo)?'low':''}" data-add="${p.id}" ${Number(p.estoque)<=0?'disabled':''}><div><strong>${esc(p.nome)}</strong><div class="stock">Estoque: ${Number(p.estoque).toLocaleString('pt-BR')}</div></div><div class="price">${brl(p.preco_venda)}</div></button>`).join(''):'<div class="empty">Nenhum produto encontrado.</div>';
    $$('[data-add]').forEach(b=>b.onclick=()=>addCart(b.dataset.add));
  }
  function addCart(id){
    const p=products.find(x=>x.id===id);if(!p||Number(p.estoque)<=0)return;
    const item=cart.find(x=>x.produto_id===id);
    if(item){if(item.quantidade+1>Number(p.estoque))return toast('Sem estoque suficiente','error');item.quantidade++}
    else cart.push({produto_id:id,nome:p.nome,preco:Number(p.preco_venda),quantidade:1});
    renderCart();
  }
  function renderCart(){
    $('#cartItems').innerHTML=cart.length?cart.map((x,i)=>`<div class="cart-item"><div><strong>${esc(x.nome)}</strong><div class="muted small">${brl(x.preco)} × ${x.quantidade} = ${brl(x.preco*x.quantidade)}</div></div><div class="cart-item-actions"><button class="qty-btn" data-dec="${i}">−</button><strong>${x.quantidade}</strong><button class="qty-btn" data-inc="${i}">+</button><button class="qty-btn" data-del="${i}">×</button></div></div>`).join(''):'<div class="empty">Carrinho vazio.</div>';
    $$('[data-dec]').forEach(b=>b.onclick=()=>{const i=+b.dataset.dec;cart[i].quantidade--;if(cart[i].quantidade<=0)cart.splice(i,1);renderCart()});
    $$('[data-inc]').forEach(b=>b.onclick=()=>{const i=+b.dataset.inc,p=products.find(x=>x.id===cart[i].produto_id);if(cart[i].quantidade+1>Number(p.estoque))return toast('Sem estoque suficiente','error');cart[i].quantidade++;renderCart()});
    $$('[data-del]').forEach(b=>b.onclick=()=>{cart.splice(+b.dataset.del,1);renderCart()});
    const sub=cart.reduce((s,x)=>s+x.preco*x.quantidade,0),disc=Math.max(0,Number($('#saleDiscount').value)||0);
    $('#subtotal').textContent=brl(sub);$('#discountPreview').textContent=brl(disc);$('#total').textContent=brl(Math.max(0,sub-disc));
  }
  $('#saleDiscount').oninput=renderCart;
  $('#paymentType').onchange=()=>$('#clientWrap').classList.toggle('hidden',$('#paymentType').value!=='Fiado');

  $('#finishSale').onclick=async()=>{
    if(!openCash)return toast('Abra o caixa antes de vender','error');
    if(!cart.length)return toast('Carrinho vazio','error');
    const seller=$('#saleSeller').value,pay=$('#paymentType').value,client=$('#saleClient').value||null;
    if(!seller)return toast('Cadastre ou selecione um vendedor','error');
    if(pay==='Fiado'&&!client)return toast('Selecione o cliente do fiado','error');
    $('#finishSale').disabled=true;
    try{
      const {data,error}=await sb.rpc('finalizar_venda',{p_vendedor_id:seller,p_tipo_pagamento:pay,p_cliente_id:client,p_desconto:Number($('#saleDiscount').value)||0,p_observacao:$('#saleNote').value||null,p_itens:cart.map(x=>({produto_id:x.produto_id,quantidade:x.quantidade}))});
      if(error)throw error;
      const receipt=await getSaleForReceipt(data.id);
      cart=[];$('#saleDiscount').value='0';$('#saleNote').value='';renderCart();
      await Promise.all([loadProducts(),loadCashSummary()]);
      toast(`Venda #${data.id} concluída`);
      if($('#printAfterSale').checked)printReceipt(receipt);
    }catch(e){toast(errMsg(e),'error')}finally{$('#finishSale').disabled=false}
  };

  // CAIXA
  function renderCash(){
    $('#cashStatus').textContent=openCash?`Caixa aberto desde ${dt(openCash.aberto_em)}`:'Caixa fechado';
    $('#cashDetail').innerHTML=openCash?`<div class="metric-grid"><div class="metric"><span>Abertura</span><strong>${dt(openCash.aberto_em)}</strong></div><div class="metric"><span>Saldo inicial</span><strong>${brl(openCash.saldo_inicial)}</strong></div></div>`:'<div class="empty">Nenhum caixa aberto.</div>';
    $('#cashActions').innerHTML=openCash?`<div class="stack"><label>Saldo final contado<input id="closeBalance" type="number" step="0.01" min="0"></label><label>Observação<input id="closeNote"></label><button id="closeCashBtn" class="danger">Fechar caixa</button></div>`:`<div class="stack"><label>Saldo inicial em dinheiro<input id="openBalance" type="number" step="0.01" min="0" value="0"></label><button id="openCashBtn" class="primary">Abrir caixa</button></div>`;
    $('#openCashBtn')?.addEventListener('click',async()=>{try{const{error}=await sb.rpc('abrir_caixa',{p_saldo_inicial:Number($('#openBalance').value)||0});if(error)throw error;toast('Caixa aberto');await loadCash();await loadCashSummary()}catch(e){toast(errMsg(e),'error')}});
    $('#closeCashBtn')?.addEventListener('click',async()=>{if(!confirm('Fechar o caixa atual?'))return;try{const{error}=await sb.rpc('fechar_caixa',{p_saldo_final_informado:Number($('#closeBalance').value)||0,p_observacao:$('#closeNote').value||null});if(error)throw error;toast('Caixa fechado');await loadCash();await loadCashSummary()}catch(e){toast(errMsg(e),'error')}});
  }
  async function loadCashSummary(){
    if(!openCash){$('#cashSummary').innerHTML='<div class="empty">Abra o caixa para ver o resumo.</div>';return}
    const [vr,pr]=await Promise.all([
      sb.from('vendas').select('tipo_pagamento,total,status').eq('caixa_id',openCash.id),
      sb.from('pagamentos_fiado').select('tipo_pagamento,valor').eq('caixa_id',openCash.id)
    ]);
    if(vr.error||pr.error)return;
    const ok=(vr.data||[]).filter(x=>x.status==='concluida'),receb=(pr.data||[]);
    const salesSum=t=>ok.filter(x=>x.tipo_pagamento===t).reduce((s,x)=>s+Number(x.total),0);
    const debtSum=t=>receb.filter(x=>x.tipo_pagamento===t).reduce((s,x)=>s+Number(x.valor),0);
    const fat=ok.reduce((s,x)=>s+Number(x.total),0),received=receb.reduce((s,x)=>s+Number(x.valor),0);
    $('#cashSummary').innerHTML=[
      ['Vendas',ok.length],['Vendas do caixa',brl(fat)],['Receb. fiado',brl(received)],
      ['Dinheiro',brl(salesSum('Dinheiro')+debtSum('Dinheiro'))],['Pix',brl(salesSum('Pix')+debtSum('Pix'))],
      ['Cartão',brl(salesSum('Cartão')+debtSum('Cartão'))],['Novo fiado',brl(salesSum('Fiado'))]
    ].map(([a,b])=>`<div class="metric"><span>${a}</span><strong>${b}</strong></div>`).join('');
  }

  // ENTRADA DE ESTOQUE
  function renderStockEntryProducts(){
    const sel=$('#stockEntryProduct');if(!sel)return;
    const current=sel.value;
    sel.innerHTML='<option value="">Selecione um produto…</option>'+products.filter(p=>p.ativo).map(p=>`<option value="${p.id}">${esc(p.nome)} — estoque ${Number(p.estoque).toLocaleString('pt-BR')}</option>`).join('');
    if(products.some(p=>p.id===current&&p.ativo))sel.value=current;
    syncStockEntryCurrent();
  }
  function syncStockEntryCurrent(){const id=$('#stockEntryProduct')?.value,p=products.find(x=>x.id===id),el=$('#stockEntryCurrent');if(!el)return;el.textContent=p?`Estoque atual: ${Number(p.estoque).toLocaleString('pt-BR')}`:'Selecione um produto.'}
  $('#stockEntryProduct')?.addEventListener('change',syncStockEntryCurrent);
  $('#refreshStockEntries')?.addEventListener('click',loadStockEntryHistory);
  $('#stockEntryForm')?.addEventListener('submit',async e=>{e.preventDefault();const produto=$('#stockEntryProduct').value,qty=Number($('#stockEntryQty').value),cost=$('#stockEntryCost').value===''?null:Number($('#stockEntryCost').value),supplier=$('#stockEntrySupplier').value.trim()||null,batch=$('#stockEntryBatch').value.trim()||null,expiry=$('#stockEntryExpiry').value||null,motivo=$('#stockEntryReason').value.trim()||'Entrada de estoque';if(!produto||!(qty>0))return toast('Selecione o produto e informe uma quantidade maior que zero','error');try{const {data,error}=await sb.rpc('registrar_entrada_estoque',{p_produto_id:produto,p_quantidade:qty,p_custo_unitario:cost,p_fornecedor:supplier,p_lote:batch,p_validade:expiry,p_motivo:motivo});if(error)throw error;toast(`Entrada registrada. Novo estoque: ${Number(data?.estoque_novo||0).toLocaleString('pt-BR')}`);['#stockEntryQty','#stockEntryCost','#stockEntrySupplier','#stockEntryBatch','#stockEntryExpiry','#stockEntryReason'].forEach(s=>$(s).value='');await loadProducts();await loadStockEntryHistory();loadDashboard()}catch(e){toast(errMsg(e),'error')}});
  async function loadStockEntryHistory(){
    const el=$('#stockEntryHistory');if(!el)return;el.innerHTML='<div class="empty">Carregando…</div>';
    const {data,error}=await sb.from('movimentacoes_estoque').select('id,quantidade,estoque_anterior,estoque_novo,motivo,custo_unitario,fornecedor,lote,validade,created_at,produtos(nome)').eq('tipo','entrada').order('created_at',{ascending:false}).limit(50);
    if(error){el.innerHTML=`<div class="empty">${esc(errMsg(error))}</div>`;return}
    el.innerHTML=(data||[]).length?(data||[]).map(x=>`<div class="compact-item"><div><strong>${esc(x.produtos?.nome||'Produto')}</strong><div class="muted small">+${Number(x.quantidade).toLocaleString('pt-BR')} • ${Number(x.estoque_anterior).toLocaleString('pt-BR')} → ${Number(x.estoque_novo).toLocaleString('pt-BR')} • ${dt(x.created_at)}</div>${x.motivo?`<div class="muted small">${esc(x.motivo)}</div>`:''}${x.custo_unitario!=null||x.fornecedor||x.lote||x.validade?`<div class="muted small">${x.custo_unitario!=null?`Custo ${brl(x.custo_unitario)} • `:''}${x.fornecedor?`${esc(x.fornecedor)} • `:''}${x.lote?`lote ${esc(x.lote)} • `:''}${x.validade?`validade ${new Date(`${x.validade}T12:00:00`).toLocaleDateString('pt-BR')}`:''}</div>`:''}</div></div>`).join(''):'<div class="empty">Nenhuma entrada registrada.</div>';
  }

  // PRODUTOS / LOJA
  async function loadVariants(productId){
    if(!productId){productVariants=[];renderVariants();return}
    const {data,error}=await sb.from('produto_variantes').select('*').eq('produto_id',productId).order('ordem').order('nome');
    if(error){toast(errMsg(error),'error');productVariants=[]}else productVariants=data||[];
    renderVariants();
  }
  function renderVariants(){
    const wrap=$('#variantEditor'),list=$('#variantList');if(!wrap||!list)return;
    const productId=$('#productId').value;wrap.classList.toggle('hidden',!productId);
    if(!productId){list.innerHTML='';return}
    list.innerHTML=productVariants.length?productVariants.map(v=>`<div class="compact-item"><div><strong>${esc(v.nome)}</strong><div class="muted small">${esc(v.codigo||'sem código')} • ${v.ativo?'ativo':'inativo'}</div></div><div class="actions"><button type="button" class="ghost" data-edit-variant="${v.id}">Editar</button><button type="button" class="danger" data-delete-variant="${v.id}">Excluir</button></div></div>`).join(''):'<div class="empty">Sem variações. Produtos sem variações podem ser encomendados normalmente.</div>';
    $$('[data-edit-variant]').forEach(b=>b.onclick=()=>editVariant(b.dataset.editVariant));
    $$('[data-delete-variant]').forEach(b=>b.onclick=()=>deleteVariant(b.dataset.deleteVariant));
  }
  async function editVariant(id){
    const old=productVariants.find(v=>v.id===id);if(!old)return;
    const nome=prompt('Nome da variação / tamanho',old.nome);if(nome===null||!nome.trim())return;
    const codigo=prompt('Código opcional',old.codigo||'');if(codigo===null)return;
    try{await adminApi('save_variant',{variant:{id:old.id,produto_id:old.produto_id,nome:nome.trim(),codigo:codigo.trim()||null,ativo:old.ativo,ordem:old.ordem||0}});toast('Variação atualizada');await loadVariants(old.produto_id)}catch(e){toast(errMsg(e),'error')}
  }
  async function deleteVariant(id){
    const old=productVariants.find(v=>v.id===id);if(!old||!confirm(`Excluir a variação "${old.nome}"?`))return;
    try{await adminApi('delete_variant',{id});toast('Variação excluída');await loadVariants(old.produto_id)}catch(e){toast(errMsg(e),'error')}
  }
  $('#addVariant').onclick=async()=>{
    const produtoId=$('#productId').value;if(!produtoId)return toast('Salve o produto primeiro','error');
    const nome=prompt('Nome da variação / tamanho (ex.: M)');if(!nome?.trim())return;
    const codigo=prompt('Código opcional (ex.: M-AZUL)','');if(codigo===null)return;
    try{await adminApi('save_variant',{variant:{produto_id:produtoId,nome:nome.trim(),codigo:codigo.trim()||null,ativo:true,ordem:productVariants.length}});toast('Variação adicionada');await loadVariants(produtoId)}catch(e){toast(errMsg(e),'error')}
  };
  function renderAdminProducts(){
    if(!$('#adminProducts'))return;
    $('#adminProducts').innerHTML=products.length?products.map(p=>`<div class="compact-item"><div><strong>${esc(p.nome)}</strong><div class="muted small">${brl(p.preco_venda)} • estoque ${Number(p.estoque).toLocaleString('pt-BR')} • ${p.ativo?'ativo':'inativo'}${p.loja_visivel?' • LOJA':''}${p.mltn_enabled?' • MLTN':''}</div></div><div class="actions"><button class="ghost" data-edit-product="${p.id}">Editar</button><button class="ghost" data-entry-stock="${p.id}">Entrada</button><button class="ghost" data-stock="${p.id}">Ajustar</button><button class="danger" data-delete-product="${p.id}">Excluir</button></div></div>`).join(''):'<div class="empty">Nenhum produto.</div>';
    $$('[data-edit-product]').forEach(b=>b.onclick=()=>fillProduct(b.dataset.editProduct));
    $$('[data-entry-stock]').forEach(b=>b.onclick=()=>{switchView('entrada');$('#stockEntryProduct').value=b.dataset.entryStock;syncStockEntryCurrent()});
    $$('[data-stock]').forEach(b=>b.onclick=()=>adjustStock(b.dataset.stock));
    $$('[data-delete-product]').forEach(b=>b.onclick=()=>deleteProduct(b.dataset.deleteProduct));
  }
  function fillProduct(id){
    const p=products.find(x=>x.id===id);if(!p)return;
    $('#productId').value=p.id;$('#pName').value=p.nome;$('#pCategory').value=p.categoria||'';$('#pBarcode').value=p.codigo_barras||'';$('#pCost').value=p.preco_compra;$('#pPrice').value=p.preco_venda;$('#pMinStock').value=p.estoque_minimo;$('#pActive').checked=p.ativo;
    $('#pStoreVisible').checked=!!p.loja_visivel;$('#pStoreMode').value=p.loja_modo||'encomenda';$('#pStoreLead').value=Number(p.loja_prazo_dias||0);$('#pStoreDescription').value=p.loja_descricao||'';$('#pStoreImage').value=p.loja_imagem_url||'';$('#pStoreImageFile').value='';setMediaPreview('#pStoreImagePreview',p.loja_imagem_url||'');$('#pStoreOrder').value=Number(p.loja_ordem||0);$('#pStoreFeatured').checked=!!p.loja_destaque;$('#pMltnEnabled').checked=!!p.mltn_enabled;$('#pMltnBase').value=p.mltn_base_name||'';$('#pMltnDrive').value=p.mltn_drive_url||'';$('#pMltnNotes').value=p.mltn_notes||'';
    loadVariants(p.id);
  }
  function clearProduct(){
    $('#productForm').reset();$('#productId').value='';$('#pStoreImage').value='';setMediaPreview('#pStoreImagePreview','');$('#pActive').checked=true;$('#pMinStock').value='0';$('#pStoreMode').value='encomenda';$('#pStoreLead').value='0';$('#pStoreOrder').value='0';$('#pMltnEnabled').checked=false;$('#pMltnBase').value='';$('#pMltnDrive').value='';$('#pMltnNotes').value='';productVariants=[];renderVariants();
  }
  $('#clearProduct').onclick=clearProduct;
  $('#productForm').onsubmit=async e=>{
    e.preventDefault();
    const id=$('#productId').value;
    const base={nome:$('#pName').value.trim(),categoria:$('#pCategory').value.trim()||null,codigo_barras:$('#pBarcode').value.trim()||null,preco_compra:Number($('#pCost').value),preco_venda:Number($('#pPrice').value),estoque_minimo:Number($('#pMinStock').value)||0,ativo:$('#pActive').checked,updated_at:new Date().toISOString()};
    try{
      let saved;
      if(id){const r=await sb.from('produtos').update(base).eq('id',id).select().single();if(r.error)throw r.error;saved=r.data}
      else{const r=await sb.from('produtos').insert(base).select().single();if(r.error)throw r.error;saved=r.data}
      let imageUrl=$('#pStoreImage').value.trim()||null;
      const imageFile=$('#pStoreImageFile').files?.[0];
      if(imageFile){toast('Enviando imagem do produto…');imageUrl=await uploadPublicImage(imageFile,'products')}
      await adminApi('set_product_store',{id:saved.id,product:{loja_visivel:$('#pStoreVisible').checked,loja_descricao:$('#pStoreDescription').value.trim()||null,loja_imagem_url:imageUrl,loja_modo:$('#pStoreMode').value,loja_prazo_dias:Math.max(0,Number($('#pStoreLead').value)||0),loja_ordem:Number($('#pStoreOrder').value)||0,loja_destaque:$('#pStoreFeatured').checked,mltn_enabled:$('#pMltnEnabled').checked,mltn_base_name:$('#pMltnBase').value.trim()||null,mltn_drive_url:$('#pMltnDrive').value.trim()||null,mltn_notes:$('#pMltnNotes').value.trim()||null}});
      toast('Produto salvo');await loadProducts();fillProduct(saved.id);
    }catch(e){toast(errMsg(e),'error')}
  };
  async function adjustStock(id){const p=products.find(x=>x.id===id);if(!p)return;const val=prompt(`Novo estoque de "${p.nome}"`,String(p.estoque));if(val===null)return;const n=Number(String(val).replace(',','.'));if(!Number.isFinite(n))return toast('Estoque inválido','error');const motivo=prompt('Motivo do ajuste','Contagem física')||'Ajuste manual';try{const{error}=await sb.rpc('ajustar_estoque',{p_produto_id:id,p_novo_estoque:n,p_motivo:motivo});if(error)throw error;toast('Estoque ajustado');await loadProducts()}catch(e){toast(errMsg(e),'error')}}

  async function deleteProduct(id){
    const p=products.find(x=>x.id===id);if(!p)return;
    if(!confirm(`Excluir definitivamente o produto "${p.nome}"?

Se ele já tiver histórico de venda ou encomenda, o sistema não poderá apagá-lo e oferecerá a opção de inativar.`))return;
    try{
      const {error}=await sb.from('produtos').delete().eq('id',id);
      if(error)throw error;
      if($('#productId').value===id)clearProduct();
      toast('Produto excluído');
      await loadProducts();
    }catch(e){
      const msg=errMsg(e);
      const referenced=/foreign key|violates foreign key|23503|referenced|constraint/i.test(msg);
      if(referenced){
        if(confirm(`Este produto possui histórico, variações ou registros vinculados e não pode ser apagado definitivamente.

Deseja inativá-lo e removê-lo da loja/balcão?`)){
          try{
            const {error}=await sb.from('produtos').update({ativo:false,loja_visivel:false,updated_at:new Date().toISOString()}).eq('id',id);
            if(error)throw error;
            toast('Produto inativado');
            if($('#productId').value===id)clearProduct();
            await loadProducts();
          }catch(e2){toast(errMsg(e2),'error')}
        }
      }else toast(msg,'error');
    }
  }

  // BIBLIOTECA VIRTUAL
  $('#refreshLibrary')?.addEventListener('click',loadLibraryAdmin);$('#clearLibrary')?.addEventListener('click',clearLibraryForm);
  async function loadLibraryAdmin(){try{const data=await portalAdminApi('list_library');libraryCache=data.items||[];renderLibraryAdmin()}catch(e){toast(errMsg(e),'error')}}
  function renderLibraryAdmin(){const el=$('#libraryAdminList');if(!el)return;el.innerHTML=libraryCache.length?libraryCache.map(x=>`<div class="compact-item"><div><strong>${esc(x.title)}</strong><div class="muted small">${esc(x.discipline)} • ${esc(x.material_type)} • ${x.active?'publicado':'pausado'}${x.rights_confirmed?' • direitos confirmados':''}</div></div><div class="actions"><button class="ghost" data-edit-library="${x.id}">Editar</button><button class="danger" data-delete-library="${x.id}">Excluir</button></div></div>`).join(''):'<div class="empty">Nenhum material cadastrado.</div>';$$('[data-edit-library]').forEach(b=>b.onclick=()=>fillLibraryForm(b.dataset.editLibrary));$$('[data-delete-library]').forEach(b=>b.onclick=()=>deleteLibrary(b.dataset.deleteLibrary))}
  function clearLibraryForm(){$('#libraryForm')?.reset();if(!$('#libraryId'))return;$('#libraryId').value='';$('#libraryCoverUrl').value='';$('#libraryPdfUrl').value='';$('#libraryActive').checked=true;$('#libraryFeatured').checked=false;$('#libraryRights').checked=false;$('#libraryOrder').value='0';setMediaPreview('#libraryCoverPreview','')}
  function fillLibraryForm(id){const x=libraryCache.find(v=>v.id===id);if(!x)return;$('#libraryId').value=x.id;$('#libraryTitle').value=x.title||'';$('#libraryAuthor').value=x.author||'';$('#libraryDiscipline').value=x.discipline||'';$('#libraryType').value=x.material_type||'livro';$('#libraryYear').value=x.publication_year||'';$('#libraryEdition').value=x.edition||'';$('#libraryIsbn').value=x.isbn||'';$('#libraryDoi').value=x.doi||'';$('#libraryProfessor').value=x.professor||'';$('#librarySemester').value=x.semester||'';$('#libraryDescription').value=x.description||'';$('#libraryCoverUrl').value=x.cover_url||'';$('#libraryPdfUrl').value=x.pdf_url||'';$('#libraryExternalUrl').value=x.external_url||'';$('#libraryRightsNote').value=x.rights_note||'';$('#libraryRights').checked=!!x.rights_confirmed;$('#libraryActive').checked=!!x.active;$('#libraryFeatured').checked=!!x.featured;$('#libraryOrder').value=Number(x.display_order||0);$('#libraryCoverFile').value='';$('#libraryPdfFile').value='';setMediaPreview('#libraryCoverPreview',x.cover_url||'');window.scrollTo({top:0,behavior:'smooth'})}
  async function deleteLibrary(id){const x=libraryCache.find(v=>v.id===id);if(!x||!confirm(`Excluir "${x.title}" da biblioteca?`))return;try{await portalAdminApi('delete_library',{id});toast('Material excluído');clearLibraryForm();await loadLibraryAdmin()}catch(e){toast(errMsg(e),'error')}}
  $('#libraryForm')?.addEventListener('submit',async e=>{e.preventDefault();try{let cover=$('#libraryCoverUrl').value||null,pdf=$('#libraryPdfUrl').value||null;const coverFile=$('#libraryCoverFile').files?.[0],pdfFile=$('#libraryPdfFile').files?.[0];if(coverFile){toast('Enviando capa…');cover=await uploadPublicImage(coverFile,'library-covers')}if(pdfFile){toast('Enviando PDF…');pdf=await uploadPublicPdf(pdfFile)}const item={id:$('#libraryId').value||undefined,title:$('#libraryTitle').value.trim(),author:$('#libraryAuthor').value.trim()||null,discipline:$('#libraryDiscipline').value.trim(),material_type:$('#libraryType').value,publication_year:$('#libraryYear').value||null,edition:$('#libraryEdition').value.trim()||null,isbn:$('#libraryIsbn').value.trim()||null,doi:$('#libraryDoi').value.trim()||null,professor:$('#libraryProfessor').value.trim()||null,semester:$('#librarySemester').value.trim()||null,description:$('#libraryDescription').value.trim()||null,cover_url:cover,pdf_url:pdf,external_url:$('#libraryExternalUrl').value.trim()||null,rights_note:$('#libraryRightsNote').value.trim()||null,rights_confirmed:$('#libraryRights').checked,active:$('#libraryActive').checked,featured:$('#libraryFeatured').checked,display_order:Number($('#libraryOrder').value)||0};const data=await portalAdminApi('save_library',{item});toast('Material salvo na Biblioteca Virtual');await loadLibraryAdmin();fillLibraryForm(data.item.id)}catch(e){toast(errMsg(e),'error')}});

  // PROJETOS / IC
  $('#refreshProjects')?.addEventListener('click',loadProjectsAdmin);$('#clearProject')?.addEventListener('click',clearProjectForm);
  async function loadProjectsAdmin(){try{const data=await portalAdminApi('list_projects');projectsCache=data.projects||[];renderProjectsAdmin()}catch(e){toast(errMsg(e),'error')}}
  function renderProjectsAdmin(){const el=$('#projectAdminList');if(!el)return;el.innerHTML=projectsCache.length?projectsCache.map(x=>`<div class="compact-item"><div><strong>${esc(x.title)}</strong><div class="muted small">${esc(x.student_name||'Sem estudante informado')} • ${esc(x.area||'Sem área')} • ${x.status==='em_andamento'?'em andamento':x.status}</div></div><div class="actions"><button class="ghost" data-edit-project="${x.id}">Editar</button><button class="danger" data-delete-project="${x.id}">Excluir</button></div></div>`).join(''):'<div class="empty">Nenhum projeto cadastrado.</div>';$$('[data-edit-project]').forEach(b=>b.onclick=()=>fillProjectForm(b.dataset.editProject));$$('[data-delete-project]').forEach(b=>b.onclick=()=>deleteProject(b.dataset.deleteProject))}
  function clearProjectForm(){$('#projectForm')?.reset();if(!$('#projectId'))return;$('#projectId').value='';$('#projectImageUrl').value='';$('#projectActive').checked=true;$('#projectFeatured').checked=false;$('#projectStatus').value='em_andamento';$('#projectOrder').value='0';['#projectLaboratory','#projectKeywords','#projectFunding','#projectLattes','#projectOrcid','#projectDoi','#projectPoster','#projectContact'].forEach(s=>$(s).value='');setMediaPreview('#projectImagePreview','')}
  function fillProjectForm(id){const x=projectsCache.find(v=>v.id===id);if(!x)return;$('#projectId').value=x.id;$('#projectTitle').value=x.title||'';$('#projectStudent').value=x.student_name||'';$('#projectArea').value=x.area||'';$('#projectLaboratory').value=x.laboratory||'';$('#projectAdvisor').value=x.advisor||'';$('#projectCoadvisor').value=x.coadvisor||'';$('#projectYearStart').value=x.year_start||'';$('#projectYearEnd').value=x.year_end||'';$('#projectStatus').value=x.status||'em_andamento';$('#projectKeywords').value=(x.keywords||[]).join(', ');$('#projectFunding').value=x.funding||'';$('#projectDescription').value=x.description||'';$('#projectImageUrl').value=x.image_url||'';$('#projectUrl').value=x.project_url||'';$('#projectLattes').value=x.lattes_url||'';$('#projectOrcid').value=x.orcid_url||'';$('#projectDoi').value=x.doi||'';$('#projectPoster').value=x.poster_url||'';$('#projectContact').value=x.contact_email||'';$('#projectActive').checked=!!x.active;$('#projectFeatured').checked=!!x.featured;$('#projectOrder').value=Number(x.display_order||0);$('#projectImageFile').value='';setMediaPreview('#projectImagePreview',x.image_url||'');window.scrollTo({top:0,behavior:'smooth'})}
  async function deleteProject(id){const x=projectsCache.find(v=>v.id===id);if(!x||!confirm(`Excluir o projeto "${x.title}"?`))return;try{await portalAdminApi('delete_project',{id});toast('Projeto excluído');clearProjectForm();await loadProjectsAdmin()}catch(e){toast(errMsg(e),'error')}}
  $('#projectForm')?.addEventListener('submit',async e=>{e.preventDefault();try{let image=$('#projectImageUrl').value||null;const file=$('#projectImageFile').files?.[0];if(file){toast('Enviando imagem do projeto…');image=await uploadPublicImage(file,'projects')}const project={id:$('#projectId').value||undefined,title:$('#projectTitle').value.trim(),student_name:$('#projectStudent').value.trim()||null,area:$('#projectArea').value.trim()||null,laboratory:$('#projectLaboratory').value.trim()||null,keywords:$('#projectKeywords').value.trim()||null,funding:$('#projectFunding').value.trim()||null,advisor:$('#projectAdvisor').value.trim()||null,coadvisor:$('#projectCoadvisor').value.trim()||null,year_start:$('#projectYearStart').value||null,year_end:$('#projectYearEnd').value||null,status:$('#projectStatus').value,description:$('#projectDescription').value.trim()||null,image_url:image,project_url:$('#projectUrl').value.trim()||null,lattes_url:$('#projectLattes').value.trim()||null,orcid_url:$('#projectOrcid').value.trim()||null,doi:$('#projectDoi').value.trim()||null,poster_url:$('#projectPoster').value.trim()||null,contact_email:$('#projectContact').value.trim()||null,active:$('#projectActive').checked,featured:$('#projectFeatured').checked,display_order:Number($('#projectOrder').value)||0};const data=await portalAdminApi('save_project',{project});toast('Projeto salvo no portal');await loadProjectsAdmin();fillProjectForm(data.project.id)}catch(e){toast(errMsg(e),'error')}});

  // MLTN / POD
  const MLTN_CFG_KEY='cahk-mltn-config-v1';
  function loadMltnConfig(){
    let cfg={drive_url:'',sender_address:'Rua Arnaldo Teixeira Lemos, 857 - Jardim Lima - Franca/SP - CEP 14403-108'};
    try{cfg={...cfg,...JSON.parse(localStorage.getItem(MLTN_CFG_KEY)||'{}')}}catch{}
    if($('#mltnDriveUrl'))$('#mltnDriveUrl').value=cfg.drive_url||'';
    if($('#mltnSenderAddress'))$('#mltnSenderAddress').value=cfg.sender_address||'';
    syncMltnLinks(cfg);return cfg;
  }
  function syncMltnLinks(cfg=loadMltnConfig()){
    for(const id of ['#mltnOpenDrive','#modalOpenDrive']){const a=$(id);if(!a)continue;a.href=cfg.drive_url||'#';a.classList.toggle('disabled-link',!cfg.drive_url);}
  }
  $('#mltnConfigForm')?.addEventListener('submit',e=>{e.preventDefault();const cfg={drive_url:$('#mltnDriveUrl').value.trim(),sender_address:$('#mltnSenderAddress').value.trim()};localStorage.setItem(MLTN_CFG_KEY,JSON.stringify(cfg));syncMltnLinks(cfg);toast('Configuração MLTN salva neste navegador')});
  loadMltnConfig();
  function parseMltnNote(note){
    const out={};String(note||'').split('|').map(x=>x.trim()).forEach(part=>{const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=part.slice(i+1).trim()});return out;
  }
  function mltnOrderText(o){
    const m=parseMltnNote(o.observacao);const cfg=loadMltnConfig();
    const items=(o.encomenda_itens||[]).map(i=>`- ${Number(i.quantidade)}x ${i.produto_nome}${i.variante_nome?` | ${i.variante_nome}`:''}`).join('\n');
    const address=m.ENTREGA==='ENVIO'?[m.RUA,m.NUMERO,m.COMPLEMENTO,m.BAIRRO,m.CIDADE,m.UF,m.CEP?`CEP ${m.CEP}`:''].filter(Boolean).join(' - '):'RETIRADA COM O CAHK';
    return `PEDIDO CAHK / MLTN #${String(o.id).slice(0,8)}\n\nCLIENTE\nNome: ${o.nome||''}\nTelefone: ${o.telefone||''}\nE-mail: ${o.email||''}\nCPF: ${m.CPF||''}\nEntrega: ${m.ENTREGA||''}\nEndereço: ${address}\n\nITENS\n${items}\n\nTotal produtos: ${brl(o.total)}\nObservação do cliente: ${m.OBS||''}\n\nPRODUÇÃO\nDrive das artes: ${cfg.drive_url||'[CONFIGURAR NA ABA MLTN / POD]'}\nRemetente para Melhor Envio: ${cfg.sender_address||''}\n\nCHECKLIST\n[ ] Pagamento confirmado\n[ ] Arte/amostra aprovada\n[ ] Etiqueta Melhor Envio gerada\n[ ] Dados + etiqueta enviados à MLTN\n[ ] Produção confirmada`;
  }
  function openMltnOrder(id){const o=ordersCache.find(x=>x.id===id);if(!o)return;$('#mltnOrderText').value=mltnOrderText(o);syncMltnLinks(loadMltnConfig());$('#mltnOrderModal').classList.remove('hidden')}
  $('#closeMltnModal')?.addEventListener('click',()=>$('#mltnOrderModal').classList.add('hidden'));
  $('#copyMltnOrder')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#mltnOrderText').value);toast('Dados do pedido copiados')}catch{$('#mltnOrderText').select();document.execCommand('copy');toast('Dados do pedido copiados')}});

  // ENCOMENDAS
  const orderStatusLabel={nova:'Nova',confirmada:'Confirmada',aguardando_pagamento:'Aguardando pagamento',paga:'Paga',pronta:'Pronta',entregue:'Entregue',cancelada:'Cancelada'};
  $('#refreshOrders').onclick=loadOrders;$('#orderStatusFilter').onchange=loadOrders;
  async function loadOrders(){
    try{
      const status=$('#orderStatusFilter').value||'';const data=await adminApi('list',status?{status}:{});ordersCache=data.orders||[];renderOrders();
    }catch(e){toast(errMsg(e),'error')}
  }
  function renderOrders(){
    const counts={};for(const o of ordersCache)counts[o.status]=(counts[o.status]||0)+1;
    $('#orderMetrics').innerHTML=[['Exibidas',ordersCache.length],['Novas',counts.nova||0],['Pagas',counts.paga||0],['Prontas',counts.pronta||0]].map(([a,b])=>`<div class="metric"><span>${a}</span><strong>${b}</strong></div>`).join('');
    $('#ordersList').innerHTML=ordersCache.length?ordersCache.map(o=>{
      const items=(o.encomenda_itens||[]).map(i=>`<li>${Number(i.quantidade).toLocaleString('pt-BR')}× ${esc(i.produto_nome)}${i.variante_nome?` — <strong>${esc(i.variante_nome)}</strong>`:''} <span>${brl(i.total)}</span></li>`).join('');
      const whatsappRaw=String(o.telefone||'').replace(/\D/g,'');const whatsapp=whatsappRaw.startsWith('55')?whatsappRaw:`55${whatsappRaw}`;
      return `<article class="card order-card"><div class="order-head"><div><div class="muted small">#${esc(String(o.id).slice(0,8))} • ${dt(o.created_at)}</div><h2>${esc(o.nome)}</h2><div class="muted small">${esc(o.telefone||'')}${o.turma?` • ${esc(o.turma)}`:''}${o.email?` • ${esc(o.email)}`:''}</div></div><span class="badge ${o.status==='cancelada'?'danger':o.status==='entregue'?'ok':''}">${esc(orderStatusLabel[o.status]||o.status)}</span><span class="badge">Produção: ${esc(({aguardando:'Aguardando',arte:'Arte',enviado_mltn:'Enviado à MLTN',producao:'Em produção',postado:'Postado',entregue:'Entregue'}[o.fulfillment_status]||o.fulfillment_status||'Aguardando'))}</span></div><ul class="order-items">${items}</ul>${o.observacao?`<div class="order-note">${esc(o.observacao)}</div>`:''}<div class="order-total"><span>Total</span><strong>${brl(o.total)}</strong></div><div class="order-actions"><select data-order-status="${o.id}">${Object.entries(orderStatusLabel).map(([v,l])=>`<option value="${v}" ${v===o.status?'selected':''}>${l}</option>`).join('')}</select><button class="ghost" data-save-order-status="${o.id}">Salvar status</button>${whatsapp?`<a class="ghost button-link" target="_blank" rel="noopener" href="https://wa.me/${whatsapp}">WhatsApp</a>`:''}<button class="ghost" data-order-mltn="${o.id}">Preparar MLTN</button><button class="primary" data-order-pdv="${o.id}">Carregar no PDV</button></div></article>`;
    }).join(''):'<div class="card empty">Nenhuma encomenda encontrada.</div>';
    $$('[data-save-order-status]').forEach(b=>b.onclick=()=>saveOrderStatus(b.dataset.saveOrderStatus));
    $$('[data-order-pdv]').forEach(b=>b.onclick=()=>orderToPdv(b.dataset.orderPdv));$$('[data-order-mltn]').forEach(b=>b.onclick=()=>openMltnOrder(b.dataset.orderMltn));
  }
  async function saveOrderStatus(id){
    const sel=$(`[data-order-status="${id}"]`);if(!sel)return;
    try{await adminApi('update_status',{id,status:sel.value});toast('Status atualizado');await loadOrders()}catch(e){toast(errMsg(e),'error')}
  }
  function orderToPdv(id){
    const o=ordersCache.find(x=>x.id===id);if(!o)return;
    const next=[];const missing=[];
    for(const i of o.encomenda_itens||[]){const p=products.find(x=>x.id===i.produto_id);if(!p){missing.push(i.produto_nome);continue}if(Number(p.estoque)<Number(i.quantidade))missing.push(`${i.produto_nome} (estoque ${p.estoque})`);next.push({produto_id:p.id,nome:p.nome,preco:Number(p.preco_venda),quantidade:Number(i.quantidade)})}
    if(missing.length)return toast(`Ajuste o estoque antes: ${missing.join(', ')}`,'error');
    cart=next;const vars=(o.encomenda_itens||[]).filter(i=>i.variante_nome).map(i=>`${i.produto_nome}: ${i.variante_nome}`).join('; ');$('#saleNote').value=`Encomenda #${String(o.id).slice(0,8)}${vars?` | ${vars}`:''}`;renderCart();switchView('pdv');toast('Encomenda carregada no PDV');
  }

  // VENDEDORES
  function renderSellerList(){
    if(!$('#sellerList'))return;
    $('#sellerList').innerHTML=sellers.length?sellers.map(s=>`<div class="compact-item"><div><strong>${esc(s.codigo)} — ${esc(s.nome)}</strong><div class="muted small">${esc(s.telefone||'')} • ${s.ativo?'ativo':'inativo'}</div></div><button class="ghost" data-edit-seller="${s.id}">Editar</button></div>`).join(''):'<div class="empty">Nenhum vendedor.</div>';
    $$('[data-edit-seller]').forEach(b=>b.onclick=()=>{const s=sellers.find(x=>x.id===b.dataset.editSeller);$('#sellerId').value=s.id;$('#sCode').value=s.codigo;$('#sName').value=s.nome;$('#sPhone').value=s.telefone||'';$('#sActive').checked=s.ativo});
  }
  function clearSeller(){$('#sellerForm').reset();$('#sellerId').value='';$('#sActive').checked=true}
  $('#clearSeller').onclick=clearSeller;
  $('#sellerForm').onsubmit=async e=>{e.preventDefault();const id=$('#sellerId').value,p={codigo:$('#sCode').value.trim(),nome:$('#sName').value.trim(),telefone:$('#sPhone').value.trim()||null,ativo:$('#sActive').checked,updated_at:new Date().toISOString()};try{const r=id?await sb.from('vendedores').update(p).eq('id',id):await sb.from('vendedores').insert(p);if(r.error)throw r.error;toast('Vendedor salvo');clearSeller();await loadSellers()}catch(e){toast(errMsg(e),'error')}};

  // CLIENTES
  function renderClientList(){
    if(!$('#clientList'))return;
    $('#clientList').innerHTML=clients.length?clients.map(c=>`<div class="compact-item"><div><strong>${esc(c.nome)}</strong><div class="muted small">${esc(c.telefone||'')} • ${c.ativo?'ativo':'inativo'}</div></div><button class="ghost" data-edit-client="${c.id}">Editar</button></div>`).join(''):'<div class="empty">Nenhum cliente.</div>';
    $$('[data-edit-client]').forEach(b=>b.onclick=()=>{const c=clients.find(x=>x.id===b.dataset.editClient);$('#clientId').value=c.id;$('#cName').value=c.nome;$('#cPhone').value=c.telefone||'';$('#cActive').checked=c.ativo});
  }
  function clearClient(){$('#clientForm').reset();$('#clientId').value='';$('#cActive').checked=true}
  $('#clearClient').onclick=clearClient;
  $('#clientForm').onsubmit=async e=>{e.preventDefault();const id=$('#clientId').value,p={nome:$('#cName').value.trim(),telefone:$('#cPhone').value.trim()||null,ativo:$('#cActive').checked,updated_at:new Date().toISOString()};try{const r=id?await sb.from('clientes').update(p).eq('id',id):await sb.from('clientes').insert(p);if(r.error)throw r.error;toast('Cliente salvo');clearClient();await loadClients()}catch(e){toast(errMsg(e),'error')}};

  // VENDAS / RECIBO
  $('#refreshSales').onclick=loadSales;
  async function loadSales(){
    const d=$('#salesDate').value||dateInput(),start=new Date(`${d}T00:00:00`),end=new Date(`${d}T00:00:00`);end.setDate(end.getDate()+1);
    const {data,error}=await sb.from('vw_vendas_resumo').select('*').gte('created_at',start.toISOString()).lt('created_at',end.toISOString()).order('created_at',{ascending:false});
    if(error){toast(errMsg(error),'error');return}salesCache=data||[];
    $('#salesTable').innerHTML=salesCache.length?salesCache.map(v=>`<tr><td>#${v.id}</td><td>${dt(v.created_at)}</td><td>${esc(v.vendedor_nome)}</td><td>${esc(v.tipo_pagamento)}</td><td>${brl(v.total)}</td><td><span class="badge ${v.status==='cancelada'?'danger':'ok'}">${v.status}</span></td><td><div class="row"><button class="ghost" data-print-sale="${v.id}">Imprimir</button>${can('sales')&&can('stock')&&v.status!=='cancelada'?`<button class="danger" data-cancel-sale="${v.id}">Cancelar</button>`:''}</div></td></tr>`).join(''):'<tr><td colspan="7" class="empty">Sem vendas no período.</td></tr>';
    $$('[data-print-sale]').forEach(b=>b.onclick=async()=>printReceipt(await getSaleForReceipt(+b.dataset.printSale)));$$('[data-cancel-sale]').forEach(b=>b.onclick=()=>cancelSale(+b.dataset.cancelSale));
  }
  async function cancelSale(id){const motivo=prompt(`Motivo do cancelamento da venda #${id}`);if(!motivo||!confirm('Cancelar a venda e devolver os itens ao estoque?'))return;try{const{error}=await sb.rpc('cancelar_venda',{p_venda_id:id,p_motivo:motivo});if(error)throw error;toast('Venda cancelada');await Promise.all([loadSales(),loadProducts(),loadCashSummary()])}catch(e){toast(errMsg(e),'error')}}
  async function getSaleForReceipt(id){const{data:v,error}=await sb.from('vendas').select('*, vendedores(nome,codigo), clientes(nome)').eq('id',id).single();if(error)throw error;const{data:items,error:e2}=await sb.from('venda_itens').select('*').eq('venda_id',id).order('id');if(e2)throw e2;return{...v,items}}
  function printReceipt(v){
    const w=Number(config?.largura_impressao||80),items=v.items.map(i=>`<tr><td>${esc(i.produto_nome)}<div>${Number(i.quantidade).toLocaleString('pt-BR')} × ${brl(i.preco_unitario)}</div></td><td>${brl(i.total)}</td></tr>`).join('');
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>Venda #${v.id}</title><style>@page{size:${w}mm auto;margin:3mm}body{font-family:Arial,sans-serif;width:${w-7}mm;margin:0;font-size:11px;color:#000}h1{text-align:center;font-size:15px;margin:0 0 3px}.center{text-align:center}.line{border-top:1px dashed #000;margin:6px 0}table{width:100%;border-collapse:collapse}td{vertical-align:top;padding:2px 0}td:last-child{text-align:right;white-space:nowrap}.total{font-size:15px;font-weight:bold}.small{font-size:9px}</style></head><body><h1>${esc(config?.nome_empresa||'CaixaFlex')}</h1>${config?.cnpj?`<div class="center">CNPJ: ${esc(config.cnpj)}</div>`:''}${config?.endereco?`<div class="center">${esc(config.endereco)}</div>`:''}<div class="center small">COMPROVANTE INTERNO — NÃO FISCAL</div><div class="line"></div><div>Venda #${v.id}</div><div>${dt(v.created_at)}</div><div>Vendedor: ${esc(v.vendedores?.codigo||'')} — ${esc(v.vendedores?.nome||'')}</div><div class="line"></div><table>${items}</table><div class="line"></div><table><tr><td>Subtotal</td><td>${brl(v.subtotal)}</td></tr>${Number(v.desconto)>0?`<tr><td>Desconto</td><td>-${brl(v.desconto)}</td></tr>`:''}<tr class="total"><td>TOTAL</td><td>${brl(v.total)}</td></tr></table><div>Pagamento: ${esc(v.tipo_pagamento)}</div>${v.clientes?.nome?`<div>Cliente: ${esc(v.clientes.nome)}</div>`:''}${v.observacao?`<div>Obs.: ${esc(v.observacao)}</div>`:''}<div class="line"></div><div class="center">${esc(config?.mensagem_rodape||'Obrigado!')}</div><script>window.onload=()=>setTimeout(()=>window.print(),150);<\/script></body></html>`;
    const win=window.open('','_blank','width=420,height=720');if(!win)return toast('Permita pop-ups para imprimir','error');win.document.write(html);win.document.close();
  }

  // FIADO
  async function loadFiado(){
    const {data:sales,error}=await sb.from('vw_vendas_resumo').select('*').eq('fiado',true).eq('status','concluida').eq('quitado',false).order('created_at',{ascending:true});if(error){toast(errMsg(error),'error');return}
    const ids=(sales||[]).map(x=>x.id);let pays=[];if(ids.length){const r=await sb.from('pagamentos_fiado').select('venda_id,valor').in('venda_id',ids);if(r.error)throw r.error;pays=r.data||[]}
    $('#fiadoTable').innerHTML=sales?.length?sales.map(v=>{const pago=pays.filter(p=>p.venda_id===v.id).reduce((s,p)=>s+Number(p.valor),0),saldo=Number(v.total)-pago;return`<tr><td>#${v.id}</td><td>${esc(v.cliente_nome||'')}</td><td>${dt(v.created_at)}</td><td>${brl(v.total)}</td><td>${brl(pago)}</td><td><strong>${brl(saldo)}</strong></td><td><button class="primary" data-receive="${v.id}" data-balance="${saldo}">Receber</button></td></tr>`}).join(''):'<tr><td colspan="7" class="empty">Nenhum fiado em aberto.</td></tr>';
    $$('[data-receive]').forEach(b=>b.onclick=()=>receiveFiado(+b.dataset.receive,Number(b.dataset.balance)));
  }
  async function receiveFiado(id,balance){const val=prompt(`Valor a receber (saldo ${brl(balance)})`,String(balance.toFixed(2)).replace('.',','));if(val===null)return;const num=Number(val.replace(',','.'));if(!(num>0))return;const pay=prompt('Pagamento: Dinheiro, Pix ou Cartão','Pix');if(!pay)return;try{const{data,error}=await sb.rpc('receber_fiado',{p_venda_id:id,p_valor:num,p_tipo_pagamento:pay,p_observacao:null});if(error)throw error;toast(`Recebido. Saldo: ${brl(data.saldo)}`);await Promise.all([loadFiado(),loadCashSummary()])}catch(e){toast(errMsg(e),'error')}}

  // RELATÓRIOS
  $('#refreshReports').onclick=loadReports;
  async function loadReports(){
    const s=$('#reportStart').value,e=$('#reportEnd').value;if(!s||!e)return;const start=new Date(`${s}T00:00:00`),end=new Date(`${e}T00:00:00`);end.setDate(end.getDate()+1);
    const {data,error}=await sb.from('vw_vendas_resumo').select('*').gte('created_at',start.toISOString()).lt('created_at',end.toISOString()).eq('status','concluida');if(error){toast(errMsg(error),'error');return}
    const x=data||[];reportCache=x;const fat=x.reduce((a,b)=>a+Number(b.total),0),custo=x.reduce((a,b)=>a+Number(b.custo_total),0),lucro=x.reduce((a,b)=>a+Number(b.lucro),0);
    $('#reportMetrics').innerHTML=[['Vendas',x.length],['Faturamento',brl(fat)],['Custo',brl(custo)],['Lucro estimado',brl(lucro)],['Ticket médio',brl(x.length?fat/x.length:0)]].map(([a,b])=>`<div class="metric"><span>${a}</span><strong>${b}</strong></div>`).join('');
    const group=(arr,key)=>Object.entries(arr.reduce((o,v)=>{const k=v[key]||'—';o[k]=(o[k]||0)+Number(v.total);return o},{})).sort((a,b)=>b[1]-a[1]),render=rows=>rows.length?rows.map(([k,v])=>`<div class="compact-item"><strong>${esc(k)}</strong><span>${brl(v)}</span></div>`).join(''):'<div class="empty">Sem dados.</div>';
    $('#reportPayments').innerHTML=render(group(x,'tipo_pagamento'));$('#reportSellers').innerHTML=render(group(x,'vendedor_nome'));
    const ids=x.map(v=>v.id);let items=[];if(ids.length){const r=await sb.from('venda_itens').select('produto_nome,quantidade,total').in('venda_id',ids);if(!r.error)items=r.data||[]}const pg=Object.entries(items.reduce((o,v)=>{const k=v.produto_nome||'—';o[k]??={qty:0,total:0};o[k].qty+=Number(v.quantidade||0);o[k].total+=Number(v.total||0);return o},{})).sort((a,b)=>b[1].qty-a[1].qty);$('#reportProducts').innerHTML=pg.length?pg.slice(0,20).map(([k,v])=>`<div class="compact-item"><div><strong>${esc(k)}</strong><div class="muted small">${Number(v.qty).toLocaleString('pt-BR')} unidade(s)</div></div><span>${brl(v.total)}</span></div>`).join(''):'<div class="empty">Sem dados.</div>';const daily=Object.entries(x.reduce((o,v)=>{const k=String(v.created_at).slice(0,10);o[k]=(o[k]||0)+Number(v.total||0);return o},{})).sort((a,b)=>a[0].localeCompare(b[0]));const maxDaily=Math.max(1,...daily.map(v=>v[1]));$('#reportDaily').innerHTML=daily.length?daily.map(([k,v])=>`<div class="bar-row"><span>${new Date(k+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(2,v/maxDaily*100)}%"></div></div><strong>${brl(v)}</strong></div>`).join(''):'<div class="empty">Sem dados.</div>';const margin=fat?lucro/fat*100:0;$('#reportMargin').innerHTML=`<div class="metric"><span>Margem estimada</span><strong>${margin.toFixed(1).replace('.',',')}%</strong></div><div class="metric"><span>Lucro / venda</span><strong>${brl(x.length?lucro/x.length:0)}</strong></div>`;
  }
  $('#exportReports')?.addEventListener('click',()=>{if(!reportCache.length)return toast('Atualize o relatório antes de exportar','error');const cols=['id','created_at','vendedor_nome','cliente_nome','tipo_pagamento','subtotal','desconto','total','custo_total','lucro'];const csv=[cols.join(';'),...reportCache.map(r=>cols.map(c=>`"${String(r[c]??'').replace(/"/g,'""')}"`).join(';'))].join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`relatorio-cahk-${$('#reportStart').value}-${$('#reportEnd').value}.csv`;a.click();URL.revokeObjectURL(a.href)});

  // CONFIG
  $('#configForm').onsubmit=async e=>{e.preventDefault();const p={nome_empresa:$('#cfgName').value.trim(),cnpj:$('#cfgCnpj').value.trim()||null,telefone:$('#cfgPhone').value.trim()||null,endereco:$('#cfgAddress').value.trim()||null,mensagem_rodape:$('#cfgFooter').value.trim()||null,largura_impressao:Number($('#cfgWidth').value),updated_at:new Date().toISOString()};try{const{error}=await sb.from('configuracoes').update(p).eq('id',1);if(error)throw error;toast('Configurações salvas');await loadConfig()}catch(e){toast(errMsg(e),'error')}};

  init().catch(e=>{console.error(e);toast(errMsg(e),'error')});
})();
