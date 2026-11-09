/* YouQwiz — moteur du quiz du jour (mêmes règles que la vidéo : chrono 5/5/6/7 s, 100/200/300/500 pts, série, rang). */
(() => {
  const Y = window.YQ || {};
  if (Y.page !== 'episode' || !Y.episode || !document.getElementById('yq')) return;
  const ep = Y.episode;
  const votes = Y.votes || {};
  const PAGE_URL = Y.url;
  const LEVELS = { facile: { label: 'FACILE', sec: 5, pts: 100, card: "On s'échauffe 🔥" }, moyen: { label: 'MOYEN', sec: 5, pts: 200, card: 'Ça se corse 👀' }, difficile: { label: 'DIFFICILE', sec: 6, pts: 300, card: 'Accroche-toi 😰' }, impossible: { label: 'IMPOSSIBLE', sec: 7, pts: 500, card: 'Seuls les génies 🧠' } };
  const ORDER = ['facile', 'moyen', 'difficile', 'impossible'];
  const RANKS = [[0, 'Débutant', '🐣'], [0.4, 'Bon joueur', '😎'], [0.7, 'Expert', '🧠'], [0.9, 'Génie', '👑']];
  const items = ep.items;
  const n = items.length;
  const isChoice = items.some((it) => it.prompt.type === 'choices');
  const isIntrus = ep.template === 'Intrus';
  const levelOf = (it, i) => it.level || ORDER[Math.min(3, Math.floor((i / n) * 4))];
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const twq = [];
  const tw = (node) => { if (window.twemoji) twemoji.parse(node, { folder: 'svg', ext: '.svg', base: 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/' }); else twq.push(node); };
  (() => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@twemoji/api@15.1.0/dist/twemoji.min.js'; s.crossOrigin = 'anonymous'; s.onload = () => { twq.splice(0).forEach(tw); }; document.head.appendChild(s); })();
  (() => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/css/flag-icons.min.css'; document.head.appendChild(l); })();
  const graphemes = (s) => [...new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(s)].map((g) => g.segment).filter((g) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g));
  const flagCode = (v) => { const cps = Array.from(v.trim()).map((c) => c.codePointAt(0)); if (cps.length !== 2 || cps.some((c) => c < 0x1f1e6 || c > 0x1f1ff)) return null; return cps.map((c) => String.fromCharCode(c - 0x1f1e6 + 97)).join(''); };
  const vibrate = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
  const ding = (() => { let ctx; return (good) => { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'triangle'; o.frequency.value = good ? 880 : 220; g.gain.setValueAtTime(0.12, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25); o.start(); o.stop(ctx.currentTime + 0.25); } catch (e) {} }; })();

  let i = 0, score = 0, streak = 0, best = 0, results = [], timer = null, lastLevel = null, locked = false;
  const total = items.reduce((a, it, k) => a + (isChoice ? 0 : LEVELS[levelOf(it, k)].pts), 0);

  $('yq-go').onclick = () => { $('yq-start').hidden = true; start(); };
  $('yq-again').onclick = () => { i = 0; score = 0; streak = 0; best = 0; results = []; lastLevel = null; $('yq-end').hidden = true; start(); };
  $('yq-levelcard-go').onclick = () => { $('yq-levelcard').hidden = true; $('yq-game').hidden = false; show(); };
  $('yq-share').onclick = share;
  document.querySelectorAll('.yq-embed').forEach((box) => box.querySelector('.yq-play').onclick = () => { box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${box.dataset.yt}?autoplay=1&rel=0" title="Vidéo YouQwiz" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`; });

  function start() { $('yq-game').hidden = false; next(); }
  function next() {
    clearTimeout(timer);
    if (i >= n) return end();
    const lv = levelOf(items[i], i);
    if (!isChoice && lv !== lastLevel) {
      lastLevel = lv;
      $('yq-game').hidden = true;
      $('yq-levelcard').hidden = false;
      $('yq-levelcard-title').textContent = `Niveau ${LEVELS[lv].label.toLowerCase()}`;
      $('yq-levelcard-sub').textContent = `${LEVELS[lv].card} · ${LEVELS[lv].pts} pts par bonne réponse · ${LEVELS[lv].sec} s`;
      tw($('yq-levelcard'));
      return;
    }
    show();
  }

  function show() {
    const it = items[i], p = it.prompt, lv = levelOf(it, i), L = LEVELS[lv];
    locked = false;
    $('yq-progress').textContent = `${i + 1} / ${n}`;
    $('yq-level').textContent = L.label; $('yq-level').dataset.l = lv; $('yq-level').hidden = isChoice;
    $('yq-score').textContent = `${score.toLocaleString('fr-FR')} pts`; $('yq-score').hidden = isChoice;
    $('yq-streak').hidden = streak < 2; $('yq-streak').textContent = `🔥 ×${streak}`;
    $('yq-fact').hidden = true;
    const q = $('yq-question'), stage = $('yq-stage'), acts = $('yq-actions');
    stage.innerHTML = ''; acts.innerHTML = '';
    q.textContent = p.type === 'qcm' ? p.value : p.type === 'letter' ? (ep.question || 'Nomme {cat} qui commence par…').replace('{cat}', p.category) : p.type === 'choices' ? 'Tu préfères… ?' : (ep.question || '');

    if (p.type === 'choices') {
      const vs = el('div', 'yq-vs');
      p.value.forEach((v, c) => { const b = el('button', '', `<span>${esc(v)}</span>`); b.onclick = () => choose(c, vs); vs.appendChild(b); });
      stage.appendChild(vs); tw(stage);
      runTimer(ep.timing && ep.timing.fixed ? ep.timing.question || 8 : 8, () => { if (!locked) choose(-1, vs); });
      return;
    }
    if (p.type === 'qcm') {
      p.choices.forEach((c, k) => { const b = el('button', 'yq-choice', `<span class="k">${'ABCD'[k]}</span><span>${esc(c)}</span>`); b.onclick = () => answerQcm(k, p.correct); acts.appendChild(b); });
      tw(acts);
    } else if (isIntrus && p.type === 'emoji') {
      const cells = graphemes(p.value).slice(0, 12);
      const counts = {}; cells.forEach((c) => (counts[c] = (counts[c] || 0) + 1));
      const odd = cells.findIndex((c) => counts[c] === 1);
      const grid = el('div', 'yq-grid12');
      cells.forEach((c, k) => { const b = el('button', 'yq-cell', c); b.onclick = () => answerIntrus(k, odd, grid); grid.appendChild(b); });
      stage.appendChild(grid); tw(stage);
    } else {
      // devinette : on montre, le chrono tourne, puis la réponse ; le joueur dit s'il l'avait.
      if (p.type === 'emoji') {
        const fc = flagCode(p.value);
        stage.appendChild(fc ? el('span', `fi fi-${fc} yq-flag`) : el('div', 'yq-prompt-emoji', esc(p.value)));
      } else if (p.type === 'text') stage.appendChild(el('div', 'yq-prompt-text', esc(p.value)));
      else if (p.type === 'letter') { stage.appendChild(el('div', 'yq-letter', esc(p.value))); stage.appendChild(el('span', 'yq-pill', esc(p.category))); }
      else if (p.type === 'image') { const im = el('img'); im.src = '/' + p.value; im.style.maxWidth = '80%'; im.style.borderRadius = '14px'; stage.appendChild(im); }
      tw(stage);
      if (it.hint) acts.appendChild(el('span', 'yq-pill', '💡 ' + esc(it.hint)));
    }
    runTimer(L.sec, () => { if (p.type === 'qcm') answerQcm(-1, p.correct); else if (isIntrus) answerIntrus(-1, graphemes(p.value).findIndex((c, _, a) => a.filter((x) => x === c).length === 1), stage.firstChild); else reveal(); });
  }

  function runTimer(sec, onEnd) {
    const bar = $('yq-bar');
    bar.classList.remove('run'); void bar.offsetWidth; bar.style.animationDuration = `${sec}s`; bar.classList.add('run');
    clearTimeout(timer); timer = setTimeout(onEnd, sec * 1000);
  }
  function stopTimer() { clearTimeout(timer); const bar = $('yq-bar'); bar.style.animationPlayState = 'paused'; setTimeout(() => (bar.style.animationPlayState = ''), 0); }

  function scoreIt(good, lv) {
    if (good) { streak++; best = Math.max(best, streak); score += LEVELS[lv].pts; } else streak = 0;
    results.push(good);
    ding(good); vibrate(good ? 30 : [40, 40, 40]);
  }
  function showFact(it) { if (it.fact) { $('yq-fact').textContent = '💡 ' + it.fact; $('yq-fact').hidden = false; tw($('yq-fact')); } }
  function nextBtn(delay) { const b = el('button', 'yq-btn', i + 1 < n ? 'Suivant →' : 'Voir mon score'); b.onclick = () => { i++; next(); }; $('yq-actions').appendChild(b); if (delay) setTimeout(() => { if (document.contains(b)) b.click(); }, delay); }

  function answerQcm(k, correct) {
    if (locked) return; locked = true; stopTimer();
    const it = items[i], lv = levelOf(it, i);
    [...$('yq-actions').children].forEach((b, idx) => { b.disabled = true; if (idx === correct) b.classList.add('ok'); else if (idx === k) b.classList.add('bad'); else b.classList.add('dim'); });
    scoreIt(k === correct, lv); showFact(it); nextBtn(it.fact ? 0 : 1800);
  }
  function answerIntrus(k, odd, grid) {
    if (locked) return; locked = true; stopTimer();
    const it = items[i], lv = levelOf(it, i);
    [...grid.children].forEach((b, idx) => { b.disabled = true; if (idx === odd) b.classList.add('ok'); else if (idx === k) b.classList.add('bad'); else b.classList.add('dim'); });
    scoreIt(k === odd, lv); showFact(it); nextBtn(it.fact ? 0 : 1500);
  }
  function reveal() {
    if (locked) return; locked = true;
    const it = items[i], lv = levelOf(it, i);
    const stage = $('yq-stage'), acts = $('yq-actions');
    stage.appendChild(el('div', 'yq-answer', esc(it.answer))); tw(stage);
    acts.innerHTML = '';
    const ok = el('button', 'yq-btn yq-self ok', "J'avais trouvé ✅"), ko = el('button', 'yq-btn yq-self bad', 'Raté ❌');
    const done = (good) => { ok.disabled = ko.disabled = true; scoreIt(good, lv); acts.innerHTML = ''; showFact(it); nextBtn(it.fact ? 0 : 600); };
    ok.onclick = () => done(true); ko.onclick = () => done(false);
    acts.append(ok, ko);
  }
  function choose(c, vs) {
    if (locked) return; locked = true; stopTimer();
    const v = (votes[i] || [0, 0]).map(Number);
    if (c >= 0) { v[c]++; votes[i] = v; fetch(`/api/episodes?vote=${encodeURIComponent(ep.id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ i, c }), keepalive: true }).catch(() => {}); vibrate(20); }
    const tot = v[0] + v[1] || 1;
    [...vs.children].forEach((b, k) => { b.disabled = true; if (k === c) b.classList.add('me'); b.appendChild(el('span', 'pct', `${Math.round((v[k] / tot) * 100)} %`)); });
    results.push(c);
    nextBtn(1800);
  }

  function end() {
    $('yq-game').hidden = true; $('yq-end').hidden = false;
    if (isChoice) {
      const nb = results.filter((r) => r >= 0).length;
      $('yq-final').textContent = `${nb} / ${n}`; $('yq-rank').textContent = nb === n ? 'Tu as tranché tous les dilemmes 😎' : 'Choix faits (les autres étaient trop durs ? 😅)';
      $('yq-emojigrid').textContent = results.map((r) => (r === 0 ? '🟦' : r === 1 ? '🟨' : '⬜')).join('');
    } else {
      const ratio = total ? score / total : 0;
      const rk = [...RANKS].reverse().find((r) => ratio >= r[0]);
      $('yq-final').textContent = `${score.toLocaleString('fr-FR')} pts`;
      $('yq-rank').textContent = `${rk[2]} ${rk[1]} · ${results.filter(Boolean).length}/${n} bonnes réponses · meilleure série ×${best}`;
      $('yq-emojigrid').textContent = results.map((r) => (r ? '🟩' : '🟥')).join('');
    }
    tw($('yq-end'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function share() {
    const text = isChoice
      ? `Tu préfères… ? J'ai tranché ${results.filter((r) => r >= 0).length}/${n} dilemmes sur YouQwiz 🤔\n${$('yq-emojigrid').textContent}\nÀ toi 👉 ${PAGE_URL}`
      : `J'ai fait ${score.toLocaleString('fr-FR')} pts au quiz du jour YouQwiz 🧠 (${results.filter(Boolean).length}/${n})\n${$('yq-emojigrid').textContent}\nBats-moi 👉 ${PAGE_URL}`;
    try { if (navigator.share) return await navigator.share({ text }); } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); $('yq-copied').hidden = false; } catch (e) { prompt('Copie ce texte :', text); }
  }

  tw(document.getElementById('yq'));
})();
