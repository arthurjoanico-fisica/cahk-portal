(() => {
  const cfg = window.CAIXAFLEX_CONFIG || {}, $ = id => document.getElementById(id);
  if (!window.supabase || !cfg.SUPABASE_URL || !$('view-denuncias')) return;
  const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
  const labels = { recebida: 'Recebida', em_analise: 'Em análise', encaminhada: 'Encaminhada', encerrada: 'Encerrada' };
  let profile = null, page = 0, current = null, listSeq = 0, detailSeq = 0, hasMore = false, saving = false;
  const date = value => new Date(value).toLocaleString('pt-BR');
  const message = (text, error = false) => { $('complaintMessage').textContent = text; $('complaintMessage').className = error ? 'complaint-message error' : 'complaint-message'; };
  async function api(action, body) {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error || !session?.access_token) throw Error('Entre novamente na gestão.');
    const r = await fetch(`${cfg.SUPABASE_URL}/functions/v1/cahk-denuncias?action=${action}`, { method: 'POST', headers: { apikey: cfg.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store', referrerPolicy: 'no-referrer', credentials: 'omit' });
    const data = await r.json().catch(() => ({})); if (!r.ok) throw Error(data.error || 'Não foi possível carregar as denúncias.'); return data;
  }
  function clearDetail() { detailSeq++; current = null; $('complaintDetail').hidden = true; $('complaintPhotos').replaceChildren(); $('complaintText').textContent = ''; $('complaintNotes').value = ''; $('complaintHistory').replaceChildren(); }
  function renderList(items) {
    const host = $('complaintList'); host.replaceChildren();
    if (!items.length) { const empty = document.createElement('p'); empty.className = 'muted'; empty.textContent = 'Nenhuma denúncia neste filtro.'; host.append(empty); return; }
    for (const item of items) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'complaint-row';
      const main = document.createElement('div'), name = document.createElement('strong'), created = document.createElement('small'), status = document.createElement('span');
      name.textContent = item.protocol; created.textContent = date(item.created_at); main.append(name, created); status.textContent = labels[item.status] || item.status; status.className = `complaint-status ${item.status}`;
      button.append(main, status); button.addEventListener('click', () => open(item.id)); host.append(button);
    }
  }
  function lockSaving(value) {
    saving = value;
    document.querySelectorAll('#view-denuncias button, #view-denuncias select, #view-denuncias textarea, #nav button').forEach(el => {
      if (value) { el.dataset.complaintWasDisabled = String(el.disabled); el.disabled = true; }
      else { el.disabled = el.dataset.complaintWasDisabled === 'true'; delete el.dataset.complaintWasDisabled; }
    });
    if (!value) { $('complaintPrev').disabled = page === 0; $('complaintNext').disabled = !hasMore; }
  }
  async function load(internal = false) {
    if (saving && !internal) return false;
    if (!profile?.ativo || profile.role !== 'admin') return;
    const seq = ++listSeq; message('Carregando registros…'); $('complaintRefresh').disabled = true;
    try { const data = await api('list', { page, status: $('complaintFilter').value }); if (seq !== listSeq) return; renderList(data.items || []); hasMore = !!data.has_more; $('complaintPage').textContent = `Página ${page + 1}`; $('complaintPrev').disabled = page === 0; $('complaintNext').disabled = !hasMore; message(''); return true; }
    catch (error) { if (seq === listSeq) { $('complaintList').replaceChildren(); message(error.message, true); } return false; }
    finally { if (seq === listSeq) $('complaintRefresh').disabled = false; }
  }
  async function open(id, internal = false) {
    if ((saving && !internal) || !profile?.ativo || profile.role !== 'admin') return false;
    if (current && ($('complaintNotes').value !== current.internal_notes || $('complaintStatus').value !== current.status) && !confirm('Você tem alterações não salvas. Abrir outro registro?')) return;
    const seq = ++detailSeq; message('Abrindo denúncia…');
    try {
      const data = await api('detail', { id }); if (seq !== detailSeq) return;
      current = data.item; $('complaintDetail').hidden = false; $('complaintProtocol').textContent = current.protocol; $('complaintCreated').textContent = `Recebida em ${date(current.created_at)}`;
      $('complaintText').textContent = current.text; $('complaintStatus').value = current.status; $('complaintNotes').value = current.internal_notes || '';
      const host = $('complaintPhotos'); host.replaceChildren();
      for (const [i, photo] of (data.photos || []).entries()) {
        const a = document.createElement('a'); a.href = photo.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.referrerPolicy = 'no-referrer';
        const img = document.createElement('img'); img.src = photo.url; img.alt = `Anexo ${i + 1}`; img.referrerPolicy = 'no-referrer'; img.loading = 'lazy';
        a.append(img); host.append(a);
      }
      $('complaintPhotoHint').textContent = (data.photos || []).length ? 'Acesso temporário às imagens. Se expirarem, use Recarregar registro.' : 'Sem imagens anexadas.';
      const history = $('complaintHistory'); history.replaceChildren();
      for (const item of data.history || []) { const div = document.createElement('div'); div.className = 'complaint-history-row'; const title = document.createElement('strong'), note = document.createElement('p'); title.textContent = `${date(item.created_at)} · ${labels[item.status] || item.status}`; note.textContent = item.notes || 'Sem observações.'; div.append(title, note); history.append(div); }
      if (!(data.history || []).length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Ainda não há atualizações administrativas.'; history.append(p); }
      message(''); $('complaintDetail').scrollIntoView({ behavior: 'smooth', block: 'start' }); return true;
    } catch (error) { if (seq === detailSeq) message(error.message, true); return false; }
  }
  $('complaintForm').addEventListener('submit', async e => {
    e.preventDefault(); if (!current || saving) return;
    const editing = current, status = $('complaintStatus').value, notes = $('complaintNotes').value.trim();
    detailSeq++; lockSaving(true); message('Salvando registro…');
    try {
      const result = await api('update', { id: editing.id, version: editing.version, status, notes });
      if (!profile?.ativo || profile.role !== 'admin') return;
      current = {...editing, status, internal_notes: notes, version: result.version || editing.version + 1};
      $('complaintNotes').value = notes;
      const listOk = await load(true), detailOk = await open(editing.id, true);
      message(listOk && detailOk ? 'Registro salvo.' : 'Registro salvo, mas não foi possível recarregar os dados. Use Recarregar registro antes de continuar.', !(listOk && detailOk));
    } catch (error) { message(error.message, true); } finally { lockSaving(false); }
  });
  $('complaintRefresh').addEventListener('click', load);
  $('complaintFilter').addEventListener('change', () => { page = 0; load(); });
  $('complaintPrev').addEventListener('click', () => { if (page > 0) { page--; load(); } });
  $('complaintNext').addEventListener('click', () => { if (hasMore) { page++; load(); } });
  $('complaintReload').addEventListener('click', () => { if (current) open(current.id); });
  $('complaintClose').addEventListener('click', () => { if (current && ($('complaintNotes').value !== current.internal_notes || $('complaintStatus').value !== current.status) && !confirm('Descartar alterações não salvas?')) return; clearDetail(); });
  document.addEventListener('click', e => { if (e.target.closest('[data-view="denuncias"]')) load(); });
  function applyProfile(value) { profile = value; const allowed = profile?.ativo && profile.role === 'admin'; $('complaintNav').classList.toggle('hidden', !allowed); if (!allowed) { clearDetail(); $('complaintList').replaceChildren(); } }
  window.addEventListener('cahk-profile-ready', e => applyProfile(e.detail));
  if (window.CAHK_MANAGEMENT_PROFILE) applyProfile(window.CAHK_MANAGEMENT_PROFILE);
  sb.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') { profile = null; listSeq++; clearDetail(); $('complaintList').replaceChildren(); $('complaintNav').classList.add('hidden'); } });
  window.addEventListener('pagehide', () => { profile = null; listSeq++; clearDetail(); $('complaintList').replaceChildren(); });
  window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
})();
