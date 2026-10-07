// 学习记录与间隔复习测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../public/js/progress.js', import.meta.url), 'utf8');
const P = vm.runInNewContext(src + '\n;({ Progress, SRS_STEPS, makeId, weightedPick, whenText, MIN, DAY });', { crypto: globalThis.crypto });
const { Progress, SRS_STEPS, MIN, DAY } = P;

// vm 里创建的对象原型不同，比较前转成普通对象
const plain = (x) => JSON.parse(JSON.stringify(x));

let seq = 0;
const T0 = Date.UTC(2026, 9, 1, 3, 0, 0);
const ans = (t, k, f, o, a) => ({ i: 'e' + (++seq), t, k, f, o: o ? 1 : 0, ...(o ? {} : { a: a || 'x' }) });

test('答错进单词本，3 分钟后到期', () => {
  const p = new Progress();
  p.add(ans(T0, '帰る|かえる', 'nai', 0, '帰ない'));
  const W = p.get('帰る|かえる');
  assert.equal(W.n, 1); assert.equal(W.w, 1);
  assert.deepEqual(plain(W.lastWrong), { f: 'nai', a: '帰ない', t: T0 });
  assert.equal(W.book.step, 0);
  assert.equal(W.book.due, T0 + 3 * MIN);
  assert.equal(p.status('帰る|かえる', T0 + MIN), 'book');
  assert.equal(p.status('帰る|かえる', T0 + 3 * MIN), 'due');
  assert.equal(p.dueList(T0 + 3 * MIN).length, 1);
});

test('按间隔答对一路升级，走完 30 天就掌握并移出单词本', () => {
  const p = new Progress();
  const k = '書く|かく';
  let t = T0;
  p.add(ans(t, k, 'te', 0));
  for (let s = 0; s < SRS_STEPS.length; s++) {
    t = p.get(k).book.due;
    p.add(ans(t, k, 'te', 1));
    if (s < SRS_STEPS.length - 1) {
      assert.equal(p.get(k).book.step, s + 1);
      assert.equal(p.get(k).book.due, t + SRS_STEPS[s + 1]);
    }
  }
  assert.equal(p.get(k).book, null);
  assert.equal(p.get(k).mastered, true);
  assert.equal(p.status(k, t), 'mastered');
});

test('还没到复习时间就答对，不推进复习进度；稍微提前一点可以', () => {
  const p = new Progress();
  const k = '読む|よむ';
  p.add(ans(T0, k, 'ta', 0));
  p.add(ans(T0 + 3 * MIN, k, 'ta', 1));          // 到期，升到 1 天那级
  const due = p.get(k).book.due;
  p.add(ans(due - 12 * 3600e3, k, 'ta', 1));       // 提前 12 小时：太早
  assert.equal(p.get(k).book.step, 1);
  p.add(ans(due - 4 * 3600e3, k, 'ta', 1));        // 提前 4 小时：在 20% 以内，算复习
  assert.equal(p.get(k).book.step, 2);
});

test('复习时答错，进度回到起点', () => {
  const p = new Progress();
  const k = '見る|みる';
  p.add(ans(T0, k, 'pot', 0));
  p.add(ans(T0 + 3 * MIN, k, 'pot', 1));
  p.add(ans(T0 + 3 * MIN + DAY, k, 'pot', 1));
  assert.equal(p.get(k).book.step, 2);
  const t = T0 + 5 * DAY;
  p.add(ans(t, k, 'te', 0, 'みって'));
  assert.equal(p.get(k).book.step, 0);
  assert.equal(p.get(k).book.due, t + 3 * MIN);
  assert.equal(p.get(k).book.since, T0);
  assert.equal(p.get(k).w, 2);
  assert.deepEqual(plain(p.get(k).forms), { pot: { n: 3, w: 1 }, te: { n: 1, w: 1 } });
});

test('手动加入和移出单词本', () => {
  const p = new Progress();
  p.add({ i: 'a1', t: T0, k: '静か|しずか', y: 'add' });
  assert.equal(p.status('静か|しずか', T0), 'book');
  assert.equal(p.status('静か|しずか', T0 + 3 * MIN), 'due');
  p.add({ i: 'a2', t: T0 + 1, k: '静か|しずか', y: 'del' });
  assert.equal(p.get('静か|しずか').book, null);
});

test('从没错过的词，答对越多权重越低，一个月没见又回升', () => {
  const p = new Progress();
  const k = '食べる|たべる';
  assert.equal(p.weight(k, T0), 1);
  const ws = [];
  for (let i = 0; i < 6; i++) { p.add(ans(T0 + i * MIN, k, 'masu', 1)); ws.push(p.weight(k, T0 + 10 * MIN)); }
  for (let i = 1; i < ws.length; i++) assert.ok(ws[i] <= ws[i - 1], `权重应递减：${ws}`);
  assert.equal(ws[ws.length - 1], 0.1);
  assert.ok(p.weight(k, T0 + 40 * DAY) >= 0.5);
  // 错过的词权重更高
  const k2 = '帰る|かえる';
  p.add(ans(T0, k2, 'nai', 0)); p.add(ans(T0 + 3 * MIN, k2, 'nai', 1));
  p.add({ i: 'x-del', t: T0 + 4 * MIN, k: k2, y: 'del' });
  assert.ok(p.weight(k2, T0 + 10 * MIN) > 1, `错过的词权重应大于 1：${p.weight(k2, T0 + 10 * MIN)}`);
});

test('两台设备的记录合并：顺序无关、重复无害', () => {
  const k = '行く|いく';
  const A = [ans(T0, k, 'te', 0), ans(T0 + 5 * MIN, k, 'te', 1), ans(T0 + 2 * DAY, k, 'ta', 1)];
  const B = [ans(T0 + MIN, '高い|たかい', 'aneg', 1), ans(T0 + DAY + MIN, k, 'te', 1), ans(T0 + 3 * DAY, '高い|たかい', 'apast', 0)];
  const snap = (p) => JSON.stringify({ w: [...p.words.entries()].sort(), f: p.forms, best: p.best, log: p.log.map(e => e.i) });
  const p1 = new Progress(); A.forEach(e => p1.add(e)); B.forEach(e => p1.add(e));
  const p2 = new Progress(); B.forEach(e => p2.add(e)); p2.addMany(A);
  const p3 = new Progress([...B, ...A, ...A]);
  assert.equal(snap(p1), snap(p2));
  assert.equal(snap(p1), snap(p3));
  assert.equal(p1.log.length, 6);
  assert.equal(p1.addMany(A), 0);
});

test('清空记录：之前的事件全部作废，之后的照常统计', () => {
  const p = new Progress();
  p.add(ans(T0, '帰る|かえる', 'nai', 0));
  p.add(ans(T0 + MIN, '書く|かく', 'te', 1));
  p.add({ i: 'r1', t: T0 + 2 * MIN, y: 'reset' });
  assert.equal(p.words.size, 0);
  assert.equal(p.best, 0);
  p.add(ans(T0 + 3 * MIN, '書く|かく', 'te', 1));
  assert.equal(p.get('書く|かく').n, 1);
  // 另一台设备晚到的旧记录也不会复活
  p.add(ans(T0 + 30e3, '読む|よむ', 'ta', 0));
  assert.equal(p.get('読む|よむ'), null);
  assert.equal(p.log[0].i, 'r1');
});

test('无效事件被忽略', () => {
  const p = new Progress();
  assert.equal(p.add({ i: 'z', t: 'x', k: 'a', f: 'nai', o: 1 }), false);
  assert.equal(p.add({ i: 'z', t: T0, k: 'a', f: 'nai', o: 2 }), false);
  assert.equal(p.add({ i: 'z', t: T0, f: 'nai', o: 1 }), false);
  assert.equal(p.add({ i: 'z', t: T0, k: 'a', y: 'boom' }), false);
  assert.equal(p.log.length, 0);
});

test('最长连对跨词统计', () => {
  const p = new Progress();
  for (let i = 0; i < 4; i++) p.add(ans(T0 + i, 'w' + i, 'nai', 1));
  p.add(ans(T0 + 10, 'w9', 'nai', 0));
  p.add(ans(T0 + 11, 'w8', 'nai', 1));
  assert.equal(p.best, 4);
});

test('复习时优先考上次错的变形', () => {
  const p = new Progress();
  const k = '話す|はなす';
  p.add(ans(T0, k, 'causpass', 0));
  p.add(ans(T0 + 1, k, 'te', 0));
  const r = p.reviewForms(k, ['te', 'causpass', 'nai']);
  assert.equal(r[0].f, 'te');
  assert.deepEqual(plain(r.map(x => x.f).sort()), ['causpass', 'te']);
});

test('时间说法', () => {
  const now = new Date(2026, 9, 7, 10, 0).getTime();
  assert.equal(P.whenText(now - 1, now), '现在');
  assert.equal(P.whenText(now + 3 * MIN, now), '3 分钟后');
  assert.equal(P.whenText(new Date(2026, 9, 7, 15, 5).getTime(), now), '今天 15:05');
  assert.equal(P.whenText(new Date(2026, 9, 8, 9, 0).getTime(), now), '明天');
  assert.equal(P.whenText(new Date(2026, 9, 11, 9, 0).getTime(), now), '4 天后');
  assert.equal(P.whenText(new Date(2026, 9, 30, 9, 0).getTime(), now), '10月30日');
});
