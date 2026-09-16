(function () {
  const DIRS = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
  };

  const STORAGE_UNLOCKED = 'snakepuzzle_v3_unlocked';
  const STORAGE_STARS = 'snakepuzzle_v3_stars';

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
  let solidSet = null;
  let stoneSet = null;
  let spikeSet = null;
  let portal = null;
  let stars = [];

  let snake = [];
  let direction = DIRS.RIGHT;
  let food = [];
  let saws = [];
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
  function saveStars(index, count) {
    const all = loadStars();
    all[index] = Math.max(all[index] || 0, count);
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
    const starData = loadStars();
    levelGridEl.innerHTML = '';
    LEVELS.forEach((lvl, i) => {
      const locked = i >= unlocked;
      const card = document.createElement('button');
      card.className = 'level-card' + (locked ? ' locked' : '');
      card.disabled = locked;
      card.innerHTML =
        '<span class="num">' + (i + 1) + '</span>' +
        '<span class="name">' + lvl.name + '</span>' +
        '<span class="stars-row">' + starRow(starData[i] || 0) + '</span>';
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
    const maxW = Math.min(window.innerWidth - 32, 660);
    const maxH = Math.min(window.innerHeight - 240, 660);
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
    makeStars();
    startSpin();
    draw();
  }

  function setupLevelState() {
    stoneSet = new Set((level.stones || []).map((s) => s[0] + ',' + s[1]));
    solidSet = new Set(level.walls.map((w) => w[0] + ',' + w[1]));
    stoneSet.forEach((k) => solidSet.add(k));
    spikeSet = new Set((level.spikes || []).map((s) => s[0] + ',' + s[1]));
    portal = level.portal ? { x: level.portal[0], y: level.portal[1] } : null;

    const s = level.start;
    direction = DIRS[s.dir];
    const back = { x: -direction.x, y: -direction.y };
    snake = [];
    for (let i = 0; i < s.length; i++) {
      snake.push({ x: s.x + back.x * i, y: s.y + back.y * i });
    }
    food = level.food.map((f) => ({ x: f[0], y: f[1] }));
    saws = (level.saws || []).map((s2) => ({
      path: Array.isArray(s2) ? [[s2[0], s2[1]]] : s2.path,
      idx: 0,
      step: 1,
    }));
    if (level.gravity) applyGravity();
    undoStack = [];
    hintUsed = false;
    alive = true;
    paused = false;
    clearHint();
    hideOverlays();
    updateHud();
  }

  function makeStars() {
    let seed = (currentLevelIndex + 1) * 9781;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({ x: rand(), y: rand(), r: 0.5 + rand() * 1.3, a: 0.25 + rand() * 0.55 });
    }
  }

  function updateHud() {
    hudLevelName.textContent = 'Level ' + (currentLevelIndex + 1) + ' – ' + level.name;
    if (food.length > 0) {
      hudProgress.textContent = food.length + (food.length === 1 ? ' Pflanze übrig' : ' Pflanzen übrig');
    } else {
      hudProgress.textContent = portal ? 'Alles gefressen – ab ins Portal!' : 'Geschafft!';
    }
    hudAttempts.textContent = 'Versuch ' + attempts;
  }

  function snapshot() {
    return {
      snake: snake.map((p) => ({ x: p.x, y: p.y })),
      direction: { x: direction.x, y: direction.y },
      food: food.map((p) => ({ x: p.x, y: p.y })),
      saws: saws.map((s) => ({ path: s.path, idx: s.idx, step: s.step })),
    };
  }

  function restoreSnapshot(snap) {
    snake = snap.snake.map((p) => ({ x: p.x, y: p.y }));
    direction = { x: snap.direction.x, y: snap.direction.y };
    food = snap.food.map((p) => ({ x: p.x, y: p.y }));
    saws = snap.saws.map((s) => ({ path: s.path, idx: s.idx, step: s.step }));
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

  function sawCell(s) {
    return s.path[s.idx];
  }

  function advanceSaws() {
    saws.forEach((s) => {
      if (s.path.length < 2) return;
      let next = s.idx + s.step;
      if (next >= s.path.length) {
        s.step = -1;
        next = s.idx + s.step;
      } else if (next < 0) {
        s.step = 1;
        next = s.idx + s.step;
      }
      s.idx = next;
    });
  }

  function sawHitsSnake() {
    return saws.some((s) => {
      const c = sawCell(s);
      return snake.some((seg) => seg.x === c[0] && seg.y === c[1]);
    });
  }

  function isGrounded() {
    return snake.some((seg) => solidSet.has(seg.x + ',' + (seg.y + 1)));
  }

  function applyGravity() {
    let fell = false;
    while (!isGrounded()) {
      snake = snake.map((seg) => ({ x: seg.x, y: seg.y + 1 }));
      fell = true;
      if (snake.some((seg) => seg.y >= level.rows)) return 'off';
    }
    if (fell && snake.some((seg) => spikeSet.has(seg.x + ',' + seg.y))) return 'spike';
    if (fell && sawHitsSnake()) return 'saw';
    return false;
  }

  function attemptMove(dirName) {
    if (!alive || paused || screens.game.classList.contains('hidden')) return;

    const dir = DIRS[dirName];
    const head = snake[0];
    const newHead = { x: head.x + dir.x, y: head.y + dir.y };
    const key = newHead.x + ',' + newHead.y;

    if (newHead.x < 0 || newHead.y < 0 || newHead.x >= level.cols || newHead.y >= level.rows) return;
    if (solidSet.has(key)) return;
    if (bodyBlocks(newHead)) return;

    undoStack.push(snapshot());
    clearHint();

    const ateIdx = food.findIndex((f) => cellsEqual(f, newHead));
    const hitSpike = spikeSet.has(key);
    const hitSaw = saws.some((s) => {
      const c = sawCell(s);
      return c[0] === newHead.x && c[1] === newHead.y;
    });

    snake.unshift(newHead);
    direction = dir;
    if (ateIdx >= 0) {
      food.splice(ateIdx, 1);
    } else {
      snake.pop();
    }

    if (hitSpike || hitSaw) {
      draw();
      onFail(hitSpike ? 'Autsch! Das war ein Stachel.' : 'Von der Kreissäge erwischt!');
      return;
    }

    advanceSaws();
    if (sawHitsSnake()) {
      draw();
      onFail('Von der Kreissäge erwischt!');
      return;
    }

    if (level.gravity) {
      const fall = applyGravity();
      if (fall) {
        draw();
        onFail(
          fall === 'off' ? 'Die Schlange ist ins Leere gefallen!' :
          fall === 'spike' ? 'Beim Fallen in einen Stachel gelandet!' :
          'Beim Fallen in die Kreissäge gelandet!'
        );
        return;
      }
    }

    updateHud();
    draw();

    if (food.length === 0) {
      if (!portal || (snake[0].x === portal.x && snake[0].y === portal.y)) onWin();
    }
  }

  function onWin() {
    alive = false;
    const base = attempts === 1 ? 3 : attempts <= 3 ? 2 : 1;
    const count = hintUsed ? Math.min(base, 2) : base;
    saveStars(currentLevelIndex, count);
    saveUnlocked(currentLevelIndex + 2);
    winStarsEl.innerHTML = [0, 1, 2]
      .map((i) => '<span class="' + (i < count ? 'filled' : '') + '">★</span>')
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
    restoreSnapshot(undoStack.pop());
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
    const targets = food.length ? food : (portal ? [portal] : []);
    if (!targets.length) return null;
    const start = snake[0];
    const startKey = start.x + ',' + start.y;
    const blocked = new Set();
    for (let i = 0; i < snake.length - 1; i++) blocked.add(snake[i].x + ',' + snake[i].y);
    saws.forEach((s) => {
      const c = sawCell(s);
      blocked.add(c[0] + ',' + c[1]);
    });

    const queue = [start];
    const cameFrom = new Map();
    const visited = new Set([startKey]);
    let target = null;

    while (queue.length) {
      const cur = queue.shift();
      const curKey = cur.x + ',' + cur.y;
      if (curKey !== startKey && targets.some((t) => t.x === cur.x && t.y === cur.y)) {
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
        if (solidSet.has(nk) || spikeSet.has(nk) || blocked.has(nk)) continue;
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

  function isSolid(x, y) {
    return solidSet.has(x + ',' + y);
  }

  function draw() {
    drawSky();

    solidSet.forEach((key) => {
      const [x, y] = key.split(',').map(Number);
      if (stoneSet.has(key)) drawStone(x, y);
      else drawWood(x, y);
    });

    spikeSet.forEach((key) => {
      const [x, y] = key.split(',').map(Number);
      drawSpikes(x, y);
    });

    if (portal) drawPortal(portal.x, portal.y, food.length === 0);

    if (hintPath) {
      ctx.fillStyle = 'rgba(250, 220, 90, 0.3)';
      hintPath.forEach((p) => ctx.fillRect(p.x * cellSize, p.y * cellSize, cellSize, cellSize));
    }

    food.forEach((f) => drawPlant(f.x, f.y));
    saws.forEach((s) => {
      const c = sawCell(s);
      drawSaw(c[0], c[1]);
    });
    drawSnake();
  }

  function drawSky() {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0f2743');
    grad.addColorStop(0.55, '#1c4a72');
    grad.addColorStop(1, '#2f6f96');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    stars.forEach((s) => {
      ctx.fillStyle = 'rgba(255,255,255,' + s.a + ')';
      ctx.beginPath();
      ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawWood(x, y) {
    const px = x * cellSize;
    const py = y * cellSize;
    const grad = ctx.createLinearGradient(px, py, px, py + cellSize);
    grad.addColorStop(0, '#9a6136');
    grad.addColorStop(1, '#6b3f21');
    ctx.fillStyle = grad;
    ctx.fillRect(px, py, cellSize, cellSize);

    if (!isSolid(x, y - 1)) {
      ctx.fillStyle = '#b57c4c';
      ctx.fillRect(px, py, cellSize, Math.max(2, cellSize * 0.2));
    }
    ctx.strokeStyle = 'rgba(52, 27, 10, 0.9)';
    ctx.lineWidth = Math.max(1, cellSize * 0.07);
    const o = ctx.lineWidth / 2;
    ctx.beginPath();
    if (!isSolid(x, y - 1)) { ctx.moveTo(px, py + o); ctx.lineTo(px + cellSize, py + o); }
    if (!isSolid(x, y + 1)) { ctx.moveTo(px, py + cellSize - o); ctx.lineTo(px + cellSize, py + cellSize - o); }
    if (!isSolid(x - 1, y)) { ctx.moveTo(px + o, py); ctx.lineTo(px + o, py + cellSize); }
    if (!isSolid(x + 1, y)) { ctx.moveTo(px + cellSize - o, py); ctx.lineTo(px + cellSize - o, py + cellSize); }
    ctx.stroke();
  }

  function drawStone(x, y) {
    const px = x * cellSize;
    const py = y * cellSize;
    const pad = cellSize * 0.04;
    const grad = ctx.createLinearGradient(px, py, px, py + cellSize);
    grad.addColorStop(0, '#b9c3cb');
    grad.addColorStop(1, '#7d8b98');
    ctx.fillStyle = grad;
    roundRect(px + pad, py + pad, cellSize - pad * 2, cellSize - pad * 2, cellSize * 0.16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(45, 58, 70, 0.9)';
    ctx.lineWidth = Math.max(1, cellSize * 0.06);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(px + cellSize * 0.63, py + cellSize * 0.36, cellSize * 0.08, cellSize * 0.06, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSpikes(x, y) {
    const px = x * cellSize;
    const base = y * cellSize + cellSize;
    const n = 3;
    const w = cellSize / n;
    for (let i = 0; i < n; i++) {
      const bx = px + i * w;
      const grad = ctx.createLinearGradient(bx, base - cellSize * 0.6, bx, base);
      grad.addColorStop(0, '#e2e8ef');
      grad.addColorStop(1, '#7c8795');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(bx + w * 0.08, base - 1);
      ctx.lineTo(bx + w / 2, base - cellSize * 0.62);
      ctx.lineTo(bx + w * 0.92, base - 1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,50,60,0.85)';
      ctx.lineWidth = Math.max(1, cellSize * 0.04);
      ctx.stroke();
    }
  }

  function drawPlant(x, y) {
    const cx = x * cellSize + cellSize / 2;
    const base = y * cellSize + cellSize * 0.92;
    const top = y * cellSize + cellSize * 0.12;
    ctx.strokeStyle = '#b6e14a';
    ctx.lineWidth = Math.max(1.5, cellSize * 0.09);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, base);
    ctx.quadraticCurveTo(cx + cellSize * 0.1, (base + top) / 2, cx, top);
    ctx.stroke();

    const leaf = (ly, side) => {
      ctx.fillStyle = '#5cc328';
      ctx.strokeStyle = '#2f7d16';
      ctx.lineWidth = Math.max(1, cellSize * 0.04);
      ctx.beginPath();
      ctx.ellipse(cx + side * cellSize * 0.2, ly, cellSize * 0.2, cellSize * 0.11, side * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    leaf(y * cellSize + cellSize * 0.3, -1);
    leaf(y * cellSize + cellSize * 0.32, 1);
    leaf(y * cellSize + cellSize * 0.62, -1);
    leaf(y * cellSize + cellSize * 0.64, 1);
  }

  function drawSaw(x, y) {
    const cx = x * cellSize + cellSize / 2;
    const cy = y * cellSize + cellSize / 2;
    const r = cellSize * 0.42;
    const teeth = 10;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spinAngle);
    ctx.fillStyle = '#aab6c2';
    ctx.strokeStyle = '#5b6874';
    ctx.lineWidth = Math.max(1, cellSize * 0.05);
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const a1 = ((i + 0.5) / teeth) * Math.PI * 2;
      const a2 = ((i + 1) / teeth) * Math.PI * 2;
      const outer = r * 1.32;
      if (i === 0) ctx.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
      ctx.lineTo(Math.cos(a1) * outer, Math.sin(a1) * outer);
      ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7a8794';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#39434e';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPortal(x, y, active) {
    const cx = x * cellSize + cellSize / 2;
    const cy = y * cellSize + cellSize / 2;
    const r = cellSize * 0.48;
    if (active) {
      const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.9);
      glow.addColorStop(0, 'rgba(129, 200, 255, 0.7)');
      glow.addColorStop(1, 'rgba(129, 200, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = active ? '#0c1c30' : '#182234';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = active ? '#8fd8ff' : '#5b7089';
    ctx.lineWidth = Math.max(1.6, cellSize * 0.11);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const turns = 2.4;
    const steps = 48;
    const phase = active ? spinAngle * 1.5 : 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = t * turns * Math.PI * 2 + phase;
      const rr = r * 0.92 * (1 - t);
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function drawSnake() {
    if (!snake.length) return;
    const pts = snake.map((s) => ({
      x: s.x * cellSize + cellSize / 2,
      y: s.y * cellSize + cellSize / 2,
    }));

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#c97b12';
    ctx.lineWidth = cellSize * 0.78;
    strokePath(pts);
    ctx.strokeStyle = '#f2a93b';
    ctx.lineWidth = cellSize * 0.64;
    strokePath(pts);
    ctx.strokeStyle = 'rgba(255, 224, 150, 0.55)';
    ctx.lineWidth = cellSize * 0.2;
    strokePath(pts.map((p) => ({ x: p.x, y: p.y - cellSize * 0.14 })));

    const head = pts[0];
    ctx.fillStyle = '#ffc247';
    ctx.beginPath();
    ctx.arc(head.x, head.y, cellSize * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c97b12';
    ctx.lineWidth = Math.max(1, cellSize * 0.05);
    ctx.stroke();

    const off = cellSize * 0.17;
    const r = Math.max(1.6, cellSize * 0.09);
    let e1 = { x: head.x, y: head.y }, e2 = { x: head.x, y: head.y };
    if (direction.x === 1) { e1 = { x: head.x + off, y: head.y - off }; e2 = { x: head.x + off, y: head.y + off }; }
    else if (direction.x === -1) { e1 = { x: head.x - off, y: head.y - off }; e2 = { x: head.x - off, y: head.y + off }; }
    else if (direction.y === -1) { e1 = { x: head.x - off, y: head.y - off }; e2 = { x: head.x + off, y: head.y - off }; }
    else { e1 = { x: head.x - off, y: head.y + off }; e2 = { x: head.x + off, y: head.y + off }; }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(e1.x, e1.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(e2.x, e2.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b1a05';
    ctx.beginPath(); ctx.arc(e1.x + direction.x * r * 0.3, e1.y + direction.y * r * 0.3, r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(e2.x + direction.x * r * 0.3, e2.y + direction.y * r * 0.3, r * 0.5, 0, Math.PI * 2); ctx.fill();
  }

  function strokePath(pts) {
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    if (pts.length === 1) ctx.lineTo(pts[0].x + 0.1, pts[0].y);
    ctx.stroke();
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

  function startSpin() {
    if (spinRaf) cancelAnimationFrame(spinRaf);
    const tick = () => {
      spinAngle += 0.03;
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
    startLevel(Math.min(loadUnlocked() - 1, LEVELS.length - 1));
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
