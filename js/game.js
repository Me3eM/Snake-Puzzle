(function () {
  const DIRS = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
  };
  const DIR_LIST = [DIRS.UP, DIRS.DOWN, DIRS.LEFT, DIRS.RIGHT];

  const STORAGE_UNLOCKED = 'snakepuzzle_unlocked';
  const STORAGE_STARS = 'snakepuzzle_stars';

  function key(x, y) { return x + ',' + y; }

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
  let runtime = null;   // built maze data for current level
  let snake = [];       // array of {x,y}
  let visited = null;   // Set of "x,y"
  let facing = DIRS.RIGHT;
  let state = 'idle';   // 'playing' | 'dead' | 'won' | 'stuck'
  let attempts = 1;
  let usedSkip = false;
  let cellSize = 28;
  let rafId = null;
  let deathAt = 0;
  let hintFlashUntil = 0;
  let hintDir = null;
  let shakeCells = null; // {key, until}

  // ---------- persistence ----------
  function loadUnlocked() {
    const v = parseInt(localStorage.getItem(STORAGE_UNLOCKED) || '1', 10);
    return Number.isFinite(v) && v > 0 ? v : 1;
  }
  function saveUnlocked(n) {
    localStorage.setItem(STORAGE_UNLOCKED, String(Math.max(loadUnlocked(), n)));
  }
  function loadStars() {
    try { return JSON.parse(localStorage.getItem(STORAGE_STARS) || '{}'); }
    catch (e) { return {}; }
  }
  function saveStars(index, stars) {
    const all = loadStars();
    all[index] = Math.max(all[index] || 0, stars);
    localStorage.setItem(STORAGE_STARS, JSON.stringify(all));
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

  // ---------- level building ----------
  function buildRuntime(def) {
    const cellType = new Map();
    def.path.forEach(([x, y]) => cellType.set(key(x, y), 'path'));
    def.spikes.forEach(([x, y]) => cellType.set(key(x, y), 'spike'));
    def.saws.forEach(([x, y]) => cellType.set(key(x, y), 'saw'));
    def.blocks.forEach(([x, y]) => cellType.set(key(x, y), 'block'));

    const all = [...def.path, ...def.blocks];
    const xs = all.map((c) => c[0]);
    const ys = all.map((c) => c[1]);
    const minX = Math.min(...xs) - 1;
    const maxX = Math.max(...xs) + 1;
    const minY = Math.min(...ys) - 1;
    const maxY = Math.max(...ys) + 1;

    return {
      def,
      cellType,
      start: { x: def.start[0], y: def.start[1] },
      goal: { x: def.goal[0], y: def.goal[1] },
      minX, maxX, minY, maxY,
      cols: maxX - minX + 1,
      rows: maxY - minY + 1,
    };
  }

  function cellTypeAt(x, y) {
    return runtime.cellType.get(key(x, y));
  }

  function isSafeWalkable(x, y) {
    const t = cellTypeAt(x, y);
    return t === 'path';
  }

  // BFS ignoring hazards (safe route only), used for hint + skip + solvability.
  function findSafePath(from, to) {
    const startKey = key(from.x, from.y);
    const goalKey = key(to.x, to.y);
    if (startKey === goalKey) return [from];
    const cameFrom = new Map();
    const seen = new Set([startKey]);
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift();
      for (const d of DIR_LIST) {
        const nx = cur.x + d.x, ny = cur.y + d.y;
        const k = key(nx, ny);
        if (seen.has(k) || !isSafeWalkable(nx, ny)) continue;
        seen.add(k);
        cameFrom.set(k, cur);
        if (k === goalKey) {
          const path = [{ x: nx, y: ny }];
          let step = cur;
          while (step) {
            path.unshift(step);
            const pk = key(step.x, step.y);
            step = cameFrom.get(pk);
          }
          return path;
        }
        queue.push({ x: nx, y: ny });
      }
    }
    return null;
  }

  // ---------- level lifecycle ----------
  function resizeCanvas() {
    const wrap = canvas.parentElement;
    const maxW = Math.min(wrap.clientWidth || window.innerWidth - 24, 520);
    const maxH = Math.min(window.innerHeight - 260, 520);
    cellSize = Math.max(16, Math.floor(Math.min(maxW / runtime.cols, maxH / runtime.rows)));
    canvas.width = cellSize * runtime.cols;
    canvas.height = cellSize * runtime.rows;
  }

  function startLevel(index) {
    currentLevelIndex = index;
    attempts = 1;
    usedSkip = false;
    runtime = buildRuntime(LEVELS[index]);
    setupLevelState();
    showScreen('game');
    resizeCanvas();
    hideOverlays();
    startLoop();
  }

  function setupLevelState() {
    snake = [{ x: runtime.start.x, y: runtime.start.y, born: performance.now() }];
    visited = new Set([key(runtime.start.x, runtime.start.y)]);
    facing = DIRS.RIGHT;
    state = 'playing';
    deathAt = 0;
    hintDir = null;
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
  function head() { return snake[snake.length - 1]; }

  function hasAvailableMove(pos) {
    return DIR_LIST.some((d) => {
      const nx = pos.x + d.x, ny = pos.y + d.y;
      const t = cellTypeAt(nx, ny);
      if (!t || t === 'block') return false;
      return !visited.has(key(nx, ny));
    });
  }

  function attemptMove(dirName) {
    if (state !== 'playing') return;
    const d = DIRS[dirName];
    if (!d) return;
    facing = d;
    const h = head();
    const nx = h.x + d.x, ny = h.y + d.y;
    const k = key(nx, ny);
    const t = cellTypeAt(nx, ny);

    if (!t || t === 'block' || visited.has(k)) {
      bumpFeedback();
      return;
    }

    snake.push({ x: nx, y: ny, born: performance.now() });
    visited.add(k);

    if (nx === runtime.goal.x && ny === runtime.goal.y) {
      triggerWin();
      return;
    }
    if (t === 'spike' || t === 'saw') {
      triggerDeath();
      return;
    }
    if (!hasAvailableMove({ x: nx, y: ny })) {
      triggerStuck();
    }
  }

  function undoMove() {
    if (state !== 'playing' || snake.length <= 1) return;
    const seg = snake.pop();
    visited.delete(key(seg.x, seg.y));
  }

  function bumpFeedback() {
    shakeCells = { until: performance.now() + 160 };
  }

  function triggerDeath() {
    state = 'dead';
    deathAt = performance.now();
    setTimeout(() => {
      if (state === 'dead') showFailOverlay();
    }, 550);
  }

  function triggerStuck() {
    state = 'stuck';
    deathAt = performance.now();
    setTimeout(() => {
      if (state === 'stuck') showFailOverlay();
    }, 350);
  }

  function showFailOverlay() {
    showOverlay('fail');
  }

  function triggerWin() {
    state = 'won';
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
    const solution = findSafePath(runtime.start, runtime.goal);
    usedSkip = true;
    if (!solution) { return; }
    snake = solution.map((p) => ({ x: p.x, y: p.y, born: performance.now() }));
    visited = new Set(solution.map((p) => key(p.x, p.y)));
    triggerWin();
  }

  function showHint() {
    if (state !== 'playing') return;
    const path = findSafePath(head(), runtime.goal);
    if (!path || path.length < 2) return;
    const next = path[1];
    const h = head();
    hintDir = { x: next.x - h.x, y: next.y - h.y };
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
  function loop() {
    draw();
    rafId = requestAnimationFrame(loop);
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

    // simple stars
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const seed = runtime.cols * 7919 + runtime.rows;
    for (let i = 0; i < 40; i++) {
      const rx = (Math.sin(i * 12.9898 + seed) * 43758.5453) % 1;
      const ry = (Math.sin(i * 78.233 + seed) * 12345.678) % 1;
      const x = Math.abs(rx) * canvas.width;
      const y = Math.abs(ry) * canvas.height * 0.7;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
  }

  function drawFloorTile(x, y) {
    const pad = 1.5;
    const g = ctx.createLinearGradient(0, toPy(y), 0, toPy(y) + cellSize);
    g.addColorStop(0, '#c98a4a');
    g.addColorStop(1, '#8a5527');
    ctx.fillStyle = g;
    roundRect(toPx(x) + pad, toPy(y) + pad, cellSize - pad * 2, cellSize - pad * 2, cellSize * 0.18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(107,63,29,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawBlock(x, y) {
    const pad = 2;
    const px = toPx(x) + pad, py = toPy(y) + pad, s = cellSize - pad * 2;
    const g = ctx.createLinearGradient(0, py, 0, py + s);
    g.addColorStop(0, '#b6bfc9');
    g.addColorStop(1, '#7c8794');
    ctx.fillStyle = g;
    roundRect(px, py, s, s, cellSize * 0.16);
    ctx.fill();
    ctx.strokeStyle = '#5b6572';
    ctx.lineWidth = 1.5;
    ctx.stroke();
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

  function drawStartMarker(x, y) {
    const cx = toPx(x) + cellSize / 2, cy = toPy(y) + cellSize / 2;
    ctx.strokeStyle = 'rgba(20,20,30,0.55)';
    ctx.lineWidth = Math.max(1.5, cellSize * 0.06);
    ctx.beginPath();
    let a = 0, r = cellSize * 0.04;
    ctx.moveTo(cx, cy);
    for (let i = 0; i < 60; i++) {
      a += 0.35;
      r += cellSize * 0.0035;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
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

  function drawSnake(t) {
    // rope body
    for (let i = 0; i < snake.length; i++) {
      const seg = snake[i];
      const age = t - (seg.born || 0);
      const pop = Math.min(1, age / 140);
      const scale = 0.55 + 0.45 * pop;
      const cx = toPx(seg.x) + cellSize / 2, cy = toPy(seg.y) + cellSize / 2;
      const s = cellSize * 0.86 * scale;
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

    // face on head
    const h = head();
    const cx = toPx(h.x) + cellSize / 2, cy = toPy(h.y) + cellSize / 2;
    const eyeOff = cellSize * 0.16;
    let e1 = { x: cx, y: cy }, e2 = { x: cx, y: cy };
    if (facing === DIRS.RIGHT) { e1 = { x: cx + eyeOff, y: cy - eyeOff }; e2 = { x: cx + eyeOff, y: cy + eyeOff }; }
    else if (facing === DIRS.LEFT) { e1 = { x: cx - eyeOff, y: cy - eyeOff }; e2 = { x: cx - eyeOff, y: cy + eyeOff }; }
    else if (facing === DIRS.UP) { e1 = { x: cx - eyeOff, y: cy - eyeOff }; e2 = { x: cx + eyeOff, y: cy - eyeOff }; }
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

  function draw() {
    if (!runtime) return;
    const t = performance.now();

    ctx.save();
    if (shakeCells) {
      const remain = shakeCells.until - t;
      if (remain > 0) {
        const mag = (remain / 160) * 4;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      } else {
        shakeCells = null;
      }
    }

    drawBackground();

    runtime.cellType.forEach((type, k) => {
      const [x, y] = k.split(',').map(Number);
      if (type === 'block') return;
      drawFloorTile(x, y);
    });

    const gx = runtime.goal.x, gy = runtime.goal.y;
    if (!visited.has(key(gx, gy))) drawGoalMarker(gx, gy, t);
    if (!visited.has(key(runtime.start.x, runtime.start.y)) || snake.length === 1) {
      drawStartMarker(runtime.start.x, runtime.start.y);
    }

    runtime.cellType.forEach((type, k) => {
      const [x, y] = k.split(',').map(Number);
      if (type === 'spike') drawSpike(x, y);
      else if (type === 'saw') drawSaw(x, y, t);
      else if (type === 'block') drawBlock(x, y);
    });

    drawSnake(t);
    ctx.restore();
  }

  // ---------- input ----------
  function requestDirection(name) {
    attemptMove(name);
  }

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
      requestDirection(map[e.code]);
      return;
    }
    if (e.code === 'Escape') togglePause();
  });

  document.querySelectorAll('.dpad').forEach((btn) => {
    const fire = (e) => {
      e.preventDefault();
      requestDirection(btn.dataset.dir);
    };
    btn.addEventListener('touchstart', fire, { passive: false });
    btn.addEventListener('mousedown', fire);
  });

  // hint flash rendering: highlight matching dpad button
  setInterval(() => {
    if (performance.now() < hintFlashUntil && hintDir) {
      const name = Object.keys(DIRS).find((k) => DIRS[k] === hintDir || (DIRS[k].x === hintDir.x && DIRS[k].y === hintDir.y));
      const btn = document.querySelector('.dpad[data-dir="' + name + '"]');
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
