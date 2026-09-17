// Reine Simulations-Engine (keine DOM-Abhängigkeiten), damit sie sowohl im
// Browser (Spiel, Hinweis, Überspringen) als auch in Node (Level-Validierung)
// verwendet werden kann.
//
// Regeln:
// - Die Schlange bewegt sich wie klassisches Snake: der Kopf zieht in eine
//   Richtung, der Rest folgt der Kette. Sie wächst NUR, wenn der Kopf auf
//   ein Apfel-Feld zieht.
// - Nach jedem Zug fällt die GESAMTE Schlange als starre Kette so lange nach
//   unten, bis mindestens ein Segment auf festem Untergrund steht (Blöcke
//   tragen also auch dann, wenn nur ein Teil der Schlange auf ihnen steht –
//   der Rest kann über eine Lücke hinausragen).
// - Stacheln/Sägen sind auf freien Feldern tödlich (auch wenn man beim
//   Herunterfallen hindurchrutscht). Das Ziel darf jederzeit berührt werden.

function cellKey(x, y) { return x + ',' + y; }

function buildLevelRuntime(def) {
  const solidSet = new Set(def.solids.map(([x, y]) => cellKey(x, y)));
  const hazardMap = new Map();
  (def.spikes || []).forEach(([x, y]) => hazardMap.set(cellKey(x, y), 'spike'));
  (def.saws || []).forEach(([x, y]) => hazardMap.set(cellKey(x, y), 'saw'));

  const xs = def.solids.map((c) => c[0]);
  const ys = def.solids.map((c) => c[1]);
  const minX = Math.min(...xs) - 1;
  const maxX = Math.max(...xs) + 1;
  const minY = Math.min(...ys) - 3; // Luft nach oben zum Springen/Fallen
  const maxY = Math.max(...ys);

  return {
    def, solidSet, hazardMap,
    minX, maxX, minY, maxY,
    cols: maxX - minX + 1,
    rows: maxY - minY + 1,
    goal: { x: def.goal[0], y: def.goal[1] },
  };
}

// Nur die Seitenränder sind fest (man kann nicht seitlich hinauslaufen);
// nach oben ist offener Himmel, nach unten ist eine Lücke ohne Boden ein
// tödlicher Sturz ins Leere (siehe Sturz-Erkennung weiter unten).
function isSolid(rt, x, y) {
  if (x < rt.minX || x > rt.maxX) return true;
  if (y < rt.minY) return false;
  return rt.solidSet.has(cellKey(x, y));
}

function hazardAt(rt, x, y) {
  return rt.hazardMap.get(cellKey(x, y)) || null;
}

function initialState(def) {
  return {
    snake: def.start.map(([x, y]) => ({ x, y })),
    apples: new Set(def.apples.map(([x, y]) => cellKey(x, y))),
  };
}

function cloneState(state) {
  return { snake: state.snake.map((s) => ({ x: s.x, y: s.y })), apples: new Set(state.apples) };
}

function sameCell(a, b) { return a.x === b.x && a.y === b.y; }

const DIR_VECTORS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

// Ein Spielerzug + anschließendes vollständiges "Absacken" durch Schwerkraft.
// Gibt null zurück, wenn der Zug ein reiner Stoß (No-Op) ist.
// Sonst { state, dead, won, frames }: frames ist die Liste der
// Zwischenformen der Schlange (für die Fall-Animation), state ist der
// endgültige, zur Ruhe gekommene Zustand (bzw. der Zustand beim Tod/Sieg).
function step(rt, state, dirName) {
  const d = DIR_VECTORS[dirName];
  if (!d) return null;
  const head = state.snake[state.snake.length - 1];
  const nx = head.x + d.x, ny = head.y + d.y;

  if (isSolid(rt, nx, ny)) return null;

  const targetKey = cellKey(nx, ny);
  const growing = state.apples.has(targetKey);

  for (let i = growing ? 0 : 1; i < state.snake.length; i++) {
    if (sameCell(state.snake[i], { x: nx, y: ny })) return null; // eigener Körper blockiert
  }

  let snake = state.snake.map((s) => ({ x: s.x, y: s.y }));
  snake.push({ x: nx, y: ny });
  if (!growing) snake.shift();
  const apples = new Set(state.apples);
  if (growing) apples.delete(targetKey);

  const frames = [snake.map((s) => ({ x: s.x, y: s.y }))];

  if (sameCell({ x: nx, y: ny }, rt.goal)) {
    return { state: { snake, apples }, dead: false, won: true, frames };
  }
  if (hazardAt(rt, nx, ny)) {
    return { state: { snake, apples }, dead: true, won: false, frames };
  }

  let dead = false, won = false;
  while (true) {
    const canFall = snake.every((s) => !isSolid(rt, s.x, s.y + 1));
    if (!canFall) break;
    snake = snake.map((s) => ({ x: s.x, y: s.y + 1 }));
    frames.push(snake.map((s) => ({ x: s.x, y: s.y })));
    const newHead = snake[snake.length - 1];
    if (sameCell(newHead, rt.goal)) { won = true; break; }
    if (snake.some((s) => hazardAt(rt, s.x, s.y))) { dead = true; break; }
    // Kein Segment kann auf einer legitimen Ruheposition tiefer als maxY-1
    // liegen (maxY ist die tiefste feste Zeile im Level) - alles darunter
    // ist ein Sturz ins Leere.
    if (snake.some((s) => s.y > rt.maxY)) { dead = true; break; }
  }

  return { state: { snake, apples }, dead, won, frames };
}

function stateKey(state) {
  return state.snake.map((s) => s.x + '_' + s.y).join('|') + '#' + [...state.apples].sort().join(',');
}

const ALL_DIRS = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

// BFS über den kompletten Zustandsraum (Schlangenform + verbleibende Äpfel)
// von `fromState` zu einem Sieg-Zustand. Gibt die Zugfolge (Richtungen)
// zurück oder null, wenn keine gefunden wird.
function solve(rt, fromState) {
  const startKey = stateKey(fromState);
  const cameFrom = new Map();
  const seen = new Set([startKey]);
  const queue = [fromState];
  while (queue.length) {
    const cur = queue.shift();
    const curKey = stateKey(cur);
    for (const dir of ALL_DIRS) {
      const res = step(rt, cur, dir);
      if (!res || res.dead) continue;
      const k = stateKey(res.state);
      if (seen.has(k)) continue;
      seen.add(k);
      cameFrom.set(k, { prevKey: curKey, dir });
      if (res.won) {
        const path = [dir];
        let pk = curKey;
        while (pk !== startKey) {
          const info = cameFrom.get(pk);
          path.unshift(info.dir);
          pk = info.prevKey;
        }
        return path;
      }
      queue.push(res.state);
    }
  }
  return null;
}

if (typeof module !== 'undefined') {
  module.exports = {
    cellKey, buildLevelRuntime, isSolid, hazardAt, initialState, cloneState,
    sameCell, step, stateKey, solve, DIR_VECTORS, ALL_DIRS,
  };
}
