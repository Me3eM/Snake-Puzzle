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

const LEVELS = [
  {
    name: 'Erste Schritte',
    cols: 12,
    rows: 8,
    start: { x: 2, y: 2, dir: 'RIGHT', length: 2 },
    walls: [...border(12, 8), ...points([[6, 4]])],
    apples: points([[9, 2], [9, 5], [3, 5]]),
    spikes: [],
    gears: [],
  },
  {
    name: 'Stachel-Alarm',
    cols: 14,
    rows: 9,
    start: { x: 2, y: 2, dir: 'RIGHT', length: 2 },
    walls: [...border(14, 9), ...hline(5, 6, 4), ...hline(8, 9, 4)],
    apples: points([[11, 2], [2, 6], [11, 6]]),
    spikes: points([[7, 2], [7, 6]]),
    gears: [],
  },
  {
    name: 'Enge Kurven',
    cols: 14,
    rows: 10,
    start: { x: 2, y: 2, dir: 'RIGHT', length: 2 },
    walls: [...border(14, 10), ...vline(2, 6, 5), ...vline(3, 7, 9)],
    apples: points([[12, 2], [2, 8], [12, 8], [7, 4]]),
    spikes: points([[9, 7]]),
    gears: [],
  },
  {
    name: 'Zahnrad',
    cols: 12,
    rows: 9,
    start: { x: 2, y: 4, dir: 'RIGHT', length: 2 },
    walls: [...border(12, 9)],
    apples: points([[9, 2], [9, 7]]),
    spikes: [],
    gears: [{ path: vline(2, 6, 6) }],
  },
  {
    name: 'Doppelt gefährlich',
    cols: 16,
    rows: 10,
    start: { x: 2, y: 2, dir: 'RIGHT', length: 2 },
    walls: [...border(16, 10), ...vline(2, 7, 7), ...hline(9, 13, 3), ...vline(5, 9, 11)],
    apples: points([[13, 2], [3, 8], [13, 8], [8, 5]]),
    spikes: points([[9, 2], [5, 6]]),
    gears: [{ path: vline(4, 8, 11) }],
  },
  {
    name: 'Meisterwerk',
    cols: 16,
    rows: 11,
    start: { x: 2, y: 2, dir: 'RIGHT', length: 2 },
    walls: [...border(16, 11), ...vline(2, 8, 5), ...hline(5, 9, 8), ...vline(1, 5, 10), ...hline(10, 12, 3), ...points([[14, 3]])],
    apples: points([[13, 2], [3, 9], [13, 9], [7, 6], [12, 6]]),
    spikes: points([[9, 2], [3, 5]]),
    gears: [{ path: vline(3, 7, 8) }, { path: vline(4, 8, 12) }],
  },
];
