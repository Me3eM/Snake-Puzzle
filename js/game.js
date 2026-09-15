(function () {
  const DIRS = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
  };

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
  const hudProgress = document.getElementById('hud-progress');
  const hudAttempts = document.getElementById('hud-attempts');
  const winStarsEl = document.getElementById('win-stars');
  const failAttemptsEl = document.getElementById('fail-attempts');

  let cellSize = 22;
  let currentLevelIndex = 0;
  let level = null;
  let wallSet = null;
  let snake = [];
  let direction = DIRS.RIGHT;
  let dirQueue = [];
  let food = null;
  let foodEaten = 0;
  let attempts = 1;
  let running = false;
  let paused = false;
  let msPerTick = 160;
  let accumulator = 0;
  let lastTime = 0;
  let rafId = null;

  function loadUnlocked() {
    const v = parseInt(localStorage.getItem(STORAGE_UNLOCKED) || '1', 10);
    return Number.isFinite(v) && v > 0 ? v : 1;
  }
  function saveUnlocked(n) {
    const current = loadUnlocked();
    localStorage.setItem(STORAGE_UNLOCKED, String(Math.max(current, n)));
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
      if (!locked) {
        card.addEventListener('click', () => startLevel(i));
      }
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
    const maxH = Math.min(window.innerHeight - 220, 640);
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
    resumeLoop();
  }

  function setupLevelState() {
    wallSet = new Set(level.walls.map((w) => w[0] + ',' + w[1]));
    const s = level.start;
    direction = DIRS[s.dir];
    const back = { x: -direction.x, y: -direction.y };
    snake = [
      { x: s.x, y: s.y },
      { x: s.x + back.x, y: s.y + back.y },
      { x: s.x + back.x * 2, y: s.y + back.y * 2 },
    ];
    dirQueue = [];
    foodEaten = 0;
    msPerTick = 1000 / level.speed;
    accumulator = 0;
    food = spawnFood();
    paused = false;
    hideOverlays();
    updateHud();
  }

  function updateHud() {
    hudLevelName.textContent = 'Level ' + (currentLevelIndex + 1) + ' – ' + level.name;
    hudProgress.textContent = foodEaten + ' / ' + level.target;
    hudAttempts.textContent = 'Versuch ' + attempts;
  }

  function spawnFood() {
    const occupied = new Set(snake.map((p) => p.x + ',' + p.y));
    const free = [];
    for (let y = 1; y < level.rows - 1; y++) {
      for (let x = 1; x < level.cols - 1; x++) {
        const key = x + ',' + y;
        if (!wallSet.has(key) && !occupied.has(key)) free.push({ x, y });
      }
    }
    if (free.length === 0) return null;
    return free[Math.floor(Math.random() * free.length)];
  }

  function resumeLoop() {
    running = true;
    lastTime = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function loop(time) {
    if (!running || paused) return;
    const dt = time - lastTime;
    lastTime = time;
    accumulator += dt;
    while (accumulator >= msPerTick) {
      accumulator -= msPerTick;
      tick();
      if (!running || paused) break;
    }
    draw();
    if (running && !paused) rafId = requestAnimationFrame(loop);
  }

  function tick() {
    if (dirQueue.length) {
      const next = dirQueue.shift();
      if (next.x !== -direction.x || next.y !== -direction.y) {
        direction = next;
      }
    }
    const head = snake[0];
    const newHead = { x: head.x + direction.x, y: head.y + direction.y };
    const key = newHead.x + ',' + newHead.y;

    if (wallSet.has(key) || collidesWithSnake(newHead)) {
      onFail();
      return;
    }

    snake.unshift(newHead);

    if (food && newHead.x === food.x && newHead.y === food.y) {
      foodEaten++;
      updateHud();
      if (foodEaten >= level.target) {
        onWin();
        return;
      }
      food = spawnFood();
    } else {
      snake.pop();
    }
  }

  function collidesWithSnake(pos) {
    for (let i = 0; i < snake.length - 1; i++) {
      if (snake[i].x === pos.x && snake[i].y === pos.y) return true;
    }
    return false;
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#1b2430';
    wallSet.forEach((key) => {
      const [x, y] = key.split(',').map(Number);
      drawCell(x, y, '#2a3543');
    });

    if (food) {
      const cx = food.x * cellSize + cellSize / 2;
      const cy = food.y * cellSize + cellSize / 2;
      const r = cellSize * 0.32;
      const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
      grad.addColorStop(0, '#fde68a');
      grad.addColorStop(1, '#f59e0b');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = snake.length - 1; i >= 0; i--) {
      const seg = snake[i];
      const isHead = i === 0;
      ctx.fillStyle = isHead ? '#4ade80' : '#22c55e';
      drawCell(seg.x, seg.y, ctx.fillStyle, 4);
      if (isHead) drawEyes(seg);
    }
  }

  function drawCell(x, y, color, radius) {
    const pad = 1;
    const r = radius === undefined ? 3 : radius;
    const px = x * cellSize + pad;
    const py = y * cellSize + pad;
    const size = cellSize - pad * 2;
    ctx.fillStyle = color;
    roundRect(px, py, size, size, r);
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

  function onWin() {
    paused = true;
    stopLoop();
    const stars = attempts === 1 ? 3 : attempts <= 3 ? 2 : 1;
    saveStars(currentLevelIndex, stars);
    saveUnlocked(currentLevelIndex + 2);
    winStarsEl.innerHTML = [0, 1, 2]
      .map((i) => '<span class="' + (i < stars ? 'filled' : '') + '">★</span>')
      .join('');
    const hasNext = currentLevelIndex + 1 < LEVELS.length;
    document.getElementById('btn-next-level').style.display = hasNext ? 'block' : 'none';
    showOverlay('win');
  }

  function onFail() {
    paused = true;
    stopLoop();
    failAttemptsEl.textContent = 'Versuch ' + attempts + ' beendet';
    showOverlay('fail');
  }

  function retryLevel() {
    attempts++;
    setupLevelState();
    resumeLoop();
  }

  function requestDirection(name) {
    const d = DIRS[name];
    if (!d) return;
    const last = dirQueue.length ? dirQueue[dirQueue.length - 1] : direction;
    if (d.x === -last.x && d.y === -last.y) return;
    if (dirQueue.length >= 2) return;
    dirQueue.push(d);
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
      if (!paused) requestDirection(map[e.code]);
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      togglePause();
    }
  });

  document.querySelectorAll('.dpad').forEach((btn) => {
    const fire = (e) => {
      e.preventDefault();
      if (!paused) requestDirection(btn.dataset.dir);
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
    if (Math.abs(dx) > Math.abs(dy)) {
      requestDirection(dx > 0 ? 'RIGHT' : 'LEFT');
    } else {
      requestDirection(dy > 0 ? 'DOWN' : 'UP');
    }
  }, { passive: true });

  function togglePause() {
    if (!screens.game.classList.contains('hidden') && overlays.win.classList.contains('hidden') && overlays.fail.classList.contains('hidden')) {
      if (paused) {
        paused = false;
        hideOverlays();
        resumeLoop();
      } else {
        paused = true;
        stopLoop();
        showOverlay('pause');
      }
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
    paused = false;
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
  document.getElementById('btn-menu-fail').addEventListener('click', () => {
    buildLevelGrid();
    showScreen('levels');
  });

  window.addEventListener('resize', () => {
    if (level && !screens.game.classList.contains('hidden')) {
      resizeCanvas();
      draw();
    }
  });

  showScreen('menu');
})();
