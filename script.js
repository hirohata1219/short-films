// 暗転して次のページへ
document.addEventListener('click', e => {
  const a = e.target.closest('a');
  if (!a || a.target || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin && location.protocol !== 'file:') return;
  if (url.pathname === location.pathname && url.hash) return;
  e.preventDefault();
  document.body.classList.add('leaving');
  setTimeout(() => { location.href = a.href; }, 450);
});
// 戻るボタンで戻ったときに暗いままにならないように
window.addEventListener('pageshow', () => document.body.classList.remove('leaving'));

// 表紙が短い動画になる（PC はマウスを乗せたとき、スマホは画面に入ったとき）
(() => {
  const cards = document.querySelectorAll('.card');
  const play = c => {
    c.classList.add('lit');
    const v = c.querySelector('video');
    if (!v) return;
    v.play().then(() => c.classList.add('playing')).catch(() => {});
  };
  const stop = c => {
    c.classList.remove('lit');
    const v = c.querySelector('video');
    if (!v) return;
    c.classList.remove('playing');
    v.pause();
  };
  if (matchMedia('(hover: hover)').matches) {
    cards.forEach(c => {
      // サムネイルに乗せたときだけ光を当てる（題名に乗せても変えない。リンクはカード全体のまま）
      const t = c.querySelector('.thumb');
      t.addEventListener('mouseenter', () => play(c));
      t.addEventListener('mouseleave', () => stop(c));
      c.addEventListener('focus', () => play(c));
      c.addEventListener('blur', () => stop(c));
    });
  } else {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => en.intersectionRatio >= 0.6 ? play(en.target) : stop(en.target));
    }, { threshold: [0, 0.6] });
    cards.forEach(c => io.observe(c));
  }
})();

// 光の中を漂うほこり（点滅させず、ゆっくり漂わせる）
// 2026-11-16：見出しだけでなく、一覧ページ全体の背景に（画面に固定して、スクロールしても漂い続ける）
(() => {
  const cv = document.querySelector('.dust');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  let w = 0, h = 0, dpr, motes = [];
  const rand = (a, b) => a + Math.random() * (b - a);
  function make(anywhere) {
    return {
      x: rand(0, w),
      y: anywhere ? rand(0, h) : h + 10,
      r: rand(0.6, 2.2),
      vx: rand(-0.08, 0.08),
      vy: rand(-0.22, -0.06),
      phase: rand(0, Math.PI * 2),
      a: rand(0.2, 0.6),
    };
  }
  function resize() {
    const nw = window.innerWidth, nh = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = nw * dpr; cv.height = nh * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const widthChanged = nw !== w;
    w = nw; h = nh;
    // スマホのアドレスバーの出入り（高さだけの変化）では粒を作り直さない
    if (widthChanged || !motes.length) {
      const n = Math.round(Math.min(90, Math.max(30, (w * h) / 14000)));
      motes = Array.from({ length: n }, () => make(true));
    }
  }
  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    for (const m of motes) {
      m.x += m.vx + Math.sin(t / 3000 + m.phase) * 0.12;
      m.y += m.vy;
      if (m.y < -10 || m.x < -10 || m.x > w + 10) Object.assign(m, make(false));
      // 上下の端ではやさしく消える
      const edge = Math.min(1, m.y / (h * 0.12), (h - m.y) / (h * 0.12));
      const alpha = m.a * Math.max(0, edge);
      const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 3);
      g.addColorStop(0, `rgba(255,228,180,${alpha})`);
      g.addColorStop(1, 'rgba(255,228,180,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(draw);
})();

// 作品のページ：本編を再生すると客席の照明が落ちる
(() => {
  const v = document.querySelector('.screen video');
  if (!v) return;
  const on = () => document.body.classList.add('lights-off');
  const off = () => document.body.classList.remove('lights-off');
  v.addEventListener('play', on);
  v.addEventListener('pause', off);
  v.addEventListener('ended', off);
})();

// 作品のページ：自作の再生バー（上の段：シーク、下の段：今の時間｜−5・再生・+5｜音・全画面）
// 2026-11-16：再生を始めるときは PC もスマホも全画面に。スマホはスキップなし、再生ボタンは動画の真ん中
(() => {
  const screen = document.querySelector('.screen');
  const v = screen && screen.querySelector('video');
  if (!v) return;
  const $ = s => screen.querySelector(s);
  const seek = $('.c-seek');
  const cur = $('.c-cur');
  const STEP = 5;
  let seeking = false;
  let timer;
  const fmt = t => {
    t = Math.max(0, Math.floor(t || 0));
    return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  };
  const show = () => {
    screen.classList.add('show-ui');
    clearTimeout(timer);
    if (!v.paused) timer = setTimeout(() => screen.classList.remove('show-ui'), 2500);
  };
  const isFull = () => document.fullscreenElement || document.webkitFullscreenElement || v.webkitDisplayingFullscreen;
  const enterFull = () => {
    if (isFull()) return;
    if (screen.requestFullscreen) screen.requestFullscreen().catch(() => {});
    else if (screen.webkitRequestFullscreen) screen.webkitRequestFullscreen();
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); // iPhone は本体の全画面プレーヤーで
  };
  const exitFull = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
    else if (v.webkitDisplayingFullscreen && v.webkitExitFullscreen) v.webkitExitFullscreen();
  };
  // 再生を始めるときは全画面にする。止めるときはそのまま
  const toggle = () => {
    if (v.paused) {
      const p = v.play();
      enterFull();
      if (p && p.catch) p.catch(() => {});
    } else {
      v.pause();
    }
  };
  const skip = s => {
    v.currentTime = Math.min(Math.max(0, v.currentTime + s), v.duration || 0);
    show();
  };
  const update = () => {
    const p = v.duration ? v.currentTime / v.duration : 0;
    if (!seeking) seek.value = Math.round(p * 1000);
    seek.style.setProperty('--p', (seek.value / 10) + '%');
    cur.textContent = fmt(v.currentTime) + ' / ' + fmt(v.duration);
  };

  $('.tap-layer').addEventListener('click', () => { toggle(); show(); });
  $('.c-play').addEventListener('click', () => { toggle(); show(); });
  $('.big-play').addEventListener('click', () => { toggle(); show(); });
  $('.c-back').addEventListener('click', () => skip(-STEP));
  $('.c-fwd').addEventListener('click', () => skip(STEP));
  $('.c-mute').addEventListener('click', () => { v.muted = !v.muted; show(); });
  $('.c-full').addEventListener('click', () => { isFull() ? exitFull() : enterFull(); show(); });
  seek.addEventListener('input', () => {
    seeking = true;
    if (v.duration) v.currentTime = seek.value / 1000 * v.duration;
    update();
    show();
  });
  seek.addEventListener('change', () => { seeking = false; });

  v.addEventListener('play', () => {
    screen.classList.add('is-playing');
    $('.c-play').setAttribute('aria-label', '一時停止');
    show();
  });
  v.addEventListener('pause', () => {
    screen.classList.remove('is-playing');
    $('.c-play').setAttribute('aria-label', '再生');
    show();
  });
  v.addEventListener('volumechange', () => {
    screen.classList.toggle('is-muted', v.muted);
    $('.c-mute').setAttribute('aria-label', v.muted ? '音を出す' : '音を消す');   // 読み上げの名前も合わせる
  });
  ['timeupdate', 'loadedmetadata', 'durationchange', 'seeked'].forEach(ev => v.addEventListener(ev, update));
  screen.addEventListener('mousemove', show);
  screen.addEventListener('touchstart', show, { passive: true });

  document.addEventListener('keydown', e => {
    const el = e.target instanceof Element ? e.target : null;
    if (el && el.closest('input, textarea')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); skip(-STEP); }
    if (e.key === 'ArrowRight') { e.preventDefault(); skip(STEP); }
    if (e.key === ' ' && !(el && el.closest('button, a'))) { e.preventDefault(); toggle(); show(); }
  });

  update();
  show();
})();

// 作品のページ：動画の前の赤い幕。クリック／タップで左右に開く（2026-11-16）
(() => {
  const screen = document.querySelector('.screen');
  const btn = screen && screen.querySelector('.sc-curtains');
  if (!btn) return;
  const sub = btn.querySelector('.sc-hint-sub');
  if (sub && matchMedia('(hover: none)').matches) sub.textContent = 'タップで幕が開きます';
  const open = () => {
    if (screen.classList.contains('curtains-open')) return;
    screen.classList.add('curtains-open');
    setTimeout(() => screen.classList.add("curtains-gone"), 3300);
  };
  btn.addEventListener('click', open);
  // 幕が閉じている間のスペースキーは、再生ではなく幕を開ける
  document.addEventListener('keydown', e => {
    if (e.key === ' ' && !screen.classList.contains('curtains-open')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      open();
    }
  }, true);
})();

// 客席（2026-11-17）：あらすじと情報のカードのちょうど真ん中から始まり、フッターまで続く。
// 階段状（スクリーンに近い列ほど低く、手前ほど高い）。左右に縦の階段、階段から端までは3席ずつ。
// 全体の約4割の所に横の通路。座席の約3分の1に観客（決まった乱数で毎回同じ並び）
(() => {
  const seats = document.querySelector('.seats');
  const syn = document.querySelector('.info .synopsis');
  const meta = document.querySelector('.info .meta');
  if (!seats || !syn || !meta) return;
  const cv = document.createElement('canvas');
  cv.className = 'seats-cv';
  seats.appendChild(cv);
  const ctx = cv.getContext('2d');
  const wcv = document.createElement('canvas');
  wcv.className = 'walls-cv';
  document.body.appendChild(wcv);
  const wctx = wcv.getContext('2d');
  const PC = { D: 373, wF: 90, aisleH: 40, gapTop: 36, eBot: -30, lean: 0.4 };
  const SP = { D: 244, wF: 36, aisleH: 22, gapTop: 6, eSeat: 0.12, eBot: -30, lean: 0.3 };
  const rng = seed => () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const rr = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  };
  const glow = (x, y, r, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,210,140,${a})`);
    g.addColorStop(.35, `rgba(255,180,90,${a * .35})`);
    g.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const person = (cx, top, w, rand) => {
    const r = w * (0.17 + rand() * 0.03);
    const hy = top - r * (0.55 + rand() * 0.25);
    const hx = cx + (rand() - 0.5) * w * 0.08;
    ctx.fillStyle = '#0b0506';
    ctx.beginPath();
    ctx.ellipse(hx, top + r * 0.55, w * 0.34, r * 1.15, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(hx - r * 0.35, hy, r * 0.7, r * 1.4);
    ctx.beginPath();
    ctx.arc(hx, hy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,205,170,.16)';
    ctx.lineWidth = Math.max(1, w * 0.02);
    ctx.beginPath();
    ctx.arc(hx, hy, r, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  };
  const seat = (x, y, w, h) => {
    const bw = w * 44 / 60, bx = x + w * 8 / 60, by = y + h * 4 / 50;
    ctx.fillStyle = '#180608';
    rr(x + w * 2 / 60, y + h * 26 / 50, w * 6 / 60, h * 24 / 50, 2); ctx.fill();
    rr(x + w * 52 / 60, y + h * 26 / 50, w * 6 / 60, h * 24 / 50, 2); ctx.fill();
    ctx.fillStyle = '#260a0e';
    rr(bx, by, bw, h - (by - y), w * 10 / 60); ctx.fill();
    ctx.strokeStyle = '#521620';
    ctx.lineWidth = Math.max(1, w * 2 / 60);
    ctx.beginPath();
    ctx.moveTo(bx, by + w * 10 / 60);
    ctx.quadraticCurveTo(bx, by, bx + w * 10 / 60, by);
    ctx.lineTo(bx + bw - w * 10 / 60, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + w * 10 / 60);
    ctx.stroke();
  };
  const place = () => {
    const d = innerWidth < 760 ? SP : PC;
    seats.style.marginTop = '';
    seats.style.height = '';
    const natTop = seats.getBoundingClientRect().top;
    const synB = syn.getBoundingClientRect().bottom;
    const mr = meta.getBoundingClientRect();
    const start = (synB + mr.top) / 2;
    const gap = Math.max(0, natTop - start);
    // 客席の下の端（＝フッターの線）を、情報のカードの下から「カードの上〜あらすじ」と同じ距離に（2026-11-17）
    const above = mr.top - synB;
    seats.style.marginTop = -gap + 'px';
    const H = Math.max(80, Math.round(mr.bottom + above - seats.getBoundingClientRect().top));
    seats.style.height = H + 'px';
    const W = seats.clientWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 遠近（2026-11-17）：客席全体を「ハ」の字に。スクリーン側（上）ほど列の幅がせまく、手前（下）ほど広い。
    // 階段・通路・座席は列の幅に合わせて並ぶので、全体がハの字に集まる。左右の3席の外側は壁
    const U = Math.max(10, W / d.wF);                  // 1列の幅を座席いくつぶんで割るか
    const nC = Math.max(2, Math.floor(U - 6 - 1.5));    // 真ん中の席の数（どの列も同じ）
    // 壁の線（2026-11-17 オーナーのスケッチ）：左右の黒い壁は、天井（ページの上）から客席の上の端まではまっすぐ縦
    // （動画のすぐ外側）。客席の部分では下へ行くほど外へ開く「ハ」の字。客席の列の端はこの線に合わせる
    const sr = document.querySelector('.proscenium').getBoundingClientRect();
    const seatsTopPage = seats.getBoundingClientRect().top + scrollY;
    const eTop = Math.max(0, sr.left - d.gapTop);      // 縦の部分の壁の内側の端
    const eBot = d.eBot;                                // 客席の一番下での壁の内側の端（画面の外へ出てもよい）
    // スマホ（2026-11-17）：動画が画面いっぱいで壁の縦の部分が画面の端に近く、そこから開くと斜めの線が画面の外へ出て
    // まっすぐに見えた。客席の上の端だけ壁を内側（幅の eSeat の割合）から始め、PC と同じくハの字が見えるように
    const eS = d.eSeat ? Math.round(W * d.eSeat) : eTop;
    const wallX = yPage => yPage <= seatsTopPage ? eTop : eS + (eBot - eS) * Math.min(1, (yPage - seatsTopPage) / H);
    const rowAt = y => {
      const eL = wallX(seatsTopPage + y);
      const Wr = W - 2 * eL;
      const w = Wr / U;
      const sw = w * 0.75;
      return { Wr, w, h: Math.round(w * 5 / 6), eL, eR: eL + Wr, sw, xL: eL + 3 * w, xR: eL + Wr - 3 * w - sw };
    };
    const rows = [];
    let y = 0, ay = -1, ayEnd = -1;
    for (let k = 0; k < 80; k++) {
      const r = rowAt(y);
      if (y + r.h > H) break;
      r.y = y;
      rows.push(r);
      y += Math.round(r.h * 0.62);
      if (ay < 0 && y > H * 0.36) {
        ay = y + Math.round(r.h * 0.25);
        ayEnd = ay + Math.round(d.aisleH * r.w / d.wF);
        y = ayEnd;
      }
    }
    if (!rows.length) return;
    { // 一番手前の列は下にそろえる（幅も下の位置で決め直す）
      const last = rows[rows.length - 1];
      const r = rowAt(H - last.h);
      Object.assign(last, r, { y: H - r.h });
    }

    // 段（ステップ）の床：手前ほど高い段。段の縁に細い明かりの線
    rows.forEach((r, i) => {
      const t1 = r.y + r.h * 0.45;
      const t2 = i < rows.length - 1 ? rows[i + 1].y + rows[i + 1].h * 0.45 : H;
      const g = ctx.createLinearGradient(0, t1, 0, t2);
      g.addColorStop(0, i % 2 ? 'rgba(44,12,16,.6)' : 'rgba(36,10,13,.6)');
      g.addColorStop(1, 'rgba(14,4,6,.8)');
      ctx.fillStyle = g;
      ctx.fillRect(0, t1, W, t2 - t1);
      ctx.fillStyle = 'rgba(140,50,60,.28)';
      ctx.fillRect(0, t1, W, 1);
    });
    // 横の通路
    if (ay >= 0) {
      ctx.fillStyle = '#050304';   // 横の通路の足元は黒
      ctx.fillRect(0, ay, W, ayEnd - ay);
      ctx.fillStyle = 'rgba(160,60,70,.25)';
      ctx.fillRect(0, ay, W, 1);
      const ra = rowAt(ayEnd);
      for (let x = ra.eL + ra.w * 1.5; x < ra.eR - ra.w; x += ra.w * 1.6) glow(x, ayEnd - 4, 5, .85);
    }
    // 左右の縦の階段（ハの字にそって。段の縁に足元の灯り）
    const stair = side => {
      for (let i = 0; i < rows.length; i++) {
        const a = rows[i], b = rows[i + 1];
        const y1 = a.y + a.h * 0.45, y2 = b ? b.y + b.h * 0.45 : H;
        const ra = rowAt(y1), rb = rowAt(y2);
        const xa = side === 'L' ? ra.xL : ra.xR, xb = side === 'L' ? rb.xL : rb.xR;
        ctx.fillStyle = '#1d0c0f';
        ctx.beginPath();
        ctx.moveTo(xa, y1); ctx.lineTo(xa + ra.sw, y1);
        ctx.lineTo(xb + rb.sw, y2); ctx.lineTo(xb, y2);
        ctx.closePath(); ctx.fill();
        for (const t of [0, 0.5]) {
          const yy = y1 + (y2 - y1) * t, rr2 = rowAt(yy);
          const xx = side === 'L' ? rr2.xL : rr2.xR;
          ctx.fillStyle = 'rgba(190,120,90,.35)';
          ctx.fillRect(xx + 1, yy, rr2.sw - 2, 1);
          if (t === 0) {   // 灯りは1列に1段だけ
            glow(xx + 3, yy + 1, Math.max(3, rr2.w * 0.08), .8);
            glow(xx + rr2.sw - 3, yy + 1, Math.max(3, rr2.w * 0.08), .8);
          }
        }
      }
    };
    stair('L');
    stair('R');

    // 座席（奥の列から順に）。中心から離れるほど外側へ傾けて、ハの字に見せる
    rows.forEach((r, i) => {
      const rand = rng(1000 + i * 97);
      const xs = [0, 1, 2].map(k => r.xL - (k + 1) * r.w);
      const cL = r.xL + r.sw, cR = r.xR;
      const c0 = cL + ((cR - cL) - nC * r.w) / 2;
      for (let k = 0; k < nC; k++) xs.push(c0 + k * r.w);
      for (let k = 0; k < 3; k++) xs.push(r.xR + r.sw + k * r.w);
      xs.forEach(x => {
        const cx = x + r.w / 2;
        const k = ((cx - W / 2) / (W / 2)) * d.lean;   // 傾き（左は左下へ、右は右下へ）
        ctx.save();
        ctx.translate(cx, r.y);
        ctx.transform(1, 0, k, 1, 0, 0);
        ctx.translate(-cx, -r.y);
        if (rand() < 1 / 3) person(cx, r.y + r.h * 4 / 50, r.w, rand);
        seat(x, r.y, r.w, r.h);
        ctx.restore();
      });
    });

    // ページ全体の左右の黒い壁（天井＝ページの上から、客席の下＝フッターの線まで）
    const bottom = seatsTopPage + H;
    const DW = document.documentElement.clientWidth;
    wcv.style.height = bottom + 'px';
    wcv.style.width = DW + 'px';
    wcv.width = DW * dpr; wcv.height = bottom * dpr;
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wctx.clearRect(0, 0, DW, bottom);
    [['L', 0], ['R', DW]].forEach(([side, xOut]) => {
      const fx = x => side === 'L' ? x : DW - x;
      const pts = [[fx(eTop), 0], [fx(eTop), seatsTopPage], ...(eS !== eTop ? [[fx(eS), seatsTopPage]] : []), [fx(eBot), bottom]];
      const g = wctx.createLinearGradient(xOut, 0, fx(eTop), 0);
      g.addColorStop(0, '#000');
      g.addColorStop(1, '#0a0607');
      wctx.fillStyle = g;
      wctx.beginPath();
      wctx.moveTo(xOut, 0);
      pts.forEach(([x, yy]) => wctx.lineTo(x, yy));
      wctx.lineTo(xOut, bottom);
      wctx.closePath(); wctx.fill();
      // 壁の内側の縁にうっすら光
      wctx.strokeStyle = 'rgba(201,169,106,.22)';
      wctx.lineWidth = 1;
      wctx.beginPath();
      pts.forEach(([x, yy], i) => i ? wctx.lineTo(x, yy) : wctx.moveTo(x, yy));
      wctx.stroke();
    });
  };
  place();
  window.addEventListener('load', place);
  window.addEventListener('resize', place);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
})();

// 一覧：表紙の画像が読み込まれるまでは、ぼかした小さな表紙を見せ、読み込めたらふわっと切り替える（2026-11-17）
document.querySelectorAll('.card .thumb img').forEach(img => {
  if (img.complete && img.naturalWidth) return;
  img.classList.add('loading');
  const done = () => img.classList.remove('loading');
  img.addEventListener('load', done);
  img.addEventListener('error', done);
});
