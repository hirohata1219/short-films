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
  // CM が終わって次へ切り替わるときは、照明をつけない
  // CM・ロゴから次へ切り替わるときと、本編が終わってエンドロールへ進むときは、照明をつけない
  const sc = v.closest('.screen');
  const off = () => { if (!(v.ended && (sc.classList.contains('pre-roll') || sc.querySelector('.credits')))) document.body.classList.remove('lights-off'); };
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
  // 2026-11-18 オーナー：iPhone は再生を押したら自動で横画面に（縦では見られなくてよい）。
  // iPhone は要素の全画面ができず、本体の全画面プレーヤーでは CM をとばす・注意書き・エンドロールが見えないので、
  // スクリーンを画面いっぱいに広げ、縦向きのときは 90度回して横画面にする（.pseudo-full、style.css）
  const canFull = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  // 2026-11-19 オーナー：iPhone は縦のままだと上のバー（時刻・電波・電池）が消せないので、動画の下に黄色の太字で案内を出す
  if (!canFull && matchMedia('(pointer: coarse)').matches) {
    const note = document.createElement('p');
    note.className = 'rotate-note';
    note.textContent = '※必ず画面の回転ロックを解除し、スマホを横にして再生してください。';
    const stage = screen.closest('.proscenium') || screen;
    stage.insertAdjacentElement('afterend', note);
  }
  const isFull = () => document.fullscreenElement || document.webkitFullscreenElement || v.webkitDisplayingFullscreen || screen.classList.contains('pseudo-full');
  const enterFull = () => {
    if (isFull()) return;
    if (!canFull) {
      screen.classList.add('pseudo-full');
      document.documentElement.classList.add('pseudo-full-on');
      return;
    }
    const lockLand = () => { try { const o = window.screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (e) {} };   // Android は全画面のあと横に固定
    if (screen.requestFullscreen) screen.requestFullscreen().then(lockLand).catch(() => {});
    else if (screen.webkitRequestFullscreen) screen.webkitRequestFullscreen();
  };
  // 横長でない映像（16:9 など）には fill を付ける。iPhone の横画面のときだけ上下を切って画面いっぱいに（style.css）
  // 上下を切ると文字が欠ける場面（秒はカットの切れ目）：時計の CM の最後は全部見せる、マナー CM の最後は下側だけ切る
  const FILL_ADJUST = { 'kestrelle.mp4': [13.95, 'adj-contain'], 'manner.mp4': [17.409, 'adj-top'] };
  const applyAdjust = t => {
    const a = FILL_ADJUST[(v.currentSrc || '').split('/').pop()];
    v.classList.toggle('adj-contain', !!a && a[1] === 'adj-contain' && t >= a[0]);
    v.classList.toggle('adj-top', !!a && a[1] === 'adj-top' && t >= a[0]);
  };
  v.addEventListener('loadedmetadata', () => { v.classList.toggle('fill', v.videoWidth / v.videoHeight < 2); applyAdjust(0); });
  if (v.requestVideoFrameCallback) {   // コマごとに合わせる（カットの切れ目でぴったり変わるように）
    const onFrame = (now, meta) => { applyAdjust(meta.mediaTime); v.requestVideoFrameCallback(onFrame); };
    v.requestVideoFrameCallback(onFrame);
  } else v.addEventListener('timeupdate', () => applyAdjust(v.currentTime));
  const exitFull = () => {
    if (screen.classList.contains('pseudo-full')) {
      screen.classList.remove('pseudo-full');
      document.documentElement.classList.remove('pseudo-full-on');
      return;
    }
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
    else if (v.webkitDisplayingFullscreen && v.webkitExitFullscreen) v.webkitExitFullscreen();
  };
  // 上映前の CM（2026-11-18）：最初に再生を押すと CM を順に流し、終わるか「CM をとばす」で本編へ。
  // 動画は1つのまま中身を入れ替える（iPhone でも続けて再生できるように）。ページを開くたびに毎回流す
  // 2026-11-18：CM のあと、本編の前に映画会社のロゴ（data-intro）を流す。「CM をとばす」でもロゴは流す。ロゴの間は何も表示しない
  const ads = (v.dataset.ads || '').split(/\s+/).filter(Boolean);
  const intro = v.dataset.intro || '';
  // CM ごとの「ふわっと始まる」長さ（ミリ秒）。2026-11-18 オーナー：時計の CM は 1.6秒、次の CM はその半分
  const adFades = (v.dataset.adFades || '').split(/\s+/).filter(Boolean).map(Number);
  const pre = [...ads.map((src, i) => ({ src, ad: true, fade: adFades[i] || 0 })), ...(intro ? [{ src: intro, ad: false, fade: 0 }] : [])];
  // 音を 0 から 1 へ ms かけて上げる（requestAnimationFrame の時刻は少し前のことがあるので 0〜1 に収める）
  const rampVolume = ms => {
    const t0 = performance.now();
    const step = () => {
      const k = Math.max(0, Math.min(1, (performance.now() - t0) / ms));
      v.volume = k;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const filmSrc = v.querySelector('source').getAttribute('src');
  const posterSrc = v.getAttribute('poster');
  // 2026-11-19 オーナー：本編の動画の頭に、黒い画面で曲だけを流す部分（約10秒）が入っている。その長さ（秒）。
  // 再生バーの時間と位置は、この後ろ（本編の絵が始まる所）を 0:00 として数える
  const FILM_OFF = parseFloat(v.dataset.filmStart) || 0;
  // 2026-11-19 オーナー：本編とエンドロールの曲がつながる作品は、本編の動画の後ろにエンドロールの曲（＋黒い画面）を入れて 1本にした
  // （別のファイルで曲を鳴らすと iPhone などでつなぎ目が途切れるため）。data-film-end＝本編の絵が終わる秒。ここでエンドロールを始める
  const FILM_END = parseFloat(v.dataset.filmEnd) || 0;
  const filmLen = () => FILM_END || v.duration || 0;          // 本編の終わり（動画の何秒目か）
  const filmLeft = () => filmLen() - v.currentTime;           // 本編の残り
  let preIdx = pre.length ? -1 : pre.length;   // -1＝まだ、0〜＝本編の前の何本目（CM・ロゴ）、pre.length＝本編
  const inAd = () => screen.classList.contains('pre-roll');   // 本編の前（CM・ロゴ）の間
  const playNow = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  const toFilm = () => {
    preIdx = pre.length;
    screen.classList.remove('pre-roll', 'ad-mode');
    v.src = filmSrc;
    playNow();
  };
  // 各 CM の前は 2秒、ロゴの前は 4秒、真っ暗にしてから始める（2026-11-18 オーナー）。暗い間に次の動画を読み込んでおく
  const GAP_AD = 2000, GAP_INTRO = 4000;
  let preTimer = null, waiting = false;
  const startPre = i => {
    clearTimeout(preTimer);
    if (i >= pre.length) return toFilm();
    preIdx = i;
    hushMusic();
    screen.classList.add('pre-roll', 'black', 'cut');   // cut：暗い幕をすぐ出し、すぐ外す（CM・ロゴは頭からはっきり見せる）
    document.body.classList.add('lights-off');
    screen.classList.toggle('ad-mode', pre[i].ad);   // 「CM をとばす」は CM の間だけ（2026-11-18：「CM 1/2」の表示はなくした）
    v.removeAttribute('poster');   // 切り替えの間に本編の表紙が見えないように
    v.src = pre[i].src;
    waiting = true;
    const fade = pre[i].fade;
    preTimer = setTimeout(() => {
      waiting = false;
      if (fade) {
        // ふわっと始める：映像は暗い幕を fade ミリ秒で外す（音は 2026-11-19 から上げない）
        v.volume = 1;   // 2026-11-19 オーナー（時計の CM）：音は頭から普通の音量で。絵だけふわっと明るくする
        v.addEventListener('playing', () => {
          cover.style.transitionDuration = fade + 'ms';
          screen.classList.remove('cut');
          void cover.offsetWidth;   // cut を外したのを先に反映させてから幕を外す（ゆっくり消えるように）
          screen.classList.remove('black');
          setTimeout(() => { cover.style.transitionDuration = ''; }, fade + 100);
        }, { once: true });
      } else {
        v.volume = 1;
        screen.classList.remove('black');
        setTimeout(() => screen.classList.remove('cut'), 100);
      }
      playNow();
    }, pre[i].ad ? GAP_AD : GAP_INTRO);
  };
  // ロゴが終わったら、真っ暗なまま 3秒 → 本編の動画を再生（2026-11-19 オーナー）。
  // 動画の頭は黒い画面で曲だけ（小さく始まる）。その間に注意書きが 1秒で浮かび 4秒 → 1秒で消え、曲だけ少し流れて本編の絵へ
  const N_BEFORE = 3000, NOTICE_HOLD = 4;
  // 注意書きが浮かび始める秒（data-notice-at）。2026-11-19 オーナー（小さなやさしさ）：前後の真っ暗が同じ長さになる真ん中に。なければ 1秒
  const NOTICE_AT = parseFloat(v.dataset.noticeAt) || 1;
  const cover = document.createElement('div');
  cover.className = 'fade-cover';
  screen.insertBefore(cover, screen.querySelector('.tap-layer'));
  const notice = document.createElement('p');
  notice.className = 'pre-notice';
  notice.innerHTML = '本作品は生成 AI を用いて制作されたフィクションです。<br>実在の人物・団体・出来事とは関係ありません。';
  screen.insertBefore(notice, screen.querySelector('.tap-layer'));
  const inFilm = () => !inAd() && preIdx === pre.length && !post;
  // 本編の終わりのマーク（2026-11-19 オーナー）：本編の最後の 2.6秒、右下にふわっと（作品ごとのデザインは style.css）
  const endMark = screen.querySelector('.end-mark');
  const END_LEAD = 2.6, END_FADE = 0.7;
  // 暗さは CSS の動き（遅れることがある）に任せず、映像の残り時間から毎コマ決める
  let endRaf = null;
  const applyEnd = () => {
    if (post || !inFilm()) return false;
    const k = Math.max(0, Math.min(1, (END_FADE - filmLeft()) / END_FADE));
    cover.style.transition = 'none'; cover.style.opacity = k;
    if (endMark && k > 0) { endMark.style.transition = 'none'; endMark.style.opacity = 1 - k; }
    return true;
  };
  const endTick = () => {
    endRaf = null;
    if (applyEnd() && !v.paused && !v.ended) endRaf = requestAnimationFrame(endTick);
  };
  const clearEndFade = () => {
    if (endRaf) { cancelAnimationFrame(endRaf); endRaf = null; }
    cover.style.transition = cover.style.opacity = '';
    if (endMark) endMark.style.transition = endMark.style.opacity = '';
  };
  v.addEventListener('timeupdate', () => {
    if (endMark && !post) endMark.classList.toggle('on', inFilm() && filmLeft() <= (parseFloat(endMark.dataset.lead) || END_LEAD));
    // 2026-11-19 オーナー：本編の最後は、題名の映像と右下のマークを同時に消していく（最後の 0.7秒で一緒に暗く）
    if (!post && inFilm()) {
      if (filmLeft() <= END_FADE + 0.4) { applyEnd(); if (!endRaf) endRaf = requestAnimationFrame(endTick); }
      else clearEndFade();
      // 1本にした作品：本編の絵が終わる時刻ちょうどにエンドロールへ（timeupdate は 0.25秒ほどおきなので、手前で時刻を合わせて待つ）
      if (FILM_END && credits && !joinTimer && filmLeft() <= 0.6) {
        joinTimer = setTimeout(() => { joinTimer = null; if (!post && inFilm() && !v.paused && filmLeft() <= 0.1) toCredits(); }, Math.max(0, filmLeft() * 1000));
      }
    }
    noticeTick();
  });
  // 注意書きは timeupdate（0.25秒おき）では遅れるので、次に出す／消す時刻までのタイマーをかける（timeupdate のたびにかけ直す）（2026-11-19）
  let noticeRaf = null;
  function noticeTick() {
    clearTimeout(noticeRaf); noticeRaf = null;
    const t = v.currentTime, end = NOTICE_AT + 1 + NOTICE_HOLD;
    notice.classList.toggle('on', inFilm() && FILM_OFF > NOTICE_AT + NOTICE_HOLD && t >= NOTICE_AT && t < end);
    if (inFilm() && !v.paused && t < end) noticeRaf = setTimeout(noticeTick, ((t < NOTICE_AT ? NOTICE_AT : end) - t) * 1000 / (v.playbackRate || 1) + 5);
  }
  const blackThenFilm = () => {
    waiting = true;
    preIdx = pre.length;
    hushMusic();
    screen.classList.add('black', 'cut');
    screen.classList.remove('ad-mode');
    v.src = filmSrc;   // 暗い間に本編を読み込んでおく（止まったまま）
    setTimeout(() => {
      screen.classList.remove('pre-roll');
      v.volume = 1;   // 曲の小さな始まりと本編の絵のふわっと明るくなるのは、動画の中に入れてある
      v.addEventListener('playing', () => {
        screen.classList.remove('black');
        setTimeout(() => screen.classList.remove('cut'), 100);
        waiting = false;
      }, { once: true });
      playNow();
    }, N_BEFORE);
  };
  // エンドロール（2026-11-18）：本編が終わったら、左に文字が流れ、右に作品の場面
  // 2026-11-19 オーナー：曲は本編から続けて、小さい音からだんだん大きく。文字は大きく、一定の速さで下から上へ流れて画面の外へ。
  // 曲の決めの音（.credits の data-bang、本編が終わってからの秒）で、黒い画面の右下に作品名と「© 年 POCKET FILMS」
  const credits = screen.querySelector('.credits');
  const music = screen.querySelector('.cr-music');
  const BANG = credits ? (parseFloat(credits.dataset.bang) || 25) * 1000 : 0;
  const ROLL_START = 4000;   // 本編が終わってから真っ暗 4秒で文字が流れ始める（2026-11-18 オーナー）
  let post = false, timers = [], rollAnim = null, unlocked = false, joinTimer = null, crT0 = 0;
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const laterC = (ms, fn) => later(Math.max(0, crT0 + ms - performance.now()), fn);   // 本編が終わってから ms の時に
  const clearLater = () => { timers.forEach(clearTimeout); timers = []; };
  // iPhone などは、あとで曲を鳴らすには最初に押したときに一度鳴らしておく必要がある（音なしで鳴らしてすぐ止める）
  const unlockMusic = () => {
    if (!music || unlocked) return;
    unlocked = true;
    // 2026-11-19：前は「鳴り始めてから止める」にしていたが、iPhone では止まらず CM 1本目に曲が流れた。
    // 押したその場で play と pause を続けて呼び、エンドロールまで音を消したままにする
    music.muted = true;
    const p = music.play();
    if (p && p.catch) p.catch(() => {});
    music.pause();
  };
  const hushMusic = () => { if (music && !post) { music.pause(); music.muted = true; } };   // 念のため：本編の前・本編の間は曲を止めておく
  const fadeMusic = ms => {
    if (!music || music.paused) return;
    const v0 = music.volume, t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      music.volume = Math.max(0, v0 * (1 - k));
      if (k < 1) requestAnimationFrame(step); else { music.pause(); music.volume = 1; }
    };
    requestAnimationFrame(step);
  };
  const scenes = credits ? [...credits.querySelectorAll('.cr-scenes img')] : [];
  const endShow = () => {   // 真っ暗になって終わり → 照明がつき、全画面が戻る
    clearLater();
    clearTimeout(joinTimer); joinTimer = null;
    v.pause();
    screen.classList.remove('is-playing', 'film-paused');
    if (endMark) endMark.classList.remove('on');
    clearEndFade();
    if (music) { music.pause(); music.currentTime = 0; music.volume = 1; }
    if (rollAnim) { rollAnim.cancel(); rollAnim = null; }
    exitFull();
    document.body.classList.remove('lights-off');
    screen.classList.remove('post-roll');
    credits.classList.remove('final', 'final-on');
    const ct = credits.querySelector('.cr-title'); if (ct) ct.classList.remove('show', 'show-slow', 'show-bang');
    scenes.forEach(x => x.classList.remove('on'));
    post = false;
    // 2026-11-19 オーナー：見終わったら幕が左右から閉まり、最初の状態（表紙・「上映する」）に戻る。もう一度上映すると CM から
    screen.classList.remove('curtains-gone', 'can-skip', 'film-paused');
    // 全画面から元の画面に戻ってから 0.8秒おいて、左右の幕が真ん中へ閉じていく（開くときの逆。閉じきってから「上映する」が浮かぶ）
    setTimeout(() => { if (!post && preIdx === -1) screen.classList.add('watched'); screen.classList.remove('curtains-open'); }, 800);   // watched：幕に「ご視聴ありがとうございました。」と「もう一度観る」
    preIdx = pre.length ? -1 : pre.length;
    waiting = false;
    if (posterSrc) v.setAttribute('poster', posterSrc);
    v.src = filmSrc;
    show();
  };
  const showFinal = () => {   // 決めの音で文字と場面が消え、右下に作品名が 1.5秒で浮かぶ → 4.5秒 → 1.5秒で消える → 1秒の黒
    clearLater();
    credits.classList.add('final');
    later(300, () => credits.classList.add('final-on'));
    later(300 + 1500 + 4500, () => credits.classList.remove('final-on'));
    later(300 + 1500 + 4500 + 1500 + 1000, endShow);
  };
  const startCredits = () => {
    post = true;
    screen.classList.add('post-roll');
    notice.classList.remove('on');
    const roll = credits.querySelector('.cr-roll'), inner = credits.querySelector('.cr-inner');
    let started = false;
    const go = () => {   // 曲が鳴り始めた時（1本にした作品は本編の絵が終わった時）を 0 にして、文字・場面・最後の作品名の時刻を合わせる
      if (started) return;
      started = true;
      crT0 = FILM_END ? performance.now() - Math.max(0, v.currentTime - FILM_END) * 1000 : performance.now();
      laterC(ROLL_START, () => {
        // 2026-11-19 オーナー：スタッフの文字（制作〜Claude Code）が一定の速さで上へ流れて消えきり、その 1秒後に、題名を左側の真ん中に
        // その場で出す（作品ごとに slow＝ゆっくり／bang＝バンと）。出す瞬間（data-at、本編が終わってから）は曲の強い拍。文字はその 1秒前に消えきる速さ
        const title = credits.querySelector('.cr-title'), list = inner.querySelector('.cr-list'), lastDd = list.lastElementChild;
        const at = (parseFloat(title.dataset.at) || (BANG / 1000 - 3)) * 1000;
        const span = Math.max(4000, at - 1000 - ROLL_START);                  // 流れ始めてから消えきるまで
        const build = cur => {                                                 // 画面の大きさが変わったら、進んだ割合はそのままで位置を計算し直す
          const R = roll.clientHeight, listEnd = lastDd.offsetTop + lastDd.offsetHeight;
          if (rollAnim) rollAnim.cancel();
          rollAnim = inner.animate([{ transform: `translateY(${R}px)` }, { transform: `translateY(${-listEnd}px)` }],
            { duration: span, easing: 'linear', fill: 'forwards' });
          if (cur) rollAnim.currentTime = cur;
        };
        build(0);
        const rebuild = () => { if (post && rollAnim) build(rollAnim.currentTime); };
        addEventListener('resize', rebuild);
        title.style.setProperty('--fade', (parseFloat(title.dataset.fade) || 2.5) + 's');
        laterC(at, () => title.classList.add('show', 'show-' + (title.dataset.mode || 'slow')));
        scenes.forEach((im, i) => laterC(ROLL_START + i * (BANG - ROLL_START) / scenes.length, () => { scenes.forEach(x => x.classList.remove('on')); im.classList.add('on'); }));
      });
      laterC(BANG, showFinal);
    };
    if (FILM_END) { go(); return; }   // 1本にした作品：曲は動画の中で続いている
    if (music) {
      music.currentTime = 0;
      music.volume = 1;
      music.muted = v.muted;   // 本編で音を消していたら、エンドロールも消したまま
      music.addEventListener('playing', go, { once: true });
      const p = music.play();
      if (p && p.catch) p.catch(go);
    }
    later(800, go);   // 曲が鳴らないときも進める
  };
  // 2026-11-18 オーナー：「エンドロールをとばす」は PC もスマホもなくした
  const toCredits = () => {
    cover.style.transition = 'none'; cover.style.opacity = 1; if (endMark) endMark.style.opacity = 0;
    startCredits();
  };
  v.addEventListener('ended', () => {
    if (!inAd()) { if (credits && !post) toCredits(); return; }
    preIdx + 1 >= pre.length ? blackThenFilm() : startPre(preIdx + 1);
  });
  // 「CM をとばす」は CM が始まって 5秒たってから出す（2026-11-18 オーナー。PC もスマホも）。一度出たら次の CM でも出したまま
  const SKIP_AFTER = 5;
  v.addEventListener('timeupdate', () => {
    if (inAd() && preIdx >= 0 && preIdx < ads.length && (preIdx > 0 || v.currentTime >= SKIP_AFTER)) screen.classList.add('can-skip');
  });
  // CM をとばす → 2026-11-19 オーナー：ロゴもとばして、本編の前の真っ暗（3秒）→ 本編へ
  $('.ad-skip').addEventListener('click', () => { clearTimeout(preTimer); screen.classList.remove('can-skip'); blackThenFilm(); });

  // 再生を始めるときは全画面にする。止めるときはそのまま
  const toggle = () => {
    if (waiting || post) return;   // ロゴのあとの暗い 2秒の間と、エンドロールの間は、押しても何もしない
    unlockMusic();
    if (v.paused && preIdx === -1) {
      startPre(0);
      enterFull();
      return;
    }
    if (v.paused) {
      const p = v.play();
      enterFull();
      if (p && p.catch) p.catch(() => {});
    } else {
      v.pause();
    }
  };
  const off = () => (inAd() ? 0 : FILM_OFF);   // 本編の絵が始まる所（動画の何秒目か）
  const skip = s => {
    if (inAd() || post) return;   // CM・ロゴ・エンドロールの間は 5秒戻る・進むを使わない
    v.currentTime = Math.min(Math.max(v.currentTime >= off() ? off() : 0, v.currentTime + s), inAd() ? v.duration || 0 : filmLen());
    show();
  };
  const update = () => {
    const o = off(), d = Math.max(0, (inAd() ? v.duration || 0 : filmLen()) - o), t = Math.min(d, Math.max(0, v.currentTime - o));
    if (!seeking) seek.value = Math.round((d ? t / d : 0) * 1000);
    seek.style.setProperty('--p', (seek.value / 10) + '%');
    cur.textContent = fmt(t) + ' / ' + fmt(d);
  };

  $('.tap-layer').addEventListener('click', () => { toggle(); show(); });
  $('.c-play').addEventListener('click', () => { toggle(); show(); });
  $('.big-play').addEventListener('click', () => { toggle(); show(); });
  $('.c-back').addEventListener('click', () => skip(-STEP));
  $('.c-fwd').addEventListener('click', () => skip(STEP));
  $('.c-mute').addEventListener('click', () => { v.muted = !v.muted; show(); });
  $('.c-full').addEventListener('click', () => { isFull() ? exitFull() : enterFull(); show(); });
  seek.addEventListener('input', () => {
    if (inAd()) return;
    seeking = true;
    if (v.duration) v.currentTime = off() + seek.value / 1000 * (filmLen() - off());
    update();
    show();
  });
  seek.addEventListener('change', () => { seeking = false; });

  v.addEventListener('play', () => {
    screen.classList.add('is-playing');
    screen.classList.remove('film-paused');
    $('.c-play').setAttribute('aria-label', '一時停止');
    show();
  });
  v.addEventListener('pause', () => {
    // CM から次へ切り替わるときと、本編が終わってエンドロールへ進むときは、再生ボタンも再生バーも出さない
    // （2026-11-19 オーナー：iPhone で本編の終わりに一瞬再生ボタンが出ていた）
    if ((v.ended || post) && (inAd() || credits)) return;
    // 2026-11-19 オーナー「本編の冒頭に再生ボタンなどが一瞬出る」→ 次の動画へ入れ替える間（真っ暗の間）の pause では何も出さない
    if (waiting) return;
    screen.classList.remove('is-playing');
    // 2026-11-19 オーナー：本編を止めたら、スマホでも再生バー（位置・時間・音）を出す。タップで再生すると消える
    screen.classList.toggle('film-paused', inFilm() && !waiting);
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
  // 2026-11-19 オーナー：見終わって幕が閉じたら「ご視聴ありがとうございました。」と「もう一度観る」（押すと幕が開く）
  const hint = btn.querySelector('.sc-hint');
  if (hint) hint.insertAdjacentHTML('beforeend', '<span class="sc-thanks">ご視聴ありがとうございました。</span><span class="sc-again">もう一度観る</span>');
  if (sub && matchMedia('(hover: none)').matches) sub.textContent = 'タップで幕が開きます';
  const open = () => {
    if (screen.classList.contains('curtains-open')) return;
    screen.classList.add('curtains-open');   // 開いた幕は左右の端にたたまれて残る（2026-11-19。前は 3.3秒後に消していた）
    setTimeout(() => screen.classList.remove('watched'), 600);   // 札が消えてから「上映する」の文に戻す
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
  // スマホ（2026-11-17 オーナー指示）：真ん中は4席、その左右に通路、外側に3席。1列＝座席12個ぶん（U）。
  // 座席の幅は奥で画面の幅の wT、手前で wB。手前では通路が画面の外へ出るほど強いハの字
  const SP = { D: 244, wF: 36, aisleH: 22, gapTop: 6, U: 12, wT: 0.067, wB: 0.24, lean: 0.7 };
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
    const U = d.U || Math.max(10, W / d.wF);           // 1列の幅を座席いくつぶんで割るか
    const nC = Math.max(2, Math.floor(U - 6 - 1.5));    // 真ん中の席の数（どの列も同じ）
    // 壁の線（2026-11-17 オーナーのスケッチ）：左右の黒い壁は、天井（ページの上）から客席の上の端まではまっすぐ縦
    // （動画のすぐ外側）。客席の部分では下へ行くほど外へ開く「ハ」の字。客席の列の端はこの線に合わせる
    const sr = document.querySelector('.proscenium').getBoundingClientRect();
    const seatsTopPage = seats.getBoundingClientRect().top + scrollY;
    const eTop = Math.max(0, sr.left - d.gapTop);      // 縦の部分の壁の内側の端
    const eBot = d.wB ? W / 2 - U / 2 * W * d.wB : d.eBot; // 客席の一番下での壁の内側の端（画面の外へ出てもよい）
    // スマホ（2026-11-17）：動画が画面いっぱいで壁の縦の部分が画面の端に近く、そこから開くと斜めの線が画面の外へ出て
    // まっすぐに見えた。客席の上の端だけ壁を内側（幅の eSeat の割合）から始め、PC と同じくハの字が見えるように
    const eS = d.wT ? W / 2 - U / 2 * W * d.wT : eTop;
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

// 2026-11-19 オーナー：iPhone で横→縦に戻すと拡大されたままになる → 向きが変わったら、倍率を一度 1 に固定してから戻す（念のため）
(() => {
  const m = document.querySelector('meta[name="viewport"]');
  if (!m) return;
  const base = m.getAttribute('content');
  let land = innerWidth > innerHeight;
  addEventListener('resize', () => {
    const now = innerWidth > innerHeight;
    if (now === land) return;
    land = now;
    m.setAttribute('content', base + ', minimum-scale=1');
    setTimeout(() => m.setAttribute('content', base), 400);
  });
})();
