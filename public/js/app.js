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

  // ---- 本机存储 ----
  const KEYS = { settings: 'katsuyo.settings', log: 'katsuyo.log', sync: 'katsuyo.sync', ui: 'katsuyo.ui' };
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } },
  };
  const DEFAULTS = {
    levels: [5, 4], classes: ['1', '2', '3', 'i', 'n'],
    forms: ['masu', 'masen', 'nai', 'ta', 'te', 'vclass', 'aneg', 'apast', 'ate', 'aattr', 'aclass'],
    mode: 'type', hint: false,
  };
  function cleanSettings(o) {
    const s = { ...DEFAULTS, ...(o || {}) };
    const arr = (v, d) => Array.isArray(v) ? v.slice() : d.slice();
    s.levels = arr(s.levels, DEFAULTS.levels).map(Number).filter(n => n >= 1 && n <= 5);
    s.classes = arr(s.classes, DEFAULTS.classes).map(String);
    s.forms = arr(s.forms, DEFAULTS.forms).filter(f => FORMS[f]);
    s.mode = s.mode === 'choice' ? 'choice' : 'type';
    s.hint = !!s.hint;
    return s;
  }
  const savedSettings = LS.get(KEYS.settings, null);
  const S = { settings: cleanSettings(savedSettings && savedSettings.data), t: (savedSettings && savedSettings.t) || 0 };

  const WORD = new Map(WORDS.map(w => [w.key, w]));
  const P = new Progress(LS.get(KEYS.log, []));
  const sync = Object.assign({ owner: null, cursor: 0, pending: [] }, LS.get(KEYS.sync, {}));
  const pending = new Set((sync.pending || []).filter(id => P.ids.has(id)));
  const ui = Object.assign({ tab: 'due' }, LS.get(KEYS.ui, {}));

  let saveTimer = null;
  function prunePending() { for (const id of [...pending]) if (!P.ids.has(id)) pending.delete(id); }
  function saveSync() { LS.set(KEYS.sync, { owner: sync.owner, cursor: sync.cursor, pending: [...pending] }); }
  function flush() { clearTimeout(saveTimer); saveTimer = null; LS.set(KEYS.log, P.log); saveSync(); }
  function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 300); }
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

  // 记一条事件：存本机，标记为待上传，稍后同步
  function record(e) {
    e.i = makeId();
    e.t = Date.now();
    P.add(e);
    pending.add(e.i);
    persist();
    Cloud.schedule();
    return e;
  }

  function saveSettings() {
    S.t = Date.now();
    LS.set(KEYS.settings, { data: S.settings, t: S.t });
    Cloud.schedule();
  }

  // 给同步模块用的接口
  const store = {
    pendingEvents: () => P.log.filter(e => pending.has(e.i)),
    markSent(ids) { ids.forEach(id => pending.delete(id)); saveSync(); },
    receive(events) {
      const n = P.addMany(events);
      if (n) { prunePending(); persist(); refreshPanels(); if (cur && !cur.done) renderHead(); }
      return n;
    },
    get cursor() { return sync.cursor; },
    set cursor(v) { sync.cursor = v; saveSync(); },
    get owner() { return sync.owner; },
    setOwner(id) { sync.owner = id; saveSync(); },
    settings: () => ({ data: S.settings, t: S.t }),
    applySettings(s) {
      if (!s || !(s.t > S.t)) return;
      S.settings = cleanSettings(s.data);
      S.t = s.t;
      LS.set(KEYS.settings, { data: S.settings, t: S.t });
      buildSettings(); renderSummary();
      if (mode === 'practice' && cur && !cur.done && !cur.review && (!pool().includes(cur.w) || !eligibleForms(cur.w).includes(cur.f))) nextQuestion(false, false);
      else if (cur && !cur.done) renderQuestion(false);
    },
    wipe() {
      P.clearAll(); pending.clear(); sync.cursor = 0;
      flush();
      mode = 'practice'; session.c = session.n = session.streak = 0;
      refreshPanels(); renderScore(); nextQuestion(false, false);
    },
  };

  const session = { c: 0, n: 0, streak: 0, q: 0 };
  let recent = [];
  let cur = null;
  let mode = 'practice';           // practice 平时练习 · review 集中复习
  const reviewRun = { done: 0, right: 0 };

  // ---- 题库筛选 ----
  function eligibleForms(w) { const set = new Set(S.settings.forms); return formsFor(w).filter(f => set.has(f)); }
  function pool() {
    const L = new Set(S.settings.levels.map(Number)), C = new Set(S.settings.classes);
    return WORDS.filter(w => L.has(w.lvl) && C.has(clsKey(w)) && eligibleForms(w).length);
  }
  const dueWords = (now) => P.dueList(now).filter(W => WORD.has(W.k));

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
    $('#sumText').textContent = `${lv} ｜ ${st.classes.length} 类词 ｜ ${st.forms.length} 种变形 ｜ ${st.mode === 'type' ? '打字' : '四选一'} ｜ 题库 ${pool().length} 词`;
  }
  $('#setup').addEventListener('change', (e) => {
    const t = e.target;
    readSettings(); saveSettings(); renderSummary();
    if (t.name === 'mode' || t.id === 'hint') { if (cur && !cur.done) renderQuestion(); return; }
    if (mode === 'practice' && cur && !cur.done && !cur.review) {
      if (!pool().includes(cur.w) || !eligibleForms(cur.w).includes(cur.f)) nextQuestion(false);
    } else if (!cur && mode === 'practice') nextQuestion(false);
  });
  $('#setup').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-all], button[data-none]');
    if (!b) return;
    const id = b.dataset.all || b.dataset.none;
    document.querySelectorAll('#' + id + ' input').forEach(i => { i.checked = !!b.dataset.all; });
    $('#setup').dispatchEvent(new Event('change'));
  });

  // ---- 出题 ----
  // 复习题考哪种变形：先看这个词错过的变形；手动加入、还没错过的，就从已选的变形里挑
  function reviewFormFor(w) {
    const valid = formsFor(w);
    const opts = P.reviewForms(w.key, valid);
    if (opts.length) return weightedPick(opts, o => o.w).f;
    const enabled = eligibleForms(w).filter(f => !isClassQ(f));
    return rand(enabled.length ? enabled : valid.filter(f => !isClassQ(f)));
  }

  function nextQuestion(count = true, focus = count) {
    const now = Date.now();
    let w = null, f = null, review = false;
    const due = dueWords(now).filter(W => !(cur && cur.w.key === W.k));
    if (mode === 'review') {
      const list = due.length ? due : dueWords(now);
      if (!list.length) { finishReview(); return; }
      w = WORD.get(list[0].k); f = reviewFormFor(w); review = true;
    } else if (due.length && !(cur && cur.review) && Math.random() < 0.4) {
      // 平时练习中穿插到期的复习题
      w = WORD.get(due[0].k); f = reviewFormFor(w); review = true;
    } else {
      const pl = pool();
      if (!pl.length) { cur = null; renderEmpty(); renderBanner(); return; }
      let cand = pl.filter(x => !recent.includes(x.id));
      if (!cand.length) cand = pl;
      w = weightedPick(cand, x => P.weight(x.key, now));
      f = weightedPick(eligibleForms(w), g => P.formWeight(w.key, g));
      recent.push(w.id);
      while (recent.length > Math.min(15, Math.floor(pl.length / 2))) recent.shift();
    }
    askWord(w, f, review, count, focus);
  }

  function askWord(w, f, review, count = true, focus = count) {
    if (count) session.q++;
    cur = { w, f, review, done: false, choices: null };
    renderQuestion(focus);
    renderBanner();
  }

  function renderEmpty() {
    $('#sheet').innerHTML = `<div class="empty"><strong>当前设置下没有可练的题</strong>至少选一个级别和一个词类，并选上对应的变形：动词变形只出给动词，形容词变形只出给形容词。</div>`;
  }

  function taskHTML(w, f) {
    const F = FORMS[f];
    if (isClassQ(f)) return `<div class="task"><span class="to">判断</span><strong>它属于哪一类？</strong></div>`;
    return `<div class="task"><span class="to">变成</span><strong lang="ja">${F.label}</strong><span class="ex">${F.sub ? esc(F.sub) + ' · ' : ''}例 <span lang="ja">${esc(F.ex)}</span></span></div>`;
  }

  function headFlag() {
    if (!cur || !cur.review) return '';
    if (mode === 'review') {
      const pos = cur.done ? reviewRun.done : reviewRun.done + 1;
      const total = Math.max(pos, reviewRun.done + dueWords(Date.now()).length);
      return `<span class="drill-flag">复习 ${pos}/${total}</span>`;
    }
    return '<span class="drill-flag">到期复习</span>';
  }
  function renderHead() { const el = document.querySelector('#sheet .q-head .drill-flag, #sheet .q-head .flag-slot'); if (el) el.outerHTML = headFlag() || '<span class="flag-slot"></span>'; }

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
        ${headFlag() || '<span class="flag-slot"></span>'}
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
    grade(c.v);
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

    const before = P.get(w.key);
    const beforeBook = before && before.book ? { ...before.book } : null;
    session.n++;
    if (ok) { session.c++; session.streak++; } else session.streak = 0;
    if (mode === 'review' && cur.review) { reviewRun.done++; if (ok) reviewRun.right++; }
    record(ok ? { k: w.key, f, o: 1 } : { k: w.key, f, o: 0, a: String(ans).slice(0, 40) });

    const form = $('#ansForm'); if (form) { $('#ans').readOnly = true; form.querySelector('button').hidden = true; const hl = document.querySelector('.hint-line'); if (hl) hl.hidden = true; }
    renderResult(ok, ans, hit, list, beforeBook);
    renderScore(); refreshPanels();
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

  const STEPS_N = SRS_STEPS.length;
  // 这个词的错误统计，写成一句话
  function statLine(W) {
    if (!W || !W.n) return '';
    const bad = Object.entries(W.forms).filter(([, F]) => F.w).sort((a, b) => b[1].w - a[1].w).slice(0, 3)
      .map(([f, F]) => `<span lang="ja">${FORMS[f] ? FORMS[f].label : f}</span> ${F.w} 次`);
    return `这个词答过 ${W.n} 次，错 ${W.w} 次${bad.length ? `（${bad.join('、')}）` : ''}`;
  }
  // 这次作答对复习安排的影响
  function scheduleNote(W, ok, beforeBook, now) {
    const B = W && W.book;
    if (!ok && B) return [`bad`, beforeBook ? `复习进度从头开始，${whenText(B.due, now)}再考一次` : `已记进单词本，${whenText(B.due, now)}再考一次`];
    if (!W) return null;
    if (beforeBook && !B && W.mastered) return ['', `连续 ${STEPS_N} 次按时复习都答对，已掌握，移出单词本`];
    if (beforeBook && B && B.step > beforeBook.step) return ['', `复习通过（${B.step}/${STEPS_N}），下次复习：${whenText(B.due, now)}`];
    if (B) return ['', `还没到复习时间，这次不算进度。下次复习：${whenText(B.due, now)}`];
    if (!W.w && W.n >= 3) return ['', '这个词从没错过，之后会少出现'];
    return null;
  }

  function renderResult(ok, ans, hit, list, beforeBook) {
    const { w, f } = cur;
    const now = Date.now();
    const ex = explain(w, f);
    const hanamaru = ok && session.streak > 0 && session.streak % 5 === 0;
    let main = '', reading = '', alts = '', mine = '', diag = '';
    if (isClassQ(f)) {
      main = `<span>${TYPE_NAME[w.t]}</span>${TYPE_SUB[w.t] ? `<span class="v-reading">（${TYPE_SUB[w.t]}）</span>` : ''}`;
      if (!ok) mine = `<p class="mine">你选了 <s>${esc(classLabel(w, ans))}</s></p>`;
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
    const W = P.get(w.key);
    const sched = scheduleNote(W, ok, beforeBook, now);
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
      <div class="v-meta">
        ${sched ? `<p class="v-sched ${sched[0]}">${esc(sched[1])}</p>` : ''}
        <p>${statLine(W)}</p>
      </div>
      <div class="actions">
        <button type="button" class="linkish" id="bookToggle"></button>
        <span class="spacer"></span>
        <button type="button" class="btn" id="nextBtn">下一题<kbd>Enter</kbd></button>
      </div>`;
    el.hidden = false;
    renderBookToggle();
    $('#bookToggle').addEventListener('click', () => { toggleBook(w.key); renderBookToggle(); });
    $('#nextBtn').addEventListener('click', () => nextQuestion());
    if (S.settings.mode === 'choice' || isClassQ(f)) $('#nextBtn').focus({ preventScroll: true });
  }
  function renderBookToggle() {
    const b = $('#bookToggle'); if (!b || !cur) return;
    const W = P.get(cur.w.key);
    b.textContent = W && W.book ? '移出单词本' : '加入单词本';
  }
  function toggleBook(k) {
    const W = P.get(k);
    record(W && W.book ? { k, y: 'del' } : { k, y: 'add' });
    refreshPanels();
  }
  function classLabel(w, v) {
    return (CLASS_CHOICES[isVerb(w) ? 'v' : 'a'].find(c => c[0] === v) || [])[1] || v;
  }

  // ---- 集中复习 ----
  function startReview() {
    mode = 'review'; reviewRun.done = 0; reviewRun.right = 0;
    nextQuestion();
    refreshPanels();
    $('#sheet').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function endReview() { mode = 'practice'; refreshPanels(); nextQuestion(); }
  function finishReview() {
    cur = null;
    const now = Date.now();
    const next = P.nextDue(now);
    $('#sheet').innerHTML = `
      <div class="done">
        <div class="stamp">${svgHanamaru()}</div>
        <h2>复习完成</h2>
        <p>${reviewRun.done ? `这一轮复习了 ${reviewRun.done} 题，答对 ${reviewRun.right} 题。` : '现在没有到期要复习的词。'}</p>
        <p>${next ? `下次复习：${whenText(next, now)}` : '单词本里没有等着复习的词了。'}</p>
        <button type="button" class="btn" id="contBtn">继续练习<kbd>Enter</kbd></button>
      </div>`;
    $('#contBtn').addEventListener('click', endReview);
    $('#contBtn').focus({ preventScroll: true });
    renderBanner();
  }

  // ---- 单词本 ----
  let listLimit = 30;
  let openKey = null;

  function renderBanner() {
    const el = $('#dueBanner');
    const n = dueWords(Date.now()).length;
    if (mode === 'review' || !n) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<p><b>${n}</b> 个词到复习时间了</p><button type="button" class="btn small" id="bannerBtn">开始复习</button>`;
    $('#bannerBtn').addEventListener('click', startReview);
  }

  function stepsHTML(B) {
    let s = '';
    for (let i = 0; i < STEPS_N; i++) s += `<i class="${i < B.step ? 'on' : ''}"></i>`;
    return `<span class="steps" title="复习进度 ${B.step}/${STEPS_N}" aria-label="复习进度 ${B.step}/${STEPS_N}">${s}</span>`;
  }
  function statusChip(W, now) {
    const st = P.status(W.k, now);
    if (st === 'due') return '<span class="chip-s due">该复习了</span>';
    if (st === 'book') return `<span class="chip-s book">${esc(whenText(W.book.due, now))}</span>`;
    if (st === 'mastered') return '<span class="chip-s ok">已掌握</span>';
    if (st === 'clean') return '<span class="chip-s">从没错过</span>';
    return '';
  }
  const fmtDate = (t) => { const d = new Date(t); return `${d.getMonth() + 1}月${d.getDate()}日`; };

  function wordDetail(W, w, now) {
    const lines = [];
    if (W.lastWrong) {
      const f = W.lastWrong.f;
      const F = FORMS[f];
      if (F && isClassQ(f)) lines.push(`<p>最近一次错：判断类别，选了 <s>${esc(classLabel(w, W.lastWrong.a))}</s>，应为 ${TYPE_NAME[w.t]}（${fmtDate(W.lastWrong.t)}）</p>`);
      else if (F) {
        const right = conj(w, f);
        lines.push(`<p>最近一次错：<span lang="ja">${F.label}</span> 写成 <s lang="ja">${esc(W.lastWrong.a || '？')}</s>，应为 <span lang="ja">${esc(right ? display(w, right[0]) : '')}</span>（${fmtDate(W.lastWrong.t)}）</p>`);
      }
    }
    const fs = Object.entries(W.forms).filter(([f]) => FORMS[f]).sort((a, b) => b[1].w - a[1].w || b[1].n - a[1].n);
    if (fs.length) {
      lines.push(`<div style="overflow-x:auto"><table class="ftable"><thead><tr><th>变形</th><th>答过</th><th>答错</th></tr></thead><tbody>${fs.map(([f, F]) =>
        `<tr><td lang="ja">${FORMS[f].label}</td><td class="n">${F.n}</td><td class="n${F.w ? ' bad' : ''}">${F.w}</td></tr>`).join('')}</tbody></table></div>`);
    }
    const bits = [];
    if (W.n) bits.push(`第一次练：${fmtDate(W.firstT)}`, `最近：${fmtDate(W.lastT)}`);
    if (W.book) bits.push(`复习进度 ${W.book.step}/${STEPS_N}`, `下次复习：${whenText(W.book.due, now)}`);
    if (bits.length) lines.push(`<p class="muted">${bits.join(' · ')}</p>`);
    lines.push(`<div class="row"><button type="button" class="btn small" data-act="ask">现在练这个词</button><button type="button" class="btn small ghost" data-act="toggle">${W.book ? '移出单词本' : '加入单词本'}</button></div>`);
    return `<div class="wdetail">${lines.join('')}</div>`;
  }

  function wordItem(W, now) {
    const w = WORD.get(W.k);
    const open = openKey === W.k;
    const err = W.n ? `错 <b>${W.w}</b>/${W.n}` : '还没答过';
    let line = esc(w.m);
    if (W.lastWrong && FORMS[W.lastWrong.f]) line = `${esc(w.m)} · 常错 <span lang="ja">${FORMS[W.lastWrong.f].label}</span>`;
    return `<li data-k="${esc(W.k)}">
      <button type="button" class="wrow" aria-expanded="${open}">
        <span class="ww"><span class="wk" lang="ja">${esc(w.w)}</span>${w.w !== w.r ? `<span class="wr" lang="ja">${esc(w.r)}</span>` : ''}</span>
        <span class="we">${err}</span>
        <span class="wl">${W.book ? stepsHTML(W.book) : ''}<span>${line}</span></span>
        <span class="ws">${statusChip(W, now)}</span>
      </button>
      ${open ? wordDetail(W, w, now) : ''}
    </li>`;
  }

  function renderBook() {
    const now = Date.now();
    const c = P.counts(now);
    $('#counts').innerHTML = `
      <div class="${c.due ? 'hot' : ''}"><b>${c.due}</b><span>待复习</span></div>
      <div><b>${c.book}</b><span>在单词本</span></div>
      <div><b>${c.mastered}</b><span>已掌握</span></div>
      <div><b>${c.practiced}</b><span>练过的词</span></div>`;
    const rb = $('#reviewBtn');
    if (mode === 'review') { rb.disabled = false; rb.textContent = '结束复习'; rb.className = 'btn small ghost'; }
    else {
      rb.className = 'btn small';
      rb.disabled = !c.due;
      const next = P.nextDue(now);
      rb.textContent = c.due ? `开始复习（${c.due}）` : next ? `下次复习：${whenText(next, now)}` : '没有要复习的词';
    }
    const tabs = { due: c.due, book: c.book, all: c.practiced };
    document.querySelectorAll('#book .tab').forEach(t => {
      const sel = t.dataset.tab === ui.tab;
      t.setAttribute('aria-selected', sel);
      t.tabIndex = sel ? 0 : -1;
      t.querySelector('small').textContent = tabs[t.dataset.tab] || '';
    });
    let list = ui.tab === 'due' ? P.dueList(now) : ui.tab === 'book' ? P.bookList() : P.practicedList();
    list = list.filter(W => WORD.has(W.k));
    const next = P.nextDue(now);
    const emptyText = {
      due: c.book ? `现在没有到期的词。下次复习：${whenText(next, now)}。` : '答错的词会自动记进单词本，到了复习时间就会出现在这里。',
      book: '单词本是空的。答错的词会自动记进来，也可以在答题后点「加入单词本」。',
      all: '还没有练习记录。每个练过的词都会在这里显示答过几次、错过几次。',
    }[ui.tab];
    $('#wlist').innerHTML = list.length ? list.slice(0, listLimit).map(W => wordItem(W, now)).join('') : `<li class="empty-li">${esc(emptyText)}</li>`;
    const more = $('#moreBtn');
    more.hidden = list.length <= listLimit;
    more.textContent = `显示更多（还有 ${list.length - listLimit} 个）`;
  }

  $('#book').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab) { ui.tab = tab.dataset.tab; listLimit = 30; openKey = null; LS.set(KEYS.ui, ui); renderBook(); return; }
    const li = e.target.closest('li[data-k]');
    if (!li) return;
    const k = li.dataset.k;
    const act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'toggle') { toggleBook(k); return; }
    if (act && act.dataset.act === 'ask') {
      const w = WORD.get(k);
      if (mode === 'review') mode = 'practice';
      askWord(w, reviewFormFor(w), P.status(k, Date.now()) === 'due');
      refreshPanels();
      $('#sheet').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (e.target.closest('.wrow')) { openKey = openKey === k ? null : k; renderBook(); }
  });
  $('#moreBtn').addEventListener('click', () => { listLimit += 50; renderBook(); });
  $('#reviewBtn').addEventListener('click', () => { if (mode === 'review') endReview(); else startReview(); });

  // ---- 计分与正确率 ----
  function renderScore() {
    const pct = session.n ? Math.round(session.c / session.n * 100) + '%' : '—';
    $('#score').innerHTML = `<span>本轮 <b>${session.c}/${session.n}</b> · ${pct}</span><span>连对 <b>${session.streak}</b></span><span>最佳 <b>${Math.max(P.best, session.streak)}</b></span>`;
  }
  function renderRates() {
    const rows = FORM_KEYS.filter(f => P.forms[f] && P.forms[f].n)
      .map(f => ({ f, ...P.forms[f], r: P.forms[f].c / P.forms[f].n }))
      .sort((a, b) => a.r - b.r || b.n - a.n);
    $('#rates').innerHTML = rows.length
      ? rows.map(o => `<div class="rate"><span class="lab"><i>${FORMS[o.f].kind === 'v' ? '动' : '形'}</i><span lang="ja">${FORMS[o.f].label}</span></span><span class="bar"><b class="${o.r < .6 ? 'low' : ''}" style="width:${Math.max(4, o.r * 100).toFixed(0)}%"></b></span><span class="num">${o.c}/${o.n}</span></div>`).join('')
      : '<p class="muted">做几题之后，这里会按正确率从低到高列出各种变形。</p>';
    $('#resetNote').textContent = Cloud.signedIn
      ? '清空后，统计、单词本和复习安排都会重新开始，云端和你的其他设备也会一起清空。'
      : '清空后，统计、单词本和复习安排都会重新开始。';
  }
  function refreshPanels() { renderBook(); renderRates(); renderBanner(); renderScore(); }

  let armTimer = null;
  $('#resetBtn').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (!b.classList.contains('armed')) {
      b.classList.add('armed'); b.textContent = '再点一次确认清空';
      clearTimeout(armTimer); armTimer = setTimeout(() => { b.classList.remove('armed'); b.textContent = '清空全部记录'; }, 4000);
      return;
    }
    clearTimeout(armTimer); b.classList.remove('armed'); b.textContent = '清空全部记录';
    record({ y: 'reset' });
    prunePending(); saveSync();
    session.c = session.n = session.streak = 0;
    mode = 'practice'; openKey = null;
    refreshPanels();
    if (!cur || cur.done) nextQuestion(false, false);
  });

  // ---- 键盘 ----
  document.addEventListener('keydown', (e) => {
    if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (!cur) {
      if (e.key === 'Enter' && $('#contBtn') && (tag === 'body' || e.target.id === 'contBtn')) { e.preventDefault(); endReview(); }
      return;
    }
    if (cur.done && e.key === 'Enter') {
      if (tag === 'button' && e.target.id !== 'nextBtn' && !e.target.closest('#ansForm')) return;
      if (e.target.id === 'ans') return; // 表单自己处理
      e.preventDefault(); nextQuestion(); return;
    }
    if (!cur.done && /^[1-4]$/.test(e.key) && document.getElementById('choices') && tag !== 'input') {
      const i = +e.key - 1; if (cur.choices && cur.choices[i]) { e.preventDefault(); pick(i); }
    }
  });

  // 到期时间是按分钟走的，停在页面上不动时也定时刷新一下
  setInterval(() => { if (document.visibilityState === 'visible') { renderBook(); renderBanner(); } }, 30e3);

  // ---- 启动 ----
  buildSettings(); renderSummary(); refreshPanels(); nextQuestion(true, false);
  Cloud.init(store);
})();
