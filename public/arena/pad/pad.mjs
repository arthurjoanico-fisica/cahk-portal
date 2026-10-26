import { MotionController, normalizeSensitivity } from './motion.mjs';
import { angleBetween } from './racket-math.mjs';

export function createPad({ window: win = globalThis.window, document: doc = globalThis.document } = {}) {
  const $ = id => doc.getElementById(id);
  const text = (id, value) => { if ($(id).textContent !== value) $(id).textContent = value; };
  const motion = new MotionController();
  const url = new URL(win.location.href);
  const room = url.searchParams.get('room') || '';
  const player = url.searchParams.get('player');
  const token = new URLSearchParams(url.hash.slice(1)).get('token') || '';
  const validInvite = /^[A-Za-z0-9_-]{1,128}$/.test(room) && ['1', '2'].includes(player) && token.length > 0 && token.length <= 512;
  const clock = () => win.performance.now();
  let lastPose = null, poseAt = -Infinity;
  let socket = null, connected = false, host = false, sentReady = null;
  let retryTimer = null, retryDelay = 500, heartbeat = null, heartbeatAt = 0;
  let mode = 'idle', permissionGranted = false, sensorError = '', transportError = '';
  let orientation = null, orientationAt = -Infinity, lastReading = -Infinity, sensingSince = 0;
  let sensorFresh = false, startVersion = 0, heldTimer = null, feedbackTimer = null;
  let wake = null, wakePending = false, lastManualShot = -Infinity, leaving = false;

  doc.documentElement.dataset.player = player === '2' ? '2' : '1';
  $('player-number').textContent = player === '2' ? '02' : '01';
  $('player-name').textContent = `JOGADOR ${player === '2' ? '2' : '1'}`;
  const visible = () => !doc.hidden && !leaving;
  const locallyReady = () => validInvite && visible() && (mode === 'manual' ||
    (mode === 'motion' && permissionGranted && motion.calibrated && sensorFresh && !sensorError));
  const ready = () => connected && !transportError && locallyReady();

  function send(packet) {
    if (!connected || socket?.readyState !== win.WebSocket.OPEN) return false;
    try { socket.send(JSON.stringify(packet)); return true; } catch { return false; }
  }
  function syncPose() {
    if (mode !== 'motion' || !ready() || !host || !visible() || socket?.bufferedAmount > 16384) return;
    const q = motion.getPose();
    if (!q) return;
    const now = clock(), elapsed = now - poseAt;
    if (elapsed < 1000 / 15) return;
    if (lastPose && angleBetween(q, lastPose) <= 1.5 * Math.PI / 180 && elapsed < 1000) return;
    if (send({ type: 'pose', q })) { lastPose = q; poseAt = now; }
  }
  function syncReady() {
    const value = ready();
    if (sentReady !== value && send({ type: 'ready', ready: value })) sentReady = value;
  }
  function render() {
    $('connection').dataset.state = connected ? (host ? 'online' : 'waiting') : 'offline';
    text('connection-text', connected ? (host ? 'Tela conectada' : 'Aguardando a tela') : 'Reconectando à sala');
    $('mode-label').textContent = mode === 'manual' ? 'Modo acessível · toque manual' : 'Controle por movimento';
    $('manual-controls').hidden = mode !== 'manual';
    $('manual-mode').hidden = mode === 'manual';
    $('manual-shot').disabled = !ready() || !host;
    $('start').disabled = !validInvite || mode === 'requesting' || (mode === 'motion' && !sensorError);
    $('start').textContent = mode === 'requesting' ? 'Aguardando permissão…' : mode === 'manual' ? 'Usar sensores' : sensorError ? 'Tentar sensores novamente' : 'Iniciar controle';
    $('calibrate').disabled = mode !== 'motion' || !permissionGranted || !visible();
    $('manual-mode').disabled = !validInvite;
    $('calibration-progress').hidden = mode !== 'motion' || motion.calibrated || !!sensorError;
    $('calibration-progress').value = motion.calibrationProgress;
    let title, detail;
    if (!validInvite) {
      title = 'Convite incompleto'; detail = 'Abra novamente o QR code do seu jogador na tela da Arena.';
      text('connection-text', 'Sem vínculo com uma sala');
    } else if (!visible()) {
      title = 'Controle pausado'; detail = 'Volte a esta página para continuar. A tela mantém a partida em pausa.';
    } else if (transportError) {
      title = 'Não foi possível entrar'; detail = transportError;
    } else if (sensorError && mode !== 'manual') {
      title = 'Sensores indisponíveis'; detail = sensorError;
    } else if (mode === 'requesting') {
      title = 'Autorize o movimento'; detail = 'Permita movimento e orientação quando o celular solicitar.';
    } else if (mode === 'idle') {
      title = 'Sua próxima jogada começa aqui.'; detail = 'Toque em iniciar, autorize os sensores e segure o celular como o cabo de uma raquete.';
    } else if (mode === 'motion' && !motion.calibrated) {
      title = 'Encontre seu ponto neutro'; detail = 'Segure com a tela voltada para você e a borda superior para cima, como o cabo de uma raquete. Fique parado por um instante para calibrar.';
    } else if (mode === 'motion' && !sensorFresh) {
      title = 'Aguardando os sensores'; detail = 'Mantenha esta página aberta. Precisamos receber leituras reais do celular.';
    } else if (!connected) {
      title = 'Reconectando…'; detail = 'A partida fica pausada enquanto recuperamos a conexão. Seu placar continua na tela.';
    } else if (!host) {
      title = 'Pronto. Falta a tela.'; detail = 'Mantenha esta página aberta e aguarde a tela da Arena se conectar.';
    } else if (mode === 'manual') {
      title = 'Você joga pelo toque'; detail = 'Modo acessível ativo: ajuste a direção e toque em Rebater. Os sensores não controlam as jogadas neste modo.';
    } else {
      title = 'Pronto para rebater'; detail = 'Mire com o caminho e a face da raquete. Um arco amplo e rápido dá mais força; abra a face e suba para um lob.';
    }
    text('status-title', title);
    text('status-detail', detail);
    doc.documentElement.dataset.ready = String(ready() && host);
    syncReady();
  }

  async function requestWake() {
    if (wake || wakePending || !visible() || !validInvite || !['motion', 'manual'].includes(mode)) return;
    if (!win.navigator.wakeLock?.request) {
      $('wake-note').textContent = 'Mantenha a tela acesa durante o jogo.';
      return;
    }
    wakePending = true;
    try {
      const lock = await win.navigator.wakeLock.request('screen');
      if (!visible() || !['motion', 'manual'].includes(mode)) { await lock.release(); return; }
      wake = lock;
      $('wake-note').textContent = 'Tela mantida acesa durante o jogo';
      lock.addEventListener('release', () => {
        if (wake === lock) {
          wake = null;
          $('wake-note').textContent = 'Mantenha a tela acesa durante o jogo.';
        }
      });
    } catch { $('wake-note').textContent = 'Mantenha a tela acesa durante o jogo.'; }
    finally { wakePending = false; }
  }
  function releaseWake() {
    const lock = wake; wake = null;
    if (lock) Promise.resolve(lock.release()).catch(() => {});
  }
  function beginCalibration() {
    if (mode !== 'motion' || !permissionGranted) return;
    lastPose = null;
    motion.calibrate(); sensorFresh = false; sensorError = '';
    sensingSince = clock(); lastReading = -Infinity;
    render();
  }
  async function start() {
    if (!validInvite || !visible() || mode === 'requesting') return;
    const version = ++startVersion;
    mode = 'requesting'; permissionGranted = false; sensorFresh = false; sensorError = '';
    motion.calibrate(); render();
    if (!win.isSecureContext || !win.DeviceMotionEvent || !win.DeviceOrientationEvent) {
      mode = 'idle';
      sensorError = !win.isSecureContext ? 'Os sensores precisam de uma conexão HTTPS. Reabra o convite seguro ou use o modo acessível.' :
        'Este navegador não oferece suporte aos sensores de movimento e orientação. Use o modo acessível para jogar por toque.';
      render(); return;
    }
    // Invoke BOTH before any await: iOS requires the original Start gesture.
    const requests = [win.DeviceMotionEvent, win.DeviceOrientationEvent].map(api => {
      try { return typeof api.requestPermission === 'function' ? api.requestPermission() : Promise.resolve('granted'); }
      catch (error) { return Promise.reject(error); }
    });
    const results = await Promise.allSettled(requests);
    if (version !== startVersion) return;
    if (results.some(result => result.status !== 'fulfilled' || result.value !== 'granted')) {
      mode = 'idle';
      sensorError = 'Permissão de movimento ou orientação negada. Libere os sensores nos ajustes do navegador e tente novamente, ou use o modo acessível.';
      render(); return;
    }
    permissionGranted = true; mode = 'motion'; orientation = null; orientationAt = -Infinity;
    beginCalibration(); requestWake();
  }
  function flash(text, power = 0.5, point = false) {
    $('feedback').textContent = text;
    $('feedback').dataset.active = 'true';
    win.clearTimeout(feedbackTimer);
    feedbackTimer = win.setTimeout(() => { $('feedback').dataset.active = 'false'; }, 900);
    if (visible() && typeof win.navigator.vibrate === 'function') {
      try { win.navigator.vibrate(point ? [45, 50, 80] : Math.round(18 + Math.max(0, Math.min(1, power)) * 35)); } catch { /* Optional haptics. */ }
    }
  }
  function swing(shot) {
    if (!ready() || !host || socket.bufferedAmount > 16384) return;
    if (send({ ...shot, type: 'swing', id: win.crypto.randomUUID() })) {
      const effect = Math.abs(shot.spin) > 0.35 ? ' · corte lateral' : shot.topspin > 0.35 ? ' · topspin' : shot.topspin < -0.35 ? ' · backspin' : '';
      flash(`Gesto enviado${effect}`, shot.power);
    }
  }
  function scheduleReconnect() {
    if (retryTimer !== null || !visible() || !validInvite || transportError) return;
    retryTimer = win.setTimeout(() => { retryTimer = null; connect(); }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 10000);
  }
  function stopHeartbeat() { win.clearInterval(heartbeat); heartbeat = null; }
  function connect() {
    if (!validInvite || !visible() || transportError || socket?.readyState === 0 || connected) return;
    const wsUrl = new URL(`/arena/api/rooms/${encodeURIComponent(room)}/ws`, url.origin);
    wsUrl.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl.searchParams.set('role', `p${player}`); wsUrl.searchParams.set('token', token);
    let next;
    try { next = new win.WebSocket(wsUrl.href); }
    catch { scheduleReconnect(); render(); return; }
    socket = next; sentReady = null; lastPose = null; poseAt = -Infinity;
    next.addEventListener('open', () => {
      if (socket !== next || !visible()) { next.close(); return; }
      connected = true; retryDelay = 500; heartbeatAt = clock();
      heartbeat = win.setInterval(() => {
        if (clock() - heartbeatAt > 45000) next.close();
        else send({ type: 'ping' });
      }, 15000);
      // Readiness belongs to sensors/mode, not to a particular WebSocket.
      render();
    });
    next.addEventListener('message', event => {
      if (socket !== next) return;
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (!data || typeof data !== 'object') return;
      heartbeatAt = clock();
      if (data.type === 'presence') {
        if (!host && data.host === true) lastPose = null;
        host = data.host === true; render(); syncPose();
      }
      else if (data.type === 'ping') send({ type: 'pong' });
      else if (data.type === 'calibrate') beginCalibration();
      else if (data.type === 'feedback' && ['hit', 'point'].includes(data.event) && Number.isFinite(data.power)) {
        flash(data.event === 'point' ? 'Ponto!' : 'Boa rebatida! Acertou.', data.power, data.event === 'point');
      } else if (data.type === 'error') {
        transportError = 'A sala recusou a conexão. Leia um novo QR code na tela da Arena.';
        render(); next.close();
      }
    });
    next.addEventListener('error', () => next.close());
    next.addEventListener('close', event => {
      if (socket !== next) return;
      connected = false; host = false; sentReady = null; stopHeartbeat(); motion.resetGesture();
      if ([1008, 4001, 4003, 4401, 4403].includes(event.code)) transportError = 'Convite inválido ou expirado. Leia um novo QR code na tela da Arena.';
      render(); scheduleReconnect();
    });
  }

  $('start').addEventListener('click', start);
  $('sensitivity').addEventListener('input', event => {
    const value = normalizeSensitivity(event.target.value);
    motion.setSensitivity(value);
    $('sensitivity-value').textContent = `${value.toFixed(1).replace('.', ',')}×`;
  });
  $('manual-mode').addEventListener('click', () => {
    if (!validInvite || !visible()) return;
    ++startVersion; mode = 'manual'; sensorFresh = false; motion.resetGesture();
    $('feedback').textContent = 'Modo acessível: rebatidas por toque';
    render(); requestWake();
  });
  $('manual-shot').addEventListener('click', () => {
    if (mode !== 'manual' || clock() - lastManualShot < 350 || !ready() || !host) return;
    lastManualShot = clock();
    const aim = Number($('manual-aim').value);
    swing({ power: 0.65, aim: Number.isFinite(aim) ? Math.max(-1, Math.min(1, aim)) : 0,
      lob: $('manual-lob').checked ? 0.8 : 0, spin: 0, topspin: 0 });
  });
  function cancelHold() {
    win.clearTimeout(heldTimer); heldTimer = null;
    $('calibrate').classList.remove('holding');
  }
  function hold() {
    if (heldTimer !== null || mode !== 'motion' || !permissionGranted || !visible()) return;
    $('calibrate').classList.add('holding');
    heldTimer = win.setTimeout(() => {
      heldTimer = null; $('calibrate').classList.remove('holding'); beginCalibration();
    }, 700);
  }
  $('calibrate').addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault(); $('calibrate').setPointerCapture?.(event.pointerId); hold();
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) $('calibrate').addEventListener(event, cancelHold);
  $('calibrate').addEventListener('keydown', event => {
    if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); if (!event.repeat) hold(); }
  });
  $('calibrate').addEventListener('keyup', cancelHold);
  $('calibrate').addEventListener('contextmenu', event => event.preventDefault());

  win.addEventListener('deviceorientation', event => {
    if (mode !== 'motion' || !permissionGranted || !visible()) return;
    if (['alpha', 'beta', 'gamma'].every(axis => typeof event[axis] === 'number' && Number.isFinite(event[axis]))) {
      orientation = { alpha: event.alpha, beta: event.beta, gamma: event.gamma }; orientationAt = clock();
    }
  });
  win.addEventListener('devicemotion', event => {
    if (mode !== 'motion' || !permissionGranted || !visible()) return;
    const now = clock(), rate = event.rotationRate;
    const freshOrientation = now - orientationAt <= 400 ? orientation : null;
    const wasCalibrated = motion.calibrated;
    const shot = motion.sample({ rotationRate: rate, orientation: freshOrientation, acceleration: event.acceleration }, now);
    if (motion.lastValidAt === now && freshOrientation) {
      lastReading = now; sensorFresh = true; sensorError = '';
    }
    if (!wasCalibrated && motion.calibrated) flash('Calibrado. Vamos jogar!');
    render();
    syncPose();
    if (shot) swing(shot);
  });
  win.setInterval(() => {
    if (mode !== 'motion' || !permissionGranted || !visible()) return;
    const now = clock();
    if ((lastReading === -Infinity && now - sensingSince > 5000) || (lastReading !== -Infinity && now - lastReading > 1800)) {
      sensorFresh = false; motion.resetGesture();
      sensorError = 'Nenhuma leitura real recente dos sensores. Verifique as permissões, mantenha esta página aberta ou escolha o modo acessível.';
      render();
    } else if (!motion.calibrated && now - sensingSince > 10000) {
      sensorError = 'Não foi possível calibrar. Segure o celular parado e tente os sensores novamente, ou escolha o modo acessível.';
      render();
    }
  }, 500);
  function pause() {
    cancelHold(); sensorFresh = false; orientation = null; orientationAt = -Infinity;
    motion.resetGesture(); syncReady();
    win.clearTimeout(retryTimer); retryTimer = null;
    stopHeartbeat(); releaseWake();
    if (socket && socket.readyState < 2) socket.close();
    render();
  }
  function resume() {
    if (!visible()) return;
    if (mode === 'motion' && permissionGranted) {
      sensingSince = clock(); lastReading = -Infinity; sensorFresh = false; sensorError = '';
    }
    connect(); requestWake(); render();
  }
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) pause(); else resume(); });
  win.addEventListener('online', () => { connect(); });
  win.addEventListener('pagehide', () => { leaving = true; pause(); });
  win.addEventListener('pageshow', () => { leaving = false; if (!connected) resume(); });
  win.addEventListener('orientationchange', () => { if (mode === 'motion') beginCalibration(); });
  render(); connect();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') createPad();
