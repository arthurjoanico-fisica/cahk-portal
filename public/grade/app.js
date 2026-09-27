(()=>{
const URL='https://ekmzeqnnktdwvzxacbix.supabase.co';
const KEY='sb_publishable_jeWoJ4G9UXN6ucS3WkZVzA_ytTEzuJz';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
let data=null,view='offerings';

function niceDate(v){try{return new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return ''}}
function semesterText(v){const [y,s]=String(v||'').split('/');return y&&s?`${s}º semestre de ${y}`:(v||'—')}
function linkButton(label,url){return url?`<a class="academic-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`:''}
function contactBlock(x){
  const buttons=[];
  if(x.email)buttons.push(`<a class="academic-link" href="mailto:${esc(x.email)}">E-mail</a>`);
  if(x.page_url)buttons.push(linkButton('Página do docente',x.page_url));
  if(buttons.length)return `<div class="academic-contact">${buttons.join('')}${x.email?`<span class="academic-email">${esc(x.email)}</span>`:''}</div>`;
  return `<div class="academic-contact academic-contact-missing">Contato público não localizado automaticamente.</div>`;
}
function offeringKind(x){
  if(x.course_code==='BFO')return 'opt-bach';
  if(x.course_code==='LFO')return 'opt-lic';
  if(String(x.course_code||'').startsWith('BF'))return 'bach';
  if(x.course_code==='LF')return 'lic';
  return 'other';
}
function offeringCard(x){
  return `<article class="offering-card">
    <div class="offering-top"><div><span class="course-code">${esc(x.code)}</span><span class="tag">${esc(x.course)}</span></div>${x.ramal?`<span class="ramal">Ramal ${esc(x.ramal)}</span>`:''}</div>
    <h3>${esc(x.title)}</h3>
    <div class="teacher-name">${esc(x.professor||'Docente não identificado')}</div>
    ${contactBlock(x)}
  </article>`;
}
function renderOfferings(){
  const q=norm($('#academicSearch').value),filter=$('#academicFilter').value;
  const list=(data?.offerings||[]).filter(x=>(!filter||offeringKind(x)===filter)&&(!q||norm([x.code,x.title,x.professor,x.email,x.course].join(' ')).includes(q)));
  $('#academicSummary').innerHTML=`<strong>${list.length}</strong> oferta${list.length===1?'':'s'} do Departamento de Física em <strong>${esc(data.semester)}</strong>.`;
  if(!list.length){$('#academicContent').className='empty-public';$('#academicContent').textContent='Nenhuma disciplina encontrada com esse filtro.';return}
  const groups=[
    ['Bacharelado',list.filter(x=>offeringKind(x)==='bach')],
    ['Licenciatura',list.filter(x=>offeringKind(x)==='lic')],
    ['Optativas do Bacharelado',list.filter(x=>offeringKind(x)==='opt-bach')],
    ['Optativas da Licenciatura',list.filter(x=>offeringKind(x)==='opt-lic')]
  ].filter(g=>g[1].length);
  $('#academicContent').className='';
  $('#academicContent').innerHTML=groups.map(([name,arr])=>`<section class="academic-section"><div class="catalog-section-head"><h2>${name}</h2><span>${arr.length} oferta${arr.length===1?'':'s'}</span></div><div class="offering-grid">${arr.map(offeringCard).join('')}</div></section>`).join('');
}
function curriculumFor(kind){return data?.curriculum?.[kind]||{items:[],periods:0,version:''}}
function renderCurriculum(kind){
  const c=curriculumFor(kind),q=norm($('#academicSearch').value),period=$('#academicFilter').value;
  const list=(c.items||[]).filter(x=>(!period||String(x.period)===period)&&(!q||norm([x.code,x.name,x.prerequisites].join(' ')).includes(q)));
  const label=kind==='bachelor'?'Bacharelado':'Licenciatura';
  $('#academicSummary').innerHTML=`${label} • versão curricular <strong>${esc(c.version)}</strong> • ${c.periods} períodos • <strong>${list.length}</strong> disciplina${list.length===1?'':'s'} exibida${list.length===1?'':'s'}.`;
  if(!list.length){$('#academicContent').className='empty-public';$('#academicContent').textContent='Nenhuma disciplina encontrada com esse filtro.';return}
  const periods=[...new Set(list.map(x=>x.period))].sort((a,b)=>a-b);
  $('#academicContent').className='';
  $('#academicContent').innerHTML=periods.map(p=>{
    const arr=list.filter(x=>x.period===p);
    return `<section class="academic-section period-section"><div class="catalog-section-head"><h2>${p}º período</h2><span>${arr.length} disciplina${arr.length===1?'':'s'}</span></div><div class="curriculum-list">${arr.map(x=>`<div class="curriculum-row"><span class="course-code">${esc(x.code)}</span><div class="curriculum-main"><strong>${esc(x.name)}</strong>${x.prerequisites?`<small>Pré-requisito: ${esc(x.prerequisites)}</small>`:''}</div>${x.workload?`<span class="hours">${esc(x.workload)}${/h/.test(String(x.workload))?'':' h'}</span>`:''}</div>`).join('')}</div></section>`;
  }).join('');
}
function offeredFaculty(){
  const map=new Map();
  for(const x of data?.offerings||[]){
    if(!x.professor)continue;
    const k=x.email||norm(x.professor);
    if(!map.has(k))map.set(k,{name:x.professor,email:x.email,page_url:x.page_url,ramal:x.ramal,courses:[]});
    const f=map.get(k);
    if(!f.courses.some(c=>c.code===x.code&&c.course===x.course))f.courses.push({code:x.code,title:x.title,course:x.course,kind:offeringKind(x)});
  }
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
}
function renderFaculty(){
  const q=norm($('#academicSearch').value),filter=$('#academicFilter').value;
  const list=offeredFaculty().filter(x=>(!q||norm([x.name,x.email,x.courses.map(c=>c.code+' '+c.title).join(' ')].join(' ')).includes(q))&&(!filter||x.courses.some(c=>c.kind===filter)));
  $('#academicSummary').innerHTML=`<strong>${list.length}</strong> docente${list.length===1?'':'s'} vinculado${list.length===1?'':'s'} às ofertas de <strong>${esc(data.semester)}</strong>.`;
  if(!list.length){$('#academicContent').className='empty-public';$('#academicContent').textContent='Nenhum docente encontrado com esse filtro.';return}
  $('#academicContent').className='';
  $('#academicContent').innerHTML=`<div class="faculty-grid">${list.map(x=>`<article class="faculty-card">
    <div class="faculty-avatar">${esc(x.name.split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase())}</div>
    <div class="faculty-body">
      <h3>${esc(x.name)}</h3>
      ${x.email?`<a class="faculty-email" href="mailto:${esc(x.email)}">${esc(x.email)}</a>`:'<span class="muted small">E-mail não localizado no cadastro público</span>'}
      ${x.ramal?`<span class="muted small">Ramal: ${esc(x.ramal)}</span>`:''}
      <div class="faculty-courses">${x.courses.slice(0,7).map(c=>`<span>${esc(c.code)} · ${esc(c.title)}</span>`).join('')}${x.courses.length>7?`<span>+ ${x.courses.length-7} oferta(s)</span>`:''}</div>
      ${x.page_url?`<a class="catalog-button faculty-page" href="${esc(x.page_url)}" target="_blank" rel="noopener">Página do docente →</a>`:''}
    </div>
  </article>`).join('')}</div>`;
}
function configureFilter(){
  const f=$('#academicFilter');
  if(view==='bachelor'||view==='licenciatura'){
    const c=curriculumFor(view);
    f.innerHTML='<option value="">Todos os períodos</option>'+Array.from({length:c.periods||0},(_,i)=>`<option value="${i+1}">${i+1}º período</option>`).join('');
  }else{
    f.innerHTML='<option value="">Todos</option><option value="bach">Bacharelado</option><option value="lic">Licenciatura</option><option value="opt-bach">Optativas do Bacharelado</option><option value="opt-lic">Optativas da Licenciatura</option>';
  }
}
function renderSources(){
  const s=data?.sources||{};
  $('#academicSources').innerHTML=`<div class="source-head"><div><strong>Atualização automática</strong><span>Fontes oficiais da Física UFPR</span></div><span class="source-state">${data?.stale?'Última cópia disponível':'Sincronizado'}</span></div>
    <div class="source-links">
      ${s.teaching_loads?linkButton(`Encargos didáticos ${data.semester}`,s.teaching_loads):''}
      ${s.bachelor_page?linkButton(`Bacharelado ${data.curriculum?.bachelor?.version||''}`,s.bachelor_page):''}
      ${s.licenciatura_page?linkButton(`Licenciatura ${data.curriculum?.licenciatura?.version||''}`,s.licenciatura_page):''}
      ${s.personnel?linkButton('Docentes / contatos',s.personnel):''}
    </div>
    <p>O portal verifica automaticamente as páginas oficiais e o quadro mais recente de encargos didáticos. Quando um novo semestre ou uma nova versão de grade é publicada pela Física UFPR, a página é atualizada sem precisar editar o portal manualmente. A sincronização automática ocorre diariamente e o resultado fica em cache para manter o site rápido.</p>
    <p><strong>Importante:</strong> “Disciplinas ofertadas” mostra as ofertas do Departamento de Física para Bacharelado/Licenciatura e as optativas identificadas no quadro oficial. Disciplinas da grade ministradas por outros departamentos aparecem na matriz curricular, mas o portal não inventa o docente quando essa informação não está na fonte do DFIS.</p>`;
}
function render(){
  if(!data)return;
  if(view==='offerings')renderOfferings();
  else if(view==='bachelor')renderCurriculum('bachelor');
  else if(view==='licenciatura')renderCurriculum('licenciatura');
  else renderFaculty();
}
async function load(){
  try{
    const r=await fetch(`${URL}/functions/v1/physics-academic`,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY},body:'{}'});
    const d=await r.json();
    if(!r.ok||d.error)throw new Error(d.error||'Erro ao carregar informações acadêmicas');
    data=d;
    $('#semesterBadge').textContent=d.semester||'—';
    $('#updateBadge').textContent=`Atualizado ${niceDate(d.updated_at)}${d.cached?' • cache':''}${d.stale?' • fonte indisponível agora':''}`;
    configureFilter();renderSources();render();
  }catch(e){
    $('#academicContent').className='empty-public';
    $('#academicContent').innerHTML=`Não foi possível carregar as informações acadêmicas agora.<br><small>${esc(e.message||'Erro de conexão')}</small>`;
    $('#academicSummary').textContent='Fonte oficial temporariamente indisponível.';
  }
}
$$('.academic-tab').forEach(btn=>btn.addEventListener('click',()=>{
  $$('.academic-tab').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');view=btn.dataset.view;$('#academicSearch').value='';configureFilter();render();
}));
$('#academicSearch').addEventListener('input',render);
$('#academicFilter').addEventListener('change',render);
load();
})();