// ===== 云同步 =====
// 网站部署在 Cloudflare 上时，只有登录过、并且在名单里的账号才能打开这个页面（登录页由 Worker 提供），
// 登录信息保存在 Cookie 里。这里负责显示账号、和服务器交换记录、退出登录。
// 直接打开 index.html 或用普通静态服务器预览时没有后端，自动只用本机记录。

const Cloud = (function () {
  let store = null;      // 由 app.js 提供：读写本机记录
  let user = null;       // { id, name, email, picture }
  let state = 'local';   // local 还没连上 · unavailable 没有后端 · idle · syncing · offline · error · expired 登录失效
  let lastSync = 0;
  let timer = null, running = null, again = false, retryDelay = 15e3;
  let view = '', confirmOut = false, confirmTimer = null;

  try { localStorage.removeItem('katsuyo.auth'); } catch { } // 旧版本存的登录令牌，已不再使用

  async function api(path, { method = 'GET', body } = {}) {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(path, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) });
    let data = null;
    try { data = await res.json(); } catch { }
    if (!res.ok) { const e = new Error((data && data.error) || `HTTP ${res.status}`); e.status = res.status; throw e; }
    return data;
  }

  async function init(s) {
    store = s;
    render();
    await connect();
    addEventListener('online', () => { if (state === 'offline') connect(); else schedule(0); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && user && Date.now() - lastSync > 20e3) schedule(0);
    });
    setInterval(() => { if (user && state === 'idle') renderStatus(); }, 30e3);
  }

  async function connect() {
    try {
      const r = await api('/api/me');
      // 这台设备上如果是另一个账号的记录，先清掉，避免混在一起
      if (store.owner && store.owner !== r.user.id) store.wipe();
      store.setOwner(r.user.id);
      user = r.user;
      state = 'idle';
      render(true);
      syncNow();
    } catch (e) {
      if (e.status === 401 || e.status === 403) state = 'expired';
      else if (e.status) state = 'unavailable';                 // 没有后端（比如本地静态预览）
      else if (store.owner) { state = 'offline'; setTimeout(connect, retryDelay); }
      else state = 'unavailable';
      render(true);
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
    try { await api('/api/logout', { method: 'POST', body: {} }); } catch { }
    store.wipe();
    store.setOwner(null);
    location.reload();
  }

  // ---- 同步 ----
  function schedule(delay = 1500) {
    if (!user) return;
    clearTimeout(timer);
    timer = setTimeout(syncNow, delay);
  }

  function syncNow() {
    if (!user || state === 'expired') return Promise.resolve();
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
        if (e.status === 401 || e.status === 403) {
          state = 'expired';
          render(true);
        } else {
          state = navigator.onLine === false ? 'offline' : 'error';
          schedule(retryDelay);
          retryDelay = Math.min(retryDelay * 2, 5 * 60e3);
        }
      } finally {
        running = null;
        renderStatus();
        if (again && user && state !== 'expired') { again = false; schedule(300); }
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
      case 'unavailable': return ['', '记录只保存在这台设备上'];
      case 'syncing': return ['busy', '正在同步…'];
      case 'offline': return ['warn', `离线中${n ? `，${n} 条记录联网后自动同步` : ''}`];
      case 'error': return ['warn', `同步没成功${n ? `，${n} 条记录等待上传` : ''}，稍后自动重试`];
      case 'expired': return ['warn', `登录已失效${n ? `，${n} 条记录还没同步，重新登录后会自动上传` : ''}`];
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
    const v = state === 'expired' ? 'expired' : user ? 'in' : 'local';
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
    } else if (v === 'expired') {
      box.innerHTML = `<div class="acct-main"><div class="acct-text">${status}</div></div>
        <div class="acct-actions"><button type="button" class="btn small" id="reloginBtn">重新登录</button></div>`;
      document.getElementById('reloginBtn').onclick = () => location.reload();
    } else {
      box.innerHTML = `<div class="acct-main"><div class="acct-text">${status}</div></div>`;
    }
  }

  return { init, schedule, syncNow, get signedIn() { return !!user; } };
})();
