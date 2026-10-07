// 后端测试：用 Node 自带的 SQLite 模拟 Cloudflare D1，用自己生成的密钥模拟 Google 登录凭证
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../worker/index.js';

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
    iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: '1001', email: 'xia@example.com', name: '夏冬',
    picture: 'https://example.com/a.png', iat: now, exp: now + 3600, ...claims,
  })));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head + '.' + body));
  return `${head}.${body}.${b64u(new Uint8Array(sig))}`;
}

// ---- 测试环境 ----
function setup(extraEnv = {}) {
  const app = createApp({ getGoogleKeys: async () => [jwk] });
  const assetsHits = [];
  const env = {
    DB: new FakeD1(), GOOGLE_CLIENT_ID: CLIENT_ID, ...extraEnv,
    ASSETS: { fetch: async (req) => { assetsHits.push(new URL(req.url).pathname); return new Response('asset'); } },
  };
  const call = async (method, path, { body, token, headers = {} } = {}) => {
    const h = { ...headers };
    if (body !== undefined) h['content-type'] = 'application/json';
    if (token) h.authorization = 'Bearer ' + token;
    const res = await app.fetch(new Request('https://katsuyo.test' + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil() {} });
    const text = await res.text();
    let data = null; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  };
  const login = async (claims) => {
    const r = await call('POST', '/api/auth/google', { body: { credential: await idToken(claims) } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r.data;
  };
  return { call, login, env, assetsHits };
}

const T = Date.now() - 3600e3;
const ev = (n, k = '帰る|かえる', extra = {}) => ({ i: 'ev' + n, t: T + n, k, f: 'nai', o: n % 2, ...(n % 2 ? {} : { a: '帰ない' }), ...extra });

test('config 返回 Google 客户端 ID，不需要数据库', async () => {
  const { call } = setup({ DB: undefined });
  const r = await call('GET', '/api/config');
  assert.equal(r.status, 200);
  assert.equal(r.data.googleClientId, CLIENT_ID);
});

test('Google 登录成功，中文名字正确解码', async () => {
  const { login, call } = setup();
  const r = await login();
  assert.match(r.token, /^[A-Za-z0-9_-]{40,}$/);
  assert.deepEqual(r.user, { id: 'g:1001', name: '夏冬', email: 'xia@example.com', picture: 'https://example.com/a.png' });
  const me = await call('GET', '/api/me', { token: r.token });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.name, '夏冬');
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
  }
});

test('没登录或令牌无效时不能同步', async () => {
  const { call } = setup();
  assert.equal((await call('POST', '/api/sync', { body: {} })).status, 401);
  assert.equal((await call('POST', '/api/sync', { body: {}, token: 'garbage' })).status, 401);
});

test('两台设备同步记录和设置', async () => {
  const { call, login } = setup();
  const A = (await login()).token, B = (await login()).token;

  const settingsA = { data: { levels: [5], mode: 'choice' }, t: T + 100 };
  const pushA = await call('POST', '/api/sync', { token: A, body: { since: 0, events: [ev(1), ev(2), ev(3)], settings: settingsA } });
  assert.equal(pushA.status, 200, JSON.stringify(pushA.data));
  assert.deepEqual(pushA.data.accepted, ['ev1', 'ev2', 'ev3']);
  assert.deepEqual(pushA.data.events, [], '自己刚上传的记录不应再发回来');
  assert.ok(pushA.data.cursor > 0);

  const pullB = await call('POST', '/api/sync', { token: B, body: { since: 0 } });
  assert.deepEqual(pullB.data.events.map(e => e.i), ['ev1', 'ev2', 'ev3']);
  assert.deepEqual(pullB.data.events[1], { i: 'ev2', t: T + 2, k: '帰る|かえる', f: 'nai', o: 0, a: '帰ない' });
  assert.deepEqual(pullB.data.settings, settingsA);

  // 重复上传不会产生重复记录
  await call('POST', '/api/sync', { token: A, body: { since: pushA.data.cursor, events: [ev(1), ev(2)] } });
  const again = await call('POST', '/api/sync', { token: B, body: { since: pullB.data.cursor } });
  assert.deepEqual(again.data.events, []);

  // 设置按时间先后取较新的
  await call('POST', '/api/sync', { token: B, body: { since: 0, settings: { data: { levels: [1] }, t: T + 50 } } });
  const s1 = await call('POST', '/api/sync', { token: A, body: { since: 0 } });
  assert.deepEqual(s1.data.settings, settingsA, '较旧的设置不应覆盖较新的');
  await call('POST', '/api/sync', { token: B, body: { since: 0, settings: { data: { levels: [3] }, t: T + 200 } } });
  const s2 = await call('POST', '/api/sync', { token: A, body: { since: 0 } });
  assert.deepEqual(s2.data.settings.data, { levels: [3] });
});

test('不合格的记录单独退回，不影响其他记录', async () => {
  const { call, login } = setup();
  const { token } = await login();
  const r = await call('POST', '/api/sync', { token, body: { since: 0, events: [
    ev(1), { i: 'bad1', t: 'yesterday', k: 'x', f: 'nai', o: 1 }, { i: 'bad2', t: T, k: 'x', f: 'nai', o: 5 },
    { i: 'bad3', t: T, k: 'x', y: 'hack' }, { i: 'bad4', t: Date.now() + 10 * 86400e3, k: 'x', f: 'nai', o: 1 },
    { i: 'add1', t: T + 9, k: '静か|しずか', y: 'add', extra: 'dropped' },
  ] } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.accepted, ['ev1', 'add1']);
  assert.deepEqual(r.data.rejected, ['bad1', 'bad2', 'bad3', 'bad4']);
  const all = await call('POST', '/api/sync', { token, body: { since: 0 } });
  const add = all.data.events.find(e => e.i === 'add1');
  assert.deepEqual(add, { i: 'add1', t: T + 9, k: '静か|しずか', y: 'add' });
  assert.equal((await call('POST', '/api/sync', { token, body: { events: new Array(501).fill(ev(1)) } })).status, 400);
});

test('清空记录会删掉云端更早的记录', async () => {
  const { call, login } = setup();
  const { token } = await login();
  await call('POST', '/api/sync', { token, body: { since: 0, events: [ev(1), ev(2), ev(3)] } });
  await call('POST', '/api/sync', { token, body: { since: 0, events: [{ i: 'r1', t: T + 10, y: 'reset' }, ev(20)] } });
  const all = await call('POST', '/api/sync', { token, body: { since: 0 } });
  assert.deepEqual(all.data.events.map(e => e.i), ['r1', 'ev20']);
});

test('不同用户的数据互相隔离', async () => {
  const { call, login } = setup();
  const a = await login({ sub: 'alice' }), b = await login({ sub: 'bob' });
  await call('POST', '/api/sync', { token: a.token, body: { since: 0, events: [ev(1)], settings: { data: { x: 1 }, t: T } } });
  const r = await call('POST', '/api/sync', { token: b.token, body: { since: 0 } });
  assert.deepEqual(r.data.events, []);
  assert.equal(r.data.settings, null);
});

test('记录很多时分页下发', async () => {
  const { call, login } = setup();
  const A = (await login()).token, B = (await login()).token;
  for (let p = 0; p < 3; p++) {
    const batch = Array.from({ length: p < 2 ? 500 : 100 }, (_, j) => ev(p * 1000 + j));
    const r = await call('POST', '/api/sync', { token: A, body: { since: 0, events: batch } });
    assert.equal(r.data.accepted.length, batch.length);
  }
  const p1 = await call('POST', '/api/sync', { token: B, body: { since: 0 } });
  assert.equal(p1.data.events.length, 1000);
  assert.equal(p1.data.more, true);
  const p2 = await call('POST', '/api/sync', { token: B, body: { since: p1.data.cursor } });
  assert.equal(p2.data.events.length, 100);
  assert.equal(p2.data.more, false);
});

test('退出登录后令牌失效', async () => {
  const { call, login } = setup();
  const { token } = await login();
  assert.equal((await call('POST', '/api/logout', { token })).status, 200);
  assert.equal((await call('GET', '/api/me', { token })).status, 401);
});

test('跨域只放行配置过的来源', async () => {
  const { call } = setup({ ALLOWED_ORIGINS: 'https://shell32-natsu.github.io' });
  const ok = await call('OPTIONS', '/api/sync', { headers: { origin: 'https://shell32-natsu.github.io' } });
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://shell32-natsu.github.io');
  const no = await call('GET', '/api/config', { headers: { origin: 'https://evil.example.com' } });
  assert.equal(no.headers.get('access-control-allow-origin'), null);
});

test('未知接口、错误方法和静态页面', async () => {
  const { call, assetsHits } = setup();
  assert.equal((await call('GET', '/api/nope')).status, 404);
  assert.equal((await call('GET', '/api/sync')).status, 405);
  const page = await call('GET', '/index.html');
  assert.equal(page.data, 'asset');
  assert.deepEqual(assetsHits, ['/index.html']);
});
