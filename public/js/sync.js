// ===== 云同步：Google 登录 + 和 Cloudflare Worker 交换记录 =====
// 练习对所有人开放，不登录时记录只保存在当前浏览器里。
// 只有名单里的 Google 账号能登录同步；登录信息保存在 Cookie 里（网页脚本读不到）。
// 直接打开 index.html 或用普通静态服务器预览时没有后端，自动只用本机记录。

const Cloud = (function () {
  let store = null;      // 由 app.js 提供：读写本机记录
  let cfg = null;        // { googleClientId, syncEnabled }
  let user = null;       // { id, name, email, picture }
  let state = 'local';   // local 正在连接 · unavailable 没有同步功能 · signedout · signing · idle · syncing · offline · error
  let message = '';      // 没登录时显示的说明（比如没有权限、登录已过期）
  let messageWarn = false;
  let lastSync = 0;
  let timer = null, running = null, again = false, retryDelay = 15e3;
  let gisReady = false, view = '', confirmOut = false, confirmTimer = null;

  try { localStorage.removeItem('katsuyo.auth'); } catch { } // 旧版本存的登录令牌，已不再使用

  async function api(path, { method = 'GET', body } = {}) {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(path, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) });
    let data = null;
    try { data = await res.json(); } catch { }
    if (!res.ok) { const e = new Error((data && data.error) || `HTTP ${res.status}`); e.status = res.status; e.data = data || {}; throw e; }
    return data;
  }

  async function init(s) {
    store = s;
    render();
    try { cfg = await api('/api/config'); } catch { cfg = null; }
    if (!cfg || !cfg.syncEnabled) { state = 'unavailable'; render(true); return; }
    await connect();
    addEventListener('online', () => { if (state === 'offline' && !user) connect(); else schedule(0); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && user && Date.now() - lastSync > 20e3) schedule(0);
    });
    setInterval(() => { if (user && state === 'idle') renderStatus(); }, 30e3);
  }

  // 看看浏览器里有没有有效的登录
  async function connect() {
    try {
      const r = await api('/api/me');
      signedIn(r.user);
    } catch (e) {
      if (e.status === 403) denied(e.data.email);
      else if (e.status === 401 || e.status) signedOut('');
      else { state = 'offline'; render(true); setTimeout(() => { if (!user) connect(); }, retryDelay); }
    }
  }

  function signedIn(u) {
    // 这台设备上如果是另一个账号的记录，先清掉，避免混在一起；没登录时练的记录会并入这个账号
    if (store.owner && store.owner !== u.id) store.wipe();
    store.setOwner(u.id);
    user = u;
    state = 'idle';
    message = '';
    render(true);
    syncNow();
  }

  function signedOut(msg, warn = false) {
    user = null;
    state = 'signedout';
    message = msg;
    messageWarn = warn;
    render(true);
    loadGis();
  }

  // 账号不在名单里（或被移出名单）：清掉登录，练习照常，记录留在本机
  function denied(email) {
    api('/api/logout', { method: 'POST', body: {} }).catch(() => { });
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    signedOut(`账号 ${email || ''} 没有同步权限。练习不受影响，记录只保存在这台设备上。`, true);
  }

  // ---- Google 登录 ----
  function loadGis() {
    if (gisReady) { render(true); return; }
    if (window.google && google.accounts && google.accounts.id) { setupGis(); return; }
    if (document.getElementById('gis-script')) return;
    const sc = document.createElement('script');
    sc.id = 'gis-script';
    sc.src = 'https://accounts.google.com/gsi/client';
    sc.async = true;
    sc.onload = setupGis;
    sc.onerror = () => { signedOut('连不上 Google 登录服务，现在只能使用本机记录。', true); };
    document.head.appendChild(sc);
  }
  function setupGis() {
    google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: onCredential, ux_mode: 'popup', itp_support: true });
    gisReady = true;
    render(true);
  }
  async function onCredential(resp) {
    state = 'signing'; message = ''; render(true);
    try {
      const r = await api('/api/auth/google', { method: 'POST', body: { credential: resp.credential } });
      signedIn(r.user);
    } catch (e) {
      if (e.status === 403 && e.data.email) denied(e.data.email);
      else signedOut('登录没有成功：' + e.message, true);
    }
  }

  async function signOut() {
    if (!user) return;
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
    try { await api('/api/logout', { method: 'POST', body: {} }); } catch { }
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    store.wipe();
    store.setOwner(null);
    signedOut('已退出。这台设备上的记录已清除，重新登录就会恢复。');
  }

  // ---- 同步 ----
  function schedule(delay = 1500) {
    if (!user) return;
    clearTimeout(timer);
    timer = setTimeout(syncNow, delay);
  }

  function syncNow() {
    if (!user) return Promise.resolve();
    if (running) { again = true; return running; }
    clearTimeout(timer);
    running = (async () => {
      state = 'syncing'; renderStatus();
      try {
        for (let round = 0; round < 100; round++) {
          const batch = store.pendingEvents().slice(0, 500);
          const r = await api('/api/sync', { method: 'POST', body: { since: store.cursor, events: batch, settings: store.settings() } });
          store.markSent([...(r.accepted || []), ...(r.rejected || [])]);
          if (r.events && r.events.length) store.receive(r.events);
          store.cursor = r.cursor;
          if (r.settings) store.applySettings(r.settings);
          if (!r.more && !store.pendingEvents().length) break;
        }
        lastSync = Date.now();
        state = 'idle';
        retryDelay = 15e3;
      } catch (e) {
        if (e.status === 403) denied(e.data.email || (user && user.email));
        else if (e.status === 401) signedOut('登录已过期，请重新登录。没同步的记录还在这台设备上，登录后会自动上传。', true);
        else {
          state = navigator.onLine === false ? 'offline' : 'error';
          schedule(retryDelay);
          retryDelay = Math.min(retryDelay * 2, 5 * 60e3);
        }
      } finally {
        running = null;
        renderStatus();
        if (again && user) { again = false; schedule(300); }
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
      case 'local': return ['busy', '正在连接…'];
      case 'unavailable': return ['', '记录保存在这台设备上'];
      case 'signedout': return message ? [messageWarn ? 'warn' : '', message] : ['', '记录保存在这台设备上。受邀的账号登录后可以在多台设备间同步'];
      case 'signing': return ['busy', '正在登录…'];
      case 'syncing': return ['busy', '正在同步…'];
      case 'offline': return ['warn', `离线中${n ? `，${n} 条记录联网后自动同步` : ''}`];
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
    const v = user ? 'in' : state === 'signedout' || state === 'signing' ? 'out' : 'local';
    if (!full && v === view) { renderStatus(); return; }
    view = v;
    const [cls, text] = statusInfo();
    const status = `<span class="acct-status ${cls}" id="acctStatus"><span class="dot"></span><span>${esc(text)}</span></span>`;
    if (v === 'in') {
      const name = user.name || user.email || '已登录';
      const pic = user.picture ? `<img src="${esc(user.picture)}" alt="" referrerpolicy="no-referrer">` : esc(name.slice(0, 1));
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
      if (gisReady && state === 'signedout') {
        const dark = matchMedia('(prefers-color-scheme: dark)').matches;
        google.accounts.id.renderButton(document.getElementById('gbtn'), {
          type: 'standard', theme: dark ? 'filled_black' : 'outline', size: 'medium', shape: 'pill', text: 'signin_with', locale: 'zh_CN',
        });
      }
    } else {
      box.innerHTML = `<div class="acct-main"><div class="acct-text">${status}</div></div>`;
    }
  }

  return { init, schedule, syncNow, get signedIn() { return !!user; } };
})();
