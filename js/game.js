(function () {
  const DIR_NAMES = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

  const STORAGE_UNLOCKED = 'snakepuzzle_unlocked';
  const STORAGE_STARS = 'snakepuzzle_stars';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  const screens = {
    menu: document.getElementById('screen-menu'),
    levels: document.getElementById('screen-levels'),
    game: document.getElementById('screen-game'),
  };
  const overlays = {
    pause: document.getElementById('overlay-pause'),
    win: document.getElementById('overlay-win'),
    fail: document.getElementById('overlay-fail'),
  };
  const levelGridEl = document.getElementById('level-grid');
  const hudLevelName = document.getElementById('hud-level-name');
  const levelSubtitleEl = document.getElementById('level-subtitle');
  const winStarsEl = document.getElementById('win-stars');

  let currentLevelIndex = 0;
  let runtime = null;     // sim.buildLevelRuntime(def)
  let current = null;     // { snake, apples } – zuletzt zur Ruhe gekommener Zustand
  let history = [];       // Stack vorheriger Zustände für Undo
  let facing = 'RIGHT';
  let state = 'idle';     // 'playing' | 'falling' | 'dead' | 'won'
  let attempts = 1;
  let usedSkip = false;
  let cellSize = 28;
  let rafId = null;

  // Fall-/Zug-Animation
  let animFrames = null;  // Liste von Schlangen-Formen
  let animIndex = 0;
  let animLastTick = 0;
  let animApples = null;  // Äpfel-Set, das während der Animation angezeigt wird
  let pendingResult = null;

  let deathAt = 0;
  let shakeUntil = 0;
  let hintDirName = null;
  let hintFlashUntil = 0;

  const ANIM_STEP_MS = 65;

  // ---------- persistence ----------
  function loadUnlocked() {
    try {
      const v = parseInt(localStorage.getItem(STORAGE_UNLOCKED) || '1', 10);
      return Number.isFinite(v) && v > 0 ? v : 1;
    } catch (e) { return 1; }
  }
  function saveUnlocked(n) {
    try { localStorage.setItem(STORAGE_UNLOCKED, String(Math.max(loadUnlocked(), n))); } catch (e) { /* ignore */ }
  }
  function loadStars() {
    try { return JSON.parse(localStorage.getItem(STORAGE_STARS) || '{}'); }
    catch (e) { return {}; }
  }
  function saveStars(index, stars) {
    try {
      const all = loadStars();
      all[index] = Math.max(all[index] || 0, stars);
      localStorage.setItem(STORAGE_STARS, JSON.stringify(all));
    } catch (e) { /* ignore */ }
  }

  // ---------- screens ----------
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
  }
  function showOverlay(name) {
    hideOverlays();
    if (name) overlays[name].classList.remove('hidden');
  }
  function hideOverlays() {
    Object.values(overlays).forEach((o) => o.classList.add('hidden'));
  }

  function starRow(count) {
    let out = '';
    for (let i = 0; i < 3; i++) out += i < count ? '★' : '☆';
    return out;
  }

  function buildLevelGrid() {
    const unlocked = loadUnlocked();
    const stars = loadStars();
    levelGridEl.innerHTML = '';
    LEVELS.forEach((lvl, i) => {
      const locked = i >= unlocked;
      const card = document.createElement('button');
      card.className = 'level-card' + (locked ? ' locked' : '');
      card.disabled = locked;
      const starCount = stars[i] || 0;
      card.innerHTML =
        '<span class="num">' + (i + 1) + '</span>' +
        '<span class="name">' + lvl.name + '</span>' +
        '<span class="stars-row">' + starRow(starCount) + '</span>';
      if (!locked) card.addEventListener('click', () => startLevel(i));
      levelGridEl.appendChild(card);
    });
  }

  // ---------- level lifecycle ----------
  function resizeCanvas() {
    const wrap = canvas.parentElement;
    const maxW = Math.min(wrap.clientWidth || window.innerWidth - 24, 560);
    const maxH = Math.min(window.innerHeight - 260, 520);
    cellSize = Math.max(16, Math.floor(Math.min(maxW / runtime.cols, maxH / runtime.rows)));
    canvas.width = cellSize * runtime.cols;
    canvas.height = cellSize * runtime.rows;
  }

  function startLevel(index) {
    currentLevelIndex = index;
    attempts = 1;
    usedSkip = false;
    const def = LEVELS[index];
    runtime = buildLevelRuntime(def);
    setupLevelState();
    showScreen('game');
    resizeCanvas();
    hideOverlays();
    startLoop();
  }

  function setupLevelState() {
    current = initialState(runtime.def);
    history = [];
    facing = 'RIGHT';
    state = 'playing';
    animFrames = null;
    pendingResult = null;
    hintDirName = null;
    hintFlashUntil = 0;
    hudLevelName.textContent = 'Level ' + (currentLevelIndex + 1);
    hudLevelName.title = runtime.def.name;
    levelSubtitleEl.textContent = runtime.def.name;
    hideOverlays();
  }

  function retryLevel() {
    attempts++;
    setupLevelState();
  }

  // ---------- movement ----------
  function currentSnake() {
    if (animFrames) return animFrames[Math.min(animIndex, animFrames.length - 1)];
    return current.snake;
  }
  function currentApples() {
    return animFrames ? animApples : current.apples;
  }

  function attemptMove(dirName) {
    if (state !== 'playing' || !DIR_NAMES.includes(dirName)) return;
    facing = dirName;
    const res = step(runtime, current, dirName);
    if (!res) { bumpFeedback(); return; }

    history.push(cloneState(current));
    animFrames = res.frames;
    animIndex = 0;
    animLastTick = performance.now();
    animApples = res.state.apples;
    pendingResult = res;
    state = 'falling';
  }

  function finishAnimation() {
    const res = pendingResult;
    current = res.state;
    animFrames = null;
    pendingResult = null;

    if (res.dead) {
      state = 'dead';
      deathAt = performance.now();
      setTimeout(() => { if (state === 'dead') showOverlay('fail'); }, 550);
      return;
    }
    if (res.won) {
      state = 'won';
      finishWin();
      return;
    }
    state = 'playing';
    if (!hasAnyLegalMove()) {
      state = 'dead';
      deathAt = performance.now();
      setTimeout(() => { if (state === 'dead') showOverlay('fail'); }, 350);
    }
  }

  function hasAnyLegalMove() {
    return DIR_NAMES.some((dir) => !!step(runtime, current, dir));
  }

  function undoMove() {
    if (state !== 'playing' || history.length === 0) return;
    current = history.pop();
  }

  function bumpFeedback() {
    shakeUntil = performance.now() + 160;
  }

  function finishWin() {
    const stars = usedSkip ? 1 : (attempts === 1 ? 3 : attempts <= 3 ? 2 : 1);
    saveStars(currentLevelIndex, stars);
    saveUnlocked(currentLevelIndex + 2);
    winStarsEl.innerHTML = [0, 1, 2]
      .map((i) => '<span class="' + (i < stars ? 'filled' : '') + '">★</span>')
      .join('');
    const hasNext = currentLevelIndex + 1 < LEVELS.length;
    document.getElementById('btn-next-level').style.display = hasNext ? 'block' : 'none';
    setTimeout(() => showOverlay('win'), 250);
  }

  function skipLevel() {
    if (!runtime || state !== 'playing') return;
    const path = solve(runtime, current);
    if (!path) return;
    usedSkip = true;
    let cur = current;
    let result = null;
    for (const dir of path) {
      result = step(runtime, cur, dir);
      if (!result) break;
      cur = result.state;
      if (result.dead || result.won) break;
    }
    if (result && result.won) {
      current = cur;
      state = 'won';
      finishWin();
    }
  }

  function showHint() {
    if (state !== 'playing') return;
    const path = solve(runtime, current);
    if (!path || !path.length) return;
    hintDirName = path[0];
    hintFlashUntil = performance.now() + 650;
  }

  // ---------- rendering ----------
  function startLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }
  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }
  function loop(time) {
    update(time);
    draw(time);
    rafId = requestAnimationFrame(loop);
  }

  function update(time) {
    if (state === 'falling' && animFrames) {
      while (time - animLastTick >= ANIM_STEP_MS && animIndex < animFrames.length - 1) {
        animIndex++;
        animLastTick += ANIM_STEP_MS;
      }
      if (animIndex >= animFrames.length - 1 && time - animLastTick >= ANIM_STEP_MS) {
        finishAnimation();
      }
    }
  }

  function toPx(gx) { return (gx - runtime.minX) * cellSize; }
  function toPy(gy) { return (gy - runtime.minY) * cellSize; }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0f2447');
    grad.addColorStop(1, '#3f7fb0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const seed = runtime.cols * 7919 + runtime.rows;
    for (let i = 0; i < 40; i++) {
      const rx = Math.abs((Math.sin(i * 12.9898 + seed) * 43758.5453) % 1);
      const ry = Math.abs((Math.sin(i * 78.233 + seed) * 12345.678) % 1);
      ctx.fillRect(rx * canvas.width, ry * canvas.height * 0.7, 1.6, 1.6);
    }
  }

  function drawBlock(x, y) {
    const pad = 1.5;
    const px = toPx(x) + pad, py = toPy(y) + pad, s = cellSize - pad * 2;
    const g = ctx.createLinearGradient(0, toPy(y), 0, toPy(y) + cellSize);
    g.addColorStop(0, '#c98a4a');
    g.addColorStop(1, '#8a5527');
    ctx.fillStyle = g;
    roundRect(px, py, s, s, cellSize * 0.16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(107,63,29,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Grasrand oben, wenn darüber kein weiterer Block liegt
    if (!runtime.solidSet.has(cellKey(x, y - 1))) {
      ctx.fillStyle = 'rgba(122, 196, 90, 0.85)';
      ctx.fillRect(px, py, s, Math.max(2, cellSize * 0.09));
    }
  }

  function drawApple(x, y, t) {
    const cx = toPx(x) + cellSize / 2, cy = toPy(y) + cellSize / 2 + Math.sin(t / 260 + x) * cellSize * 0.03;
    const r = cellSize * 0.26;
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(cx - 1, cy - r - 6, 2, 6);
    ctx.fillStyle = '#57b354';
    ctx.beginPath();
    ctx.ellipse(cx + 5, cy - r - 3, 5, 3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, 1, cx, cy, r);
    g.addColorStop(0, '#ff8a7a');
    g.addColorStop(1, '#e5372e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSpike(x, y) {
    const cx = toPx(x), cy = toPy(y);
    const n = 3;
    const w = cellSize / n;
    ctx.fillStyle = '#cbd3db';
    ctx.strokeStyle = '#5b6572';
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const bx = cx + i * w;
      ctx.beginPath();
      ctx.moveTo(bx + 1, cy + cellSize - 2);
      ctx.lineTo(bx + w / 2, cy + cellSize * 0.28);
      ctx.lineTo(bx + w - 1, cy + cellSize - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawSaw(x, y, t) {
    const cx = toPx(x) + cellSize / 2, cy = toPy(y) + cellSize / 2;
    const r = cellSize * 0.36;
    const teeth = 8;
    const angle = (t / 260) % (Math.PI * 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = '#c3ccd6';
    ctx.strokeStyle = '#5b6572';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a = (Math.PI * 2 * i) / (teeth * 2);
      const rad = i % 2 === 0 ? r : r * 0.7;
      const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5b6572';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGoalMarker(x, y, t) {
    const cx = toPx(x) + cellSize / 2, cy = toPy(y) + cellSize / 2;
    const bob = Math.sin(t / 300) * cellSize * 0.05;
    ctx.fillStyle = '#ffd447';
    ctx.strokeStyle = '#a86f00';
    ctx.lineWidth = 1.5;
    const r = cellSize * 0.28;
    const spikes = 5;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = (Math.PI * i) / spikes - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const px = cx + Math.cos(a) * rad, py = cy + bob + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawSnake(snake) {
    for (let i = 0; i < snake.length; i++) {
      const seg = snake[i];
      const cx = toPx(seg.x) + cellSize / 2, cy = toPy(seg.y) + cellSize / 2;
      const s = cellSize * 0.86;
      const isHead = i === snake.length - 1;
      const g = ctx.createLinearGradient(cx, cy - s / 2, cx, cy + s / 2);
      if (state === 'dead' && isHead) {
        g.addColorStop(0, '#e5772e');
        g.addColorStop(1, '#b8501a');
      } else {
        g.addColorStop(0, '#ffcf5c');
        g.addColorStop(1, '#f5a623');
      }
      ctx.fillStyle = g;
      roundRect(cx - s / 2, cy - s / 2, s, s, s * 0.32);
      ctx.fill();

      if (i > 0) {
        const prev = snake[i - 1];
        const pcx = toPx(prev.x) + cellSize / 2, pcy = toPy(prev.y) + cellSize / 2;
        const jw = cellSize * 0.6;
        ctx.fillStyle = g;
        roundRect(
          seg.x === prev.x ? cx - jw / 2 : Math.min(cx, pcx),
          seg.y === prev.y ? cy - jw / 2 : Math.min(cy, pcy),
          seg.x === prev.x ? jw : Math.abs(cx - pcx),
          seg.y === prev.y ? jw : Math.abs(cy - pcy),
          jw * 0.3
        );
        ctx.fill();
      }
    }

    const h = snake[snake.length - 1];
    const cx = toPx(h.x) + cellSize / 2, cy = toPy(h.y) + cellSize / 2;
    const eyeOff = cellSize * 0.16;
    let e1 = { x: cx, y: cy }, e2 = { x: cx, y: cy };
    if (facing === 'RIGHT') { e1 = { x: cx + eyeOff, y: cy - eyeOff }; e2 = { x: cx + eyeOff, y: cy + eyeOff }; }
    else if (facing === 'LEFT') { e1 = { x: cx - eyeOff, y: cy - eyeOff }; e2 = { x: cx - eyeOff, y: cy + eyeOff }; }
    else if (facing === 'UP') { e1 = { x: cx - eyeOff, y: cy - eyeOff }; e2 = { x: cx + eyeOff, y: cy - eyeOff }; }
    else { e1 = { x: cx - eyeOff, y: cy + eyeOff }; e2 = { x: cx + eyeOff, y: cy + eyeOff }; }

    const eyeR = Math.max(2, cellSize * 0.13);
    [e1, e2].forEach((e) => {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(e.x, e.y, eyeR, 0, Math.PI * 2); ctx.fill();
      if (state === 'dead') {
        ctx.strokeStyle = '#111';
        ctx.lineWidth = Math.max(1, eyeR * 0.4);
        ctx.beginPath();
        ctx.moveTo(e.x - eyeR * 0.6, e.y - eyeR * 0.6);
        ctx.lineTo(e.x + eyeR * 0.6, e.y + eyeR * 0.6);
        ctx.moveTo(e.x + eyeR * 0.6, e.y - eyeR * 0.6);
        ctx.lineTo(e.x - eyeR * 0.6, e.y + eyeR * 0.6);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath(); ctx.arc(e.x, e.y, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  function draw(time) {
    if (!runtime) return;
    const t = time || performance.now();

    ctx.save();
    if (t < shakeUntil) {
      const remain = shakeUntil - t;
      const mag = (remain / 160) * 4;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    drawBackground();

    runtime.solidSet.forEach((k) => {
      const [x, y] = k.split(',').map(Number);
      drawBlock(x, y);
    });

    if (!hazardAt(runtime, runtime.goal.x, runtime.goal.y)) {
      const snakeNow = currentSnake();
      const headOnGoal = snakeNow.some((s) => sameCell(s, runtime.goal));
      if (!headOnGoal) drawGoalMarker(runtime.goal.x, runtime.goal.y, t);
    }

    const apples = currentApples();
    apples.forEach((k) => {
      const [x, y] = k.split(',').map(Number);
      drawApple(x, y, t);
    });

    runtime.hazardMap.forEach((kind, k) => {
      const [x, y] = k.split(',').map(Number);
      if (kind === 'spike') drawSpike(x, y);
      else drawSaw(x, y, t);
    });

    drawSnake(currentSnake());
    ctx.restore();
  }

  // ---------- input ----------
  document.addEventListener('keydown', (e) => {
    if (screens.game.classList.contains('hidden')) return;
    const map = {
      ArrowUp: 'UP', KeyW: 'UP',
      ArrowDown: 'DOWN', KeyS: 'DOWN',
      ArrowLeft: 'LEFT', KeyA: 'LEFT',
      ArrowRight: 'RIGHT', KeyD: 'RIGHT',
    };
    if (map[e.code]) {
      e.preventDefault();
      if (e.repeat) return;
      attemptMove(map[e.code]);
      return;
    }
    if (e.code === 'Escape') togglePause();
  });

  document.querySelectorAll('.dpad').forEach((btn) => {
    const fire = (e) => {
      e.preventDefault();
      attemptMove(btn.dataset.dir);
    };
    btn.addEventListener('touchstart', fire, { passive: false });
    btn.addEventListener('mousedown', fire);
  });

  setInterval(() => {
    if (performance.now() < hintFlashUntil && hintDirName) {
      const btn = document.querySelector('.dpad[data-dir="' + hintDirName + '"]');
      if (btn && !btn.classList.contains('flash')) {
        btn.classList.add('flash');
        setTimeout(() => btn.classList.remove('flash'), 600);
      }
      hintFlashUntil = 0;
    }
  }, 50);

  function togglePause() {
    if (screens.game.classList.contains('hidden')) return;
    if (!overlays.win.classList.contains('hidden') || !overlays.fail.classList.contains('hidden')) return;
    if (!overlays.pause.classList.contains('hidden')) {
      hideOverlays();
    } else {
      showOverlay('pause');
    }
  }

  document.getElementById('btn-continue').addEventListener('click', () => {
    const unlocked = loadUnlocked();
    startLevel(Math.min(unlocked - 1, LEVELS.length - 1));
  });
  document.getElementById('btn-levels').addEventListener('click', () => {
    buildLevelGrid();
    showScreen('levels');
  });
  document.getElementById('btn-back-menu').addEventListener('click', () => showScreen('menu'));

  document.getElementById('btn-pause').addEventListener('click', togglePause);
  document.getElementById('btn-resume').addEventListener('click', togglePause);
  document.getElementById('btn-restart-pause').addEventListener('click', () => {
    hideOverlays();
    retryLevel();
  });
  document.getElementById('btn-menu-pause').addEventListener('click', () => {
    stopLoop();
    buildLevelGrid();
    showScreen('levels');
  });

  document.getElementById('btn-next-level').addEventListener('click', () => {
    const next = currentLevelIndex + 1;
    if (next < LEVELS.length) startLevel(next);
  });
  document.getElementById('btn-menu-win').addEventListener('click', () => {
    buildLevelGrid();
    showScreen('levels');
  });

  document.getElementById('btn-retry').addEventListener('click', retryLevel);
  document.getElementById('btn-skip-fail').addEventListener('click', () => {
    hideOverlays();
    retryLevel();
    skipLevel();
  });
  document.getElementById('btn-menu-fail').addEventListener('click', () => {
    buildLevelGrid();
    showScreen('levels');
  });

  document.getElementById('btn-undo').addEventListener('click', undoMove);
  document.getElementById('btn-hint').addEventListener('click', showHint);
  document.getElementById('btn-skip').addEventListener('click', skipLevel);
  document.getElementById('btn-exit').addEventListener('click', () => {
    stopLoop();
    buildLevelGrid();
    showScreen('levels');
  });

  window.addEventListener('resize', () => {
    if (runtime && !screens.game.classList.contains('hidden')) {
      resizeCanvas();
    }
  });

  showScreen('menu');
})();
