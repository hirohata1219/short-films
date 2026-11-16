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
  v.addEventListener('volumechange', () => screen.classList.toggle('is-muted', v.muted));
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

// 客席（2026-11-17）：あらすじと「完成」の行のちょうど真ん中から始まり、フッターまで続く。
// 奥の2列 → 横の通路（足元の灯り）→ 手前の3列。手前ほど大きく、列は少しずつ横にずらす
(() => {
  const seats = document.querySelector('.seats');
  const syn = document.querySelector('.info .synopsis');
  const meta = document.querySelector('.info .meta');
  if (!seats || !syn || !meta) return;
  // 列の設計（top は上からの位置、w は座席1つの幅。高さは幅の 5/6）
  const PC = { rows: [[0, 64], [40, 76], [140, 94], [200, 108], [270, 124]], aisle: [92, 40], D: 373 };
  const SP = { rows: [[0, 40], [26, 48], [92, 60], [130, 70], [176, 82]], aisle: [60, 26], D: 244 };
  const place = () => {
    const d = innerWidth < 760 ? SP : PC;
    seats.style.marginTop = '';
    seats.style.height = '';
    const natTop = seats.getBoundingClientRect().top;
    const start = (syn.getBoundingClientRect().bottom + meta.getBoundingClientRect().top) / 2;
    const gap = Math.max(0, natTop - start);
    const H = Math.max(d.D, gap + 60);
    seats.style.marginTop = -gap + 'px';
    seats.style.height = H + 'px';
    const s = H / d.D; // 列の間隔だけを高さに合わせて伸ばす（座席の大きさは変えない）
    const seat = getComputedStyle(seats).getPropertyValue('--seat').trim();
    const layers = [];
    d.rows.slice().reverse().forEach(([top, w], k) => {
      const h = Math.round(w * 5 / 6);
      const y = k === 0 ? H - h : Math.round(top * s);   // 一番手前の列は下にそろえる
      const shift = (d.rows.length - 1 - k) % 2 ? w / 2 : 0;    // 1列ごとに半分ずらす
      layers.push(`${seat} calc(50% + ${shift}px) ${y}px / ${w}px ${h}px repeat-x`);
    });
    const [ay, ah] = [Math.round(d.aisle[0] * s), d.aisle[1]];
    // 通路の足元の灯り
    layers.push(`radial-gradient(circle, rgba(255,200,120,.85) 0 1.5px, rgba(255,180,90,.25) 3px, transparent 5px) 50% ${ay + ah - 8}px / 110px 10px repeat-x`);
    // 通路の床
    layers.push(`linear-gradient(rgba(90,22,30,.35), rgba(50,12,18,.35)) 0 ${ay}px / 100% ${ah}px no-repeat`);
    layers.push('linear-gradient(to bottom, rgba(0,0,0,0), rgba(60,10,16,.35))');
    seats.style.background = layers.join(', ');
  };
  place();
  window.addEventListener('load', place);
  window.addEventListener('resize', place);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
})();
