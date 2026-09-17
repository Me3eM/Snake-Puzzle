# Snake Puzzle

Ein browserbasiertes Physik-Puzzle: Die Schlange steht auf festen Holzblöcken,
Schwerkraft zieht sie nach unten, wenn sie den Boden unter den Füßen
verliert, und sie wächst nur, wenn sie einen Apfel frisst. Ziel jedes
Levels ist es, die Fahne zu erreichen, ohne in Stacheln, Sägeblätter oder
eine Lücke ins Leere zu fallen.

Kein Build-Prozess nötig – reines HTML/CSS/JavaScript. Einfach `index.html`
in einem lokalen Server öffnen (z. B. `python3 -m http.server`) oder direkt
im Browser laden.

## Spielprinzip

- Steuerung per Steuerkreuz (Bildschirm), Pfeiltasten oder WASD: Jeder
  Tastendruck bewegt den Kopf genau ein Feld, der Rest der Schlange folgt
  wie beim klassischen Snake.
- Nach jedem Zug greift die Schwerkraft: Steht kein Teil der Schlange mehr
  auf festem Untergrund, fällt sie als Ganzes nach unten, bis sie wieder
  aufkommt. Ein langer Körper kann dabei über Lücken hinausragen, solange
  ein Teil noch auf festem Boden steht – deshalb lohnt sich Länge.
- Die Schlange wächst ausschließlich, wenn der Kopf auf einen Apfel zieht.
  Auf manchen Feldern ist genau das nötig, um eine Lücke sicher zu
  überbrücken.
- Stacheln und Sägeblätter sind auf Berührung tödlich – auch beim
  Herunterfallen. Fällt die Schlange ins Leere (keine Lücke reicht bis zum
  Boden), endet der Versuch ebenfalls mit "FAILED!".
- Bei "FAILED!" helfen "Nochmal" (Neustart) oder "Überspringen" (Level
  automatisch mit der kürzesten Lösung abschließen) weiter.
- ↺ nimmt den letzten Zug (inkl. Fall) zurück, 💡 zeigt kurz die nächste
  richtige Richtung einer tatsächlich berechneten Lösung an.
- Nach jedem geschafften Level wird das nächste freigeschaltet; die
  Sternebewertung (1–3) hängt von der Anzahl der Versuche ab (Überspringen
  gibt immer nur 1 Stern).
- Fortschritt und Sterne werden lokal im Browser gespeichert (`localStorage`).

## Struktur

- `index.html` – Bildschirme (Menü, Level-Auswahl, Spiel) und Overlays
  (Pause, Sieg, "FAILED!")
- `style.css` – Holz-/Nachthimmel-Theme, responsives Layout, Steuerkreuz
- `js/sim.js` – reine Physik-/Regel-Engine (keine DOM-Abhängigkeit): Züge,
  Schwerkraft, Kollisionen, sowie eine Zustandsraum-Suche (BFS) für
  Hinweis, Überspringen und die Level-Validierung
- `js/levels.js` – Level-Baukasten (Helferfunktionen für Blockformen) und
  Level-Definitionen (Untergrund, Stacheln, Sägen, Äpfel, Start/Ziel)
- `js/game.js` – Bindeglied zur Oberfläche: Eingaben, Fall-Animation,
  Rendering, Undo/Hinweis/Überspringen, Speicherstand

Aktuell enthalten: 6 Level mit steigender Schwierigkeit (Einstieg bis
Turm-Kletterei), jedes automatisiert auf Lösbarkeit geprüft.
