// 活用練習帳 · Cloudflare Worker
// 网页本身由 Workers 静态资源（public/）提供，这里只处理 /api/*：
//   GET  /api/config        前端需要的配置（Google 客户端 ID）
//   POST /api/auth/google   用 Google 登录凭证换本站的登录令牌
//   GET  /api/me            当前登录的用户
//   POST /api/logout        退出登录
//   POST /api/sync          上传本机新增的答题记录和设置，取回其他设备的记录

import { verifyGoogleIdToken, fetchGoogleKeys, AuthError } from './google.js';

const DAY = 86400e3;
const SESSION_TTL = 365 * DAY;
const SESSION_RENEW = 180 * DAY;   // 剩余有效期不到这么久时自动续期
const MAX_BODY = 600_000;
const MAX_EVENTS = 500;            // 每次最多上传的事件数
const PAGE = 1000;                 // 每次最多下发的事件数
const MIN_T = Date.UTC(2024, 0, 1);

// 第一次收到请求时自动建表，不需要单独跑数据库迁移
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY, email TEXT, name TEXT, picture TEXT,
     created_at INTEGER NOT NULL, last_login INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL,
     created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)`,
  `CREATE TABLE IF NOT EXISTS events (
     seq INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, id TEXT NOT NULL,
     ts INTEGER NOT NULL, data TEXT NOT NULL, UNIQUE (user_id, id))`,
  `CREATE INDEX IF NOT EXISTS events_user_seq ON events (user_id, seq)`,
  `CREATE INDEX IF NOT EXISTS events_user_ts ON events (user_id, ts)`,
  `CREATE TABLE IF NOT EXISTS settings (
     user_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
];
const schemaReady = new WeakMap();
function ensureSchema(db) {
  let p = schemaReady.get(db);
  if (!p) {
    p = db.batch(SCHEMA.map(s => db.prepare(s))).catch(e => { schemaReady.delete(db); throw e; });
    schemaReady.set(db, p);
  }
  return p;
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

async function readJson(request) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY) throw new HttpError(413, '请求太大');
  const text = await request.text();
  if (text.length > MAX_BODY) throw new HttpError(413, '请求太大');
  try { return JSON.parse(text || '{}'); } catch { throw new HttpError(400, '请求内容不是有效的 JSON'); }
}

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join('');
}

function publicUser(row, id) {
  return { id, name: row.name || '', email: row.email || '', picture: row.picture || '' };
}

async function requireUser(request, env, ctx) {
  const m = /^Bearer\s+(\S+)$/.exec(request.headers.get('Authorization') || '');
  if (!m) throw new HttpError(401, '没有登录');
  const hash = await sha256(m[1]);
  const row = await env.DB.prepare(
    `SELECT s.user_id, s.expires_at, u.name, u.email, u.picture
       FROM sessions s LEFT JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?1`).bind(hash).first();
  const now = Date.now();
  if (!row || row.expires_at < now) throw new HttpError(401, '登录已过期，请重新登录');
  if (row.expires_at - now < SESSION_RENEW) {
    const renew = env.DB.prepare('UPDATE sessions SET expires_at = ?1 WHERE token_hash = ?2').bind(now + SESSION_TTL, hash).run();
    if (ctx && ctx.waitUntil) ctx.waitUntil(renew); else await renew;
  }
  return { ...publicUser(row, row.user_id), hash };
}

// 校验并整理上传的事件；不合格的单独列出来，让前端丢掉，不影响其他事件
function cleanEvents(list) {
  if (list == null) return { events: [], rejected: [] };
  if (!Array.isArray(list)) throw new HttpError(400, 'events 必须是数组');
  if (list.length > MAX_EVENTS) throw new HttpError(400, `一次最多上传 ${MAX_EVENTS} 条记录`);
  const maxT = Date.now() + DAY;
  const events = [], rejected = [];
  for (const e of list) {
    const id = e && typeof e.i === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(e.i) ? e.i : null;
    const out = id && Number.isSafeInteger(e.t) && e.t >= MIN_T && e.t <= maxT ? normalize(e) : null;
    if (out) events.push(out);
    else if (e && typeof e.i === 'string') rejected.push(String(e.i).slice(0, 40));
  }
  return { events, rejected };
}

function normalize(e) {
  const { i, t } = e;
  if (e.y === 'reset') return { i, t, y: 'reset' };
  if (typeof e.k !== 'string' || !e.k || e.k.length > 64) return null;
  if (e.y === 'add' || e.y === 'del') return { i, t, k: e.k, y: e.y };
  if (e.y !== undefined) return null;
  if (typeof e.f !== 'string' || !/^[a-z]{1,16}$/.test(e.f) || (e.o !== 0 && e.o !== 1)) return null;
  const out = { i, t, k: e.k, f: e.f, o: e.o };
  if (e.o === 0 && typeof e.a === 'string') out.a = e.a.slice(0, 40);
  return out;
}

function cleanSettings(s) {
  if (!s || typeof s !== 'object' || !s.data || typeof s.data !== 'object' || Array.isArray(s.data)) return null;
  if (!Number.isSafeInteger(s.t) || s.t < MIN_T || s.t > Date.now() + DAY) return null;
  const text = JSON.stringify(s.data);
  return text.length <= 4000 ? { text, t: s.t } : null;
}

export function createApp({ getGoogleKeys = fetchGoogleKeys } = {}) {
  const routes = {
    'GET /api/config': async (req, env) => ({ googleClientId: env.GOOGLE_CLIENT_ID || null }),

    'POST /api/auth/google': async (req, env) => {
      const { credential } = await readJson(req);
      const p = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID, { getKeys: getGoogleKeys });
      const id = 'g:' + p.sub;
      const now = Date.now();
      const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
      const user = { name: p.name || '', email: p.email || '', picture: p.picture || '' };
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO users (id, email, name, picture, created_at, last_login) VALUES (?1, ?2, ?3, ?4, ?5, ?5)
           ON CONFLICT (id) DO UPDATE SET email = excluded.email, name = excluded.name,
             picture = excluded.picture, last_login = excluded.last_login`).bind(id, user.email, user.name, user.picture, now),
        env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1 AND expires_at < ?2').bind(id, now),
        env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)')
          .bind(await sha256(token), id, now, now + SESSION_TTL),
      ]);
      return { token, user: publicUser(user, id) };
    },

    'GET /api/me': async (req, env, ctx) => {
      const { hash, ...user } = await requireUser(req, env, ctx);
      return { user };
    },

    'POST /api/logout': async (req, env, ctx) => {
      const { hash } = await requireUser(req, env, ctx);
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(hash).run();
      return { ok: true };
    },

    'POST /api/sync': async (req, env, ctx) => {
      const { id: uid } = await requireUser(req, env, ctx);
      const body = await readJson(req);
      const since = Number.isSafeInteger(body.since) && body.since >= 0 ? body.since : 0;
      const { events, rejected } = cleanEvents(body.events);
      const settings = cleanSettings(body.settings);
      const db = env.DB;

      const writes = [];
      if (events.length) {
        // 一条语句插入全部事件；同一 id 已存在就跳过，所以重复上传无害
        writes.push(db.prepare(
          `INSERT OR IGNORE INTO events (user_id, id, ts, data)
           SELECT ?1, json_extract(value, '$.i'), json_extract(value, '$.t'), value FROM json_each(?2)`)
          .bind(uid, JSON.stringify(events)));
      }
      const resetT = events.reduce((m, e) => (e.y === 'reset' && e.t > m ? e.t : m), 0);
      if (resetT) writes.push(db.prepare('DELETE FROM events WHERE user_id = ?1 AND ts < ?2').bind(uid, resetT));
      if (settings) {
        writes.push(db.prepare(
          `INSERT INTO settings (user_id, data, updated_at) VALUES (?1, ?2, ?3)
           ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
           WHERE excluded.updated_at > settings.updated_at`).bind(uid, settings.text, settings.t));
      }
      if (writes.length) await db.batch(writes);

      const { results } = await db.prepare(
        'SELECT seq, data FROM events WHERE user_id = ?1 AND seq > ?2 ORDER BY seq LIMIT ?3').bind(uid, since, PAGE + 1).all();
      const rows = results.slice(0, PAGE);
      const pushed = new Set(events.map(e => e.i));
      const out = [];
      for (const r of rows) { const e = JSON.parse(r.data); if (!pushed.has(e.i)) out.push(e); }
      const st = await db.prepare('SELECT data, updated_at FROM settings WHERE user_id = ?1').bind(uid).first();
      return {
        events: out,
        cursor: rows.length ? rows[rows.length - 1].seq : since,
        more: results.length > PAGE,
        accepted: events.map(e => e.i),
        rejected,
        settings: st ? { data: JSON.parse(st.data), t: st.updated_at } : null,
      };
    },
  };

  return {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      if (!url.pathname.startsWith('/api/')) {
        return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
      }
      const cors = corsHeaders(request, env);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      const handler = routes[`${request.method} ${url.pathname}`];
      try {
        if (!handler) {
          const known = Object.keys(routes).some(r => r.endsWith(' ' + url.pathname));
          throw new HttpError(known ? 405 : 404, known ? '不支持这个请求方法' : '没有这个接口');
        }
        if (url.pathname !== '/api/config') {
          if (!env.DB) throw new HttpError(503, '服务器没有配置数据库');
          await ensureSchema(env.DB);
        }
        return json(await handler(request, env, ctx), 200, cors);
      } catch (e) {
        if (e instanceof HttpError) return json({ error: e.message }, e.status, cors);
        if (e instanceof AuthError) return json({ error: e.message }, 401, cors);
        console.error(e);
        return json({ error: '服务器出错了，请稍后再试' }, 500, cors);
      }
    },
  };
}

export default createApp();
