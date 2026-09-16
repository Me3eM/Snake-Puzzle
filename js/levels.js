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
    cols: 16,
    rows: 11,
    gravity: true,
    start: { x: 2, y: 3, dir: 'RIGHT', length: 2 },
    walls: [
      ...hline(0, 15, 0),
      ...vline(0, 10, 0),
      ...vline(0, 10, 15),
      ...hline(0, 8, 10),
      ...hline(11, 15, 10),
      ...hline(1, 4, 4),
      ...hline(3, 5, 7),
    ],
    stones: points([[6, 7], [11, 5], [11, 6]]),
    food: points([
      [3, 3], [4, 6], [8, 9],
      [14, 7], [14, 6], [14, 5], [14, 4], [14, 3], [14, 2],
    ]),
    spikes: points([[12, 9]]),
    saws: points([[12, 7]]),
    portal: [14, 1],
  },
];
