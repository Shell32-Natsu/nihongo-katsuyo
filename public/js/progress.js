// ===== 学习记录：答题日志 + 间隔复习 =====
//
// 每答一题记一条事件，所有统计和复习安排都由事件按时间顺序推算出来。
// 这样多台设备的记录合并时只需要取并集，不会互相覆盖。
//
// 事件格式（字段名尽量短，省存储）：
//   答题  { i: id, t: 时间戳(ms), k: 单词 key, f: 变形, o: 1 对 / 0 错, a: 错误答案（只在答错时记） }
//   加入单词本 { i, t, k, y: 'add' }
//   移出单词本 { i, t, k, y: 'del' }
//   清空全部记录 { i, t, y: 'reset' }

const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;

// 单词本的复习间隔：答错后 3 分钟再考一次，之后每答对一次间隔拉长，
// 走完最后一级（30 天）仍答对，就算掌握，移出单词本。
const SRS_STEPS = [3 * MIN, DAY, 3 * DAY, 7 * DAY, 15 * DAY, 30 * DAY];
// 提前一点答也算复习：允许提前该级间隔的 20%（比如 1 天的那级可以提前约 5 小时）
const SRS_EARLY = 0.2;

function makeId() {
  const b = new Uint8Array(12);
  if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

function byTime(a, b) { return a.t - b.t || (a.i < b.i ? -1 : a.i > b.i ? 1 : 0); }

class Progress {
  constructor(events) {
    this.log = [];      // 按时间排好序的全部事件
    this.ids = new Set();
    this._clearState();
    if (events) this.addMany(events);
  }

  // 丢掉全部记录（退出登录时清掉本机数据用）
  clearAll() { this.log = []; this.ids = new Set(); this._clearState(); }

  _clearState() {
    this.words = new Map(); // key → 单词记录
    this.forms = {};        // 变形 → { n: 答题数, c: 答对数 }
    this.best = 0;          // 历史最长连对
    this.run = 0;
  }

  word(k) {
    let w = this.words.get(k);
    if (!w) {
      w = { k, n: 0, w: 0, streak: 0, firstT: 0, lastT: 0, forms: {}, lastWrong: null, book: null, mastered: false };
      this.words.set(k, w);
    }
    return w;
  }

  // 按一条事件更新状态。只依赖事件本身的时间，所以重放结果和设备、时区无关。
  _apply(e) {
    if (e.y === 'reset') { this._clearState(); return; }
    const W = this.word(e.k);
    if (e.y === 'add') { if (!W.book) W.book = { step: 0, due: e.t + SRS_STEPS[0], since: e.t }; return; }
    if (e.y === 'del') { W.book = null; return; }

    if (!W.n) W.firstT = e.t;
    W.n++; W.lastT = e.t;
    const F = W.forms[e.f] || (W.forms[e.f] = { n: 0, w: 0 });
    const G = this.forms[e.f] || (this.forms[e.f] = { n: 0, c: 0 });
    F.n++; G.n++;
    if (e.o) {
      G.c++; W.streak++;
      this.run++; if (this.run > this.best) this.best = this.run;
      const B = W.book;
      if (B && e.t >= B.due - SRS_EARLY * SRS_STEPS[B.step]) {
        const next = B.step + 1;
        if (next >= SRS_STEPS.length) { W.book = null; W.mastered = true; }
        else W.book = { step: next, due: e.t + SRS_STEPS[next], since: B.since };
      }
    } else {
      W.w++; F.w++; W.streak = 0; this.run = 0;
      W.lastWrong = { f: e.f, a: e.a || '', t: e.t };
      W.mastered = false;
      W.book = { step: 0, due: e.t + SRS_STEPS[0], since: W.book ? W.book.since : e.t };
    }
  }

  _rebuild() {
    // 清空之前的事件已经没用了，从日志里去掉
    let last = -1;
    for (let i = this.log.length - 1; i >= 0; i--) if (this.log[i].y === 'reset') { last = i; break; }
    if (last > 0) { this.log = this.log.slice(last); this.ids = new Set(this.log.map(e => e.i)); }
    this._clearState();
    for (const e of this.log) this._apply(e);
  }

  // 加一条事件；已经有的（同 id）会被忽略。返回是否新加入。
  add(e) {
    if (!valid(e) || this.ids.has(e.i)) return false;
    this.ids.add(e.i);
    const lastE = this.log[this.log.length - 1];
    if (!lastE || byTime(lastE, e) <= 0) { this.log.push(e); if (e.y === 'reset') this._rebuild(); else this._apply(e); }
    else { this.log.push(e); this.log.sort(byTime); this._rebuild(); }
    return true;
  }

  // 批量加入（比如从云端拉下来的记录），只重算一次。返回新加入的条数。
  addMany(list) {
    let added = 0;
    for (const e of list || []) {
      if (!valid(e) || this.ids.has(e.i)) continue;
      this.ids.add(e.i); this.log.push(e); added++;
    }
    if (added) { this.log.sort(byTime); this._rebuild(); }
    return added;
  }

  // ---- 查询 ----

  get(k) { return this.words.get(k) || null; }

  // new 没答过 · due 该复习了 · book 在单词本里 · mastered 已掌握 · clean 从没错过 · seen 错过但已移出单词本
  status(k, now) {
    const W = this.words.get(k);
    if (!W || (!W.n && !W.book)) return 'new';
    if (W.book) return W.book.due <= now ? 'due' : 'book';
    if (W.mastered) return 'mastered';
    if (!W.w) return 'clean';
    return 'seen';
  }

  dueList(now) {
    const out = [];
    for (const W of this.words.values()) if (W.book && W.book.due <= now) out.push(W);
    return out.sort((a, b) => a.book.due - b.book.due);
  }

  bookList() {
    const out = [];
    for (const W of this.words.values()) if (W.book) out.push(W);
    return out.sort((a, b) => a.book.due - b.book.due);
  }

  // 下一个还没到期的复习时间
  nextDue(now) {
    let best = null;
    for (const W of this.words.values()) if (W.book && W.book.due > now && (best === null || W.book.due < best)) best = W.book.due;
    return best;
  }

  countDueBy(t) {
    let n = 0;
    for (const W of this.words.values()) if (W.book && W.book.due <= t) n++;
    return n;
  }

  practicedList() {
    const out = [...this.words.values()].filter(W => W.n);
    return out.sort((a, b) => b.w - a.w || (b.w / b.n) - (a.w / a.n) || b.lastT - a.lastT);
  }

  counts(now) {
    let due = 0, book = 0, mastered = 0, practiced = 0;
    for (const W of this.words.values()) {
      if (W.n) practiced++;
      if (W.book) { book++; if (W.book.due <= now) due++; }
      else if (W.mastered) mastered++;
    }
    return { due, book, mastered, practiced };
  }

  // 平时练习时选词的权重：没练过的 1；从来没错过的，答对次数越多出现越少（最低 0.1），
  // 隔了一个月没见又会慢慢回来；错过的按错误率提高；单词本里的词交给复习安排，不额外多出。
  weight(k, now) {
    const W = this.words.get(k);
    if (!W || !W.n) return 1;
    if (W.book) return W.book.due <= now ? 0.3 : 0.6;
    if (!W.w) {
      let x = Math.max(0.1, Math.pow(0.6, W.n));
      if (now - W.lastT > 30 * DAY) x = Math.max(x, 0.5);
      return x;
    }
    return Math.min(1.5, Math.max(0.3, 0.4 + 2 * W.w / W.n));
  }

  // 平时练习时给这个词挑变形：这个词错过的变形、整体正确率低的变形更容易被选中
  formWeight(k, f) {
    const W = this.words.get(k);
    let x = 1;
    const F = W && W.forms[f];
    if (F && F.w) x += 1 + 2 * F.w / F.n;
    const G = this.forms[f];
    if (G && G.n >= 3) x += 1 - G.c / G.n;
    return x;
  }

  // 复习时考哪种变形：优先考上次错的，其次按这个词各变形的错误次数
  reviewForms(k, valid) {
    const W = this.words.get(k);
    if (!W) return [];
    const out = [];
    if (W.lastWrong && valid.includes(W.lastWrong.f)) out.push({ f: W.lastWrong.f, w: 3 });
    for (const f of valid) { const F = W.forms[f]; if (F && F.w && !(W.lastWrong && W.lastWrong.f === f)) out.push({ f, w: F.w }); }
    return out;
  }
}

function valid(e) {
  if (!e || typeof e.i !== 'string' || !e.i || typeof e.t !== 'number' || !isFinite(e.t)) return false;
  if (e.y === 'reset') return true;
  if (typeof e.k !== 'string' || !e.k) return false;
  if (e.y === 'add' || e.y === 'del') return true;
  return e.y === undefined && typeof e.f === 'string' && (e.o === 0 || e.o === 1);
}

function weightedPick(items, weightOf, rnd = Math.random) {
  let total = 0;
  const ws = items.map(x => { const w = Math.max(0, weightOf(x)); total += w; return w; });
  if (!items.length) return undefined;
  if (total <= 0) return items[Math.floor(rnd() * items.length)];
  let r = rnd() * total;
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r < 0) return items[i]; }
  return items[items.length - 1];
}

// 把时间写成「3 分钟后」「明天」「10月12日」这样的说法
function whenText(t, now) {
  const d = t - now;
  if (d <= 0) return '现在';
  if (d < HOUR) return `${Math.max(1, Math.round(d / MIN))} 分钟后`;
  const a = new Date(now), b = new Date(t);
  const day0 = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const days = Math.floor((new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() - day0) / DAY + 0.5);
  const hm = `${b.getHours()}:${String(b.getMinutes()).padStart(2, '0')}`;
  if (days === 0) return `今天 ${hm}`;
  if (days === 1) return '明天';
  if (days === 2) return '后天';
  if (days < 7) return `${days} 天后`;
  return `${b.getMonth() + 1}月${b.getDate()}日`;
}
