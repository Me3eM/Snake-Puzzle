(function () {
  const DIRS = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
  };

  const STORAGE_UNLOCKED = 'snakepuzzle_v2_unlocked';
  const STORAGE_STARS = 'snakepuzzle_v2_stars';

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
  const hudProgress = document.getElementById('hud-progress');
  const hudAttempts = document.getElementById('hud-attempts');
  const winStarsEl = document.getElementById('win-stars');
  const failAttemptsEl = document.getElementById('fail-attempts');
  const failTitleEl = document.getElementById('fail-title');
  const btnUndo = document.getElementById('btn-undo');
  const btnUndoFail = document.getElementById('btn-undo-fail');

  let cellSize = 22;
  let currentLevelIndex = 0;
  let level = null;
  let wallSet = null;
  let spikeSet = null;

  let snake = [];
  let direction = DIRS.RIGHT;
  let apples = [];
  let gears = [];
  let attempts = 1;
  let hintUsed = false;
  let alive = true;
  let paused = false;
  let undoStack = [];

  let hintPath = null;
  let hintTimer = null;
  let spinAngle = 0;
  let spinRaf = null;

  function loadUnlocked() {
    const v = parseInt(localStorage.getItem(STORAGE_UNLOCKED) || '1', 10);
    return Number.isFinite(v) && v > 0 ? v : 1;
  }
  function saveUnlocked(n) {
    localStorage.setItem(STORAGE_UNLOCKED, String(Math.max(loadUnlocked(), n)));
  }
  function loadStars() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_STARS) || '{}');
    } catch (e) {
      return {};
    }
  }
  function saveStars(index, stars) {
    const all = loadStars();
    all[index] = Math.max(all[index] || 0, stars);
    localStorage.setItem(STORAGE_STARS, JSON.stringify(all));
  }

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

  function starRow(count) {
    let out = '';
    for (let i = 0; i < 3; i++) out += i < count ? '★' : '☆';
    return out;
  }

  function resizeCanvas() {
    const maxW = Math.min(window.innerWidth - 32, 640);
    const maxH = Math.min(window.innerHeight - 240, 640);
    cellSize = Math.max(10, Math.floor(Math.min(maxW / level.cols, maxH / level.rows)));
    canvas.width = cellSize * level.cols;
    canvas.height = cellSize * level.rows;
  }

  function startLevel(index) {
    currentLevelIndex = index;
    level = LEVELS[index];
    attempts = 1;
    setupLevelState();
    showScreen('game');
    resizeCanvas();
    startSpin();
    draw();
  }

  function setupLevelState() {
    wallSet = new Set(level.walls.map((w) => w[0] + ',' + w[1]));
    spikeSet = new Set((level.spikes || []).map((s) => s[0] + ',' + s[1]));
    const s = level.start;
    direction = DIRS[s.dir];
    const back = { x: -direction.x, y: -direction.y };
    snake = [];
    for (let i = 0; i < s.length; i++) {
      snake.push({ x: s.x + back.x * i, y: s.y + back.y * i });
    }
    apples = level.apples.map((a) => ({ x: a[0], y: a[1] }));
    gears = (level.gears || []).map((g) => ({ path: g.path, idx: 0, step: 1 }));
    undoStack = [];
    hintUsed = false;
    alive = true;
    paused = false;
    clearHint();
    hideOverlays();
    updateHud();
  }

  function updateHud() {
    hudLevelName.textContent = 'Level ' + (currentLevelIndex + 1) + ' – ' + level.name;
    hudProgress.textContent = apples.length + ' Äpfel übrig';
    hudAttempts.textContent = 'Versuch ' + attempts;
  }

  function snapshot() {
    return {
      snake: snake.map((p) => ({ x: p.x, y: p.y })),
      direction: { x: direction.x, y: direction.y },
      apples: apples.map((p) => ({ x: p.x, y: p.y })),
      gears: gears.map((g) => ({ path: g.path, idx: g.idx, step: g.step })),
    };
  }

  function restoreSnapshot(snap) {
    snake = snap.snake.map((p) => ({ x: p.x, y: p.y }));
    direction = { x: snap.direction.x, y: snap.direction.y };
    apples = snap.apples.map((p) => ({ x: p.x, y: p.y }));
    gears = snap.gears.map((g) => ({ path: g.path, idx: g.idx, step: g.step }));
  }

  function cellsEqual(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function bodyBlocks(pos) {
    for (let i = 0; i < snake.length - 1; i++) {
      if (cellsEqual(snake[i], pos)) return true;
    }
    return false;
  }

  function gearCellAt(g) {
    return g.path[g.idx];
  }

  function advanceGears() {
    gears.forEach((g) => {
      if (g.path.length < 2) return;
      let next = g.idx + g.step;
      if (next >= g.path.length) {
        g.step = -1;
        next = g.idx + g.step;
      } else if (next < 0) {
        g.step = 1;
        next = g.idx + g.step;
      }
      g.idx = next;
    });
  }

  function gearHitsSnake() {
    return gears.some((g) => {
      const cell = { x: gearCellAt(g)[0], y: gearCellAt(g)[1] };
      return snake.some((seg) => cellsEqual(seg, cell));
    });
  }

  function attemptMove(dirName) {
    if (!alive || paused || screens.game.classList.contains('hidden')) return;

    const dir = DIRS[dirName];
    const head = snake[0];
    const newHead = { x: head.x + dir.x, y: head.y + dir.y };
    const key = newHead.x + ',' + newHead.y;

    if (newHead.x < 0 || newHead.y < 0 || newHead.x >= level.cols || newHead.y >= level.rows) return;
    if (wallSet.has(key)) return;
    if (bodyBlocks(newHead)) return;

    undoStack.push(snapshot());
    clearHint();

    const ateAppleIdx = apples.findIndex((a) => cellsEqual(a, newHead));
    const hitSpike = spikeSet.has(key);
    const hitGear = gears.some((g) => {
      const c = gearCellAt(g);
      return c[0] === newHead.x && c[1] === newHead.y;
    });

    snake.unshift(newHead);
    direction = dir;
    if (ateAppleIdx >= 0) {
      apples.splice(ateAppleIdx, 1);
    } else {
      snake.pop();
    }

    if (hitSpike || hitGear) {
      draw();
      onFail(hitSpike ? 'Autsch! Das war ein Stachel.' : 'Erwischt vom Zahnrad!');
      return;
    }

    advanceGears();
    if (gearHitsSnake()) {
      draw();
      onFail('Erwischt vom Zahnrad!');
      return;
    }

    updateHud();
    draw();

    if (apples.length === 0) {
      onWin();
    }
  }

  function onWin() {
    alive = false;
    const stars = attempts === 1 ? 3 : attempts <= 3 ? 2 : 1;
    const finalStars = hintUsed ? Math.min(stars, 2) : stars;
    saveStars(currentLevelIndex, finalStars);
    saveUnlocked(currentLevelIndex + 2);
    winStarsEl.innerHTML = [0, 1, 2]
      .map((i) => '<span class="' + (i < finalStars ? 'filled' : '') + '">★</span>')
      .join('');
    const hasNext = currentLevelIndex + 1 < LEVELS.length;
    document.getElementById('btn-next-level').style.display = hasNext ? 'block' : 'none';
    showOverlay('win');
  }

  function onFail(message) {
    alive = false;
    failTitleEl.textContent = message || 'Erwischt!';
    failAttemptsEl.textContent = 'Versuch ' + attempts + ' beendet';
    btnUndoFail.style.display = undoStack.length ? 'block' : 'none';
    showOverlay('fail');
  }

  function retryLevel() {
    attempts++;
    setupLevelState();
    draw();
  }

  function undoMove() {
    if (!undoStack.length) return;
    const snap = undoStack.pop();
    restoreSnapshot(snap);
    alive = true;
    hideOverlays();
    updateHud();
    clearHint();
    draw();
  }

  function clearHint() {
    hintPath = null;
    if (hintTimer) {
      clearTimeout(hintTimer);
      hintTimer = null;
    }
  }

  function showHint() {
    if (!alive || paused) return;
    const path = findHintPath();
    if (!path) return;
    hintUsed = true;
    hintPath = path;
    draw();
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      hintPath = null;
      draw();
    }, 1800);
  }

  function findHintPath() {
    if (!apples.length) return null;
    const start = snake[0];
    const startKey = start.x + ',' + start.y;
    const blocked = new Set();
    for (let i = 0; i < snake.length - 1; i++) blocked.add(snake[i].x + ',' + snake[i].y);
    gears.forEach((g) => {
      const c = gearCellAt(g);
      blocked.add(c[0] + ',' + c[1]);
    });

    const queue = [start];
    const cameFrom = new Map();
    const visited = new Set([startKey]);
    let target = null;

    while (queue.length) {
      const cur = queue.shift();
      const curKey = cur.x + ',' + cur.y;
      if (apples.some((a) => a.x === cur.x && a.y === cur.y) && curKey !== startKey) {
        target = cur;
        break;
      }
      const neighbors = [
        { x: cur.x + 1, y: cur.y },
        { x: cur.x - 1, y: cur.y },
        { x: cur.x, y: cur.y + 1 },
        { x: cur.x, y: cur.y - 1 },
      ];
      for (const n of neighbors) {
        const nk = n.x + ',' + n.y;
        if (visited.has(nk)) continue;
        if (n.x < 0 || n.y < 0 || n.x >= level.cols || n.y >= level.rows) continue;
        if (wallSet.has(nk) || spikeSet.has(nk) || blocked.has(nk)) continue;
        visited.add(nk);
        cameFrom.set(nk, cur);
        queue.push(n);
      }
    }

    if (!target) return null;
    const path = [target];
    let cur = target;
    while (cur.x !== start.x || cur.y !== start.y) {
      cur = cameFrom.get(cur.x + ',' + cur.y);
      path.unshift(cur);
    }
    return path;
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    wallSet.forEach((key) => {
      const [x, y] = key.split(',').map(Number);
      drawWoodBlock(x, y);
    });

    spikeSet.forEach((key) => {
      const [x, y] = key.split(',').map(Number);
      drawSpike(x, y);
    });

    if (hintPath) {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.28)';
      hintPath.forEach((p) => {
        ctx.fillRect(p.x * cellSize, p.y * cellSize, cellSize, cellSize);
      });
    }

    apples.forEach((a) => drawApple(a.x, a.y));
    gears.forEach((g) => {
      const c = gearCellAt(g);
      drawGear(c[0], c[1]);
    });

    for (let i = snake.length - 1; i >= 0; i--) {
      const seg = snake[i];
      const isHead = i === 0;
      const color = isHead ? '#4ade80' : '#22c55e';
      drawCell(seg.x, seg.y, color, 4);
      if (isHead) drawEyes(seg);
    }
  }

  function drawWoodBlock(x, y) {
    const px = x * cellSize;
    const py = y * cellSize;
    const grad = ctx.createLinearGradient(px, py, px, py + cellSize);
    grad.addColorStop(0, '#a9764a');
    grad.addColorStop(1, '#6b4423');
    ctx.fillStyle = grad;
    roundRect(px + 1, py + 1, cellSize - 2, cellSize - 2, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    roundRect(px + 1.5, py + 1.5, cellSize - 3, cellSize - 3, 3);
    ctx.stroke();
  }

  function drawSpike(x, y) {
    const px = x * cellSize;
    const py = y * cellSize;
    ctx.fillStyle = '#1b2430';
    ctx.fillRect(px, py, cellSize, cellSize);
    ctx.fillStyle = '#cbd5e1';
    const n = 3;
    const w = cellSize / n;
    for (let i = 0; i < n; i++) {
      const bx = px + i * w;
      ctx.beginPath();
      ctx.moveTo(bx + 2, py + cellSize - 3);
      ctx.lineTo(bx + w / 2, py + cellSize * 0.25);
      ctx.lineTo(bx + w - 2, py + cellSize - 3);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawApple(x, y) {
    const cx = x * cellSize + cellSize / 2;
    const cy = y * cellSize + cellSize / 2;
    const r = cellSize * 0.32;
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.3, cy - r * 1.15, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fill();
    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r);
    grad.addColorStop(0, '#fca5a5');
    grad.addColorStop(1, '#dc2626');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGear(x, y) {
    const cx = x * cellSize + cellSize / 2;
    const cy = y * cellSize + cellSize / 2;
    const r = cellSize * 0.34;
    const teeth = 8;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spinAngle);
    ctx.fillStyle = '#94a3b8';
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.fillRect(-cellSize * 0.06, -r - cellSize * 0.12, cellSize * 0.12, cellSize * 0.14);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b2430';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCell(x, y, color, radius) {
    const pad = 1;
    const px = x * cellSize + pad;
    const py = y * cellSize + pad;
    const size = cellSize - pad * 2;
    ctx.fillStyle = color;
    roundRect(px, py, size, size, radius);
    ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawEyes(head) {
    const cx = head.x * cellSize + cellSize / 2;
    const cy = head.y * cellSize + cellSize / 2;
    const off = cellSize * 0.18;
    const r = Math.max(1.5, cellSize * 0.08);
    let ex1 = cx, ey1 = cy, ex2 = cx, ey2 = cy;
    if (direction === DIRS.RIGHT) { ex1 += off; ey1 -= off; ex2 += off; ey2 += off; }
    else if (direction === DIRS.LEFT) { ex1 -= off; ey1 -= off; ex2 -= off; ey2 += off; }
    else if (direction === DIRS.UP) { ex1 -= off; ey1 -= off; ex2 += off; ey2 -= off; }
    else { ex1 -= off; ey1 += off; ex2 += off; ey2 += off; }
    ctx.fillStyle = '#06240f';
    ctx.beginPath(); ctx.arc(ex1, ey1, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex2, ey2, r, 0, Math.PI * 2); ctx.fill();
  }

  function startSpin() {
    if (spinRaf) cancelAnimationFrame(spinRaf);
    const tick = () => {
      spinAngle += 0.02;
      if (!screens.game.classList.contains('hidden')) draw();
      spinRaf = requestAnimationFrame(tick);
    };
    spinRaf = requestAnimationFrame(tick);
  }

  function togglePause() {
    if (screens.game.classList.contains('hidden')) return;
    if (!overlays.win.classList.contains('hidden') || !overlays.fail.classList.contains('hidden')) return;
    paused = !paused;
    if (paused) showOverlay('pause');
    else hideOverlays();
  }

  document.addEventListener('keydown', (e) => {
    const map = {
      ArrowUp: 'UP', KeyW: 'UP',
      ArrowDown: 'DOWN', KeyS: 'DOWN',
      ArrowLeft: 'LEFT', KeyA: 'LEFT',
      ArrowRight: 'RIGHT', KeyD: 'RIGHT',
    };
    if (screens.game.classList.contains('hidden')) return;
    if (map[e.code]) {
      e.preventDefault();
      attemptMove(map[e.code]);
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    if (e.code === 'KeyZ' || e.code === 'Backspace') { e.preventDefault(); undoMove(); }
  });

  document.querySelectorAll('.dpad').forEach((btn) => {
    const fire = (e) => {
      e.preventDefault();
      attemptMove(btn.dataset.dir);
    };
    btn.addEventListener('touchstart', fire, { passive: false });
    btn.addEventListener('mousedown', fire);
  });

  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) attemptMove(dx > 0 ? 'RIGHT' : 'LEFT');
    else attemptMove(dy > 0 ? 'DOWN' : 'UP');
  }, { passive: true });

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
    paused = false;
    retryLevel();
  });
  document.getElementById('btn-menu-pause').addEventListener('click', () => {
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
  document.getElementById('btn-menu-fail').addEventListener('click', () => {
    buildLevelGrid();
    showScreen('levels');
  });
  btnUndoFail.addEventListener('click', undoMove);
  btnUndo.addEventListener('click', undoMove);
  document.getElementById('btn-hint').addEventListener('click', showHint);

  window.addEventListener('resize', () => {
    if (level && !screens.game.classList.contains('hidden')) {
      resizeCanvas();
      draw();
    }
  });

  showScreen('menu');
})();
