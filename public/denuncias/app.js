(() => {
  const $ = id => document.getElementById(id);
  const cfg = window.CAIXAFLEX_CONFIG || {};
  let submissionKey = crypto.randomUUID(), photos = [], busy = false;
  const msg = (text, type = 'error') => { $('formMessage').className = type; $('formMessage').textContent = text; };
  function renderPhotos() {
    $('imagePreview').replaceChildren();
    photos.forEach((item, index) => {
      const box = document.createElement('div'); box.className = 'photo';
      const image = document.createElement('img'); image.src = item.url; image.alt = `Prévia da imagem ${index + 1}`;
      const label = document.createElement('span'); label.textContent = `Imagem ${index + 1}`;
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Remover'; button.disabled = busy;
      button.addEventListener('click', () => { URL.revokeObjectURL(item.url); photos.splice(index, 1); renderPhotos(); });
      box.append(image, label, button); $('imagePreview').append(box);
    });
  }
  function clearPhotos() { photos.forEach(p => URL.revokeObjectURL(p.url)); photos = []; $('reportImages').value = ''; renderPhotos(); }
  $('reportText').addEventListener('input', () => { $('textCount').textContent = `${$('reportText').value.length.toLocaleString('pt-BR')} / 10.000 caracteres · mínimo de 20`; });
  $('reportImages').addEventListener('change', async e => {
    if (busy) return;
    const chosen = [...e.target.files]; e.target.value = '';
    if (photos.length + chosen.length > 3) return msg('Você pode anexar até três imagens. Remova uma antes de adicionar outra.');
    const types = ['image/jpeg', 'image/png', 'image/webp'];
    for (const file of chosen) {
      if (!types.includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) return msg('Use imagens JPG, PNG ou WebP, de até 5 MB cada.');
    }
    for (const file of chosen) photos.push({ file, url: URL.createObjectURL(file) });
    renderPhotos(); msg('', '');
  });
  async function convert(item, index) {
    const img = new Image(); img.src = item.url; await img.decode();
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 40000000) throw Error('Uma imagem é grande demais para ser processada. Reduza sua resolução.');
    const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let result;
    for (const quality of [0.92, 0.82, 0.7, 0.55]) {
      result = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (result && result.size <= 2 * 1024 * 1024) break;
    }
    canvas.width = 0; canvas.height = 0;
    if (!result || result.size > 2 * 1024 * 1024) throw Error('Não foi possível reduzir uma imagem. Escolha uma versão menor.');
    return new File([result], `imagem-${index + 1}.jpg`, { type: 'image/jpeg' });
  }
  function setBusy(value) {
    busy = value; $('submitReport').disabled = value;
    for (const id of ['reportText', 'reportImages', 'reportConsent']) $(id).disabled = value;
    renderPhotos(); $('submitReport').textContent = value ? 'Enviando…' : 'Enviar denúncia';
  }
  $('reportForm').addEventListener('submit', async e => {
    e.preventDefault(); if (busy) return;
    const text = $('reportText').value.trim();
    if (text.length < 20 || text.length > 10000) return msg('Escreva um relato entre 20 e 10.000 caracteres.');
    if (!$('reportConsent').checked) return msg('Leia e marque a confirmação de privacidade.');
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return msg('O recebimento está indisponível. Tente mais tarde.');
    setBusy(true); msg(photos.length ? 'Preparando imagens e enviando seu relato…' : 'Enviando seu relato…', 'sending');
    const controller = new AbortController(); let timer;
    try {
      const form = new FormData(); form.set('text', text); form.set('submission_key', submissionKey); form.set('website', $('reportWebsite').value);
      for (let i = 0; i < photos.length; i++) form.append('images', await convert(photos[i], i));
      timer = setTimeout(() => controller.abort(), 60000);
      // Deliberately independent of any existing Supabase login on this device.
      const response = await fetch(`${cfg.SUPABASE_URL}/functions/v1/cahk-denuncias?action=submit`, { method: 'POST', headers: { apikey: cfg.SUPABASE_PUBLISHABLE_KEY }, body: form, signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.protocol) throw Error(data.error || 'Não foi possível confirmar o recebimento. Tente novamente.');
      $('receiptCode').textContent = data.protocol; $('receipt').hidden = false; $('reportForm').hidden = true;
      $('reportForm').reset(); $('reportText').value = ''; $('textCount').textContent = '0 / 10.000 caracteres · mínimo de 20'; clearPhotos(); msg('', '');
      $('receipt').focus(); $('receipt').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      msg(error.name === 'AbortError' ? 'O envio demorou mais que o esperado. O recebimento não foi confirmado; tente novamente sem alterar o conteúdo.' : error.message || 'Falha de conexão. Seu relato permanece no formulário para tentar novamente.');
    } finally { clearTimeout(timer); setBusy(false); }
  });
  $('newReport').addEventListener('click', () => { submissionKey = crypto.randomUUID(); $('receipt').hidden = true; $('receiptCode').textContent = ''; $('reportForm').hidden = false; $('reportConsent').checked = false; $('reportText').focus(); });
})();
