/* products.js — internal product comparison dashboard. Display only: no score, rank,
   threshold or average is computed here; all numbers come from products_data/*.json,
   which are verbatim structural transforms of the accepted canonical tables. */
(function () {
  'use strict';
  var D = 'products_data/';
  var LANGS = ['ja', 'zh', 'en'];
  // Hero lookup: ONLY the two existing 11-axis entries (inflammation, senescence) in axes.json.
  var HERO_AXES = ['炎症・NF-kB', '細胞老化・周期（SASP含む）'];
  // Colour classification only (high brown → pale low, negatives blue); SenMayo is not in axes.json.
  var BROWN_AXES = HERO_AXES.concat(['SenMayo']);
  var DEFAULT_GENES = ['CDKN2A', 'CXCL8', 'IDO1', 'RUNX2'];
  var PAGE = 50;
  var st = { lang: 'ja', axis: 0, prod: '柳葉会', scope: '6', pop: 'msc', cAxis: 0, cFilter: 'all', smPop: 'all',
             color: true, hc: false, table: false, gq: '', gf: 'none', gp: 0 };
  var I18N, AXES, MAN, SEN, GENES, META, cellCache = {}, picks = null;
  var $ = function (id) { return document.getElementById(id); };
  var t = function (k) { return (I18N[st.lang] && I18N[st.lang][k]) || k; };
  var axLabel = function (a) { return a === 'SenMayo' ? t('sm_axis') : (I18N[st.lang].axis[a] || a); };
  var cLabel = function (c) { return I18N[st.lang].cond[c] || c; };
  // SenMayo ranks SVF among 7, so the "not ranked" SVF label of the 11 axes must not be used there
  var smLabel = function (c) { return c === 'SVF' ? t('sm_svf') : cLabel(c); };
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'cls') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function getJSON(u) { return fetch(D + u, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }); }
  // Score ×100 display (not %). Near-zero keeps a meaningful digit instead of "0.0".
  function f100(v) {
    var x = v * 100, s = x.toFixed(1);
    if ((s === '0.0' || s === '-0.0') && v !== 0) s = x.toFixed(2);
    return s.replace('-', '−');
  }
  function fl2(v) { var s = v.toFixed(1); if (s === '0.0' && v !== 0) s = v.toFixed(2); return s; }
  function nfmt(n) { return n.toLocaleString(st.lang === 'en' ? 'en-US' : 'ja-JP'); }

  /* ---------------- language ---------------- */
  function applyLang() {
    document.documentElement.lang = st.lang === 'zh' ? 'zh-CN' : st.lang;
    document.title = t('title');
    document.querySelectorAll('[data-t]').forEach(function (n) { n.textContent = t(n.getAttribute('data-t')); });
    document.querySelectorAll('.langs button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === st.lang)); });
    $('home').href = 'index.html?lang=' + st.lang;
    $('makerLink').href = 'index.html?lang=' + st.lang + '#methods-' + st.lang;   // public main page methods anchor (no PDF link)
    var u = new URL(location.href); u.searchParams.set('lang', st.lang);
    try { history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) { /* file:// */ }
  }
  function fillSelects() {
    [['axisSel', 'axis'], ['cAxisSel', 'cAxis']].forEach(function (p) {
      var s = $(p[0]); s.innerHTML = '';
      AXES.axes.forEach(function (a, i) { s.appendChild(el('option', { value: i, text: (a.order) + '. ' + axLabel(a.axis) })); });
      if (p[0] === 'cAxisSel') s.appendChild(el('option', { value: 'sm', text: '— ' + t('sm_axis') }));
      s.value = st[p[1]];
    });
    ['prodSel', 'gProd'].forEach(function (id) {
      var s = $(id); s.innerHTML = '';
      AXES.own_products.forEach(function (c) { s.appendChild(el('option', { value: c, text: cLabel(c) })); });
      s.value = st.prod;
    });
  }
  function setProd(c) {
    st.prod = c; st.gp = 0;
    ['prodSel', 'gProd'].forEach(function (id) { $(id).value = c; });
    renderBars(); renderMatrix(); renderGenes(); renderSenmayo();
  }
  function renderAll() { applyLang(); fillSelects(); renderHero(); renderBars(); renderMatrix(); renderDefs(); renderGenes(); renderSenmayo(); renderCells(); }

  /* ---------------- hero (facts read from accepted ranks) ---------------- */
  function renderHero() {
    var box = $('hero-ranks'); box.innerHTML = '';
    var ok = true;
    HERO_AXES.forEach(function (name) {
      var a = AXES.axes.filter(function (x) { return x.axis === name; })[0];
      var r = a && a.msc['柳葉会'];
      if (!r || r.rank_low_cultured6 !== 1) ok = false;
      if (r) box.appendChild(el('div', null, [el('span', { cls: 'note', text: axLabel(name) + ' — ' + t('hero_rank') }),
        el('b', { text: r.rank_low_cultured6 + ' / 6' }), el('span', { cls: 'note', title: String(r.value_token), text: t('col_value') + ': ' + f100(r.value) })]));
    });
    $('hero').hidden = !ok; // never show the claim unless the accepted ranks support it
    [['heroSen', 'heroCapSen', HERO_AXES[1]], ['heroInf', 'heroCapInf', HERO_AXES[0]]].forEach(function (h) {
      var a = AXES.axes.filter(function (x) { return x.axis === h[2]; })[0];
      $(h[1]).textContent = axLabel(a.axis);
      barSet($(h[0]), AXES.cultured_display_order, a.msc, '柳葉会');
    });
  }

  /* ---------------- bar charts (display only: sort + scale verified values) ---------------- */
  function barSet(box, conds, tab, sel, suffix, lab) {
    lab = lab || cLabel;
    conds = conds.slice().sort(function (x, y) { return tab[y].value - tab[x].value; });
    var vals = conds.map(function (c) { return tab[c].value; });
    var lo = Math.min(0, Math.min.apply(null, vals)), hi = Math.max(0, Math.max.apply(null, vals));
    var span = (hi - lo) || 1, z = (-lo / span) * 100;
    box.innerHTML = '';
    conds.forEach(function (c) {
      var v = tab[c].value, l = ((Math.min(v, 0) - lo) / span) * 100, w = (Math.abs(v) / span) * 100;
      box.appendChild(el('div', { cls: 'bar' + (c === sel ? ' sel' : ''), role: 'listitem' }, [
        el('span', { text: lab(c) + (suffix ? suffix(c) : '') }),
        el('span', { cls: 'track', style: '--zero:' + z + '%' }, [el('span', { cls: 'fill', style: 'left:' + l + '%;width:' + w + '%' })]),
        el('span', { cls: 'num', title: String(tab[c].value_token), text: f100(v) })]));
    });
  }
  function renderBars() {
    var a = AXES.axes[st.axis], tab = a[st.pop];
    var conds = st.scope === '6' ? AXES.cultured_display_order.slice() : [st.prod].concat(AXES.external_media);
    barSet($('bars'), conds, tab, st.prod);
    $('scopeNote').hidden = st.scope !== '4';
    var s = tab.SVF; $('svfRef').textContent = t('svf_ref') + ': ' + f100(s.value) + '  (' + axLabel(a.axis) + ')';
  }
  function renderMatrix() {
    var m = $('matrix'); m.innerHTML = '';
    var own = AXES.own_products, pop = st.pop;
    var h1 = el('tr', null, [el('th', { rowspan: 2, text: t('col_axis') })]);
    var h2 = el('tr');
    own.forEach(function (c) {
      var sel = c === st.prod ? 'selcol' : '';
      h1.appendChild(el('th', { colspan: 3, cls: sel, scope: 'colgroup', text: cLabel(c) }));
      [t('col_value'), '6: ' + t('hi') + '/' + t('lo'), t('own3')].forEach(function (x) { h2.appendChild(el('th', { cls: sel, text: x })); });
    });
    m.appendChild(el('thead', null, [h1, h2]));
    var tb = el('tbody');
    AXES.axes.forEach(function (a) {
      var tr = el('tr', null, [el('td', { text: a.order + '. ' + axLabel(a.axis) })]);
      own.forEach(function (c) {
        var r = a[pop][c], sel = c === st.prod ? 'selcol' : '';
        tr.appendChild(el('td', { cls: sel, title: String(r.value_token), text: f100(r.value) }));
        tr.appendChild(el('td', { cls: sel, text: t('hi') + r.rank_high_cultured6 + ' / ' + t('lo') + r.rank_low_cultured6 }));
        tr.appendChild(el('td', { cls: sel, text: t('hi') + r.rank_high_internal3 + ' / ' + t('lo') + r.rank_low_internal3 }));
      });
      tb.appendChild(tr);
    });
    m.appendChild(tb);
  }

  /* ---------------- SenMayo (separate literature gene set; all QC cells) ---------------- */
  function senTab(pop) {
    var tab = {}, src = pop === 'msc' && SEN.msc_summary_gated ? SEN.summary_msc : SEN.summary;
    var r6 = (SEN.cultured6_ranks || {})[pop === 'msc' ? 'msc' : 'all'] || {};
    src.forEach(function (r) { tab[r.condition] = { value: r.mean_score, value_token: r.mean_score, r: r, r6: r6[r.condition] || null }; });
    return tab;
  }
  function renderSenmayo() {
    if (!SEN) return;
    if (!SEN.msc_summary_gated) { st.smPop = 'all'; $('smPop').disabled = true; }
    $('smPop').value = st.smPop;
    var tab = senTab(st.smPop), conds = SEN.summary.map(function (r) { return r.condition; });
    $('smCov').textContent = t('sm_cov') + ': ' + SEN.missing_symbols.join(', ') + ' (' + SEN.matched_gene_count + '/' + SEN.list_gene_count + ')';
    barSet($('smBars'), conds, tab, st.prod, function (c) { return tab[c].r6 ? '  (' + t('lo') + tab[c].r6.rank_low_of6 + '/6)' : ''; }, smLabel);
    var m = $('smTab'); m.innerHTML = '';
    m.appendChild(el('thead', null, [el('tr', null, [t('tab_cond'), t('sm_n'), t('sm_mean'), t('sm_median'), t('sm_rank6'), t('sm_rank')].map(function (x) { return el('th', { text: x }); }))]));
    var tb = el('tbody');
    AXES.conditions_source_order.forEach(function (c) {
      var r = tab[c].r;
      tb.appendChild(el('tr', { cls: c === st.prod ? 'selcol' : '' }, [el('td', { text: smLabel(c) }), el('td', { text: nfmt(r.cell_count) }),
        el('td', { title: String(r.mean_score), text: f100(r.mean_score) }), el('td', { title: String(r.median_score), text: f100(r.median_score) }),
        el('td', { text: tab[c].r6 ? t('hi') + tab[c].r6.rank_high_of6 + ' / ' + t('lo') + tab[c].r6.rank_low_of6 : '—' }),
        el('td', { text: t('hi') + r.rank_high_of7 + ' / ' + t('lo') + r.rank_low_of7 })]));
    });
    m.appendChild(tb);
  }

  /* ---------------- methods (public page: no downloads section) ---------------- */
  function renderDefs() {
    var box = $('defs'); box.innerHTML = '';
    AXES.axes.forEach(function (a) {
      box.appendChild(el('div', { cls: 'def' }, [
        el('b', { text: a.order + '. ' + axLabel(a.axis) }), ' (' + a.axis + ')', el('br'),
        t('m_src') + ': ' + a.source_members.join(', '), el('br'),
        t('m_miss') + ': ' + (a.missing_members.length ? a.missing_members.join(', ') : t('m_none')) +
          ' (' + a.scored_members.length + '/' + a.source_members.length + ')', el('br'),
        a.source_method + ' — ' + t('m_dir')]));
    });
  }
  /* ---------------- gene explorer ---------------- */
  function renderGenes() {
    var tab = $('gTab'), stEl = $('gStatus');
    if (!GENES) { stEl.textContent = t(GENES === false ? 'g_err' : 'g_loading'); return; }
    var cols = GENES.columns, pi = cols.indexOf(st.prod), q = st.gq.trim().toUpperCase(), rows;
    if (!q && st.gf === 'none') {
      rows = DEFAULT_GENES.map(function (g) { return GENES.index[g]; }).filter(Boolean);
    } else {
      rows = GENES.rows.filter(function (r) {
        if (q && r[0].toUpperCase().indexOf(q) < 0) return false;
        if (st.gf === 'high' && r[3][pi] !== 1) return false;
        if (st.gf === 'low' && r[4][pi] !== 1) return false;
        return true;
      });
      if (q) rows.sort(function (a, b) { return (b[0].toUpperCase() === q) - (a[0].toUpperCase() === q); });
    }
    var pages = Math.max(1, Math.ceil(rows.length / PAGE));
    if (st.gp >= pages) st.gp = pages - 1;
    var slice = rows.slice(st.gp * PAGE, st.gp * PAGE + PAGE);
    stEl.textContent = (!q && st.gf === 'none' ? t('g_default') + ' — ' : '') + t('g_rows') + ': ' + nfmt(rows.length) + ' · ' + GENES.unit;
    tab.innerHTML = '';
    var hr = el('tr', null, [el('th', { text: t('g_gene') })]);
    cols.forEach(function (c, i) { hr.appendChild(el('th', { cls: i === pi ? 'selcol' : '', text: cLabel(c) })); });
    hr.appendChild(el('th', { text: cLabel('SVF') }));
    tab.appendChild(el('thead', null, [hr]));
    var tb = el('tbody');
    if (!slice.length) tb.appendChild(el('tr', null, [el('td', { colspan: cols.length + 2, text: t('g_empty') })]));
    slice.forEach(function (r) {
      var tr = el('tr', null, [el('td', { text: r[0] })]);
      cols.forEach(function (c, i) {
        tr.appendChild(el('td', { cls: i === pi ? 'selcol' : '', title: String(r[1][i]),
          text: fl2(r[1][i]) + '  (' + t('hi') + r[3][i] + '/' + t('lo') + r[4][i] + ')' }));
      });
      tr.appendChild(el('td', { title: String(r[2]), text: fl2(r[2]) }));
      tb.appendChild(tr);
    });
    tab.appendChild(tb);
    $('gPage').textContent = t('g_page') + ' ' + (st.gp + 1) + ' / ' + pages + '  · ' + t('g_cell');
    $('gPrev').disabled = st.gp <= 0; $('gNext').disabled = st.gp >= pages - 1;
    var ck = GENES.index.CDKN2A;
    if (ck) {
      var ord = cols.map(function (c, i) { return i; }).sort(function (x, y) { return ck[4][x] - ck[4][y]; });
      $('cdkOrder').textContent = t('cdkn2a_order') + ': ' + ord.map(function (i) { return ck[4][i] + '. ' + cLabel(cols[i]) + ' ' + fl2(ck[1][i]); }).join(' · ');
    }
    var ex = $('gEx'); ex.innerHTML = '';
    DEFAULT_GENES.forEach(function (g) { ex.appendChild(el('dt', { text: g })); ex.appendChild(el('dd', { text: t('ex_' + g) })); });
  }

  /* ---------------- all-cells canvas ---------------- */
  function cellOrder() { return ['SVF'].concat(AXES.cultured_display_order); }
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mix(a, b, k) { return 'rgb(' + a.map(function (x, i) { return Math.round(x + (b[i] - x) * k); }).join(',') + ')'; }
  var BLUE = hex('#2f5f9e'), WHITE = hex('#ffffff'), PALE = hex('#f1e6cf'), BROWN = hex('#6b3a1c'), CRIMSON = hex('#a3122a');
  var NB = 40; // colour bins per side (display only)
  function palette(sen) {
    var base = sen ? PALE : WHITE, hiC = sen ? BROWN : CRIMSON, out = [];
    for (var i = -NB; i <= NB; i++) out.push(i < 0 ? mix(base, BLUE, -i / NB) : mix(base, hiC, i / NB));
    return out;
  }
  function loadAxis(i) {
    var fn = i === 'sm' ? MAN.senmayo_cell_file : MAN.cell_files[i];
    if (!cellCache[fn]) cellCache[fn] = getJSON(fn).then(function (j) {
      var v = j.v, lo = Infinity, hi = -Infinity;
      for (var k = 0; k < v.length; k++) { if (v[k] < lo) lo = v[k]; if (v[k] > hi) hi = v[k]; }
      j.lo = lo; j.hi = hi; return j; });
    return cellCache[fn];
  }
  function jit(i) { var h = Math.imul(i + 1, 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }
  function renderCells() {
    if (!META) { $('cCount').textContent = t(META === false ? 'cells_err' : 'cells_load'); return; }
    var ai = st.cAxis, sm = ai === 'sm';
    var a = sm ? { axis: 'SenMayo', all: senTab('all'), msc: senTab('msc') } : AXES.axes[ai];
    if (sm && !SEN.msc_summary_gated) { st.cFilter = 'all'; $('cFilter').value = 'all'; }
    $('cFilter').disabled = sm && !SEN.msc_summary_gated; $('cSmNote').hidden = !sm;
    $('cCount').textContent = t('cells_load');
    loadAxis(ai).then(function (j) { if (st.cAxis === ai) drawCells(a, j); })
      .catch(function () { $('cCount').textContent = t('cells_err'); });
  }
  function drawCells(a, j) {
    var cv = $('cv'), wrap = $('plotwrap'), dpr = window.devicePixelRatio || 1;
    var order = cellOrder(), msc = st.cFilter === 'msc';
    var cssW = Math.max(300, wrap.clientWidth), bandH = cssW < 520 ? 54 : 70, labH = 20, gap = 10, top = 6, sep = 16, axH = 34;
    var cssH = top + order.length * (labH + bandH + gap) + sep + axH;
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr); cv.style.height = cssH + 'px';
    var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var hc = st.hc, padL = 10, padR = 14, W = cssW - padL - padR;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, cssW, cssH);
    var M = Math.max(Math.abs(j.lo), Math.abs(j.hi)) || 1; // symmetric shared scale, all conditions
    var lo = -M, hi = M, X = function (v) { return padL + (v - lo) / (hi - lo) * W; };
    var sen = BROWN_AXES.indexOf(a.axis) >= 0, pal = palette(sen);
    var bandTop = {}, y = top;
    order.forEach(function (c, k) { if (k === 1) y += sep; bandTop[c] = y + labH; y += labH + bandH + gap; });
    var axisY = y + 2;
    // band backgrounds + labels
    var tabV = msc ? a.msc : a.all, counts = {};
    order.forEach(function (c) {
      counts[c] = 0;
      g.fillStyle = hc ? '#d9d6cf' : '#ebe6da'; g.fillRect(padL, bandTop[c], W, bandH);
    });
    if (!hc) { g.strokeStyle = '#b8963e'; g.lineWidth = 1; g.beginPath(); g.moveTo(padL, bandTop.SVF + bandH + gap / 2 + sep / 2); g.lineTo(padL + W, bandTop.SVF + bandH + gap / 2 + sep / 2); g.stroke(); }
    // points, bucketed by colour bin
    var meta = META, ci = meta.cond, ti = meta.type, conds = meta.conditions, v = j.v, n = v.length;
    var mscType = meta.celltypes.map(function (s) { return s.indexOf(meta.msc_celltype_prefix) === 0; });
    var buckets = []; for (var b = 0; b <= 2 * NB; b++) buckets.push([]);
    picks = { x: new Float32Array(n), y: new Float32Array(n), v: v, axis: a.axis };
    var drawn = 0, sz = hc ? 2.6 : 2;
    for (var i = 0; i < n; i++) {
      var c = conds[ci[i]];
      if (msc && !mscType[ti[i]]) { picks.x[i] = NaN; continue; }
      var px = X(v[i]), py = bandTop[c] + 3 + jit(i) * (bandH - 6);
      picks.x[i] = px; picks.y[i] = py; counts[c]++; drawn++;
      var bi = Math.round(v[i] / M * NB) + NB; buckets[Math.max(0, Math.min(2 * NB, bi))].push(i);
    }
    g.globalAlpha = hc ? 1 : (st.color ? 0.75 : 0.35);
    buckets.forEach(function (lst, bi) {
      g.fillStyle = st.color ? pal[bi] : '#141414';
      for (var k = 0; k < lst.length; k++) { var i = lst[k]; g.fillRect(picks.x[i] - sz / 2, picks.y[i] - sz / 2, sz, sz); }
    });
    g.globalAlpha = 1;
    // zero line, verified condition-score ticks, labels
    g.strokeStyle = hc ? '#000' : '#8a8478'; g.lineWidth = 1; g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(X(0), top + labH); g.lineTo(X(0), axisY); g.stroke(); g.setLineDash([]);
    g.font = (cssW < 520 ? 12 : 13) + 'px ' + getComputedStyle(document.body).fontFamily;
    order.forEach(function (c) {
      var r = tabV[c], tx = X(r.value);
      g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(tx, bandTop[c] - 2); g.lineTo(tx, bandTop[c] + bandH + 2); g.stroke();
      g.fillStyle = '#141414'; g.textBaseline = 'bottom';
      g.fillText((a.axis === 'SenMayo' ? smLabel(c) : cLabel(c)) + '  n=' + nfmt(counts[c]) + '  ·  ' + f100(r.value), padL, bandTop[c] - 3);
    });
    // x axis (score ×100)
    g.strokeStyle = '#141414'; g.beginPath(); g.moveTo(padL, axisY); g.lineTo(padL + W, axisY); g.stroke();
    g.textBaseline = 'top'; g.fillStyle = '#141414';
    [lo, lo / 2, 0, hi / 2, hi].forEach(function (tv, k) {
      var tx = X(tv); g.beginPath(); g.moveTo(tx, axisY); g.lineTo(tx, axisY + 4); g.stroke();
      var s = f100(tv); g.textAlign = k === 0 ? 'left' : (k === 4 ? 'right' : 'center'); g.fillText(s, tx, axisY + 6);
    });
    g.textAlign = 'left';
    cv.setAttribute('aria-label', axLabel(a.axis) + ': ' + nfmt(drawn) + ' ' + t('drawn'));
    $('cCount').textContent = t('drawn') + ': ' + nfmt(drawn) + ' / ' + nfmt(meta.n) + ' — ' + t('nocap') + ' · ' + t('unit');
    // legend (common scale, signed)
    $('cGrad').style.background = st.color ? 'linear-gradient(90deg,' + pal[0] + ',' + pal[NB] + ',' + pal[2 * NB] + ')' : '#141414';
    $('cTicks').innerHTML = ''; [lo, 0, hi].forEach(function (tv) { $('cTicks').appendChild(el('span', { text: f100(tv) })); });
    $('cLegText').textContent = t('legend') + t(sen ? 'legend_sen' : 'legend_gen') + ' · ' + t('tick_note');
    // table fallback
    var tw = $('cTableWrap'), tab = $('cTab'); tw.hidden = !st.table; tab.innerHTML = '';
    tab.appendChild(el('thead', null, [el('tr', null, [el('th', { text: t('tab_cond') }), el('th', { text: t('tab_n') }), el('th', { text: t('tab_score') + ' (' + t(msc ? 'pop_msc' : 'pop_all') + ')' })])]));
    var tb = el('tbody');
    order.forEach(function (c) { tb.appendChild(el('tr', null, [el('td', { text: a.axis === 'SenMayo' ? smLabel(c) : cLabel(c) }), el('td', { text: nfmt(counts[c]) }), el('td', { title: String(tabV[c].value_token), text: f100(tabV[c].value) })])); });
    tab.appendChild(tb);
  }
  function onPick(ev) {
    if (!picks || !META) return;
    var r = $('cv').getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top, best = -1, bd = 64;
    for (var i = 0; i < picks.x.length; i++) {
      var px = picks.x[i]; if (px !== px) continue;
      var dx = px - mx, dy = picks.y[i] - my, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) { $('cPick').textContent = t('pick'); return; }
    var c = META.conditions[META.cond[best]], ty = META.celltypes[META.type[best]];
    $('cPick').textContent = (picks.axis === 'SenMayo' ? smLabel(c) : cLabel(c)) + ' · ' + (I18N[st.lang].ctype[ty] || ty) + ' · ' + t('cell_idx') + ' #' + best +
      ' · ' + axLabel(picks.axis) + ' = ' + picks.v[best] + ' (×100: ' + f100(picks.v[best]) + ')';
  }

  /* ---------------- wiring ---------------- */
  function bind() {
    document.querySelectorAll('.langs button').forEach(function (b) { b.addEventListener('click', function () { st.lang = b.dataset.lang; renderAll(); }); });
    $('axisSel').addEventListener('change', function (e) { st.axis = +e.target.value; renderBars(); });
    $('prodSel').addEventListener('change', function (e) { setProd(e.target.value); });
    $('smPop').addEventListener('change', function (e) { st.smPop = e.target.value; renderSenmayo(); });
    $('scopeSel').addEventListener('change', function (e) { st.scope = e.target.value; renderBars(); });
    $('popSel').addEventListener('change', function (e) { st.pop = e.target.value; renderBars(); renderMatrix(); });
    $('cAxisSel').addEventListener('change', function (e) { st.cAxis = e.target.value === 'sm' ? 'sm' : +e.target.value; renderCells(); });
    $('cFilter').addEventListener('change', function (e) { st.cFilter = e.target.value; renderCells(); });
    $('cColor').addEventListener('change', function (e) { st.color = e.target.checked; renderCells(); });
    $('cHC').addEventListener('change', function (e) { st.hc = e.target.checked; document.body.classList.toggle('hc', st.hc); renderCells(); });
    $('cTable').addEventListener('change', function (e) { st.table = e.target.checked; renderCells(); });
    $('cv').addEventListener('click', onPick);
    var tmr; $('gSearch').addEventListener('input', function (e) { clearTimeout(tmr); tmr = setTimeout(function () { st.gq = e.target.value; st.gp = 0; renderGenes(); }, 150); });
    $('gProd').addEventListener('change', function (e) { setProd(e.target.value); });
    $('gFilter').addEventListener('change', function (e) { st.gf = e.target.value; st.gp = 0; renderGenes(); });
    $('gPrev').addEventListener('click', function () { st.gp--; renderGenes(); });
    $('gNext').addEventListener('click', function () { st.gp++; renderGenes(); });
    var rw; window.addEventListener('resize', function () { clearTimeout(rw); rw = setTimeout(renderCells, 200); });
  }
  function lazy(id, fn) {
    if (!('IntersectionObserver' in window)) return fn();
    var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fn(); } }, { rootMargin: '400px' });
    io.observe($(id));
  }
  var q = new URLSearchParams(location.search).get('lang');
  if (LANGS.indexOf(q) >= 0) st.lang = q;
  else { var nl = (navigator.language || '').slice(0, 2); if (LANGS.indexOf(nl) >= 0) st.lang = nl; }
  Promise.all([getJSON('i18n.json'), getJSON('axes.json'), getJSON('manifest.json'), getJSON('senmayo.json').catch(function () { return null; })]).then(function (r) {
    I18N = r[0]; AXES = r[1]; MAN = r[2]; SEN = r[3];
    if (!SEN) $('senmayo').hidden = true;
    bind(); renderAll();
    lazy('genes', function () {
      getJSON('genes_msc.json').then(function (g) { g.index = {}; g.rows.forEach(function (row) { g.index[row[0]] = row; }); GENES = g; renderGenes(); })
        .catch(function () { GENES = false; renderGenes(); });
    });
    lazy('cells', function () {
      getJSON('cells/meta.json').then(function (m) { META = m; renderCells(); }).catch(function () { META = false; renderCells(); });
    });
  }).catch(function () {
    var p = document.createElement('p'); p.className = 'frame'; p.textContent = 'Data could not be loaded / データを読み込めませんでした。';
    document.querySelector('main').appendChild(p);
  });
})();
