// Level-Baukasten: jedes Level besteht aus festen Untergrund-Blöcken
// („solids“), auf denen die Schlange steht bzw. über die sie klettert.
// Alles, was kein Block ist, ist offene Luft – dort gilt Schwerkraft.
// Stacheln/Sägen sind auf offenen Feldern tödlich, Äpfel lassen die
// Schlange wachsen, das Ziel gewinnt das Level.

function hline(x1, x2, y) {
  const cells = [];
  const [a, b] = x1 <= x2 ? [x1, x2] : [x2, x1];
  for (let x = a; x <= b; x++) cells.push([x, y]);
  return cells;
}

function vline(y1, y2, x) {
  const cells = [];
  const [a, b] = y1 <= y2 ? [y1, y2] : [y2, y1];
  for (let y = a; y <= b; y++) cells.push([x, y]);
  return cells;
}

function rect(x1, y1, x2, y2) {
  const cells = [];
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) cells.push([x, y]);
  }
  return cells;
}

function merge(...groups) {
  const map = new Map();
  groups.forEach((g) => g.forEach(([x, y]) => map.set(x + ',' + y, [x, y])));
  return Array.from(map.values());
}

// Ein Block-Pfeiler: eine Spalte von der Oberfläche `ySurface` `depth`
// Reihen tief nach unten aufgefüllt (Standardtiefe 4 – genug, damit es
// solide aussieht, ohne den Canvas unnötig zu vergrößern).
function pillar(x, ySurface, depth) {
  return vline(ySurface, ySurface + (depth == null ? 4 : depth), x);
}

// Wie `pillar`, aber über einen ganzen Spaltenbereich (eine ebene Fläche).
function platform(x1, x2, ySurface, depth) {
  const cells = [];
  for (let x = x1; x <= x2; x++) cells.push(...pillar(x, ySurface, depth));
  return cells;
}

const LEVELS = [];

// --- Level 1: Erste Schritte ---
// Großer Rundkurs: sanfte Hügel zum Eingewöhnen, zwei Kletterwände, eine
// Sprung-Lücke und je ein Stachel-/Säge-Steg, die alle erst mit den
// unterwegs gefressenen Äpfeln zu schaffen sind, und eine Zieltreppe.
LEVELS.push({
  name: 'Erste Schritte',
  solids: merge(
    platform(0, 4, 10),
    pillar(5, 9), pillar(6, 8), pillar(7, 8), pillar(8, 7),
    pillar(9, 7), pillar(10, 8), pillar(11, 9), pillar(12, 10),
    platform(13, 18, 10),
    platform(19, 22, 7),   // Plattform hinter Kletterwand 1 (Höhe 3 -> Apfel 1 nötig)
    platform(23, 26, 10),  // zurück auf Bodenhöhe
    // Lücke x=27..30 (Breite 4 -> Apfel 2 nötig)
    platform(31, 34, 10),
    pillar(35, 6),           // Kletter-Pfeiler zum Stachelsteg
    hline(36, 39, 6),        // dünner Steg über der Stachel-Lücke
    platform(40, 40, 6),     // Landepfeiler
    platform(41, 44, 10),    // zurück auf Bodenhöhe
    pillar(45, 5),            // Kletter-Pfeiler zum Sägesteg (Höhe 5 -> Apfel 3 nötig)
    hline(46, 50, 5),         // dünner Steg über der Säge-Lücke
    platform(51, 53, 5),      // Landepfeiler
    pillar(54, 4), pillar(55, 4), pillar(56, 3), pillar(57, 3),
    pillar(58, 2), pillar(59, 2),
    platform(60, 63, 2),      // Zielplateau
  ),
  spikes: [[37, 10], [38, 10]],
  saws: [[47, 10], [48, 10], [49, 10]],
  apples: [[15, 9], [24, 9], [42, 9]],
  start: [[1, 9], [2, 9], [3, 9]],
  goal: [62, 1],
});

// --- Level 2: Der Sprung (hochklettern, dann herunterfallen) ---
LEVELS.push({
  name: 'Der Sprung',
  solids: merge(
    hline(0, 6, 6),
    hline(7, 12, 4),
    hline(13, 18, 7),
  ),
  spikes: [],
  saws: [],
  apples: [[9, 3]],
  start: [[1, 5], [2, 5], [3, 5]],
  goal: [16, 6],
});

// --- Level 3: Apfelbrücke (nur mit dem Apfel lang genug für die Lücke) ---
LEVELS.push({
  name: 'Apfelbrücke',
  solids: merge(hline(0, 6, 6), hline(10, 16, 6)),
  spikes: [],
  saws: [],
  apples: [[5, 5]],
  start: [[1, 5], [2, 5], [3, 5]],
  goal: [13, 5],
});

// --- Level 4: Stachelfeld (Steg über eine tödliche Lücke mit Stachel) ---
LEVELS.push({
  name: 'Stachelfeld',
  solids: merge(
    hline(0, 3, 6),
    hline(4, 9, 4),
    hline(10, 16, 6),
  ),
  spikes: [[6, 6]],
  saws: [],
  apples: [[12, 5]],
  start: [[1, 5], [2, 5], [3, 5]],
  goal: [14, 5],
});

// --- Level 5: Sägewerk (zwei Stege über tödliche Lücken mit Sägen) ---
LEVELS.push({
  name: 'Sägewerk',
  solids: merge(
    hline(0, 3, 6),
    hline(4, 8, 4),
    hline(9, 12, 6),
    hline(13, 17, 4),
    hline(18, 22, 6),
  ),
  spikes: [],
  saws: [[6, 6], [15, 6]],
  apples: [[10, 5]],
  start: [[1, 5], [2, 5], [3, 5]],
  goal: [20, 5],
});

// --- Level 6: Turm (Treppe hochklettern, zwei Äpfel für die letzte Stufe) ---
LEVELS.push({
  name: 'Turm',
  solids: merge(
    hline(0, 3, 8),
    rect(4, 7, 6, 8),
    rect(7, 6, 9, 8),
    rect(10, 5, 12, 8),
    rect(13, 4, 16, 8),
  ),
  spikes: [],
  saws: [],
  apples: [[5, 6], [11, 4]],
  start: [[1, 7], [2, 7], [3, 7]],
  goal: [15, 3],
});

if (typeof module !== 'undefined') {
  module.exports = { LEVELS, hline, vline, rect, merge, pillar, platform };
}
