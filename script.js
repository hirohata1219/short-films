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
(() => {
  const cv = document.querySelector('.dust');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  let w, h, dpr, motes = [];
  const rand = (a, b) => a + Math.random() * (b - a);
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(60, Math.max(24, w / 22)));
    motes = Array.from({ length: n }, () => make(true));
  }
  function make(anywhere) {
    // 上の真ん中（明かりの中）に多く集まるように
    const x = w / 2 + (Math.random() + Math.random() - 1) * w * 0.45;
    return {
      x, y: anywhere ? rand(0, h) : h + 10,
      r: rand(0.6, 2.2),
      vx: rand(-0.08, 0.08),
      vy: rand(-0.22, -0.06),
      phase: rand(0, Math.PI * 2),
      a: rand(0.25, 0.7),
    };
  }
  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    for (const m of motes) {
      m.x += m.vx + Math.sin(t / 3000 + m.phase) * 0.12;
      m.y += m.vy;
      if (m.y < -10 || m.x < -10 || m.x > w + 10) Object.assign(m, make(false));
      // 明かりの中心に近いほど明るく、上下の端ではやさしく消える
      const cx = Math.abs(m.x - w / 2) / (w / 2);
      const edge = Math.min(1, m.y / (h * 0.15), (h - m.y) / (h * 0.25));
      const alpha = m.a * Math.max(0, 1 - cx * 0.8) * Math.max(0, edge);
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
