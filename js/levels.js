function border(cols, rows) {
  const cells = [];
  for (let x = 0; x < cols; x++) {
    cells.push([x, 0]);
    cells.push([x, rows - 1]);
  }
  for (let y = 0; y < rows; y++) {
    cells.push([0, y]);
    cells.push([cols - 1, y]);
  }
  return cells;
}

function hline(x1, x2, y) {
  const cells = [];
  for (let x = x1; x <= x2; x++) cells.push([x, y]);
  return cells;
}

function vline(y1, y2, x) {
  const cells = [];
  for (let y = y1; y <= y2; y++) cells.push([x, y]);
  return cells;
}

function points(arr) {
  return arr.map((p) => [p[0], p[1]]);
}

function rectHollow(x1, y1, x2, y2, gaps) {
  gaps = gaps || [];
  const gapKeys = new Set(gaps.map((g) => g[0] + ',' + g[1]));
  const map = new Map();
  for (let x = x1; x <= x2; x++) {
    map.set(x + ',' + y1, [x, y1]);
    map.set(x + ',' + y2, [x, y2]);
  }
  for (let y = y1; y <= y2; y++) {
    map.set(x1 + ',' + y, [x1, y]);
    map.set(x2 + ',' + y, [x2, y]);
  }
  gapKeys.forEach((k) => map.delete(k));
  return Array.from(map.values());
}

function grid(xs, ys) {
  const cells = [];
  xs.forEach((x) => ys.forEach((y) => cells.push([x, y])));
  return cells;
}

const LEVELS = [
  {
    name: 'Erste Schritte',
    cols: 14,
    rows: 8,
    gravity: true,
    start: { x: 2, y: 6, dir: 'RIGHT', length: 2 },
    walls: [...border(14, 8), ...hline(1, 3, 3), ...hline(5, 7, 2)],
    stones: points([[9, 4], [9, 5]]),
    food: points([[3, 6], [4, 6], [8, 6], [11, 4], [11, 3], [11, 2]]),
    spikes: points([[6, 6]]),
    saws: points([[6, 4]]),
    portal: [11, 1],
  },
  {
    name: 'Stachel-Alarm',
    cols: 14,
    rows: 9,
    start: { x: 2, y: 2, dir: 'RIGHT', length: 2 },
    walls: [...border(14, 9), ...hline(5, 6, 4), ...hline(8, 9, 4)],
    food: points([[11, 2], [2, 6], [11, 6]]),
    spikes: points([[7, 2], [7, 6]]),
    saws: [],
  },
  {
    name: 'Enge Kurven',
    cols: 14,
    rows: 10,
    start: { x: 2, y: 2, dir: 'RIGHT', length: 2 },
    walls: [...border(14, 10), ...vline(2, 6, 5), ...vline(3, 7, 9)],
    food: points([[12, 2], [2, 8], [12, 8], [7, 4]]),
    spikes: points([[9, 7]]),
    saws: [],
  },
  {
    name: 'Kreissäge',
    cols: 12,
    rows: 9,
    start: { x: 2, y: 4, dir: 'RIGHT', length: 2 },
    walls: [...border(12, 9)],
    food: points([[9, 2], [9, 7]]),
    spikes: [],
    saws: [{ path: vline(2, 6, 6) }],
  },
  {
    name: 'Doppelt gefährlich',
    cols: 16,
    rows: 10,
    start: { x: 2, y: 2, dir: 'RIGHT', length: 2 },
    walls: [...border(16, 10), ...vline(2, 7, 7), ...hline(9, 13, 3), ...vline(5, 9, 11)],
    food: points([[13, 2], [3, 8], [13, 8], [8, 5]]),
    spikes: points([[9, 2], [5, 6]]),
    saws: [{ path: vline(4, 8, 11) }],
  },
  {
    name: 'Meisterwerk',
    cols: 16,
    rows: 11,
    start: { x: 2, y: 2, dir: 'RIGHT', length: 2 },
    walls: [...border(16, 11), ...vline(2, 8, 5), ...hline(5, 9, 8), ...vline(1, 5, 10), ...hline(10, 12, 3), ...points([[14, 3]])],
    food: points([[13, 2], [3, 9], [13, 9], [7, 6], [12, 6]]),
    spikes: points([[9, 2], [3, 5]]),
    saws: [{ path: vline(3, 7, 8) }, { path: vline(4, 8, 12) }],
  },
];
