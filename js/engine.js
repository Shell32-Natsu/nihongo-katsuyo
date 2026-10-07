// ===== 变形引擎 =====
const FORMS = {
  masu:         { kind: 'v', g: '礼貌体', label: 'ます形',     sub: '礼貌形',       ex: '書く → 書きます' },
  masen:        { kind: 'v', g: '礼貌体', label: 'ません',     sub: '礼貌否定',     ex: '書く → 書きません' },
  mashita:      { kind: 'v', g: '礼貌体', label: 'ました',     sub: '礼貌过去',     ex: '書く → 書きました' },
  masendeshita: { kind: 'v', g: '礼貌体', label: 'ませんでした', sub: '礼貌过去否定', ex: '書く → 書きませんでした' },
  mashou:       { kind: 'v', g: '礼貌体', label: 'ましょう',   sub: '一起…吧',     ex: '書く → 書きましょう' },
  nai:          { kind: 'v', g: '简体',   label: 'ない形',     sub: '否定',         ex: '書く → 書かない' },
  nakatta:      { kind: 'v', g: '简体',   label: 'なかった',   sub: '过去否定',     ex: '書く → 書かなかった' },
  ta:           { kind: 'v', g: '简体',   label: 'た形',       sub: '过去',         ex: '書く → 書いた' },
  te:           { kind: 'v', g: '简体',   label: 'て形',       sub: '连接、请求',   ex: '書く → 書いて' },
  tai:          { kind: 'v', g: '进阶',   label: 'たい形',     sub: '想做',         ex: '書く → 書きたい' },
  vol:          { kind: 'v', g: '进阶',   label: '意志形',     sub: '…吧（简体）', ex: '書く → 書こう' },
  pot:          { kind: 'v', g: '进阶',   label: '可能形',     sub: '能做',         ex: '書く → 書ける' },
  pass:         { kind: 'v', g: '进阶',   label: '被动形',     sub: '被…',         ex: '書く → 書かれる' },
  caus:         { kind: 'v', g: '进阶',   label: '使役形',     sub: '让…做',       ex: '書く → 書かせる' },
  causpass:     { kind: 'v', g: '进阶',   label: '使役被动',   sub: '被迫做',       ex: '書く → 書かされる' },
  imp:          { kind: 'v', g: '进阶',   label: '命令形',     sub: '简体命令',     ex: '書く → 書け' },
  proh:         { kind: 'v', g: '进阶',   label: '禁止形',     sub: '不许…',       ex: '書く → 書くな' },
  ba:           { kind: 'v', g: '进阶',   label: 'ば形',       sub: '假定',         ex: '書く → 書けば' },
  tara:         { kind: 'v', g: '进阶',   label: 'たら形',     sub: '如果／…之后', ex: '書く → 書いたら' },
  vclass:       { kind: 'v', g: '类别',   label: '判断类别',   sub: '一类／二类／三类', ex: '帰る → 一类（例外）' },
  aneg:         { kind: 'a', g: '简体',   label: '否定',       sub: '不…',         ex: '高い → 高くない ／ 静か → 静かじゃない' },
  apast:        { kind: 'a', g: '简体',   label: '过去',       sub: '…过',         ex: '高い → 高かった ／ 静か → 静かだった' },
  apastneg:     { kind: 'a', g: '简体',   label: '过去否定',   sub: '过去不…',     ex: '高い → 高くなかった' },
  ate:          { kind: 'a', g: '简体',   label: 'て形',       sub: '中顿、并列',   ex: '高い → 高くて ／ 静か → 静かで' },
  aadv:         { kind: 'a', g: '简体',   label: '副词形',     sub: '修饰动词',     ex: '高い → 高く ／ 静か → 静かに' },
  apneg:        { kind: 'a', g: '敬体',   label: '敬体否定',   sub: '〜です的否定', ex: '高い → 高くないです' },
  appast:       { kind: 'a', g: '敬体',   label: '敬体过去',   sub: '〜でした',     ex: '高い → 高かったです ／ 静か → 静かでした' },
  appastneg:    { kind: 'a', g: '敬体',   label: '敬体过去否定', sub: '',           ex: '高い → 高くなかったです' },
  aba:          { kind: 'a', g: '进阶',   label: '假定形',     sub: '如果…',       ex: '高い → 高ければ ／ 静か → 静かなら' },
  atara:        { kind: 'a', g: '进阶',   label: 'たら形',     sub: '如果…',       ex: '高い → 高かったら' },
  anaru:        { kind: 'a', g: '进阶',   label: '〜なる',     sub: '变得…',       ex: '高い → 高くなる ／ 静か → 静かになる' },
  asou:         { kind: 'a', g: '进阶',   label: '〜そう',     sub: '看起来…',     ex: '高い → 高そう' },
  aattr:        { kind: 'a', g: '进阶',   label: '修饰名词',   sub: '＋名词',       ex: '高い山 ／ 静かな部屋' },
  aclass:       { kind: 'a', g: '类别',   label: '判断类别',   sub: 'い形／な形',   ex: 'きれい → な形容词' },
};
const FORM_KEYS = Object.keys(FORMS);
const NV = ['pot', 'pass', 'caus', 'causpass', 'vol', 'mashou', 'imp', 'proh', 'tai'];

const TYPE_NAME = { '1': '一类动词', '2': '二类动词', s: '三类动词', k: '三类动词', i: 'い形容词', n: 'な形容词' };
const TYPE_SUB = { '1': '五段', '2': '一段', s: 'サ变', k: 'カ变', i: '', n: '' };
const clsKey = (w) => (w.t === 's' || w.t === 'k') ? '3' : w.t;
const isVerb = (w) => !(w.t === 'i' || w.t === 'n');

const WORDS = RAW.trim().split('\n').map((line, id) => {
  const [w, r, m, l, t, fl = ''] = line.split('|');
  const f = {}; const x = new Set();
  fl.split(';').filter(Boolean).forEach(tok => {
    const [k, v] = tok.split('=');
    if (k === 'nv') NV.forEach(a => x.add(a));
    else if (k === 'x') v.split(',').forEach(a => x.add(a));
    else if (k === 'ok') v.split(',').forEach(a => x.delete(a));
    else if (k === 'imp') f.imp = v;
    else f[k] = true;
  });
  return { id, key: w + '|' + r, w, r, m, lvl: +l, t, f, x };
});

// ---- 假名工具 ----
const VROW = { a: 'あかさたなはまやらわがざだばぱぁゃ', i: 'いきしちにひみりぎじぢびぴぃ', u: 'うくすつぬふむゆるぐずづぶぷぅゅ', e: 'えけせてねへめれげぜでべぺぇ', o: 'おこそとのほもよろをごぞどぼぽぉょ' };
const VNAME = { a: 'あ段', i: 'い段', u: 'う段', e: 'え段', o: 'お段' };
function vowelOf(ch) { for (const v in VROW) if (VROW[v].includes(ch)) return v; return null; }

function toHira(s) { return s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)); }
function norm(s) {
  if (!s) return '';
  return toHira(String(s).normalize('NFKC').replace(/[\s　。．.！!？?、,，]/g, ''));
}

const ROWS = {
  'う': ['わ', 'い', 'う', 'え', 'お'], 'く': ['か', 'き', 'く', 'け', 'こ'], 'ぐ': ['が', 'ぎ', 'ぐ', 'げ', 'ご'],
  'す': ['さ', 'し', 'す', 'せ', 'そ'], 'つ': ['た', 'ち', 'つ', 'て', 'と'], 'ぬ': ['な', 'に', 'ぬ', 'ね', 'の'],
  'ぶ': ['ば', 'び', 'ぶ', 'べ', 'ぼ'], 'む': ['ま', 'み', 'む', 'め', 'も'], 'る': ['ら', 'り', 'る', 'れ', 'ろ'],
};
const TE = { 'う': 'って', 'つ': 'って', 'る': 'って', 'む': 'んで', 'ぶ': 'んで', 'ぬ': 'んで', 'く': 'いて', 'ぐ': 'いで', 'す': 'して' };
const toTa = (te) => te.slice(0, -1) + (te.endsWith('で') ? 'だ' : 'た');

function godan(w, f) {
  const last = w.r.slice(-1), R = ROWS[last];
  if (!R) return null;
  const rs = w.r.slice(0, -1), ws = w.w.slice(0, -1);
  const real = w.t === '1';
  const aru = real && w.f.aru;
  const [a, i, , e, o] = R;
  const te = (real && w.f.iku) ? 'って' : TE[last];
  const ta = toTa(te);
  const mk = (s, note) => ({ k: rs + s, j: ws + s, note });
  switch (f) {
    case 'masu': return [mk(i + 'ます')];
    case 'masen': return [mk(i + 'ません')];
    case 'mashita': return [mk(i + 'ました')];
    case 'masendeshita': return [mk(i + 'ませんでした')];
    case 'mashou': return [mk(i + 'ましょう')];
    case 'tai': return [mk(i + 'たい')];
    case 'nai': return aru ? [{ k: 'ない', j: 'ない' }] : [mk(a + 'ない')];
    case 'nakatta': return aru ? [{ k: 'なかった', j: 'なかった' }] : [mk(a + 'なかった')];
    case 'te': return [mk(te)];
    case 'ta': return [mk(ta)];
    case 'tara': return [mk(ta + 'ら')];
    case 'pot': return [mk(e + 'る')];
    case 'pass': return [mk(a + 'れる')];
    case 'caus': return [mk(a + 'せる')];
    case 'causpass': return last === 'す' ? [mk(a + 'せられる')] : [mk(a + 'される'), mk(a + 'せられる')];
    case 'vol': return [mk(o + 'う')];
    case 'imp': return [mk(e)];
    case 'proh': return [mk(last + 'な')];
    case 'ba': return [mk(e + 'ば')];
  }
  return null;
}

const ICHI = { masu: 'ます', masen: 'ません', mashita: 'ました', masendeshita: 'ませんでした', mashou: 'ましょう', tai: 'たい', nai: 'ない', nakatta: 'なかった', te: 'て', ta: 'た', tara: 'たら', pass: 'られる', caus: 'させる', causpass: 'させられる', vol: 'よう', proh: 'るな', ba: 'れば' };
function ichidan(w, f) {
  if (!w.r.endsWith('る')) return null;
  const rs = w.r.slice(0, -1), ws = w.w.slice(0, -1);
  const mk = (s, note) => ({ k: rs + s, j: ws + s, note });
  if (f === 'pot') return [mk('られる'), mk('れる', '「ら抜き」口语说法，考试请写「られる」')];
  if (f === 'imp') return [mk('ろ'), mk('よ', '书面语说法')];
  return ICHI[f] ? [mk(ICHI[f])] : null;
}

const SURU = { masu: 'します', masen: 'しません', mashita: 'しました', masendeshita: 'しませんでした', mashou: 'しましょう', tai: 'したい', nai: 'しない', nakatta: 'しなかった', te: 'して', ta: 'した', tara: 'したら', pot: 'できる', pass: 'される', caus: 'させる', causpass: 'させられる', vol: 'しよう', imp: 'しろ', proh: 'するな', ba: 'すれば' };
function suru(w, f) {
  const pr = w.r.slice(0, -2), pw = w.w.slice(0, -2);
  const s = SURU[f]; if (!s) return null;
  const out = [{ k: pr + s, j: pw + s }];
  if (f === 'imp') out.push({ k: pr + 'せよ', j: pw + 'せよ', note: '书面语说法' });
  return out;
}

const KURU = { masu: 'きます', masen: 'きません', mashita: 'きました', masendeshita: 'きませんでした', mashou: 'きましょう', tai: 'きたい', nai: 'こない', nakatta: 'こなかった', te: 'きて', ta: 'きた', tara: 'きたら', pot: 'こられる', pass: 'こられる', caus: 'こさせる', causpass: 'こさせられる', vol: 'こよう', imp: 'こい', proh: 'くるな', ba: 'くれば' };
function kuru(w, f) {
  const pr = w.r.slice(0, -2), pw = w.w.slice(0, -2);
  const mk = (s, note) => ({ k: pr + s, j: pw + '来' + s.slice(1), alt: pw !== pr ? pw + s : null, note });
  if (!KURU[f]) return null;
  const out = [mk(KURU[f])];
  if (f === 'pot') out.push(mk('これる', '「ら抜き」口语说法，考试请写「こられる」'));
  return out;
}

function iadj(w, f) {
  if (!w.r.endsWith('い')) return null;
  const ii = w.t === 'i' && w.f.ii;
  const rs = ii ? w.r.slice(0, -2) + 'よ' : w.r.slice(0, -1);
  const ws = ii ? w.w.slice(0, -2) + 'よ' : w.w.slice(0, -1);
  const mk = (s, note) => ({ k: rs + s, j: ws + s, note });
  switch (f) {
    case 'aneg': return [mk('くない')];
    case 'apast': return [mk('かった')];
    case 'apastneg': return [mk('くなかった')];
    case 'ate': return [mk('くて')];
    case 'aadv': return [mk('く')];
    case 'apneg': return [mk('くないです'), mk('くありません')];
    case 'appast': return [mk('かったです')];
    case 'appastneg': return [mk('くなかったです'), mk('くありませんでした')];
    case 'aba': return [mk('ければ')];
    case 'atara': return [mk('かったら')];
    case 'anaru': return [mk('くなる')];
    case 'asou': return [mk(ii ? 'さそう' : 'そう')];
    case 'aattr': return [{ k: w.r, j: w.w }];
  }
  return null;
}

function naadj(w, f) {
  const mk = (s, note) => ({ k: w.r + s, j: w.w + s, note });
  switch (f) {
    case 'aneg': return [mk('じゃない'), mk('ではない')];
    case 'apast': return [mk('だった')];
    case 'apastneg': return [mk('じゃなかった'), mk('ではなかった')];
    case 'ate': return [mk('で')];
    case 'aadv': return [mk('に')];
    case 'apneg': return [mk('じゃないです'), mk('じゃありません'), mk('ではありません'), mk('ではないです')];
    case 'appast': return [mk('でした')];
    case 'appastneg': return [mk('じゃなかったです'), mk('じゃありませんでした'), mk('ではありませんでした'), mk('ではなかったです')];
    case 'aba': return [mk('なら'), mk('ならば'), mk('であれば')];
    case 'atara': return [mk('だったら')];
    case 'anaru': return [mk('になる')];
    case 'asou': return [mk('そう')];
    case 'aattr': return [mk('な')];
  }
  return null;
}

function conj(w, f, t = w.t) {
  if (t === w.t && f === 'imp' && w.f.imp) return [{ k: w.f.imp, j: w.f.imp }];
  switch (t) {
    case '1': return godan(w, f);
    case '2': return ichidan(w, f);
    case 's': return suru(w, f);
    case 'k': return kuru(w, f);
    case 'i': return iadj(w, f);
    case 'n': return naadj(w, f);
  }
  return null;
}

function formsFor(w) {
  const kind = isVerb(w) ? 'v' : 'a';
  return FORM_KEYS.filter(f => FORMS[f].kind === kind && !w.x.has(f));
}

const spellings = (a) => [a.k, a.j, a.alt].filter(Boolean).map(norm);
function matches(list, u) { return !!list && list.some(a => spellings(a).includes(u)); }

// ---- 类别题 ----
function classAnswer(w) { return isVerb(w) ? clsKey(w) : w.t; }
const CLASS_CHOICES = {
  v: [['1', '一类动词', '五段'], ['2', '二类动词', '一段'], ['3', '三类动词', 'サ变・カ变']],
  a: [['i', 'い形容词', ''], ['n', 'な形容词', '']],
};

// ---- 判定 ----
function check(w, f, input) {
  const u = norm(input);
  if (!u) return { ok: false, empty: true };
  const list = conj(w, f);
  const hit = list.find(a => spellings(a).includes(u));
  return { ok: !!hit, hit, list };
}

// ---- 讲解 ----
function twinNote(w) {
  if (!isVerb(w) || (w.t !== '1' && w.t !== '2')) return '';
  const o = WORDS.find(x => x !== w && x.r === w.r && (x.t === '1' || x.t === '2') && x.t !== w.t);
  return o ? `同音的「${o.w}」（${o.m}）是${TYPE_NAME[o.t]}，别搞混：${w.w}→${conj(w, 'nai')[0].j}，${o.w}→${conj(o, 'nai')[0].j}。` : '';
}

function classReason(w) {
  const prev = w.r.slice(-2, -1), v = vowelOf(prev);
  switch (w.t) {
    case 'k': return w.r === 'くる' ? '「来る」是三类动词（カ变），只有这一个，单独记。读音会在 こ／き／く 之间变。' : `「${w.w}」的后半是「来る」，按三类动词（カ变）变化。`;
    case 's': return w.r === 'する' ? '「する」是三类动词（サ变），单独记。' : '「名词＋する」都是三类动词（サ变），变法和「する」完全一样。';
    case '1':
      if (!w.r.endsWith('る')) return `词尾是「${w.r.slice(-1)}」，不是「る」→ 一类动词（五段）。`;
      if (v === 'i' || v === 'e') return `「る」前面是「${prev}」（${VNAME[v]}），看起来像二类，其实是一类的例外，要单独记。`;
      return `「る」前面是「${prev}」（${VNAME[v]}）→ 一类动词（五段）。`;
    case '2': return `「る」前面是「${prev}」（${VNAME[v]}）→ 二类动词（一段）。`;
    case 'i':
      if (w.f.ii) return w.r === 'いい' ? '「いい」是い形容词，但变形时要换成「よい」来变：よくない、よかった。' : `「${w.w}」末尾的「いい」变形时要换成「よ」：${w.r.slice(0, -2)}よくない。`;
      return '以「い」结尾 → い形容词。';
    case 'n':
      return w.r.endsWith('い') ? `注意：读音以「い」结尾，但「${w.w}」是な形容词（高频易错）。` : `「${w.w}」是な形容词，修饰名词时加「な」。`;
  }
  return '';
}

const MASU_SUF = { masu: 'ます', masen: 'ません', mashita: 'ました', masendeshita: 'ませんでした', mashou: 'ましょう', tai: 'たい' };
const TE_GROUP = (last) => ({
  'く': '「く」结尾 → いて', 'ぐ': '「ぐ」结尾 → いで', 'す': '「す」结尾 → して',
  'う': '「う・つ・る」结尾 → って', 'つ': '「う・つ・る」结尾 → って', 'る': '「う・つ・る」结尾 → って',
  'む': '「む・ぶ・ぬ」结尾 → んで', 'ぶ': '「む・ぶ・ぬ」结尾 → んで', 'ぬ': '「む・ぶ・ぬ」结尾 → んで',
}[last]);

function ruleText(w, f) {
  const L = FORMS[f].label;
  if (w.t === '1') {
    const last = w.r.slice(-1), [a, i, , e, o] = ROWS[last];
    const wa = last === 'う' ? '注意：「う」结尾时，あ段用「わ」，不是「あ」。' : '';
    if (MASU_SUF[f]) return `一类：词尾「${last}」→ い段「${i}」，再接「${MASU_SUF[f]}」。`;
    if (f === 'nai' || f === 'nakatta') {
      if (w.f.aru) return '「ある」是特例：否定直接说「ない」，过去否定说「なかった」，不说「あらない」。';
      return `一类：词尾「${last}」→ あ段「${a}」，再接「${f === 'nai' ? 'ない' : 'なかった'}」。${wa}`;
    }
    if (f === 'te' || f === 'ta' || f === 'tara') {
      if (w.f.iku) return `「行く」是特例：て形是「行って」，た形是「行った」，不按「く→いて」变。${f === 'tara' ? 'たら形＝た形＋ら。' : ''}`;
      const g = TE_GROUP(last);
      if (f === 'te') return `一类て形要音便：${g}。`;
      if (f === 'ta') return `一类た形和て形规则相同，把て换成た（で换成だ）：${g.replace('いて', 'いた').replace('いで', 'いだ').replace('して', 'した').replace('って', 'った').replace('んで', 'んだ')}。`;
      return `たら形＝た形＋ら。一类た形：${g.replace('いて', 'いた').replace('いで', 'いだ').replace('して', 'した').replace('って', 'った').replace('んで', 'んだ')}。`;
    }
    if (f === 'pot') return `一类：词尾「${last}」→ え段「${e}」，再接「る」。变成的可能动词按二类继续变：${conj(w, 'pot')[0].j.slice(0, -1)}ない。`;
    if (f === 'pass') return `一类：词尾「${last}」→ あ段「${a}」，再接「れる」。${wa}`;
    if (f === 'caus') return `一类：词尾「${last}」→ あ段「${a}」，再接「せる」。${wa}`;
    if (f === 'causpass') return last === 'す' ? `一类：词尾「す」→ あ段「さ」，再接「せられる」。「す」结尾的动词不能缩短成「〜される」。` : `一类：词尾「${last}」→ あ段「${a}」＋「せられる」，口语更常缩成「${a}される」，两种都对。${wa}`;
    if (f === 'vol') return `一类：词尾「${last}」→ お段「${o}」，再接「う」。`;
    if (f === 'imp') return `一类：词尾「${last}」→ え段「${e}」。`;
    if (f === 'proh') return '所有动词的禁止形都是：辞书形＋「な」。';
    if (f === 'ba') return `一类：词尾「${last}」→ え段「${e}」，再接「ば」。`;
  }
  if (w.t === '2') {
    if (MASU_SUF[f]) return `二类：去掉「る」，直接接「${MASU_SUF[f]}」。`;
    if (f === 'nai' || f === 'nakatta') return `二类：去掉「る」，直接接「${f === 'nai' ? 'ない' : 'なかった'}」。`;
    if (f === 'te' || f === 'ta') return `二类：去掉「る」，接「${f === 'te' ? 'て' : 'た'}」，没有音便。`;
    if (f === 'tara') return '二类：去掉「る」＋「たら」。';
    if (f === 'pot') return '二类：去掉「る」＋「られる」。口语常省成「れる」（ら抜き），考试写「られる」最稳。二类的可能形和被动形同形，靠上下文区分。';
    if (f === 'pass') return '二类：去掉「る」＋「られる」。它和二类的可能形同形，靠上下文区分。';
    if (f === 'caus') return '二类：去掉「る」＋「させる」。';
    if (f === 'causpass') return '二类：去掉「る」＋「させられる」，不能缩短。';
    if (f === 'vol') return '二类：去掉「る」＋「よう」。';
    if (f === 'imp') return w.f.imp ? `「${w.w}」的命令形是特例「${w.f.imp}」。` : '二类：去掉「る」＋「ろ」（书面语用「よ」）。';
    if (f === 'proh') return '所有动词的禁止形都是：辞书形＋「な」。';
    if (f === 'ba') return '二类：「る」→「れ」，再接「ば」。';
  }
  if (w.t === 's') {
    let s = `「する」不规则，${L}是「${SURU[f]}」${w.r === 'する' ? '' : `，前面的「${w.w.slice(0, -2)}」不变`}。`;
    if (f === 'pot') s += '「する」的可能形是另一个词「できる」，不说「しれる」。';
    return s;
  }
  if (w.t === 'k') return `「来る」不规则，${L}读作「${KURU[f]}」。汉字都写「来」，读音在 こ／き／く 之间变：こない・きます・くれば。`;
  if (w.t === 'i') {
    const p = w.f.ii ? '先把「いい」换成「よ」，' : '';
    const A = {
      aneg: '去掉词尾「い」＋「くない」。', apast: '去掉「い」＋「かった」。', apastneg: '去掉「い」＋「くなかった」。',
      ate: '去掉「い」＋「くて」。', aadv: '去掉「い」＋「く」，用来修饰动词：早く起きる。',
      apneg: '去掉「い」＋「くないです」，更正式可说「くありません」。', appast: '去掉「い」＋「かったです」。不能说「〜いでした」。',
      appastneg: '去掉「い」＋「くなかったです」或「くありませんでした」。', aba: '去掉「い」＋「ければ」。',
      atara: '去掉「い」＋「かったら」（过去形＋ら）。', anaru: '去掉「い」＋「く」，再接「なる」，表示变化。',
      asou: w.f.ii ? '「いい」的样态是特例「よさそう」。' : '去掉「い」＋「そう」，表示「看起来…」。',
      aattr: 'い形容词直接修饰名词，不加「な」：高い山。',
    };
    if (f === 'asou' || f === 'aattr') return 'い形容词：' + A[f];
    return 'い形容词：' + p + A[f];
  }
  if (w.t === 'n') {
    const A = {
      aneg: '词干＋「じゃない」（书面语「ではない」）。', apast: '词干＋「だった」。', apastneg: '词干＋「じゃなかった」（书面语「ではなかった」）。',
      ate: '词干＋「で」。', aadv: '词干＋「に」，用来修饰动词：静かに話す。',
      apneg: '词干＋「じゃないです」，也可以说「じゃありません／ではありません」。', appast: '词干＋「でした」。',
      appastneg: '词干＋「じゃなかったです」，也可以说「じゃありませんでした」。', aba: '词干＋「なら」（也可「ならば」「であれば」）。',
      atara: '词干＋「だったら」。', anaru: '词干＋「に」，再接「なる」，表示变化。', asou: '词干＋「そう」，表示「看起来…」。',
      aattr: '修饰名词时要加「な」：静かな部屋。',
    };
    return 'な形容词：' + A[f];
  }
  return '';
}

function explain(w, f) {
  if (f === 'vclass' || f === 'aclass') {
    return { cls: classReason(w), twin: twinNote(w) };
  }
  return { cls: classReason(w), rule: ruleText(w, f), twin: twinNote(w) };
}

// ---- 错因诊断 ----
function teVariants(w, f) {
  const rs = w.r.slice(0, -1), ws = w.w.slice(0, -1);
  const out = [];
  for (const te of ['いて', 'いで', 'して', 'って', 'んで']) {
    const s = f === 'te' ? te : f === 'ta' ? toTa(te) : toTa(te) + 'ら';
    out.push({ k: rs + s, j: ws + s });
  }
  return out;
}
function waVariant(w, f) {
  if (w.t !== '1' || !w.r.endsWith('う')) return null;
  if (!['nai', 'nakatta', 'pass', 'caus', 'causpass'].includes(f)) return null;
  const n = w.r.length - 1;
  return conj(w, f).map(a => ({ k: a.k.slice(0, n) + 'あ' + a.k.slice(n + 1), j: a.j.slice(0, w.w.length - 1) + 'あ' + a.j.slice(w.w.length) }));
}
function naAsI(w, f) { // 静か → 静かくない 这种错
  if (w.t !== 'n' || w.r.endsWith('い')) return null;
  return iadj({ ...w, t: 'x', r: w.r + 'い', w: w.w + 'い' }, f);
}

function simulations(w, f) {
  const sims = [];
  if (w.t === '1' && w.f.aru) sims.push([godan({ ...w, t: 'x' }, f), '「ある」是特例：否定直接说「ない」，不说「あらない」。']);
  if (w.t === '1' && w.r.endsWith('る')) sims.push([conj(w, f, '2'), `你按二类动词（去掉「る」）变了。「${w.w}」是一类动词${['i', 'e'].includes(vowelOf(w.r.slice(-2, -1))) ? '，属于「る前是い/え段」的例外' : ''}。`]);
  if (w.t === '2') sims.push([conj(w, f, '1'), `你按一类动词变了。「${w.w}」是二类动词，去掉「る」直接接。`]);
  if (w.t === 'k') { sims.push([ichidan(w, f), '「来る」不能当二类动词变，它的读音会变：こない・きます・くれば。'], [godan(w, f), '「来る」不能当一类动词变，它是不规则的三类动词。']); }
  if (w.t === 's') sims.push([godan({ ...w, t: 'x' }, f), '「する」不能当一类动词变，它是不规则的三类动词。']);
  if (w.t === 'n' && w.r.endsWith('い')) sims.push([iadj({ ...w, t: 'x' }, f), `你把它当成い形容词了。「${w.w}」虽然以「い」结尾，却是な形容词。`]);
  if (w.t === 'n') sims.push([naAsI(w, f), `「${w.w}」是な形容词，不能接「く／かった」这类い形容词的词尾。`]);
  if (w.t === 'i') sims.push([naadj({ ...w, t: 'x' }, f), `你按な形容词变了。「${w.w}」是い形容词，要把词尾「い」变掉。`]);
  if (w.t === 'i' && w.f.ii) sims.push([iadj({ ...w, t: 'x', f: {} }, f), '「いい」变形时要先换成「よ」：よくない、よかった，不说「いくない」。']);
  if (w.t === '1' && ['te', 'ta', 'tara'].includes(f)) sims.push([teVariants(w, f), `て形（た形）音便记混了：${w.f.iku ? '「行く」是特例 → 行って' : TE_GROUP(w.r.slice(-1))}。`]);
  sims.push([waVariant(w, f), '「う」结尾的一类动词，あ段要用「わ」：買わない、言われる。']);
  return sims.filter(s => s[0]);
}

function diagnose(w, f, input) {
  const u = norm(input);
  if (!u) return '';
  if (w.t === 'i' && f === 'appast' && (u === norm(w.r + 'でした') || u === norm(w.w + 'でした'))) return 'い形容词的敬体过去是「〜かったです」，不能说「〜いでした」。';
  if (w.t === 'n' && f === 'aattr' && (u === norm(w.r) || u === norm(w.w))) return 'な形容词修饰名词时要加「な」。';
  for (const [list, msg] of simulations(w, f)) if (matches(list, u)) return msg;
  for (const g of formsFor(w)) {
    if (g === f || g === 'vclass' || g === 'aclass') continue;
    if (matches(conj(w, g), u)) return `你写的是「${FORMS[g].label}」，这题要的是「${FORMS[f].label}」。`;
  }
  return '';
}

// ---- 选择题干扰项 ----
const CONFUSE = {
  pot: ['pass', 'caus'], pass: ['pot', 'causpass', 'caus'], caus: ['pass', 'causpass'], causpass: ['caus', 'pass'],
  nai: ['nakatta', 'masen'], nakatta: ['nai', 'ta'], ta: ['te', 'tara'], te: ['ta', 'tara'], tara: ['ba', 'ta'], ba: ['tara', 'vol'],
  vol: ['mashou', 'imp'], mashou: ['vol', 'masu'], imp: ['vol', 'proh'], proh: ['imp', 'nai'], masu: ['mashou', 'masen'],
  masen: ['masendeshita', 'nai'], mashita: ['masu', 'ta'], masendeshita: ['masen', 'nakatta'], tai: ['masu', 'vol'],
  aneg: ['apastneg', 'apneg'], apast: ['appast', 'apastneg'], apastneg: ['apast', 'aneg'], ate: ['aadv', 'anaru'], aadv: ['ate', 'anaru'],
  apneg: ['aneg', 'appastneg'], appast: ['apast', 'appastneg'], appastneg: ['appast', 'apneg'], aba: ['atara', 'apast'], atara: ['aba', 'apast'],
  anaru: ['aadv', 'ate'], asou: ['aattr', 'aadv'], aattr: ['asou', 'aadv'],
};
function display(w, a) { return w.t === 'k' ? a.k : a.j; }
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

function choicesFor(w, f) {
  const correct = conj(w, f);
  const bad = new Set(correct.flatMap(spellings));
  const seen = new Set();
  const out = [];
  const add = (a) => {
    if (!a || out.length >= 3) return;
    const d = display(w, a); const n = norm(d);
    if (!d || bad.has(n) || bad.has(norm(a.k)) || seen.has(n)) return;
    seen.add(n); out.push(d);
  };
  const sims = simulations(w, f);
  // 优先：同一变形、错误类别的结果
  sims.forEach(([list]) => shuffle([...list]).slice(0, 2).forEach(add));
  (CONFUSE[f] || []).filter(g => !w.x.has(g) || true).forEach(g => (conj(w, g) || []).slice(0, 1).forEach(add));
  shuffle(formsFor(w).filter(g => g !== f && FORMS[g].g !== '类别')).forEach(g => (conj(w, g) || []).slice(0, 1).forEach(add));
  const opts = shuffle([display(w, correct[0]), ...out.slice(0, 3)]);
  return opts;
}

