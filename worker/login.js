// 没登录或没有权限时显示的登录页。页面自带样式，不依赖 public/ 里的文件（那些文件要登录后才能访问）。

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%232b4796'/%3E%3Ctext x='32' y='45' font-size='38' text-anchor='middle' fill='white' font-family='serif'%3E%E6%B4%BB%3C/text%3E%3C/svg%3E";

/**
 * @param {object} o
 * @param {string|null} o.clientId   Google 客户端 ID；没有时显示「还没配置」
 * @param {boolean} o.listReady      是否设置了允许使用的账号
 * @param {string} [o.denied]        被拒绝的邮箱（已登录但不在名单里）
 */
export function loginPage({ clientId, listReady, denied = '' }) {
  let notice = '';
  if (!clientId) notice = '网站还没有配置 Google 登录（GOOGLE_CLIENT_ID），暂时无法登录。';
  else if (!listReady) notice = '网站还没有设置允许使用的账号（ALLOWED_EMAILS），暂时谁都无法登录。';
  const ready = !!clientId && listReady;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>活用練習帳</title>
<link rel="icon" href="${ICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Klee+One:wght@600&display=swap">
<style>
:root {
  --paper: #eef1f6; --sheet: #fbfcfe; --grid: #e4e9f2; --ink: #1a2132; --muted: #5d6779; --rule: #d3dae6;
  --ai: #2b4796; --pen: #cf3626; --pen-soft: #fbe9e6;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root { --paper: #0f141d; --sheet: #161c28; --grid: #1f2736; --ink: #e6eaf2; --muted: #9aa3b5; --rule: #2a3343;
    --ai: #93abf2; --pen: #ff7564; --pen-soft: #35201f; color-scheme: dark; }
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 15px/1.65 "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
  display: grid; place-items: center; padding: 24px 16px; }
main { width: 100%; max-width: 400px; background-color: var(--sheet);
  background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 24px 24px; background-position: -1px -1px;
  border: 1px solid var(--rule); border-radius: 8px; padding: 32px 24px 28px; display: grid; gap: 18px; justify-items: center; text-align: center; }
h1 { margin: 0; font-family: "Klee One", "Hiragino Mincho ProN", "Yu Mincho", serif; font-weight: 600; font-size: 2.2rem; letter-spacing: .06em; line-height: 1.2; background: var(--sheet); padding: 0 8px; }
p { margin: 0; background: var(--sheet); padding: 0 6px; }
.sub { color: var(--muted); font-size: .9rem; }
#gbtn { min-height: 44px; display: grid; place-items: center; }
.msg { border: 1.5px dashed var(--pen); background: var(--pen-soft); color: var(--pen); border-radius: 8px; padding: 10px 12px; font-size: .9rem; text-align: left; width: 100%; }
.msg b { font-weight: 600; overflow-wrap: anywhere; }
.busy { color: var(--muted); font-size: .9rem; }
[hidden] { display: none !important; }
</style>
</head>
<body>
<main>
  <h1 lang="ja">活用練習帳</h1>
  <p class="sub">日语动词・形容词变形练习<br>这是私人网站，只有受邀的账号可以使用</p>
  ${ready ? '<div id="gbtn" aria-label="使用 Google 账号登录"></div><p class="busy" id="busy" hidden>正在登录…</p>' : ''}
  <p class="msg" id="msg"${notice || denied ? '' : ' hidden'}>${notice ? esc(notice) : denied ? `账号 <b>${esc(denied)}</b> 没有使用权限。请换一个账号，或联系网站管理员。` : ''}</p>
</main>
${ready ? `<script src="https://accounts.google.com/gsi/client" async onload="start()"></script>
<script>
const CLIENT_ID = ${JSON.stringify(clientId)};
const msg = document.getElementById('msg'), busy = document.getElementById('busy'), box = document.getElementById('gbtn');
function show(html) { msg.innerHTML = html; msg.hidden = false; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function start() {
  google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onCredential, ux_mode: 'popup', itp_support: true });
  google.accounts.id.renderButton(box, {
    type: 'standard', size: 'large', shape: 'pill', text: 'signin_with', locale: 'zh_CN',
    theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'filled_black' : 'outline',
  });
}
async function onCredential(resp) {
  box.hidden = true; busy.hidden = false; msg.hidden = true;
  try {
    const r = await fetch('/api/auth/google', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential: resp.credential }) });
    const data = await r.json().catch(() => ({}));
    if (r.ok) { location.reload(); return; }
    google.accounts.id.disableAutoSelect();
    if (r.status === 403 && data.email) show('账号 <b>' + esc(data.email) + '</b> 没有使用权限。请换一个账号，或联系网站管理员。');
    else show(esc(data.error || '登录没有成功，请再试一次。'));
  } catch (e) {
    show('连不上服务器，请检查网络后再试。');
  }
  box.hidden = false; busy.hidden = true;
}
setTimeout(() => { if (!window.google || !google.accounts) show('Google 登录加载不出来。请检查网络，或关掉拦截广告和脚本的插件后刷新。'); }, 8000);
</script>` : ''}
</body>
</html>`;
}
