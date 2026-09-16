// Level-Baukasten: jedes Level ist ein festes "Rohr" (Pfad-Zellen), durch das
// die Schlange Schritt für Schritt gesteuert wird. Alles außerhalb des Pfads
// ist Leerraum (Himmel). Stacheln/Sägen auf dem Pfad sind tödlich, Steine
// blockieren den Weg (sie werden aus dem begehbaren Pfad herausgeschnitten).

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

// Kleine Ausweichschlaufe: Hauptreihe bei y (mit Platz für eine Gefahr in der
// Mitte) plus eine freie Bypass-Reihe darüber (dy=-1) oder darunter (dy=1),
// verbunden an beiden Enden. Gibt außerdem die Zelle für die Gefahr zurück.
function dodge(x, y, width, dy) {
  const x2 = x + width - 1;
  const hazardX = x + Math.floor(width / 2);
  const cells = [
    ...hline(x, x2, y),
    ...hline(x, x2, y + dy),
    ...vline(y, y + dy, x),
    ...vline(y, y + dy, x2),
  ];
  return { cells, hazard: [hazardX, y] };
}

function merge(...groups) {
  const map = new Map();
  groups.forEach((g) => g.forEach(([x, y]) => map.set(x + ',' + y, [x, y])));
  return Array.from(map.values());
}

function subtract(base, remove) {
  const removeSet = new Set(remove.map(([x, y]) => x + ',' + y));
  return base.filter(([x, y]) => !removeSet.has(x + ',' + y));
}

const LEVELS = [];

// --- Level 1: Erste Schritte (Tutorial, keine Gefahren) ---
{
  const path = merge(
    hline(1, 8, 1),
    vline(1, 3, 8),
    hline(3, 8, 3),
    vline(3, 6, 3),
    hline(3, 9, 6),
  );
  LEVELS.push({
    name: 'Erste Schritte',
    start: [1, 1],
    goal: [9, 6],
    path,
    spikes: [],
    saws: [],
    blocks: [],
  });
}

// --- Level 2: Stachelgang (erste Stachel-Ausweiche) ---
{
  const d1 = dodge(4, 2, 5, -1); // cols 4..8, Bypass Reihe y=1
  const path = merge(
    hline(1, 4, 2),
    d1.cells,
    hline(8, 12, 2),
  );
  LEVELS.push({
    name: 'Stachelgang',
    start: [1, 2],
    goal: [12, 2],
    path,
    spikes: [d1.hazard],
    saws: [],
    blocks: [],
  });
}

// --- Level 3: Sägezahn (erste Säge-Ausweiche) ---
{
  const d1 = dodge(6, 3, 5, 1); // Bypass Reihe y=4
  const path = merge(
    vline(1, 3, 1),
    hline(1, 6, 3),
    d1.cells,
    hline(10, 12, 3),
    vline(3, 6, 12),
  );
  LEVELS.push({
    name: 'Sägezahn',
    start: [1, 1],
    goal: [12, 6],
    path,
    spikes: [],
    saws: [d1.hazard],
    blocks: [],
  });
}

// --- Level 4: Steinbruch (Steine in einer offenen Kammer umgehen) ---
{
  const chamber = rect(4, 3, 8, 5);
  const blocks = [[6, 4], [7, 3], [7, 5]];
  const path = subtract(
    merge(
      hline(1, 6, 1),
      vline(1, 7, 6),
      hline(6, 11, 7),
      chamber,
    ),
    blocks,
  );
  LEVELS.push({
    name: 'Steinbruch',
    start: [1, 1],
    goal: [11, 7],
    path,
    spikes: [],
    saws: [],
    blocks,
  });
}

// --- Level 5: Zickzack (Stachel + Säge kombiniert) ---
{
  const d1 = dodge(2, 2, 4, 1);   // Bypass Reihe y=3, Säge auf Hauptreihe y=2
  const d2 = dodge(9, 7, 4, -1);  // Bypass Reihe y=6, Stachel auf Hauptreihe y=7
  const path = merge(
    hline(1, 2, 2),
    d1.cells,
    vline(2, 7, 5),
    hline(5, 9, 7),
    d2.cells,
    hline(12, 13, 7),
    vline(7, 9, 13),
  );
  LEVELS.push({
    name: 'Zickzack',
    start: [1, 2],
    goal: [13, 9],
    path,
    spikes: [d2.hazard],
    saws: [d1.hazard],
    blocks: [],
  });
}

// --- Level 6: Kammerspiel (große Kammer mit mehreren Gefahren) ---
{
  const d1 = dodge(7, 2, 5, 1); // Bypass Reihe y=3, Säge auf Hauptreihe y=2
  const chamber = rect(9, 6, 13, 8);
  const blocks = [[10, 6], [12, 7]];
  const path = subtract(
    merge(
      rect(1, 1, 3, 3),
      hline(3, 7, 2),
      d1.cells,
      hline(11, 13, 3),
      vline(3, 8, 11),
      hline(9, 13, 8),
      chamber,
    ),
    blocks,
  );
  LEVELS.push({
    name: 'Kammerspiel',
    start: [1, 1],
    goal: [9, 7],
    path,
    spikes: [[13, 3], [9, 8]],
    saws: [d1.hazard],
    blocks,
  });
}

// --- Level 7: Enger Tunnel (langer Weg, mehrere Ausweichen) ---
{
  const d1 = dodge(4, 4, 3, -1);   // Stachel bei y=4, Bypass y=3
  const d2 = dodge(9, 4, 3, 1);    // Stachel bei y=4, Bypass y=5
  const d3 = dodge(12, 4, 3, -1);  // Säge bei y=4, Bypass y=3
  const path = merge(
    hline(1, 4, 4),
    d1.cells,
    hline(6, 9, 4),
    d2.cells,
    hline(11, 12, 4),
    d3.cells,
    hline(14, 15, 4),
    vline(4, 8, 15),
    hline(11, 15, 8),
  );
  LEVELS.push({
    name: 'Enger Tunnel',
    start: [1, 4],
    goal: [11, 8],
    path,
    spikes: [d1.hazard, d2.hazard],
    saws: [d3.hazard],
    blocks: [],
  });
}

// --- Level 8: Endgegner (alles kombiniert) ---
{
  const d1 = dodge(3, 1, 3, 1);    // Säge bei y=1, Bypass y=2
  const d2 = dodge(6, 4, 3, -1);   // Stachel bei y=4, Bypass y=3
  const chamber = rect(9, 6, 12, 9);
  const blocks = [[10, 7], [11, 8]];
  const d3 = dodge(11, 2, 3, 1);   // Säge bei y=2, Bypass y=3
  const path = subtract(
    merge(
      hline(1, 3, 1),
      d1.cells,
      hline(5, 6, 2),
      vline(2, 4, 6),
      d2.cells,
      vline(4, 6, 8),
      hline(8, 9, 6),
      chamber,
      hline(12, 13, 7),
      vline(1, 7, 13),
      hline(11, 13, 1),
      d3.cells,
    ),
    blocks,
  );
  LEVELS.push({
    name: 'Endgegner',
    start: [1, 1],
    goal: [9, 8],
    path,
    spikes: [d2.hazard],
    saws: [d1.hazard, d3.hazard],
    blocks,
  });
}

if (typeof module !== 'undefined') {
  module.exports = { LEVELS, hline, vline, rect, dodge, merge, subtract };
}
