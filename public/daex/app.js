import { getValidSession, signIn } from './auth.js';

const USERNAME_MAP = Object.freeze({ caixadaex: 'caixadaex@cahk.app' });
const form = document.querySelector('#login-form');
const errorBox = document.querySelector('#error');
const submit = document.querySelector('#submit');

function normalize(v) { return String(v ?? '').trim().toLowerCase(); }
function safeNext() {
  const value = new URLSearchParams(location.search).get('next') || 'dashboard.html';
  return /^(dashboard\.html|vale\.html)(\?|#|$)/.test(value) ? value : 'dashboard.html';
}
function showError(message) { errorBox.textContent = message; errorBox.hidden = !message; }

(async () => {
  if (await getValidSession()) location.replace(`./${safeNext()}`);
})();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');
  const email = USERNAME_MAP[normalize(document.querySelector('#username').value)];
  const password = document.querySelector('#password').value;
  if (!email) return showError('Usuário ou senha inválidos.');
  submit.disabled = true;
  submit.textContent = 'Entrando...';
  const result = await signIn(email, password);
  submit.disabled = false;
  submit.textContent = 'Entrar';
  if (!result.ok) return showError(result.network ? 'Sem conexão. Tente novamente.' : 'Usuário ou senha inválidos.');
  location.replace(`./${safeNext()}`);
});
