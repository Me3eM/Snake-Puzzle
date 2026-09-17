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
    name: 'Der lange Weg',
    cols: 20,
    rows: 13,
    gravity: true,
    start: { x: 4, y: 3, dir: 'RIGHT', length: 2 },
    walls: [
      ...hline(0, 19, 0),
      ...hline(0, 19, 12),
      ...vline(0, 12, 0),
      ...vline(0, 12, 19),
      ...hline(3, 7, 4),
      ...hline(10, 14, 4),
      ...hline(4, 6, 7),
      ...hline(11, 16, 7),
    ],
    stones: points([[8, 4], [15, 4], [3, 7], [17, 7]]),
    food: points([
      [6, 3], [12, 3], [17, 4],
      [14, 6], [4, 6], [9, 8], [2, 8], [18, 9],
      [3, 11], [8, 11], [11, 11], [16, 11],
    ]),
    spikes: points([[5, 11], [13, 11], [6, 6], [11, 6]]),
    saws: points([[5, 9], [13, 9], [9, 2]]),
    portal: [1, 1],
  },
];
