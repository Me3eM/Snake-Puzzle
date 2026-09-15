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
    name: 'Einstieg',
    cols: 22,
    rows: 14,
    target: 5,
    speed: 6,
    start: { x: 3, y: 2, dir: 'RIGHT' },
    walls: [
      ...border(22, 14),
      ...points([[10, 4], [16, 4], [10, 9], [16, 9], [13, 6]]),
    ],
  },
  {
    name: 'Kreuzung',
    cols: 22,
    rows: 14,
    target: 6,
    speed: 6.5,
    start: { x: 3, y: 2, dir: 'RIGHT' },
    walls: [
      ...border(22, 14),
      ...hline(5, 9, 7),
      ...hline(12, 16, 7),
      ...points([[8, 3], [14, 10]]),
    ],
  },
  {
    name: 'Slalom',
    cols: 24,
    rows: 15,
    target: 7,
    speed: 7,
    start: { x: 3, y: 2, dir: 'RIGHT' },
    walls: [
      ...border(24, 15),
      ...vline(2, 9, 8),
      ...vline(5, 13, 16),
      ...points([[11, 7]]),
    ],
  },
  {
    name: 'Kammer',
    cols: 24,
    rows: 15,
    target: 8,
    speed: 7.5,
    start: { x: 3, y: 2, dir: 'RIGHT' },
    walls: [
      ...border(24, 15),
      ...rectHollow(8, 4, 17, 11, [[12, 11]]),
      ...points([[5, 12], [20, 3]]),
    ],
  },
  {
    name: 'Stelzenfeld',
    cols: 26,
    rows: 16,
    target: 9,
    speed: 8,
    start: { x: 3, y: 2, dir: 'RIGHT' },
    walls: [
      ...border(26, 16),
      ...grid([6, 11, 16, 21], [4, 8, 12]),
    ],
  },
  {
    name: 'Irrgarten',
    cols: 26,
    rows: 16,
    target: 10,
    speed: 8.5,
    start: { x: 3, y: 2, dir: 'RIGHT' },
    walls: [
      ...border(26, 16),
      ...vline(2, 9, 7),
      ...hline(10, 18, 11),
      ...vline(6, 13, 19),
      ...points([[13, 4]]),
    ],
  },
  {
    name: 'Spirale',
    cols: 28,
    rows: 17,
    target: 11,
    speed: 9,
    start: { x: 3, y: 2, dir: 'RIGHT' },
    walls: [
      ...border(28, 17),
      ...rectHollow(6, 3, 25, 14, [[25, 8]]),
      ...rectHollow(9, 5, 22, 12, [[9, 8]]),
    ],
  },
  {
    name: 'Endgegner',
    cols: 28,
    rows: 17,
    target: 12,
    speed: 9.5,
    start: { x: 3, y: 2, dir: 'RIGHT' },
    walls: [
      ...border(28, 17),
      ...hline(8, 13, 6),
      ...hline(16, 21, 6),
      ...hline(8, 17, 11),
      ...hline(20, 21, 11),
      ...points([[5, 12], [24, 4], [24, 12]]),
    ],
  },
];
