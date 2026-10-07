// 变形引擎测试：node --test test/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 和浏览器一样，把词库和引擎当作普通脚本加载到同一个全局环境
const root = path.join(__dirname, '..');
const src = ['js/data.js', 'js/engine.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
const E = vm.runInNewContext(src + `
;({ WORDS, FORMS, conj, check, explain, diagnose, choicesFor, formsFor });`);

const word = (w) => {
  const found = E.WORDS.find(x => x.w === w);
  assert.ok(found, `词库里没有「${w}」`);
  return found;
};

test('常见变形判定正确', () => {
  const cases = [
    ['書く', 'nai', '書かない'], ['書く', 'te', '書いて'], ['書く', 'causpass', '書かされる'], ['書く', 'causpass', '書かせられる'],
    ['行く', 'te', '行って'], ['行く', 'tara', '行ったら'], ['買う', 'nai', '買わない'], ['買う', 'pass', '買われる'],
    ['泳ぐ', 'ta', '泳いだ'], ['話す', 'te', '話して'], ['話す', 'causpass', '話させられる'], ['待つ', 'te', '待って'],
    ['死ぬ', 'ta', '死んだ'], ['遊ぶ', 'te', '遊んで'], ['読む', 'vol', '読もう'], ['帰る', 'nai', '帰らない'],
    ['帰る', 'pot', '帰れる'], ['ある', 'nai', 'ない'], ['ある', 'nakatta', 'なかった'], ['食べる', 'pot', '食べられる'],
    ['食べる', 'pot', '食べれる'], ['食べる', 'imp', '食べろ'], ['見る', 'ba', '見れば'], ['くれる', 'imp', 'くれ'],
    ['する', 'pot', 'できる'], ['勉強する', 'pot', '勉強できる'], ['勉強する', 'causpass', '勉強させられる'],
    ['来る', 'nai', '来ない'], ['来る', 'nai', 'こない'], ['来る', 'ba', 'くれば'], ['来る', 'imp', 'こい'],
    ['持って来る', 'nai', '持ってこない'], ['持って来る', 'te', 'もってきて'], ['帰って来る', 'ta', '帰って来た'],
    ['高い', 'aneg', '高くない'], ['いい', 'apast', 'よかった'], ['いい', 'asou', 'よさそう'], ['かっこいい', 'aneg', 'かっこよくない'],
    ['静か', 'aneg', '静かじゃない'], ['静か', 'aneg', 'しずかではない'], ['きれい', 'apast', 'きれいだった'],
    ['静か', 'aattr', '静かな'], ['静か', 'aba', '静かなら'], ['コピーする', 'nai', 'コピーしない'], ['役に立つ', 'pot', '役に立てる'],
    ['書く', 'nai', 'カカナイ'], ['書く', 'nai', 'かかない。'],
  ];
  for (const [w, f, ans] of cases) {
    assert.ok(E.check(word(w), f, ans).ok, `${w} ${f} 应接受「${ans}」，实际答案 ${JSON.stringify(E.conj(word(w), f))}`);
  }
});

test('常见错误不会被判对', () => {
  const wrong = [
    ['帰る', 'nai', '帰ない'], ['食べる', 'nai', '食べらない'], ['書く', 'te', '書って'], ['買う', 'nai', '買あない'],
    ['きれい', 'aneg', 'きれくない'], ['高い', 'appast', '高いでした'], ['いい', 'aneg', 'いくない'], ['ある', 'nai', 'あらない'],
    ['話す', 'causpass', '話さされる'], ['行く', 'te', '行いて'], ['来る', 'nai', 'くない'],
  ];
  for (const [w, f, ans] of wrong) assert.equal(E.check(word(w), f, ans).ok, false, `${w} ${f} 不应接受「${ans}」`);
});

test('错因诊断能认出典型错误', () => {
  const cases = [
    ['帰る', 'nai', '帰ない', '二类'], ['食べる', 'nai', '食べらない', '一类'], ['書く', 'te', '書って', '音便'],
    ['買う', 'nai', '買あない', 'わ'], ['きれい', 'aneg', 'きれくない', 'な形容词'], ['高い', 'appast', '高いでした', 'かったです'],
    ['いい', 'aneg', 'いくない', 'よ'], ['ある', 'nai', 'あらない', 'ある'], ['食べる', 'pot', '食べさせる', '使役形'],
    ['静か', 'aattr', '静か', 'な'],
  ];
  for (const [w, f, ans, keyword] of cases) {
    const d = E.diagnose(word(w), f, ans);
    assert.ok(d.includes(keyword), `${w} ${f}「${ans}」的诊断应提到「${keyword}」，实际：${d || '（空）'}`);
  }
});

test('每个词的每种变形都有答案、讲解和 4 个不重复选项', () => {
  for (const w of E.WORDS) {
    for (const f of E.formsFor(w)) {
      const ex = E.explain(w, f);
      assert.ok(ex.cls, `${w.w} 缺少类别说明`);
      if (f === 'vclass' || f === 'aclass') continue;
      const list = E.conj(w, f);
      assert.ok(list && list.length && list.every(a => a.k && a.j), `${w.w} ${f} 没有答案`);
      assert.ok(ex.rule, `${w.w} ${f} 缺少规则说明`);
      const opts = E.choicesFor(w, f);
      assert.equal(opts.length, 4, `${w.w} ${f} 选项数为 ${opts.length}`);
      assert.equal(new Set(opts).size, 4, `${w.w} ${f} 选项有重复：${opts}`);
      assert.equal(opts.filter(o => E.check(w, f, o).ok).length, 1, `${w.w} ${f} 应恰好有一个正确选项：${opts}`);
    }
  }
});

test('词库格式正确', () => {
  const keys = new Set();
  for (const w of E.WORDS) {
    assert.ok(!keys.has(w.key), `重复的词：${w.key}`);
    keys.add(w.key);
    assert.ok([1, 2, 3, 4, 5].includes(w.lvl), `${w.w} 的级别不对：${w.lvl}`);
    assert.ok(['1', '2', 's', 'k', 'i', 'n'].includes(w.t), `${w.w} 的词类不对：${w.t}`);
    assert.ok(w.m, `${w.w} 缺少中文释义`);
    if (w.t === '1' || w.t === '2') assert.equal(w.w.slice(-1), w.r.slice(-1), `${w.w} 写法和读音的词尾不一致`);
    if (w.t === '2') assert.equal(w.r.slice(-1), 'る', `${w.w} 标成二类但不以る结尾`);
    if (w.t === 'i') assert.equal(w.r.slice(-1), 'い', `${w.w} 标成い形容词但不以い结尾`);
    for (const f of w.x) assert.ok(E.FORMS[f], `${w.w} 排除了不存在的变形：${f}`);
  }
});
