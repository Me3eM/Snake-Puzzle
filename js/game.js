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
  let petals = [];
  let pad = 0;

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

  const PAD_CELLS = 1.1;

  function resizeCanvas() {
    const maxW = Math.min(window.innerWidth - 24, 700);
    const maxH = Math.min(window.innerHeight - 240, 700);
    cellSize = Math.max(10, Math.floor(Math.min(
      maxW / (level.cols + PAD_CELLS),
      maxH / (level.rows + PAD_CELLS)
    )));
    pad = Math.round((cellSize * PAD_CELLS) / 2);
    canvas.width = cellSize * level.cols + pad * 2;
    canvas.height = cellSize * level.rows + pad * 2;
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
    for (let i = 0; i < 80; i++) {
      stars.push({ x: rand(), y: rand(), r: 0.5 + rand() * 1.4, a: 0.25 + rand() * 0.6 });
    }
    petals = [];
    for (let i = 0; i < 9; i++) {
      petals.push({
        x: rand(),
        y: rand(),
        r: 1.6 + rand() * 2.2,
        a: 0.2 + rand() * 0.35,
        rot: rand() * Math.PI,
        vy: 0.0007 + rand() * 0.0012,
        vx: (rand() - 0.5) * 0.0006,
      });
    }
  }

  function stepPetals() {
    petals.forEach((p) => {
      p.y -= p.vy;
      p.x += p.vx;
      p.rot += 0.01;
      if (p.y < -0.05) {
        p.y = 1.05;
        p.x = Math.random();
      }
      if (p.x < -0.05) p.x = 1.05;
      if (p.x > 1.05) p.x = -0.05;
    });
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

  function blockPath(x, y, inset, radius) {
    const up = isSolid(x, y - 1), dn = isSolid(x, y + 1);
    const lf = isSolid(x - 1, y), rt = isSolid(x + 1, y);
    const l = x * cellSize + (lf ? 0 : inset);
    const t = y * cellSize + (up ? 0 : inset);
    const r = (x + 1) * cellSize - (rt ? 0 : inset);
    const b = (y + 1) * cellSize - (dn ? 0 : inset);
    const tl = (!up && !lf) ? radius : 0;
    const tr = (!up && !rt) ? radius : 0;
    const br = (!dn && !rt) ? radius : 0;
    const bl = (!dn && !lf) ? radius : 0;
    ctx.beginPath();
    ctx.moveTo(l + tl, t);
    ctx.lineTo(r - tr, t);
    if (tr) ctx.arcTo(r, t, r, t + tr, tr);
    ctx.lineTo(r, b - br);
    if (br) ctx.arcTo(r, b, r - br, b, br);
    ctx.lineTo(l + bl, b);
    if (bl) ctx.arcTo(l, b, l, b - bl, bl);
    ctx.lineTo(l, t + tl);
    if (tl) ctx.arcTo(l, t, l + tl, t, tl);
    ctx.closePath();
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawSky();
    ctx.save();
    ctx.translate(pad, pad);

    drawBlocks();
    spikeSet.forEach((key) => {
      const [x, y] = key.split(',').map(Number);
      drawSpikes(x, y);
    });
    if (portal) drawPortal(portal.x, portal.y, food.length === 0);

    if (hintPath) {
      ctx.fillStyle = 'rgba(255, 228, 120, 0.32)';
      hintPath.forEach((p) => {
        roundRect(p.x * cellSize + 2, p.y * cellSize + 2, cellSize - 4, cellSize - 4, cellSize * 0.2);
        ctx.fill();
      });
    }

    food.forEach((f) => drawPlant(f.x, f.y));
    saws.forEach((s) => {
      const c = sawCell(s);
      drawSaw(c[0], c[1]);
    });
    drawSnake();
    ctx.restore();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#0a1b33');
    g.addColorStop(0.45, '#17406b');
    g.addColorStop(1, '#3b7ea6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    stars.forEach((s) => {
      ctx.fillStyle = 'rgba(255,255,255,' + s.a + ')';
      ctx.beginPath();
      ctx.arc(s.x * canvas.width, s.y * canvas.height * 0.8, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    const glow = ctx.createLinearGradient(0, canvas.height * 0.72, 0, canvas.height);
    glow.addColorStop(0, 'rgba(120, 190, 225, 0)');
    glow.addColorStop(1, 'rgba(160, 215, 240, 0.35)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, canvas.height * 0.72, canvas.width, canvas.height * 0.28);

    petals.forEach((p) => {
      ctx.save();
      ctx.translate(p.x * canvas.width, p.y * canvas.height);
      ctx.rotate(p.rot);
      ctx.fillStyle = 'rgba(255, 170, 190, ' + p.a + ')';
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * 1.6, p.r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawBlocks() {
    const outline = Math.max(1.6, cellSize * 0.1);
    const rad = cellSize * 0.3;
    solidSet.forEach((key) => {
      const [x, y] = key.split(',').map(Number);
      if (stoneSet.has(key)) {
        stonePath(x, y, 0);
        ctx.fillStyle = '#2f3d4d';
      } else {
        blockPath(x, y, 0, rad);
        ctx.fillStyle = '#3f2410';
      }
      ctx.fill();
    });
    solidSet.forEach((key) => {
      const [x, y] = key.split(',').map(Number);
      if (stoneSet.has(key)) drawStoneBody(x, y, outline);
      else drawWoodBody(x, y, outline, rad);
    });
  }

  function drawWoodBody(x, y, outline, rad) {
    const px = x * cellSize;
    const py = y * cellSize;
    blockPath(x, y, outline, Math.max(1, rad - outline * 0.6));
    const g = ctx.createLinearGradient(0, py, 0, py + cellSize);
    g.addColorStop(0, '#a96d3d');
    g.addColorStop(0.45, '#8c5527');
    g.addColorStop(1, '#6b3d1b');
    ctx.fillStyle = g;
    ctx.fill();

    ctx.save();
    ctx.clip();
    if (!isSolid(x, y - 1)) {
      ctx.fillStyle = '#c28a55';
      ctx.fillRect(px - 1, py, cellSize + 2, cellSize * 0.24);
      ctx.fillStyle = 'rgba(214, 163, 111, 0.55)';
      ctx.fillRect(px - 1, py + cellSize * 0.24, cellSize + 2, cellSize * 0.08);
    }
    ctx.strokeStyle = 'rgba(78, 42, 16, 0.4)';
    ctx.lineWidth = Math.max(1, cellSize * 0.05);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px + cellSize * 0.12, py + cellSize * 0.56);
    ctx.lineTo(px + cellSize * 0.72, py + cellSize * 0.56);
    ctx.moveTo(px + cellSize * 0.34, py + cellSize * 0.8);
    ctx.lineTo(px + cellSize * 0.96, py + cellSize * 0.8);
    ctx.stroke();
    ctx.restore();
  }

  function stonePath(x, y, inset) {
    const g = cellSize * 0.06 + inset;
    roundRect(x * cellSize + g, y * cellSize + g, cellSize - g * 2, cellSize - g * 2, cellSize * 0.22);
  }

  function drawStoneBody(x, y, outline) {
    const px = x * cellSize;
    const py = y * cellSize;
    stonePath(x, y, outline);
    const g = ctx.createLinearGradient(0, py, 0, py + cellSize);
    g.addColorStop(0, '#c2cdd6');
    g.addColorStop(0.5, '#9aa8b5');
    g.addColorStop(1, '#75838f');
    ctx.fillStyle = g;
    ctx.fill();

    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(226, 235, 242, 0.75)';
    ctx.fillRect(px - 1, py, cellSize + 2, cellSize * 0.2);
    ctx.fillStyle = 'rgba(88, 100, 112, 0.5)';
    ctx.beginPath();
    ctx.ellipse(px + cellSize * 0.66, py + cellSize * 0.42, cellSize * 0.09, cellSize * 0.07, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px + cellSize * 0.36, py + cellSize * 0.68, cellSize * 0.06, cellSize * 0.05, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSpikes(x, y) {
    const px = x * cellSize;
    const base = y * cellSize + cellSize;
    const n = 3;
    const w = cellSize / n;
    for (let i = 0; i < n; i++) {
      const bx = px + i * w;
      const tipY = base - cellSize * (i === 1 ? 0.78 : 0.62);
      ctx.beginPath();
      ctx.moveTo(bx + w * 0.06, base);
      ctx.lineTo(bx + w / 2, tipY);
      ctx.lineTo(bx + w * 0.94, base);
      ctx.closePath();
      const g = ctx.createLinearGradient(bx, tipY, bx + w, base);
      g.addColorStop(0, '#f0f4f8');
      g.addColorStop(0.5, '#aab6c2');
      g.addColorStop(1, '#6b7885');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = '#333e4a';
      ctx.lineWidth = Math.max(1.2, cellSize * 0.055);
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }

  function drawPlant(x, y) {
    const cx = x * cellSize + cellSize / 2;
    const base = y * cellSize + cellSize * 0.95;
    const top = y * cellSize + cellSize * 0.1;
    const bend = cellSize * 0.12;

    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2f6b18';
    ctx.lineWidth = Math.max(2.4, cellSize * 0.17);
    stemPath(cx, base, top, bend);
    ctx.stroke();
    ctx.strokeStyle = '#c3e04c';
    ctx.lineWidth = Math.max(1.4, cellSize * 0.1);
    stemPath(cx, base, top, bend);
    ctx.stroke();

    const pairs = [
      [0.26, 1.0],
      [0.5, 0.92],
      [0.74, 0.8],
    ];
    pairs.forEach((p, i) => {
      const ly = y * cellSize + cellSize * p[0];
      const scale = p[1];
      drawLeaf(cx + bend * (1 - p[0]), ly, -1, scale);
      drawLeaf(cx + bend * (1 - p[0]), ly + cellSize * 0.03, 1, scale);
    });
  }

  function stemPath(cx, base, top, bend) {
    ctx.beginPath();
    ctx.moveTo(cx, base);
    ctx.quadraticCurveTo(cx + bend, (base + top) / 2, cx, top);
  }

  function drawLeaf(cx, cy, side, scale) {
    const rx = cellSize * 0.26 * scale;
    const ry = cellSize * 0.14 * scale;
    ctx.save();
    ctx.translate(cx + side * cellSize * 0.2 * scale, cy);
    ctx.rotate(side * 0.55);
    const g = ctx.createLinearGradient(0, -ry, 0, ry);
    g.addColorStop(0, '#7fd93c');
    g.addColorStop(1, '#3f9a1c');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#2b6415';
    ctx.lineWidth = Math.max(1.1, cellSize * 0.05);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(220, 255, 180, 0.6)';
    ctx.lineWidth = Math.max(0.8, cellSize * 0.028);
    ctx.beginPath();
    ctx.moveTo(-rx * 0.6, 0);
    ctx.lineTo(rx * 0.7, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawSaw(x, y) {
    const cx = x * cellSize + cellSize / 2;
    const cy = y * cellSize + cellSize / 2;
    const r = cellSize * 0.32;
    const outer = cellSize * 0.54;
    const teeth = 9;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spinAngle);

    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const a1 = ((i + 0.34) / teeth) * Math.PI * 2;
      const a2 = ((i + 1) / teeth) * Math.PI * 2;
      if (i === 0) ctx.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
      ctx.lineTo(Math.cos(a1) * outer, Math.sin(a1) * outer);
      ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#dfe7ee');
    g.addColorStop(0.5, '#a9b5c1');
    g.addColorStop(1, '#78838f');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#3a444f';
    ctx.lineWidth = Math.max(1.2, cellSize * 0.055);
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.fillStyle = '#8b98a5';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(58,68,79,0.75)';
    ctx.lineWidth = Math.max(1, cellSize * 0.04);
    ctx.stroke();

    ctx.fillStyle = '#2c343d';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPortal(x, y, active) {
    const cx = x * cellSize + cellSize / 2;
    const cy = y * cellSize + cellSize / 2;
    const r = cellSize * 0.46;

    if (active) {
      const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.1);
      glow.addColorStop(0, 'rgba(120, 205, 255, 0.75)');
      glow.addColorStop(0.5, 'rgba(120, 205, 255, 0.25)');
      glow.addColorStop(1, 'rgba(120, 205, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = active ? '#07182c' : '#141d2a';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = active ? 'rgba(150, 220, 255, 0.9)' : 'rgba(90, 110, 135, 0.8)';
    ctx.lineWidth = Math.max(1.2, cellSize * 0.06);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = active ? '#8fdcff' : '#55687f';
    ctx.lineWidth = Math.max(1.6, cellSize * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const turns = 2.6;
    const steps = 60;
    const phase = active ? spinAngle * 1.6 : spinAngle * 0.25;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = t * turns * Math.PI * 2 + phase;
      const rr = r * 0.95 * (1 - t);
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawSnake() {
    if (!snake.length) return;
    const pts = snake.map((s) => ({
      x: s.x * cellSize + cellSize / 2,
      y: s.y * cellSize + cellSize / 2,
    }));

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const wHead = cellSize * 0.66;
    const wTail = cellSize * 0.4;
    const edge = cellSize * 0.14;
    strokeTapered(pts, wHead + edge, wTail + edge, '#7a4408');
    strokeTapered(pts, wHead, wTail, '#efb033');
    strokeTapered(pts, wHead * 0.42, wTail * 0.42, 'rgba(255, 233, 160, 0.45)');

    for (let i = Math.max(1, pts.length - 4); i < pts.length; i++) {
      ctx.fillStyle = 'rgba(199, 118, 16, 0.35)';
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, cellSize * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }

    const head = pts[0];
    const px = -direction.y;
    const py = direction.x;

    const tipX = head.x + direction.x * cellSize * 0.72;
    const tipY = head.y + direction.y * cellSize * 0.72;
    ctx.strokeStyle = '#e8402f';
    ctx.lineWidth = Math.max(1.4, cellSize * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(head.x, head.y);
    ctx.lineTo(tipX, tipY);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + direction.x * cellSize * 0.12 + px * cellSize * 0.13, tipY + direction.y * cellSize * 0.12 + py * cellSize * 0.13);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + direction.x * cellSize * 0.12 - px * cellSize * 0.13, tipY + direction.y * cellSize * 0.12 - py * cellSize * 0.13);
    ctx.stroke();

    ctx.fillStyle = '#f7bb3e';
    ctx.strokeStyle = '#7a4408';
    ctx.lineWidth = Math.max(1.6, cellSize * 0.08);
    ctx.beginPath();
    ctx.arc(head.x, head.y, cellSize * 0.44, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const side = cellSize * 0.19;
    const fwd = cellSize * 0.09;
    const er = Math.max(2.2, cellSize * 0.145);
    const e1 = { x: head.x + direction.x * fwd + px * side, y: head.y + direction.y * fwd + py * side };
    const e2 = { x: head.x + direction.x * fwd - px * side, y: head.y + direction.y * fwd - py * side };

    [e1, e2].forEach((e) => {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#7a4408';
      ctx.lineWidth = Math.max(1, cellSize * 0.04);
      ctx.beginPath();
      ctx.arc(e.x, e.y, er, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#23303d';
      ctx.beginPath();
      ctx.arc(e.x + direction.x * er * 0.35, e.y + direction.y * er * 0.35, er * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(e.x - er * 0.25, e.y - er * 0.3, er * 0.22, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function strokeTapered(pts, wHead, wTail, color) {
    ctx.strokeStyle = color;
    if (pts.length === 1) {
      ctx.lineWidth = wHead;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[0].x + 0.1, pts[0].y);
      ctx.stroke();
      return;
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const t = i / (pts.length - 1);
      ctx.lineWidth = wHead + (wTail - wHead) * t;
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      ctx.stroke();
    }
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
      stepPetals();
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
