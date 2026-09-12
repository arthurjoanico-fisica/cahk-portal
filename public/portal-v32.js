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

  const list = document.querySelector('#events-list');
  const events = Array.isArray(window.CAHK_PORTAL?.events) ? window.CAHK_PORTAL.events : [];
  if (!list) return;

  if (!events.length) {
    list.innerHTML = `
      <div class="empty-events">
        <div><strong>Agenda em atualização</strong>Os próximos eventos do CAHK vão aparecer aqui.</div>
        <a class="text-link" href="https://www.instagram.com/cahk.ufpr/" target="_blank" rel="noopener noreferrer">Acompanhar no Instagram →</a>
      </div>`;
    return;
  }

  list.innerHTML = events.slice(0, 3).map(event => {
    const url = event.url || '#';
    const external = /^https?:\/\//i.test(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `
      <a class="event-card" href="${escapeHtml(url)}"${external} style="text-decoration:none;color:inherit">
        <div class="event-date"><strong>${escapeHtml(event.day || '')}</strong><span>${escapeHtml(event.month || '')}</span></div>
        <div class="event-info">
          <h3>${escapeHtml(event.title || 'Evento CAHK')}</h3>
          ${event.place ? `<p>⌖ ${escapeHtml(event.place)}</p>` : ''}
          ${event.time ? `<p>◷ ${escapeHtml(event.time)}</p>` : ''}
        </div>
      </a>`;
  }).join('');

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
})();
