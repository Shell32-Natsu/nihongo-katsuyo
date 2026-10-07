// 验证 Google 登录返回的 ID token（Google Identity Services 的 credential）
// 文档：https://developers.google.com/identity/gsi/web/guides/verify-google-id-token

const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

let cache = { keys: null, until: 0 };

// 取 Google 的公钥，按响应里的 max-age 缓存
export async function fetchGoogleKeys({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache.keys && now < cache.until) return cache.keys;
  const res = await fetch(GOOGLE_CERTS);
  if (!res.ok) throw new Error(`无法获取 Google 公钥：HTTP ${res.status}`);
  const { keys } = await res.json();
  const m = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
  cache = { keys, until: now + (m ? Number(m[1]) : 3600) * 1000 };
  return keys;
}

export function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJson(part) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
}

export class AuthError extends Error {}

/**
 * 验证成功返回 token 里的用户信息（sub、email、name、picture…），否则抛 AuthError。
 * getKeys 可以替换，方便测试。
 */
export async function verifyGoogleIdToken(token, clientId, { getKeys = fetchGoogleKeys, now = Date.now() } = {}) {
  if (!clientId) throw new AuthError('服务器没有配置 GOOGLE_CLIENT_ID');
  if (typeof token !== 'string') throw new AuthError('缺少登录凭证');
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError('登录凭证格式不对');
  let header, payload;
  try { header = decodeJson(parts[0]); payload = decodeJson(parts[1]); } catch { throw new AuthError('登录凭证格式不对'); }
  if (header.alg !== 'RS256' || !header.kid) throw new AuthError('登录凭证的签名算法不对');

  let keys = await getKeys();
  let jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) { keys = await getKeys({ force: true }); jwk = keys.find(k => k.kid === header.kid); }
  if (!jwk) throw new AuthError('找不到对应的 Google 公钥');

  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) throw new AuthError('登录凭证签名无效');

  const sec = Math.floor(now / 1000);
  if (!ISSUERS.includes(payload.iss)) throw new AuthError('登录凭证不是 Google 签发的');
  if (payload.aud !== clientId) throw new AuthError('登录凭证不是发给这个网站的');
  if (typeof payload.exp !== 'number' || payload.exp < sec - 60) throw new AuthError('登录凭证已过期');
  if (typeof payload.iat === 'number' && payload.iat > sec + 300) throw new AuthError('登录凭证的时间不对');
  if (!payload.sub) throw new AuthError('登录凭证里没有用户 ID');
  return payload;
}
