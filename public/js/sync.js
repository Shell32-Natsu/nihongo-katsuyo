// ===== 云同步：Google 登录 + 和 Cloudflare Worker 交换记录 =====
// 没有部署后端（比如直接打开 index.html）时，这部分自动隐藏，网页照常只用本机记录。

const Cloud = (function () {
  const AUTH_KEY = 'katsuyo.auth';
  const meta = document.querySelector('meta[name="katsuyo-api"]');
  const API = ((meta && meta.content) || '').replace(/\/+$/, '');

  let store = null;      // 由 app.js 提供：读写本机记录
  let cfg = null;
  let auth = loadAuth(); // { token, user: { id, name, email, picture } }
  let state = 'local';   // local 还没连上 · unavailable 没有后端 · signedout · signing · idle · syncing · offline · error
  let message = '';
  let lastSync = 0;
  let timer = null, running = null, again = false, retryDelay = 15e3;
  let gisReady = false, view = '', confirmOut = false, confirmTimer = null;

  function loadAuth() { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; } }
  function saveAuth() { try { auth ? localStorage.setItem(AUTH_KEY, JSON.stringify(auth)) : localStorage.removeItem(AUTH_KEY); } catch { } }

  async function api(path, { method = 'GET', body, token } = {}) {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = 'Bearer ' + token;
    const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    let data = null;
    try { data = await res.json(); } catch { }
    if (!res.ok) { const e = new Error((data && data.error) || `HTTP ${res.status}`); e.status = res.status; throw e; }
    return data;
  }

  async function init(s) {
    store = s;
    render();
    try { cfg = await api('/api/config'); } catch { cfg = null; }
    if (!cfg || !cfg.googleClientId) { state = 'unavailable'; render(); return; }
    if (auth) { state = 'idle'; render(); syncNow(); }
    else { state = 'signedout'; render(); loadGis(); }
    addEventListener('online', () => schedule(0));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && auth && Date.now() - lastSync > 20e3) schedule(0);
    });
    setInterval(() => { if (auth && state === 'idle') renderStatus(); }, 30e3);
  }

  // ---- Google 登录 ----
  function loadGis() {
    if (window.google && google.accounts && google.accounts.id) { setupGis(); return; }
    if (document.getElementById('gis-script')) return;
    const sc = document.createElement('script');
    sc.id = 'gis-script';
    sc.src = 'https://accounts.google.com/gsi/client';
    sc.async = true;
    sc.onload = setupGis;
    sc.onerror = () => { message = '连不上 Google 登录服务，现在只能使用本机记录'; render(); };
    document.head.appendChild(sc);
  }
  function setupGis() {
    if (gisReady) { render(true); return; }
    google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: onCredential, ux_mode: 'popup', itp_support: true });
    gisReady = true;
    render(true);
  }
  async function onCredential(resp) {
    state = 'signing'; message = ''; render();
    try {
      const r = await api('/api/auth/google', { method: 'POST', body: { credential: resp.credential } });
      // 这台设备上如果是另一个账号的记录，先清掉，避免混在一起；没登录时练的记录会并入这个账号
      if (store.owner && store.owner !== r.user.id) store.wipe();
      store.setOwner(r.user.id);
      auth = { token: r.token, user: r.user };
      saveAuth();
      state = 'idle';
      render();
      await syncNow();
    } catch (e) {
      state = 'signedout';
      message = '登录没有成功：' + e.message;
      render(true);
    }
  }

  async function signOut() {
    if (!auth) return;
    if (!confirmOut) {
      await syncNow();
      confirmOut = true;
      render(true);
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => { confirmOut = false; render(true); }, 6000);
      return;
    }
    clearTimeout(confirmTimer);
    confirmOut = false;
    const token = auth.token;
    auth = null;
    saveAuth();
    api('/api/logout', { method: 'POST', token }).catch(() => { });
    store.wipe();
    store.setOwner(null);
    state = 'signedout';
    message = '已退出。这台设备上的记录已清除，重新登录就会恢复。';
    render(true);
    loadGis();
  }

  // ---- 同步 ----
  function schedule(delay = 1500) {
    if (!auth || state === 'unavailable') return;
    clearTimeout(timer);
    timer = setTimeout(syncNow, delay);
  }

  function syncNow() {
    if (!auth) return Promise.resolve();
    if (running) { again = true; return running; }
    clearTimeout(timer);
    running = (async () => {
      state = 'syncing'; renderStatus();
      try {
        for (let round = 0; round < 100; round++) {
          const batch = store.pendingEvents().slice(0, 500);
          const r = await api('/api/sync', { method: 'POST', token: auth.token, body: { since: store.cursor, events: batch, settings: store.settings() } });
          store.markSent([...(r.accepted || []), ...(r.rejected || [])]);
          if (r.events && r.events.length) store.receive(r.events);
          store.cursor = r.cursor;
          if (r.settings) store.applySettings(r.settings);
          if (!r.more && !store.pendingEvents().length) break;
        }
        lastSync = Date.now();
        state = 'idle';
        message = '';
        retryDelay = 15e3;
      } catch (e) {
        if (e.status === 401) {
          auth = null; saveAuth();
          state = 'signedout';
          message = '登录已过期，请重新登录。没同步的记录还在这台设备上，登录后会自动上传。';
          render(true);
          loadGis();
        } else {
          state = navigator.onLine === false ? 'offline' : 'error';
          schedule(retryDelay);
          retryDelay = Math.min(retryDelay * 2, 5 * 60e3);
        }
      } finally {
        running = null;
        renderStatus();
        if (again && auth) { again = false; schedule(300); }
      }
    })();
    return running;
  }

  // ---- 显示 ----
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function ago(t) {
    const d = Date.now() - t;
    if (d < 60e3) return '刚刚';
    if (d < 3600e3) return `${Math.floor(d / 60e3)} 分钟前`;
    return `${Math.floor(d / 3600e3)} 小时前`;
  }

  function statusInfo() {
    const n = store ? store.pendingEvents().length : 0;
    switch (state) {
      case 'local': return ['', '记录保存在这台设备上'];
      case 'unavailable': return ['', '记录只保存在这台设备上'];
      case 'signedout': return ['', message || '登录后，练习记录会在你的手机、电脑之间同步'];
      case 'signing': return ['busy', '正在登录…'];
      case 'syncing': return ['busy', '正在同步…'];
      case 'offline': return ['warn', `离线中，${n} 条记录联网后自动同步`];
      case 'error': return ['warn', `同步没成功${n ? `，${n} 条记录等待上传` : ''}，稍后自动重试`];
      default: return n ? ['busy', `${n} 条记录等待同步`] : ['ok', `已同步 · ${ago(lastSync)}`];
    }
  }

  function renderStatus() {
    const el = document.getElementById('acctStatus');
    if (!el) { render(true); return; }
    const [cls, text] = statusInfo();
    el.className = 'acct-status ' + cls;
    el.lastElementChild.textContent = text;
  }

  // full=true 时重建整个账号栏（登录状态变化时）；否则只更新状态文字
  function render(full) {
    const box = document.getElementById('account');
    if (!box) return;
    const v = auth ? 'in' : state === 'signedout' || state === 'signing' ? 'out' : 'local';
    if (!full && v === view) { renderStatus(); return; }
    view = v;
    const [cls, text] = statusInfo();
    const status = `<span class="acct-status ${cls}" id="acctStatus"><span class="dot"></span><span>${esc(text)}</span></span>`;
    if (v === 'in') {
      const u = auth.user || {};
      const name = u.name || u.email || '已登录';
      const pic = u.picture ? `<img src="${esc(u.picture)}" alt="" referrerpolicy="no-referrer">` : esc(name.slice(0, 1));
      const n = store ? store.pendingEvents().length : 0;
      box.innerHTML = `
        <div class="acct-main"><div class="avatar">${pic}</div><div class="acct-text"><b>${esc(name)}</b>${status}</div></div>
        <div class="acct-actions">
          ${confirmOut ? `<span class="hint">${n ? `还有 ${n} 条记录没同步上去，退出会丢掉它们。` : '退出后这台设备上的记录会清除，云端的保留。'}</span>` : ''}
          <button type="button" class="btn small ${confirmOut ? 'warn armed' : 'ghost'}" id="signOutBtn">${confirmOut ? '确认退出' : '退出登录'}</button>
        </div>`;
      const img = box.querySelector('.avatar img');
      if (img) img.onerror = () => { img.replaceWith(document.createTextNode(name.slice(0, 1))); };
      document.getElementById('signOutBtn').onclick = signOut;
    } else if (v === 'out') {
      box.innerHTML = `<div class="acct-main"><div class="acct-text"><b>同步</b>${status}</div></div><div class="acct-actions"><div id="gbtn"></div></div>`;
      if (gisReady) {
        const dark = matchMedia('(prefers-color-scheme: dark)').matches;
        google.accounts.id.renderButton(document.getElementById('gbtn'), {
          type: 'standard', theme: dark ? 'filled_black' : 'outline', size: 'medium', shape: 'pill', text: 'signin_with', locale: 'zh_CN',
        });
      }
    } else {
      box.innerHTML = `<div class="acct-main"><div class="acct-text">${status}</div></div>`;
    }
  }

  return { init, schedule, syncNow, get signedIn() { return !!auth; } };
})();
