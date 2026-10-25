// ---------- Beispielformen ----------
// Jede Form ist eine Silhouette als SVG-Pfad in einem Kasten von 200 × 100 (x nach rechts, y nach unten).
// Der Wind kommt von links, die Nase zeigt also nach links. Formen mit ground: true stehen auf dem Boden
// (die Unterkante des Pfads liegt dann auf dem Boden des Kanals). len: Länge in Metern (für die Reynoldszahl).
// Mehrere Teilpfade werden vereinigt (Füllregel nonzero, alle im selben Drehsinn gezeichnet).

const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const rect = (x, y, w, h, r = 0) => r > 0
  ? `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`
  : `M${x} ${y}h${w}v${h}h${-w}Z`;
const poly = (pts) => 'M' + pts.map(p => p.join(' ')).join('L') + 'Z';
const ell = (cx, cy, rx, ry) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
// dicke Linie als Pfad (für Speichen, Rahmen, Leinen)
const bar = (x0, y0, x1, y1, w) => { const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2; return poly([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]]); };

// NACA-4-Profil (Sehne von x0 bis x1 auf Höhe yc), Dicke t (Anteil), Wölbung m bei p
function naca(x0, x1, yc, t = 0.12, m = 0.02, p = 0.4, n = 40) {
  const c = x1 - x0, up = [], lo = [];
  for (let i = 0; i <= n; i++) {
    const xc = 0.5 - 0.5 * Math.cos(Math.PI * i / n);
    const yt = 5 * t * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
    const ycam = xc < p ? m / (p * p) * (2 * p * xc - xc * xc) : m / ((1 - p) ** 2) * (1 - 2 * p + 2 * p * xc - xc * xc);
    const dyc = xc < p ? 2 * m / (p * p) * (p - xc) : 2 * m / ((1 - p) ** 2) * (p - xc);
    const th = Math.atan(dyc);
    up.push([x0 + c * (xc - yt * Math.sin(th)), yc - c * (ycam + yt * Math.cos(th))]);
    lo.push([x0 + c * (xc + yt * Math.sin(th)), yc - c * (ycam - yt * Math.cos(th))]);
  }
  return 'M' + up.map(q => q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join('L') + 'L' + lo.reverse().map(q => q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join('L') + 'Z';
}

const SHAPES = [
  // ---- Grundformen
  { id: 'kreis', name: 'Kreis', group: 'Grundformen', len: 1, path: circ(100, 50, 40) },
  { id: 'quadrat', name: 'Quadrat', group: 'Grundformen', len: 1, path: rect(60, 10, 80, 80) },
  { id: 'dreieck', name: 'Dreieck', group: 'Grundformen', len: 1, path: poly([[45, 50], [150, 8], [150, 92]]) },
  { id: 'tropfen', name: 'Tropfen', group: 'Grundformen', len: 1, info: 'die windschnittigste Form', path: 'M22 50C22 28 40 16 64 16C96 16 140 32 186 50C140 68 96 84 64 84C40 84 22 72 22 50Z' },   // Schwanz höchstens 21° steil
  { id: 'platte_quer', name: 'Platte quer', group: 'Grundformen', len: 1, path: rect(96, 10, 8, 80) },
  { id: 'platte_laengs', name: 'Platte längs', group: 'Grundformen', len: 2, path: rect(20, 47, 160, 6) },
  { id: 'schale', name: 'Schale', group: 'Grundformen', len: 1, info: 'offen gegen den Wind, wie ein Fallschirm', path: 'M100 8A42 42 0 0 1 100 92L90 92A34 34 0 0 0 90 8Z' },
  { id: 'kugelhaelfte', name: 'Halbkugel', group: 'Grundformen', len: 1, info: 'Rundung gegen den Wind', path: 'M100 8A42 42 0 0 0 100 92Z' },
  { id: 'ellipse', name: 'Ellipse', group: 'Grundformen', len: 2, path: ell(100, 50, 80, 28) },
  { id: 'fluegel', name: 'Tragflügel', group: 'Grundformen', len: 1.5, ref: 'len', info: 'NACA 2412, Beiwerte auf die Flügeltiefe bezogen', path: naca(20, 180, 52) },
  { id: 'raute', name: 'Raute', group: 'Grundformen', len: 1, path: poly([[30, 50], [100, 14], [170, 50], [100, 86]]) },
  // ---- Fahrzeuge
  { id: 'kaefer', name: 'Käfer', group: 'Fahrzeuge', len: 4.1, ground: true, info: 'der runde Klassiker',
    path: 'M18 78C18 62 30 56 46 54C58 40 72 24 100 22C128 20 148 34 160 50C176 54 186 62 186 76L186 80L18 80Z' + circ(58, 80, 15) + circ(150, 80, 15) },
  { id: 'sportwagen', name: 'Sportwagen', group: 'Fahrzeuge', len: 4.5, ground: true,
    path: 'M12 76L16 62C40 56 60 54 74 52C88 40 104 34 128 34C150 34 164 42 172 52L184 56C190 60 190 70 186 78L12 78Z' + circ(50, 78, 13) + circ(152, 78, 13) },
  { id: 'lkw', name: 'Lkw', group: 'Fahrzeuge', len: 16, ground: true, info: 'Fahrerhaus und Koffer mit Spalt',
    path: 'M14 80L14 40C14 30 20 22 30 22L52 22L58 44L58 80Z' + rect(64, 14, 128, 66) + circ(36, 80, 11) + circ(138, 80, 11) + circ(166, 80, 11) },
  { id: 'bus', name: 'Bus', group: 'Fahrzeuge', len: 12, ground: true, path: rect(12, 18, 176, 62, 12) + circ(46, 80, 11) + circ(154, 80, 11) },
  { id: 'zug', name: 'Zug', group: 'Fahrzeuge', len: 25, ground: true, info: 'die Nase eines Schnellzugs',
    path: 'M10 80L10 70C10 58 30 36 58 28C72 24 90 22 110 22L200 22L200 80Z' },
  { id: 'formel1', name: 'Rennwagen', group: 'Fahrzeuge', len: 5.5, ground: true,
    path: 'M8 72L8 62L30 62L34 56L80 56L92 42L116 42L124 56L150 56L158 50L176 50L176 64L190 64L190 72Z' + circ(50, 72, 14) + circ(156, 72, 14) + circ(100, 36, 8) },
  { id: 'wohnmobil', name: 'Wohnmobil', group: 'Fahrzeuge', len: 7, ground: true,
    path: 'M14 80L14 52C14 46 18 42 24 40L40 36L52 32L60 20L186 20C190 20 192 22 192 26L192 80Z' + circ(50, 80, 12) + circ(154, 80, 12) },
  { id: 'traktor', name: 'Traktor', group: 'Fahrzeuge', len: 4.5, ground: true,
    path: 'M30 70L30 50L46 50L46 42L80 42L80 20L110 20L110 70Z' + 'M28 42L34 24L40 24L40 42Z' + circ(52, 70, 14) + circ(132, 62, 26) },
  { id: 'motorrad', name: 'Motorrad', group: 'Fahrzeuge', len: 2.2, ground: true, info: 'mit geducktem Fahrer',
    path: circ(48, 76, 18) + circ(152, 76, 18) + 'M44 66L60 46L90 42L120 46L140 54L150 66L130 72L60 72Z' + 'M86 44C84 30 92 22 102 22C112 22 118 30 116 44L130 50L110 56L92 54Z' + circ(68, 20, 10) + 'M60 28L72 30L84 44L68 46Z' },
  { id: 'fahrrad', name: 'Radfahrer', group: 'Fahrzeuge', len: 1.8, ground: true,
    path: circ(44, 74, 20) + circ(44, 74, 10) + circ(156, 74, 20) + circ(156, 74, 10) + 'M44 74L80 36L120 36L156 74L100 74Z' + circ(100, 74, 6)
      + 'M84 42C80 30 86 24 96 26L112 48L104 52Z' + circ(88, 14, 10) + 'M80 24L98 22L112 36L100 44Z' },
  { id: 'skifahrer', name: 'Skifahrer', group: 'Fahrzeuge', len: 1.8, ground: true, info: 'in der Hocke',
    path: rect(20, 76, 170, 4) + 'M70 76L74 54L96 40L132 40L150 56L146 76Z' + circ(72, 36, 11) + 'M64 46L80 44L92 54L76 58Z' },
  // ---- Luft und Raum
  { id: 'flugzeug', name: 'Flugzeug', group: 'Luft und Raum', len: 38, info: 'Seitenansicht eines Verkehrsflugzeugs',
    path: 'M12 52C12 44 24 38 44 38L164 38L190 30L196 32L188 44L188 58L170 62L80 62C40 62 12 58 12 52Z' + 'M150 38L166 14L178 14L170 38Z' + 'M80 58L120 58L112 68L68 66Z' + ell(100, 70, 16, 7) },
  { id: 'zeppelin', name: 'Zeppelin', group: 'Luft und Raum', len: 75, path: 'M14 50C14 32 50 22 100 22C150 22 190 36 194 50C190 64 150 78 100 78C50 78 14 68 14 50Z' + 'M150 72L176 72L190 88L160 88Z' + rect(84, 76, 36, 10, 4) },
  { id: 'ballon', name: 'Heißluftballon', group: 'Luft und Raum', len: 20, path: 'M60 44C60 20 80 8 100 8C120 8 140 20 140 44C140 62 116 76 108 84L92 84C84 76 60 62 60 44Z' + rect(90, 90, 20, 10) + bar(94, 84, 92, 90, 2) + bar(106, 84, 108, 90, 2) },
  { id: 'rakete', name: 'Rakete', group: 'Luft und Raum', len: 50, path: 'M8 50L48 34L150 34L150 66L48 66Z' + 'M140 34L170 20L180 20L164 34L164 66L180 80L170 80L140 66Z' },
  { id: 'papierflieger', name: 'Papierflieger', group: 'Luft und Raum', len: 0.3, path: poly([[12, 54], [188, 26], [120, 58], [150, 72], [118, 62], [100, 76]]) },
  { id: 'shuttle', name: 'Raumfähre', group: 'Luft und Raum', len: 37, path: 'M16 48C16 40 30 34 50 34L150 34L160 42L176 42L176 60L50 64C30 64 16 58 16 48Z' + 'M120 34L150 10L162 10L160 34Z' + 'M70 60L160 56L170 70L60 68Z' },
  { id: 'ufo', name: 'Ufo', group: 'Luft und Raum', len: 12, path: ell(100, 56, 92, 16) + 'M62 52C62 36 78 28 100 28C122 28 138 36 138 52Z' },
  { id: 'drachen', name: 'Drachen', group: 'Luft und Raum', len: 1, info: 'Lenkdrachen, quer im Wind', path: poly([[60, 8], [120, 50], [60, 92], [40, 50]]) },
  { id: 'schirm', name: 'Regenschirm', group: 'Luft und Raum', len: 1.1, info: 'im Sturm, Rundung voraus', path: 'M22 50C22 24 44 10 74 10L76 90C44 90 22 76 22 50Z' + rect(76, 46, 110, 6) + 'M186 46a7 7 0 0 1 0 14L180 60L180 52L186 52Z' },
  // ---- Tiere
  { id: 'delfin', name: 'Delfin', group: 'Tiere', len: 2.5, path: 'M8 50C14 44 30 40 44 40C60 26 90 20 120 24C150 28 170 40 178 50L190 36L196 40L188 54L196 68L190 72L178 60C168 70 140 80 110 80C80 80 54 70 44 60C30 62 14 58 8 50Z' + 'M86 24L100 8L112 10L108 26Z' + 'M70 68L84 84L92 82L84 66Z' },
  { id: 'hai', name: 'Hai', group: 'Tiere', len: 4, path: 'M10 50C26 36 60 30 100 30C140 30 164 40 172 50C164 60 140 70 100 70C60 70 26 64 10 50Z' + 'M80 30L96 6L112 10L108 30Z' + 'M166 46L192 20L196 26L186 50L196 76L190 80L166 56Z' + 'M66 66L74 86L86 84L80 68Z' },
  { id: 'fisch', name: 'Fisch', group: 'Tiere', len: 0.4, path: 'M10 50C30 28 70 22 104 24C130 26 148 36 156 50C148 64 130 74 104 76C70 78 30 72 10 50Z' + 'M150 50L190 26L182 50L190 74Z' + 'M72 26L84 10L100 12L96 28Z' },
  { id: 'pinguin', name: 'Pinguin', group: 'Tiere', len: 1.1, ground: true, info: 'steht im Wind', path: 'M80 80C70 70 68 50 72 36C76 18 90 8 108 8C126 8 136 20 134 34L140 36L146 42L136 44C136 56 140 72 134 80Z' + 'M72 30L56 32L72 36Z' + rect(78, 80, 24, 10, 3) + rect(110, 80, 24, 10, 3) },
  { id: 'moewe', name: 'Möwe', group: 'Tiere', len: 1.2, info: 'im Gleitflug', path: 'M8 48L30 40L92 44L170 50L196 46L172 56L96 56L30 54Z' + 'M60 46L52 22L60 10L80 12L96 44Z' + 'M100 56L96 72L108 86L124 84L128 56Z' },
  { id: 'katze', name: 'Katze', group: 'Tiere', len: 0.5, ground: true, info: 'sitzt und schaut in den Wind', path: 'M44 80L48 56C50 40 60 30 76 28L72 16L86 22L98 22L112 14L110 30C122 36 128 48 130 60C132 70 136 80 148 80L172 80C180 80 186 72 182 64L176 64C178 70 174 74 168 74L160 74C154 60 150 46 148 40L150 80Z' },
  { id: 'dackel', name: 'Dackel', group: 'Tiere', len: 0.9, ground: true, path: 'M10 46C18 36 32 36 44 42L58 50L150 50C170 50 182 46 190 36L196 40C190 54 174 62 150 62L60 62L60 80L50 80L50 64L44 64L44 80L34 80L34 60C24 58 14 54 10 46Z' + 'M136 62L136 80L146 80L146 62Z' + 'M160 62L160 80L170 80L170 62Z' + 'M12 48L6 62L14 62Z' },
  { id: 'elefant', name: 'Elefant', group: 'Tiere', len: 6, ground: true, path: 'M18 46C18 34 34 26 50 28C60 10 90 6 120 10C150 14 176 30 180 50C182 62 176 70 170 72L170 80L154 80L154 70L128 70L128 80L112 80L112 70L80 70L80 80L64 80L64 68C52 68 44 60 40 54L40 80L30 80L30 66C22 62 18 54 18 46Z' + 'M12 40C4 42 2 54 10 56L16 50Z' },
  { id: 'schildkroete', name: 'Schildkröte', group: 'Tiere', len: 0.6, ground: true, path: 'M40 70C40 44 70 26 110 26C150 26 180 44 180 70Z' + 'M14 62C14 54 26 50 40 56L44 70L26 72C18 72 14 68 14 62Z' + rect(60, 70, 22, 10, 4) + rect(140, 70, 22, 10, 4) + 'M176 66L196 60L190 72Z' },
  { id: 'ente', name: 'Ente', group: 'Tiere', len: 0.5, ground: true, info: 'schwimmt gegen den Wind', path: 'M40 80C36 68 46 56 72 54L140 54C166 54 184 60 190 70L196 80Z' + 'M60 54C58 36 66 26 80 26C92 26 100 34 98 50L94 56L70 58Z' + 'M66 36L40 42L66 46Z' },
  // ---- Gebäude und Dinge
  { id: 'haus', name: 'Haus', group: 'Gebäude und Dinge', len: 10, ground: true, path: 'M40 80L40 50L100 16L160 50L160 80Z' + rect(126, 22, 12, 24) },
  { id: 'kirche', name: 'Kirche', group: 'Gebäude und Dinge', len: 30, ground: true, path: 'M24 80L24 40L48 6L72 40L72 80Z' + 'M72 80L72 46L130 26L188 46L188 80Z' },
  { id: 'baum', name: 'Baum', group: 'Gebäude und Dinge', len: 12, ground: true, path: circ(100, 36, 30) + circ(76, 50, 20) + circ(126, 48, 22) + rect(92, 60, 16, 20) },
  { id: 'turm', name: 'Turm', group: 'Gebäude und Dinge', len: 60, ground: true, info: 'Schornstein oder Hochhaus', path: rect(86, 4, 28, 76) },
  { id: 'bruecke', name: 'Brücke', group: 'Gebäude und Dinge', len: 20, info: 'Brückenquerschnitt, Wind von der Seite', path: poly([[20, 40], [180, 40], [190, 60], [10, 60]]) + rect(16, 30, 4, 10) + rect(180, 30, 4, 10) },
  { id: 'flasche', name: 'Flasche', group: 'Gebäude und Dinge', len: 0.3, path: 'M10 42L44 42C56 42 64 32 80 30L160 30C176 30 190 38 190 50C190 62 176 70 160 70L80 70C64 68 56 58 44 58L10 58Z' },
  { id: 'ei', name: 'Ei', group: 'Gebäude und Dinge', len: 0.06, info: 'Spitze voraus', path: 'M20 50C20 30 44 16 80 16C130 16 180 30 180 50C180 70 130 84 80 84C44 84 20 70 20 50Z' },
  { id: 'banane', name: 'Banane', group: 'Gebäude und Dinge', len: 0.2, path: 'M14 60C40 22 120 10 186 30L190 40C130 30 60 44 26 74Z' },
  { id: 'tasse', name: 'Tasse', group: 'Gebäude und Dinge', len: 0.1, ground: true, path: 'M50 24L150 24L144 80L56 80Z' + 'M150 36C176 36 180 70 150 70L150 62C168 62 166 44 150 44Z' },
  { id: 'pilz', name: 'Pilz', group: 'Gebäude und Dinge', len: 0.2, ground: true, path: 'M36 46C36 22 66 8 100 8C134 8 164 22 164 46C164 52 158 54 150 54L50 54C42 54 36 52 36 46Z' + 'M84 54L116 54L112 80L88 80Z' },
  { id: 'korken', name: 'Korken', group: 'Gebäude und Dinge', len: 0.05, path: 'M30 30L120 30C150 24 180 24 180 50C180 76 150 76 120 70L30 70Z' },
  { id: 'kegel', name: 'Kegel', group: 'Gebäude und Dinge', len: 0.4, ground: true, info: 'Verkehrshütchen', path: poly([[86, 10], [114, 10], [136, 72], [64, 72]]) + rect(50, 72, 100, 8) },
];
