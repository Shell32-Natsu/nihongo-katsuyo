// 后端测试：用 Node 自带的 SQLite 模拟 Cloudflare D1，用自己生成的密钥模拟 Google 登录凭证
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createApp, parseAllowList, isAllowed } from '../worker/index.js';

// ---- 模拟 D1 ----
class Stmt {
  constructor(db, sql, params = []) { this.db = db; this.sql = sql; this.params = params; }
  bind(...p) { return new Stmt(this.db, this.sql, p); }
  async first() { return this.db.prepare(this.sql).get(...this.params) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.params) }; }
  async run() { this.db.prepare(this.sql).run(...this.params); return { success: true }; }
  exec() {
    const st = this.db.prepare(this.sql);
    return /^\s*(select|with)\b/i.test(this.sql) ? { results: st.all(...this.params) } : (st.run(...this.params), { success: true });
  }
}
class FakeD1 {
  constructor() { this.db = new DatabaseSync(':memory:'); }
  prepare(sql) { return new Stmt(this.db, sql); }
  async batch(list) {
    this.db.exec('BEGIN');
    try { const out = list.map(s => s.exec()); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
}

// ---- 模拟 Google 登录凭证 ----
const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const alg = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
const goodPair = await crypto.subtle.generateKey(alg, true, ['sign', 'verify']);
const evilPair = await crypto.subtle.generateKey(alg, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', goodPair.publicKey)), kid: 'k1', use: 'sig', alg: 'RS256' };
const b64u = (bytes) => Buffer.from(bytes).toString('base64url');
async function idToken(claims = {}, { key = goodPair.privateKey, kid = 'k1' } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(Buffer.from(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })));
  const body = b64u(Buffer.from(JSON.stringify({
    iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: '1001', email: 'xia@example.com', email_verified: true,
    name: '夏冬', picture: 'https://example.com/a.png', iat: now, exp: now + 3600, ...claims,
  })));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head + '.' + body));
  return `${head}.${body}.${b64u(new Uint8Array(sig))}`;
}

// ---- 测试环境 ----
const ORIGIN = 'https://katsuyo.test';
function setup(extraEnv = {}) {
  const app = createApp({ getGoogleKeys: async () => [jwk] });
  const assetsHits = [];
  const env = {
    DB: new FakeD1(), GOOGLE_CLIENT_ID: CLIENT_ID, ALLOWED_EMAILS: 'Xia@Example.com,\n bob@example.com; @team.example', ...extraEnv,
    ASSETS: { fetch: async (req) => { assetsHits.push(new URL(req.url).pathname); return new Response('asset'); } },
  };
  // cookie 传 Cookie 头；body 默认按 JSON 发，带本站的 Origin
  const call = async (method, path, { body, cookie, headers = {}, accept } = {}) => {
    const h = { ...headers };
    if (body !== undefined) { h['content-type'] ??= 'application/json'; h.origin ??= ORIGIN; }
    if (cookie) h.cookie = cookie;
    if (accept) h.accept = accept;
    const res = await app.fetch(new Request(ORIGIN + path, { method, headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }), env, { waitUntil() {} });
    const text = await res.text();
    let data = null; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  };
  const login = async (claims) => {
    const r = await call('POST', '/api/auth/google', { body: { credential: await idToken(claims) } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const sc = r.headers.get('set-cookie');
    return { ...r.data, cookie: sc.split(';')[0], setCookie: sc };
  };
  const page = (path = '/', cookie) => call('GET', path, { cookie, accept: 'text/html,application/xhtml+xml' });
  return { call, login, page, env, assetsHits };
}

const T = Date.now() - 3600e3;
const ev = (n, k = '帰る|かえる', extra = {}) => ({ i: 'ev' + n, t: T + n, k, f: 'nai', o: n % 2, ...(n % 2 ? {} : { a: '帰ない' }), ...extra });

test('名单解析：分隔符、大小写、整个域名', () => {
  const list = parseAllowList(' A@x.com,b@x.com;\n@Team.org  c@y.com ');
  assert.deepEqual(list, ['a@x.com', 'b@x.com', '@team.org', 'c@y.com']);
  assert.equal(isAllowed('A@X.COM', list), true);
  assert.equal(isAllowed('anyone@team.org', list), true);
  assert.equal(isAllowed('d@x.com', list), false);
  assert.equal(isAllowed('a@x.com.evil.com', list), false);
  assert.equal(isAllowed('someone@sub.team.org', list), false);
  assert.equal(isAllowed('', list), false);
  assert.equal(isAllowed('a@x.com', []), false);
});

test('网页对所有人开放；没登录时同步接口都拿不到', async () => {
  const { page, call, assetsHits } = setup();
  assert.equal((await page('/')).data, 'asset');
  assert.equal((await call('GET', '/js/app.js')).data, 'asset');
  assert.deepEqual(assetsHits, ['/', '/js/app.js']);
  assert.equal((await call('GET', '/api/me')).status, 401);
  assert.equal((await call('POST', '/api/sync', { body: {} })).status, 401);
  assert.equal((await call('POST', '/api/sync', { body: {}, cookie: 'katsuyo_session=forged-token-forged-token-forged' })).status, 401);
});

test('config 告诉页面是否开放同步，不需要数据库', async () => {
  const on = setup({ DB: undefined });
  assert.deepEqual((await on.call('GET', '/api/config')).data, { googleClientId: CLIENT_ID, syncEnabled: true });
  const noList = setup({ DB: undefined, ALLOWED_EMAILS: ' ' });
  assert.deepEqual((await noList.call('GET', '/api/config')).data, { googleClientId: CLIENT_ID, syncEnabled: false });
  const noClient = setup({ DB: undefined, GOOGLE_CLIENT_ID: '' });
  assert.deepEqual((await noClient.call('GET', '/api/config')).data, { googleClientId: null, syncEnabled: false });
});

test('名单里的账号登录后拿到 Cookie，能用同步接口', async () => {
  const { login, call } = setup();
  const r = await login();
  assert.deepEqual(r.user, { id: 'g:1001', name: '夏冬', email: 'xia@example.com', picture: 'https://example.com/a.png' });
  assert.match(r.setCookie, /^katsuyo_session=[A-Za-z0-9_-]{40,}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=\d+; Secure$/);
  const me = await call('GET', '/api/me', { cookie: r.cookie });
  assert.equal(me.data.user.email, 'xia@example.com');
  assert.equal((await call('POST', '/api/sync', { cookie: r.cookie, body: { since: 0 } })).status, 200);
});

test('名单里的域名下所有账号都能登录', async () => {
  const { login } = setup();
  const r = await login({ sub: 't1', email: 'anyone@team.example' });
  assert.equal(r.user.email, 'anyone@team.example');
});

test('不在名单里的账号：不发 Cookie，告诉他是哪个邮箱', async () => {
  const { call } = setup();
  const r = await call('POST', '/api/auth/google', { body: { credential: await idToken({ sub: '9', email: 'stranger@gmail.com' }) } });
  assert.equal(r.status, 403);
  assert.equal(r.data.email, 'stranger@gmail.com');
  assert.equal(r.headers.get('set-cookie'), null);
});

test('邮箱没验证过的 Google 账号不能登录', async () => {
  const { call } = setup();
  for (const email_verified of [false, undefined, 'true']) {
    const r = await call('POST', '/api/auth/google', { body: { credential: await idToken({ email_verified }) } });
    assert.equal(r.status, 403, `email_verified=${email_verified}`);
    assert.equal(r.headers.get('set-cookie'), null);
  }
});

test('从名单里删掉后，同步马上失效，网页照常能用', async () => {
  const { login, page, call, env } = setup();
  const { cookie } = await login();
  env.ALLOWED_EMAILS = 'bob@example.com';
  const me = await call('GET', '/api/me', { cookie });
  assert.equal(me.status, 403);
  assert.equal(me.data.email, 'xia@example.com');
  const sync = await call('POST', '/api/sync', { cookie, body: { since: 0, events: [ev(1)] } });
  assert.equal(sync.status, 403);
  assert.equal(sync.data.email, 'xia@example.com');
  assert.equal((await page('/', cookie)).data, 'asset');
});

test('没设置名单时谁都登录不了', async () => {
  const { call } = setup({ ALLOWED_EMAILS: '' });
  const r = await call('POST', '/api/auth/google', { body: { credential: await idToken() } });
  assert.equal(r.status, 403);
  assert.equal(r.headers.get('set-cookie'), null);
});

test('无效的 Google 凭证被拒绝', async () => {
  const { call } = setup();
  const now = Math.floor(Date.now() / 1000);
  const bad = [
    await idToken({ aud: 'someone-else' }),
    await idToken({ iss: 'https://evil.example.com' }),
    await idToken({ exp: now - 3600, iat: now - 7200 }),
    await idToken({}, { key: evilPair.privateKey }),
    await idToken({}, { kid: 'unknown' }),
    'not-a-token', '',
  ];
  for (const credential of bad) {
    const r = await call('POST', '/api/auth/google', { body: { credential } });
    assert.equal(r.status, 401, `应拒绝：${credential.slice(0, 30)} → ${JSON.stringify(r.data)}`);
    assert.equal(r.headers.get('set-cookie'), null);
  }
});

test('拒绝其他网站发来的写请求和非 JSON 请求', async () => {
  const { call, login } = setup();
  const { cookie } = await login();
  const cross = await call('POST', '/api/sync', { cookie, body: { since: 0 }, headers: { origin: 'https://evil.example.com' } });
  assert.equal(cross.status, 403);
  const form = await call('POST', '/api/sync', { cookie, body: 'since=0', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(form.status, 415);
  const loginCsrf = await call('POST', '/api/auth/google', { body: { credential: await idToken() }, headers: { origin: 'https://evil.example.com' } });
  assert.equal(loginCsrf.status, 403);
});

test('两台设备同步记录和设置', async () => {
  const { call, login } = setup();
  const A = (await login()).cookie, B = (await login()).cookie;

  const settingsA = { data: { levels: [5], mode: 'choice' }, t: T + 100 };
  const pushA = await call('POST', '/api/sync', { cookie: A, body: { since: 0, events: [ev(1), ev(2), ev(3)], settings: settingsA } });
  assert.equal(pushA.status, 200, JSON.stringify(pushA.data));
  assert.deepEqual(pushA.data.accepted, ['ev1', 'ev2', 'ev3']);
  assert.deepEqual(pushA.data.events, [], '自己刚上传的记录不应再发回来');
  assert.ok(pushA.data.cursor > 0);

  const pullB = await call('POST', '/api/sync', { cookie: B, body: { since: 0 } });
  assert.deepEqual(pullB.data.events.map(e => e.i), ['ev1', 'ev2', 'ev3']);
  assert.deepEqual(pullB.data.events[1], { i: 'ev2', t: T + 2, k: '帰る|かえる', f: 'nai', o: 0, a: '帰ない' });
  assert.deepEqual(pullB.data.settings, settingsA);

  // 重复上传不会产生重复记录
  await call('POST', '/api/sync', { cookie: A, body: { since: pushA.data.cursor, events: [ev(1), ev(2)] } });
  const again = await call('POST', '/api/sync', { cookie: B, body: { since: pullB.data.cursor } });
  assert.deepEqual(again.data.events, []);

  // 设置按时间先后取较新的
  await call('POST', '/api/sync', { cookie: B, body: { since: 0, settings: { data: { levels: [1] }, t: T + 50 } } });
  const s1 = await call('POST', '/api/sync', { cookie: A, body: { since: 0 } });
  assert.deepEqual(s1.data.settings, settingsA, '较旧的设置不应覆盖较新的');
  await call('POST', '/api/sync', { cookie: B, body: { since: 0, settings: { data: { levels: [3] }, t: T + 200 } } });
  const s2 = await call('POST', '/api/sync', { cookie: A, body: { since: 0 } });
  assert.deepEqual(s2.data.settings.data, { levels: [3] });
});

test('不合格的记录单独退回，不影响其他记录', async () => {
  const { call, login } = setup();
  const { cookie } = await login();
  const r = await call('POST', '/api/sync', { cookie, body: { since: 0, events: [
    ev(1), { i: 'bad1', t: 'yesterday', k: 'x', f: 'nai', o: 1 }, { i: 'bad2', t: T, k: 'x', f: 'nai', o: 5 },
    { i: 'bad3', t: T, k: 'x', y: 'hack' }, { i: 'bad4', t: Date.now() + 10 * 86400e3, k: 'x', f: 'nai', o: 1 },
    { i: 'add1', t: T + 9, k: '静か|しずか', y: 'add', extra: 'dropped' },
  ] } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.accepted, ['ev1', 'add1']);
  assert.deepEqual(r.data.rejected, ['bad1', 'bad2', 'bad3', 'bad4']);
  const all = await call('POST', '/api/sync', { cookie, body: { since: 0 } });
  const add = all.data.events.find(e => e.i === 'add1');
  assert.deepEqual(add, { i: 'add1', t: T + 9, k: '静か|しずか', y: 'add' });
  assert.equal((await call('POST', '/api/sync', { cookie, body: { events: new Array(501).fill(ev(1)) } })).status, 400);
});

test('清空记录会删掉云端更早的记录', async () => {
  const { call, login } = setup();
  const { cookie } = await login();
  await call('POST', '/api/sync', { cookie, body: { since: 0, events: [ev(1), ev(2), ev(3)] } });
  await call('POST', '/api/sync', { cookie, body: { since: 0, events: [{ i: 'r1', t: T + 10, y: 'reset' }, ev(20)] } });
  const all = await call('POST', '/api/sync', { cookie, body: { since: 0 } });
  assert.deepEqual(all.data.events.map(e => e.i), ['r1', 'ev20']);
});

test('不同用户的数据互相隔离', async () => {
  const { call, login } = setup();
  const a = await login({ sub: 'alice' }), b = await login({ sub: 'bob', email: 'bob@example.com' });
  await call('POST', '/api/sync', { cookie: a.cookie, body: { since: 0, events: [ev(1)], settings: { data: { x: 1 }, t: T } } });
  const r = await call('POST', '/api/sync', { cookie: b.cookie, body: { since: 0 } });
  assert.deepEqual(r.data.events, []);
  assert.equal(r.data.settings, null);
});

test('记录很多时分页下发', async () => {
  const { call, login } = setup();
  const A = (await login()).cookie, B = (await login()).cookie;
  for (let p = 0; p < 3; p++) {
    const batch = Array.from({ length: p < 2 ? 500 : 100 }, (_, j) => ev(p * 1000 + j));
    const r = await call('POST', '/api/sync', { cookie: A, body: { since: 0, events: batch } });
    assert.equal(r.data.accepted.length, batch.length);
  }
  const p1 = await call('POST', '/api/sync', { cookie: B, body: { since: 0 } });
  assert.equal(p1.data.events.length, 1000);
  assert.equal(p1.data.more, true);
  const p2 = await call('POST', '/api/sync', { cookie: B, body: { since: p1.data.cursor } });
  assert.equal(p2.data.events.length, 100);
  assert.equal(p2.data.more, false);
});

test('退出登录：清掉 Cookie，令牌失效', async () => {
  const { call, login } = setup();
  const { cookie } = await login();
  const r = await call('POST', '/api/logout', { cookie, body: {} });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('set-cookie'), /^katsuyo_session=; .*Max-Age=0/);
  assert.equal((await call('GET', '/api/me', { cookie })).status, 401);
});

test('本地 http 开发时 Cookie 不带 Secure', async () => {
  const app = createApp({ getGoogleKeys: async () => [jwk] });
  const env = { DB: new FakeD1(), GOOGLE_CLIENT_ID: CLIENT_ID, ALLOWED_EMAILS: 'xia@example.com' };
  const res = await app.fetch(new Request('http://localhost:8787/api/auth/google', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:8787' },
    body: JSON.stringify({ credential: await idToken() }),
  }), env, {});
  assert.equal(res.status, 200);
  assert.doesNotMatch(res.headers.get('set-cookie'), /Secure/);
});

test('未知接口、错误方法和找不到的网页', async () => {
  const { call, login, assetsHits } = setup();
  const { cookie } = await login();
  assert.equal((await call('GET', '/api/nope', { cookie })).status, 404);
  assert.equal((await call('GET', '/api/sync', { cookie })).status, 405);
  assert.equal((await call('GET', '/no-such-page')).data, 'asset');
  assert.deepEqual(assetsHits, ['/no-such-page']);
});
