// ===== 页面 =====
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const isClassQ = (f) => f === 'vclass' || f === 'aclass';

  // ---- 罗马字 → 平假名 ----
  const RJ = {
    a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
    ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ', kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
    ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご', gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
    sa: 'さ', si: 'し', shi: 'し', su: 'す', se: 'せ', so: 'そ', sha: 'しゃ', shu: 'しゅ', she: 'しぇ', sho: 'しょ', sya: 'しゃ', syu: 'しゅ', syo: 'しょ',
    za: 'ざ', zi: 'じ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ', ja: 'じゃ', ju: 'じゅ', je: 'じぇ', jo: 'じょ', jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ', zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ',
    ta: 'た', ti: 'ち', chi: 'ち', tu: 'つ', tsu: 'つ', te: 'て', to: 'と', cha: 'ちゃ', chu: 'ちゅ', che: 'ちぇ', cho: 'ちょ', tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ', cya: 'ちゃ', cyu: 'ちゅ', cyo: 'ちょ',
    da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
    na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の', nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
    ha: 'は', hi: 'ひ', hu: 'ふ', fu: 'ふ', he: 'へ', ho: 'ほ', hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ', fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ',
    ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ', bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
    pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ', pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
    ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も', mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
    ya: 'や', yu: 'ゆ', yo: 'よ',
    ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ', rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
    wa: 'わ', wo: 'を', wi: 'うぃ', we: 'うぇ', vu: 'ゔ',
    xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ', xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', xtu: 'っ', xtsu: 'っ',
    la: 'ぁ', li: 'ぃ', lu: 'ぅ', le: 'ぇ', lo: 'ぉ', lya: 'ゃ', lyu: 'ゅ', lyo: 'ょ', ltu: 'っ', ltsu: 'っ',
    '-': 'ー',
  };
  function romaji(src, final) {
    const s = src.replace(/[A-Z]/g, c => c.toLowerCase());
    let out = '', i = 0;
    while (i < s.length) {
      const c = s[i];
      if (!/[a-z\-']/.test(c)) { out += c; i++; continue; }
      if (c === "'") { i++; continue; }
      if (c === 'n') {
        const nx = s[i + 1];
        if (nx === undefined) { out += final ? 'ん' : 'n'; i++; continue; }
        if (nx === "'") { out += 'ん'; i += 2; continue; }
        if (nx === 'n') {
          const n2 = s[i + 2];
          if (n2 && /[aiueoy]/.test(n2)) { out += 'ん'; i += 1; continue; }
          out += 'ん'; i += 2; continue;
        }
        if (!/[aiueoy]/.test(nx)) { out += 'ん'; i++; continue; }
      }
      if (c !== 'n' && /[bcdfghjkmpqrstvwxyz]/.test(c) && s[i + 1] === c) { out += 'っ'; i++; continue; }
      if (c === 't' && s[i + 1] === 'c' && s[i + 2] === 'h') { out += 'っ'; i++; continue; }
      let m = null;
      for (const L of [4, 3, 2, 1]) { const sub = s.substr(i, L); if (RJ[sub]) { m = sub; break; } }
      if (m) { out += RJ[m]; i += m.length; continue; }
      out += c; i++;
    }
    return out;
  }

  // ---- 存档（只存在本机浏览器） ----
  const KEY = 'katsuyo-renshucho-v1';
  const DEFAULTS = {
    levels: [5, 4], classes: ['1', '2', '3', 'i', 'n'],
    forms: ['masu', 'masen', 'nai', 'ta', 'te', 'vclass', 'aneg', 'apast', 'ate', 'aattr', 'aclass'],
    mode: 'type', hint: false,
  };
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o) return { settings: { ...DEFAULTS, ...o.settings }, stats: o.stats || {}, best: o.best || 0, mistakes: o.mistakes || [] };
    } catch (e) { }
    return { settings: { ...DEFAULTS, levels: [...DEFAULTS.levels], classes: [...DEFAULTS.classes], forms: [...DEFAULTS.forms] }, stats: {}, best: 0, mistakes: [] };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
  const S = load();

  const session = { c: 0, n: 0, streak: 0, q: 0 };
  let recent = [];
  let cur = null;
  let drill = false;

  // ---- 题库筛选 ----
  function eligibleForms(w) { const set = new Set(S.settings.forms); return formsFor(w).filter(f => set.has(f)); }
  function pool() {
    const L = new Set(S.settings.levels.map(Number)), C = new Set(S.settings.classes);
    return WORDS.filter(w => L.has(w.lvl) && C.has(clsKey(w)) && eligibleForms(w).length);
  }

  // ---- 设置面板 ----
  const CLASSES = [['1', '一类动词'], ['2', '二类动词'], ['3', '三类动词'], ['i', 'い形容词'], ['n', 'な形容词']];
  function chip(id, value, label, checked, count) {
    return `<label class="chip"><input type="checkbox" id="${id}" value="${value}"${checked ? ' checked' : ''}><span>${label}${count != null ? `<small>${count}</small>` : ''}</span></label>`;
  }
  function buildSettings() {
    const lv = [5, 4, 3, 2, 1];
    $('#levels').innerHTML = lv.map(l => chip('lv-' + l, l, 'N' + l, S.settings.levels.includes(l), WORDS.filter(w => w.lvl === l).length)).join('');
    $('#classes').innerHTML = CLASSES.map(([k, n]) => chip('cl-' + k, k, n, S.settings.classes.includes(k), WORDS.filter(w => clsKey(w) === k).length)).join('');
    for (const kind of ['v', 'a']) {
      const groups = {};
      FORM_KEYS.filter(f => FORMS[f].kind === kind).forEach(f => (groups[FORMS[f].g] = groups[FORMS[f].g] || []).push(f));
      $(kind === 'v' ? '#vforms' : '#aforms').innerHTML = Object.entries(groups).map(([g, fs]) =>
        `<div class="subgroup"><span>${g}</span><div class="chips">${fs.map(f => chip('f-' + f, f, `<span lang="ja">${FORMS[f].label}</span>`, S.settings.forms.includes(f))).join('')}</div></div>`).join('');
    }
    $('#mode-' + S.settings.mode).checked = true;
    $('#hint').checked = !!S.settings.hint;
  }
  function readSettings() {
    S.settings.levels = [...document.querySelectorAll('#levels input:checked')].map(i => +i.value);
    S.settings.classes = [...document.querySelectorAll('#classes input:checked')].map(i => i.value);
    S.settings.forms = [...document.querySelectorAll('#vforms input:checked, #aforms input:checked')].map(i => i.value);
    S.settings.mode = document.querySelector('input[name="mode"]:checked')?.value || 'type';
    S.settings.hint = $('#hint').checked;
  }
  function renderSummary() {
    const st = S.settings;
    const lv = st.levels.slice().sort((a, b) => b - a).map(l => 'N' + l).join('・') || '未选级别';
    const nf = st.forms.length;
    const p = pool().length;
    $('#sumText').textContent = `${lv} ｜ ${st.classes.length} 类词 ｜ ${nf} 种变形 ｜ ${st.mode === 'type' ? '打字' : '四选一'} ｜ 题库 ${p} 词`;
  }
  $('#setup').addEventListener('change', (e) => {
    const t = e.target;
    readSettings(); save(); renderSummary();
    if (t.name === 'mode' || t.id === 'hint') { if (cur && !cur.done) renderQuestion(); return; }
    if (!drill && (!cur || !cur.done)) {
      if (!cur || !pool().includes(cur.w) || !eligibleForms(cur.w).includes(cur.f)) nextQuestion(false);
    }
  });
  $('#setup').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-all], button[data-none]');
    if (!b) return;
    const id = b.dataset.all || b.dataset.none;
    document.querySelectorAll('#' + id + ' input').forEach(i => { i.checked = !!b.dataset.all; });
    $('#setup').dispatchEvent(new Event('change'));
  });

  // ---- 出题 ----
  function nextQuestion(count = true, focus = count) {
    let w, f;
    if (drill) {
      const items = S.mistakes.map(m => ({ m, w: WORDS.find(x => x.key === m.key) })).filter(o => o.w);
      if (!items.length) { drill = false; renderReview(); }
      else {
        let cand = items.filter(o => !(cur && o.w === cur.w && o.m.f === cur.f));
        if (!cand.length) cand = items;
        const o = rand(cand); w = o.w; f = o.m.f;
      }
    }
    if (!drill) {
      const P = pool();
      if (!P.length) { cur = null; renderEmpty(); return; }
      let cand = P.filter(x => !recent.includes(x.id));
      if (!cand.length) cand = P;
      w = rand(cand); f = rand(eligibleForms(w));
      recent.push(w.id);
      while (recent.length > Math.min(15, Math.floor(P.length / 2))) recent.shift();
    }
    if (count) session.q++;
    cur = { w, f, done: false, choices: null };
    renderQuestion(focus);
  }

  function renderEmpty() {
    $('#sheet').innerHTML = `<div class="empty"><strong>当前设置下没有可练的题</strong>至少选一个级别和一个词类，并选上对应的变形：动词变形只出给动词，形容词变形只出给形容词。</div>`;
  }

  function taskHTML(w, f) {
    const F = FORMS[f];
    if (isClassQ(f)) return `<div class="task"><span class="to">判断</span><strong>它属于哪一类？</strong></div>`;
    return `<div class="task"><span class="to">变成</span><strong lang="ja">${F.label}</strong><span class="ex">${F.sub ? esc(F.sub) + ' · ' : ''}例 <span lang="ja">${esc(F.ex)}</span></span></div>`;
  }

  function renderQuestion(focus) {
    const { w, f } = cur;
    const showCls = S.settings.hint && !isClassQ(f);
    const yomi = w.w !== w.r ? w.r : '';
    const choiceMode = isClassQ(f) || S.settings.mode === 'choice';
    if (choiceMode && !cur.choices) {
      cur.choices = isClassQ(f)
        ? CLASS_CHOICES[isVerb(w) ? 'v' : 'a'].map(([v, l, s]) => ({ v, html: `${l}${s ? `<small>${s}</small>` : ''}`, ja: false }))
        : choicesFor(w, f).map(d => ({ v: d, html: esc(d), ja: true }));
    }
    $('#sheet').innerHTML = `
      <div class="q-head">
        <span class="tag lvl">N${w.lvl}</span>
        <span class="tag cls${showCls ? '' : ' hidden-cls'}">${showCls ? TYPE_NAME[w.t] : (isVerb(w) ? '动词' : '形容词')}</span>
        ${drill ? '<span class="drill-flag">错题重练</span>' : ''}
        <span class="qno">No.${session.q}</span>
      </div>
      <div class="q-word">
        <div class="yomi" lang="ja">${esc(yomi)}</div>
        <div class="kanji" lang="ja">${esc(w.w)}</div>
        <div class="imi">${esc(w.m)}</div>
      </div>
      ${taskHTML(w, f)}
      ${choiceMode
        ? `<div class="choices${cur.choices.length === 3 ? ' three' : ''}" id="choices">${cur.choices.map((c, i) =>
            `<button type="button" class="choice" data-i="${i}"><kbd>${i + 1}</kbd><span class="txt"${c.ja ? ' lang="ja"' : ''}>${c.html}</span></button>`).join('')}</div>`
        : `<form class="answer" id="ansForm" autocomplete="off">
             <input id="ans" lang="ja" inputmode="text" enterkeyhint="go" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="写假名、汉字或罗马字" aria-label="你的答案">
             <button class="btn" type="submit">判定</button>
           </form>
           <div class="hint-line">罗马字会自动转成假名，例如 kaeranai → かえらない</div>`}
      <div id="result" hidden></div>`;
    if (choiceMode) {
      $('#choices').addEventListener('click', (e) => {
        const b = e.target.closest('.choice'); if (!b || cur.done) return;
        pick(+b.dataset.i);
      });
    } else {
      const inp = $('#ans');
      inp.addEventListener('input', (e) => {
        if (e.isComposing || !/[A-Za-z'\-]/.test(inp.value)) return;
        const v = romaji(inp.value, false);
        if (v !== inp.value) { inp.value = v; inp.setSelectionRange(v.length, v.length); }
      });
      $('#ansForm').addEventListener('submit', (e) => {
        e.preventDefault();
        if (cur.done) { nextQuestion(); return; }
        const v = romaji(inp.value, true); inp.value = v;
        if (!norm(v)) { const fm = $('#ansForm'); fm.classList.remove('shake'); void fm.offsetWidth; fm.classList.add('shake'); inp.focus(); return; }
        grade(v);
      });
      if (focus) inp.focus({ preventScroll: true });
    }
  }

  function pick(i) {
    const c = cur.choices[i]; if (!c) return;
    const btns = document.querySelectorAll('.choice');
    grade(c.v, i);
    const rightIdx = cur.choices.findIndex(x => isClassQ(cur.f) ? x.v === classAnswer(cur.w) : check(cur.w, cur.f, x.v).ok);
    btns.forEach((b, k) => { b.disabled = true; if (k === rightIdx) b.classList.add('right'); else if (k === i) b.classList.add('wrong'); });
  }

  // ---- 判定与反馈 ----
  function grade(ans) {
    const { w, f } = cur;
    cur.done = true;
    let ok, hit = null, list = null;
    if (isClassQ(f)) ok = ans === classAnswer(w);
    else { const r = check(w, f, ans); ok = r.ok; hit = r.hit; list = r.list; }

    session.n++;
    if (ok) { session.c++; session.streak++; if (session.streak > S.best) S.best = session.streak; } else session.streak = 0;
    const st = S.stats[f] || (S.stats[f] = { c: 0, n: 0 }); st.n++; if (ok) st.c++;
    const idx = S.mistakes.findIndex(m => m.key === w.key && m.f === f);
    if (idx >= 0) S.mistakes.splice(idx, 1);
    if (!ok) { S.mistakes.unshift({ key: w.key, f, u: ans, t: Date.now() }); S.mistakes = S.mistakes.slice(0, 80); }
    save();

    const form = $('#ansForm'); if (form) { $('#ans').readOnly = true; form.querySelector('button').hidden = true; const hl = document.querySelector('.hint-line'); if (hl) hl.hidden = true; }
    renderResult(ok, ans, hit, list);
    renderScore(); renderReview();
  }

  const SVG_MARU = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M22 13 C38 4 59 14 56 34 C53 53 29 61 15 48 C4 38 8 20 27 11" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>';
  const SVG_BATSU = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M17 15 L48 50 M49 14 L16 49" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/></svg>';
  function svgHanamaru() {
    const N = 9, R = 24; let d = '';
    for (let k = 0; k < N; k++) {
      const a1 = (k / N) * 2 * Math.PI - Math.PI / 2, a2 = ((k + 1) / N) * 2 * Math.PI - Math.PI / 2;
      const p = (a) => `${(32 + R * Math.cos(a)).toFixed(1)} ${(32 + R * Math.sin(a)).toFixed(1)}`;
      d += (k === 0 ? `M${p(a1)}` : '') + ` A8.6 8.6 0 0 1 ${p(a2)}`;
    }
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/><path d="M32 32 a3 3 0 0 1 6 0 a6 6 0 0 1 -12 0 a9 9 0 0 1 18 0 a12 12 0 0 1 -24 0" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>`;
  }

  function highlight(w, ans) {
    const base = w.t === 'k' ? w.r : w.w;
    let n = 0; while (n < base.length && n < ans.length && base[n] === ans[n]) n++;
    return `${esc(ans.slice(0, n))}<em>${esc(ans.slice(n))}</em>`;
  }

  function renderResult(ok, ans, hit, list) {
    const { w, f } = cur;
    const ex = explain(w, f);
    const hanamaru = ok && session.streak > 0 && session.streak % 5 === 0;
    let main = '', reading = '', alts = '', mine = '', diag = '';
    if (isClassQ(f)) {
      main = `<span>${TYPE_NAME[w.t]}</span>${TYPE_SUB[w.t] ? `<span class="v-reading">（${TYPE_SUB[w.t]}）</span>` : ''}`;
      if (!ok) {
        const lbl = (CLASS_CHOICES[isVerb(w) ? 'v' : 'a'].find(c => c[0] === ans) || [])[1] || ans;
        mine = `<p class="mine">你选了 <s>${esc(lbl)}</s></p>`;
      }
    } else {
      const primary = list[0];
      const show = (a) => display(w, a);
      main = `<span lang="ja">${highlight(w, show(primary))}</span>`;
      if (w.t !== 'k' && primary.j !== primary.k) reading = `<p class="v-reading" lang="ja">${esc(primary.k)}</p>`;
      if (w.t === 'k') reading = `<p class="v-reading" lang="ja">${esc(primary.j)}</p>`;
      const others = list.slice(1).filter(a => !a.note);
      if (others.length) alts = `<p class="alts">也对：${others.map(a => `<span lang="ja">${esc(show(a))}</span>`).join('、')}</p>`;
      const noted = list.filter(a => a.note);
      if (hit && hit.note) alts += `<p class="alts">你写的<span lang="ja">「${esc(show(hit))}」</span>也算对：${esc(hit.note)}。</p>`;
      else if (noted.length) alts += noted.map(a => `<p class="alts"><span lang="ja">「${esc(show(a))}」</span>：${esc(a.note)}。</p>`).join('');
      if (!ok) {
        mine = `<p class="mine">你的答案：<s lang="ja">${esc(ans)}</s></p>`;
        const d = diagnose(w, f, ans);
        if (d) diag = `<p class="diag">${esc(d)}</p>`;
      }
    }
    const rows = [];
    if (ex.cls) rows.push(['词类', ex.cls]);
    if (ex.rule) rows.push(['规则', ex.rule]);
    if (ex.twin) rows.push(['小心', ex.twin]);
    const el = $('#result');
    el.className = 'result';
    el.innerHTML = `
      <div class="verdict">
        <div class="stamp">${ok ? (hanamaru ? svgHanamaru() : SVG_MARU) : SVG_BATSU}</div>
        <div class="v-body">
          <p class="v-title">${ok ? (hanamaru ? `花丸！连对 ${session.streak} 题` : '正解') : '不对，正确答案是'}</p>
          <p class="v-answer">${main}</p>
          ${reading}${mine}${alts}
        </div>
      </div>
      ${diag}
      <dl class="why">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <div class="actions"><button type="button" class="btn" id="nextBtn">下一题<kbd>Enter</kbd></button></div>`;
    el.hidden = false;
    $('#nextBtn').addEventListener('click', () => nextQuestion());
    if (S.settings.mode === 'choice' || isClassQ(f)) $('#nextBtn').focus({ preventScroll: true });
  }

  // ---- 计分与回顾 ----
  function renderScore() {
    const pct = session.n ? Math.round(session.c / session.n * 100) + '%' : '—';
    $('#score').innerHTML = `<span>本轮 <b>${session.c}/${session.n}</b> · ${pct}</span><span>连对 <b>${session.streak}</b></span><span>最佳 <b>${S.best}</b></span>`;
  }
  function renderReview() {
    const rows = FORM_KEYS.filter(f => S.stats[f] && S.stats[f].n)
      .map(f => ({ f, ...S.stats[f], r: S.stats[f].c / S.stats[f].n }))
      .sort((a, b) => a.r - b.r || b.n - a.n);
    $('#rates').innerHTML = rows.length
      ? rows.map(o => `<div class="rate"><span class="lab"><i>${FORMS[o.f].kind === 'v' ? '动' : '形'}</i><span lang="ja">${FORMS[o.f].label}</span></span><span class="bar"><b class="${o.r < .6 ? 'low' : ''}" style="width:${Math.max(4, o.r * 100).toFixed(0)}%"></b></span><span class="num">${o.c}/${o.n}</span></div>`).join('')
      : '<p class="muted">做几题之后，这里会按正确率从低到高列出各种变形，最弱的排在最上面。</p>';
    const ms = S.mistakes.map(m => ({ m, w: WORDS.find(x => x.key === m.key) })).filter(o => o.w);
    $('#mcount').textContent = ms.length ? `${ms.length} 题` : '';
    $('#mlist').innerHTML = ms.length
      ? ms.slice(0, 40).map(({ m, w }) => {
          let right;
          if (isClassQ(m.f)) right = TYPE_NAME[w.t];
          else right = display(w, conj(w, m.f)[0]);
          const mine = isClassQ(m.f) ? ((CLASS_CHOICES[isVerb(w) ? 'v' : 'a'].find(c => c[0] === m.u) || [])[1] || m.u) : m.u;
          return `<li><span class="w" lang="ja">${esc(w.w)}</span><span class="f" lang="ja">${FORMS[m.f].label}</span><span class="d">你答 <s lang="ja">${esc(mine)}</s> → <span lang="ja">${esc(right)}</span></span></li>`;
        }).join('')
      : '<li class="muted" style="border:0">答错的题会记在这里。答对一次就会自动划掉。</li>';
    const db = $('#drillBtn');
    db.disabled = !ms.length && !drill;
    db.textContent = drill ? '结束专练' : `专练错题${ms.length ? `（${ms.length}）` : ''}`;
  }
  $('#drillBtn').addEventListener('click', () => {
    drill = !drill && S.mistakes.length > 0;
    renderReview(); nextQuestion();
    $('#sheet').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  let armTimer = null;
  $('#resetBtn').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (!b.classList.contains('armed')) {
      b.classList.add('armed'); b.textContent = '再点一次确认清空';
      clearTimeout(armTimer); armTimer = setTimeout(() => { b.classList.remove('armed'); b.textContent = '清空记录'; }, 4000);
      return;
    }
    clearTimeout(armTimer); b.classList.remove('armed'); b.textContent = '清空记录';
    S.stats = {}; S.mistakes = []; S.best = 0; drill = false; save();
    renderReview(); renderScore();
  });

  // ---- 键盘 ----
  document.addEventListener('keydown', (e) => {
    if (!cur || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (cur.done && e.key === 'Enter') {
      if (tag === 'button' && e.target.id !== 'nextBtn' && !e.target.closest('#ansForm')) return;
      if (e.target.id === 'ans') return; // 表单自己处理
      e.preventDefault(); nextQuestion(); return;
    }
    if (!cur.done && /^[1-4]$/.test(e.key) && document.getElementById('choices') && tag !== 'input') {
      const i = +e.key - 1; if (cur.choices && cur.choices[i]) { e.preventDefault(); pick(i); }
    }
  });

  // ---- 启动 ----
  buildSettings(); renderSummary(); renderScore(); renderReview(); nextQuestion(true, false);
})();
