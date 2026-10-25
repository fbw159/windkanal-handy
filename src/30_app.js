// ---------- Bedienung ----------
const App = {
  shape: null, mode: 0, running: true, speed: 30, angle: 0, grid: 'normal',
  spf: 4, frameMs: 16, lastT: 0, force: { n: 0, fx: 0, fy: 0 }, draw: false, drawn: null, nuMin: 0,
};
const GRIDS = { grob: 300, normal: 400, fein: 600 };
const MODES = [['Rauch', 'Rauchfäden'], ['Tempo', 'Geschwindigkeit'], ['Druck', 'Druck'], ['Wirbel', 'Wirbel']];
let lbm;

// Gittergröße aus der Bildfläche: sichtbare Breite fest, Höhe nach dem Seitenverhältnis; davor ein verdeckter Vorlauf,
// damit der Einlass weit genug vor dem Modell liegt
function gridSize() {
  const r = $('#stage').getBoundingClientRect();
  const nxv = GRIDS[App.grid] || 400, x0 = Math.round(nxv * 0.22);
  const ny = clamp(Math.round(nxv * r.height / Math.max(r.width, 1) / 2) * 2, 120, Math.round(nxv * 1.0));
  return [nxv + x0, ny, x0];
}

// Form in die Maske zeichnen: Pfad (200 × 100) in den Kanal legen, gedreht um die Mitte; Bodenformen stehen auf dem Boden
function rasterShape(s, nx, ny, angleDeg) {
  // doppelt so fein gezeichnet und je Zelle die Deckung gezählt: so werden runde Formen oben und unten gleich
  const S = 2, cv = document.createElement('canvas'); cv.width = nx * S; cv.height = ny * S;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000'; g.fillRect(0, 0, nx * S, ny * S);
  const x0 = lbm.x0 || 0, nxv = nx - x0;
  // Kastenbreite 200 -> Anteil der sichtbaren Breite; im Querformat (niedriger Kanal) etwas kleiner, damit die
  // Versperrung ähnlich bleibt und die Beiwerte nicht von der Lage des Handys abhängen
  const k = (s.ground ? 0.42 : 0.38) * Math.min(nxv, 1.25 * ny) / 200;
  const cx = x0 + 0.4 * nxv;
  g.save();
  g.scale(S, S);
  g.translate(cx, s.ground ? ny : ny / 2);
  if (!s.ground) g.rotate(angleDeg * DEG);
  g.scale(k, k);
  g.translate(-100, s.ground ? -s.bottom : -50);
  g.fillStyle = '#fff';
  g.fill(new Path2D(s.path), 'nonzero');
  g.restore();
  const img = g.getImageData(0, 0, nx * S, ny * S).data, m = new Uint8Array(nx * ny);
  // Bildzeile 0 ist oben, Gitterzeile 0 unten
  let xa = nx, xb = -1, rows = 0;
  for (let y = 0; y < ny; y++) {
    let any = false;
    for (let x = 0; x < nx; x++) {
      let c = 0;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) if (img[((y * S + j) * nx * S + x * S + i) * 4] > 127) c++;
      if (c * 2 >= S * S) { m[(ny - 1 - y) * nx + x] = 1; any = true; if (x < xa) xa = x; if (x > xb) xb = x; }
    }
    if (any) rows++;
  }
  return { m, height: rows, length: Math.max(1, xb - xa + 1) };
}

// Unterkante jedes Pfads (für Bodenformen) einmal bestimmen
function measureShapes() {
  const cv = document.createElement('canvas'); cv.width = 200; cv.height = 110;
  const g = cv.getContext('2d', { willReadFrequently: true });
  for (const s of SHAPES) {
    g.clearRect(0, 0, 200, 110); g.fillStyle = '#fff'; g.fill(new Path2D(s.path), 'nonzero');
    const d = g.getImageData(0, 0, 200, 110).data; let bottom = 100;
    for (let y = 109; y >= 0; y--) { let any = false; for (let x = 0; x < 200; x++) if (d[(y * 200 + x) * 4 + 3] > 127) { any = true; break; } if (any) { bottom = y + 1; break; } }
    s.bottom = bottom;
  }
}

function physParams() {
  const s = App.shape, D = Math.max(App.lengthCells || 100, App.heightCells || 1);   // D: größte Abmessung in Zellen
  const lenM = App.draw || !s ? 1 : s.len;                                              // ... und in Metern (len der Form)
  const re = App.speed * lenM / NU_AIR;
  let nu = U_LB * D / re;
  // Das Gitter löst nur eine begrenzte Reynoldszahl auf (etwa 30 je Zelle der größten Abmessung, höchstens 6000);
  // darüber hinaus bleibt die Zähigkeit größer als in Wirklichkeit. Nach einer Instabilität kommt mehr Dämpfung dazu.
  const reMax = Math.min(30 * D, 6000);
  const nuMin = Math.max(U_LB * D / reMax, App.nuMin);
  // (Ein langsames Hochfahren des Winds wurde geprüft und verworfen: Der ganze Kanal müsste dann beschleunigt werden,
  // der Einlassdruck stieg dabei auf das 15-fache des Staudrucks und schwang lange nach.)
  // re: Reynoldszahl mit der größten Abmessung; reGrid: was das Gitter davon wirklich rechnet (gleiche Bezugslänge)
  return { nu: Math.max(nu, nuMin), uin: U_LB, uref: U_LB, pref: App.pRef || 0, csm: 0.12, ground: !!(s && s.ground) && !App.draw, re, reGrid: U_LB * D / Math.max(nu, nuMin) };
}

function setShape(s) {
  App.shape = s; App.draw = false;
  $('#drawbar').hidden = true; $('#hud').hidden = false;
  const [nx, ny] = [lbm.nx, lbm.ny];
  const r = rasterShape(s, nx, ny, App.angle);
  App.heightCells = r.height; App.lengthCells = r.length;
  lbm.setMask(r.m);
  $('#angleRow').style.visibility = s.ground ? 'hidden' : '';
  $('#hudName').textContent = s.name + (s.info ? ' · ' + s.info : '');
  for (const el of document.querySelectorAll('#gallery button')) el.setAttribute('aria-pressed', el.dataset.id === s.id ? 'true' : 'false');
  resetForces();
  updateHud();
}

function resetForces() { App.force = { n: 0, fx: 0, fy: 0 }; App.sinceReset = 0; }

function restart() {
  lbm.init(U_LB); App.nuMin = 0; resetForces();
}

// Gitter neu anlegen (Start, Gitterwahl, Drehen des Handys); eine gemalte Form wird auf das neue Gitter übertragen
function rebuildGrid() {
  const [nx, ny, x0] = gridSize();
  const old = App.drawn && !App.draw ? { m: App.drawn, nx: lbm.nx, ny: lbm.ny, x0: lbm.x0 } : null;
  lbm.build(nx, ny, x0);
  App.draw = false; App.drawn = null; $('#drawbar').hidden = true; $('#hud').hidden = false;
  if (old) {
    const m = new Uint8Array(nx * ny);
    for (let y = 0; y < ny; y++) for (let x = x0; x < nx; x++) {
      const ox = old.x0 + Math.floor((x - x0) / (nx - x0) * (old.nx - old.x0)), oy = Math.floor(y / ny * old.ny);
      if (old.m[oy * old.nx + ox]) m[y * nx + x] = 1;
    }
    App.drawn = m; finishDraw();
  } else {
    setShape(App.shape || SHAPES.find(x => x.id === 'kaefer') || SHAPES[0]);
    restart();
  }
}

// Beiwerte: Kraft je Schritt (Gitter) auf Staudruck · Stirnhöhe; beim Flügel auf die Flügeltiefe (wie in der Luftfahrt üblich)
function refLength() { return App.shape && App.shape.ref === 'len' ? Math.max(App.lengthCells || 1, 1) : Math.max(App.heightCells || 1, 1); }
function updateHud() {
  const f = App.force, q = 0.5 * U_LB * U_LB * refLength();   // Staudruck des vollen Winds mal Bezugslänge
  const el = $('#hudCw'), ela = $('#hudCa');
  if (f.n > 5) {
    const cw = f.fx / f.n / q, ca = f.fy / f.n / q;   // Kraft auf den Körper: x nach hinten, y nach oben
    el.textContent = fmt(cw, 2); ela.textContent = fmt(ca, 2);
    const g = $('#gauge i'); g.style.width = clamp(cw / 2.2 * 100, 0, 100) + '%';
  } else { el.textContent = '–'; ela.textContent = '–'; }
  const p = physParams();
  const reTxt = (v) => v >= 1e6 ? fmt(v / 1e6, 1) + ' Mio.' : v >= 1000 ? fmt(v / 1000) + ' Tsd.' : fmt(v);
  $('#hudRe').textContent = 'Re ' + reTxt(p.re) + (p.reGrid < p.re * 0.9 ? ' (Gitter: ' + reTxt(p.reGrid) + ')' : '');
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = now - (App.lastT || now); App.lastT = now;
  if (dt > 0) App.frameMs = lerp(App.frameMs, Math.min(dt, 200), 0.2);
  const gl = lbm.gl, cv = lbm.canvas;
  const dpr = Math.min(2, devicePixelRatio || 1), W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const prm = physParams();
  if (App.running && !App.draw && !App.lost) {
    // Schritte je Bild: so viele, dass das Bild flüssig bleibt (Ziel ~14 ms)
    if (App.frameMs > 24) App.spf = Math.max(1, App.spf - 1); else if (App.frameMs < 15) App.spf = Math.min(40, App.spf + 1);
    lbm.step(App.spf, prm);
    App.sinceReset = (App.sinceReset || 0) + App.spf;
    // Zu langsam für das normale Gitter? Nach drei Sekunden auf grob wechseln (einmalig, nur wenn nichts gewählt wurde)
    App.stepsRun = (App.stepsRun || 0) + App.spf; App.msRun = (App.msRun || 0) + Math.min(dt, 200);
    if (!App.gridChosen && App.grid === 'normal' && App.msRun > 3000) {
      const rate = App.stepsRun / App.msRun * 1000;
      App.gridChosen = true;
      if (rate < 180) { App.grid = 'grob'; for (const x of document.querySelectorAll('#gridSeg button')) x.setAttribute('aria-pressed', x.dataset.v === 'grob' ? 'true' : 'false'); rebuildGrid(); toast('Das Gitter wurde auf „grob“ gestellt, damit es auf diesem Gerät flüssig läuft.'); }
    }
    lbm.dye(App.spf, Math.max(6, Math.round(lbm.ny / 22)), 0);   // ganzzahliger Abstand: alle Fäden gleich dick
    // Kräfte ab einem halben Durchlauf mitteln; Geschwindigkeit überwachen
    if ((App.frameCount = (App.frameCount || 0) + 1) % 3 === 0) {
      const [fx, fy, umax] = lbm.readForce();
      if (App.frameCount % 12 === 0) App.pRef = lerp(App.pRef || 0, lbm.readColumnRho(2), 0.5);
      if (!(umax < 0.38)) {
        // instabil: mehr Dämpfung, neu starten
        App.nuMin = 1.5 * prm.nu;
        lbm.init(U_LB); resetForces();
        toast('Die Rechnung wurde unruhig und startet mit etwas mehr Dämpfung neu.');
      } else if (App.sinceReset > 0.5 * lbm.nx / U_LB) {
        const f = App.force; f.n++; f.fx += fx; f.fy += fy;
        // gleitendes Mittel: alte Werte langsam vergessen
        if (f.n > 60) { const k = 1 - 1 / 60; f.fx *= k; f.fy *= k; f.n = 60; }
      }
      updateHud();
    }
  }
  if (!App.lost) lbm.draw(App.mode, prm, W, H);
}

// ---------- Selber malen ----------
function startDraw() {
  App.draw = true; App.shape = null;
  App.drawn = new Uint8Array(lbm.nx * lbm.ny);
  lbm.setMask(App.drawn); App.heightCells = 1; App.lengthCells = 100;
  $('#drawbar').hidden = false; $('#hud').hidden = true; $('#angleRow').style.visibility = 'hidden';
  $('#hudName').textContent = 'Selber gemalt · mit dem Finger ins Bild zeichnen';
  for (const el of document.querySelectorAll('#gallery button')) el.setAttribute('aria-pressed', el.dataset.id === 'malen' ? 'true' : 'false');
  resetForces(); updateHud();
}
function paintAt(clientX, clientY, last) {
  const cv = lbm.canvas, r = cv.getBoundingClientRect();
  const x0 = lbm.x0 || 0, gx = x0 + (clientX - r.left) / r.width * (lbm.nx - x0), gy = (1 - (clientY - r.top) / r.height) * lbm.ny;
  const rad = Math.max(2.5, lbm.ny / 40), m = App.drawn, nx = lbm.nx, ny = lbm.ny;
  const stamp = (x, y) => { for (let j = Math.floor(y - rad); j <= Math.ceil(y + rad); j++) for (let i = Math.floor(x - rad); i <= Math.ceil(x + rad); i++) { if (i < 0 || j < 0 || i >= nx || j >= ny) continue; if ((i + 0.5 - x) ** 2 + (j + 0.5 - y) ** 2 <= rad * rad) m[j * nx + i] = 1; } };
  if (last) { const n = Math.ceil(Math.hypot(gx - last[0], gy - last[1]) / (rad * 0.5)) + 1; for (let k = 0; k <= n; k++) stamp(lerp(last[0], gx, k / n), lerp(last[1], gy, k / n)); } else stamp(gx, gy);
  return [gx, gy];
}
function finishDraw() {
  // Stirnhöhe und Länge aus der Maske
  const m = App.drawn, nx = lbm.nx, ny = lbm.ny; let rows = 0, x0 = nx, x1 = -1;
  for (let y = 0; y < ny; y++) { let any = false; for (let x = 0; x < nx; x++) if (m[y * nx + x]) { any = true; if (x < x0) x0 = x; if (x > x1) x1 = x; } if (any) rows++; }
  App.heightCells = Math.max(rows, 1); App.lengthCells = Math.max(x1 - x0 + 1, 10);
  lbm.setMask(m); App.draw = false; $('#drawbar').hidden = true; $('#hud').hidden = false;
  $('#hudName').textContent = 'Selber gemalt';
  resetForces(); restart();
}

let toastTimer = 0;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 4000); }

function buildGallery() {
  const g = $('#gallery');
  let group = '';
  for (const s of SHAPES) {
    if (s.group !== group) { group = s.group; const h = document.createElement('span'); h.className = 'grp'; h.textContent = group; g.appendChild(h); }
    const b = document.createElement('button'); b.type = 'button'; b.dataset.id = s.id; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<svg viewBox="-4 -4 208 108" aria-hidden="true"><path d="${s.path}"/></svg><span>${s.name}</span>`;
    b.addEventListener('click', () => { setShape(s); restart(); });
    g.appendChild(b);
  }
  const b = document.createElement('button'); b.type = 'button'; b.dataset.id = 'malen'; b.className = 'malen'; b.setAttribute('aria-pressed', 'false');
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21l3.8-1 11-11-2.8-2.8-11 11L3 21zm13.7-16.5 2.8 2.8 1.6-1.6a1 1 0 0 0 0-1.4l-1.4-1.4a1 1 0 0 0-1.4 0l-1.6 1.6z"/></svg><span>Selber malen</span>`;
  b.addEventListener('click', startDraw);
  g.appendChild(b);
}

function setupUI() {
  buildGallery();
  const sp = $('#speed'), spv = $('#speedV');
  sp.addEventListener('input', () => { App.speed = +sp.value; spv.textContent = fmt(App.speed) + ' m/s'; updateHud(); });
  const an = $('#angle'), anv = $('#angleV');
  an.addEventListener('input', () => {
    App.angle = +an.value; anv.textContent = fmt(App.angle) + '°';
    if (App.shape) {
      const r = rasterShape(App.shape, lbm.nx, lbm.ny, App.angle); App.heightCells = r.height; App.lengthCells = r.length; lbm.setMask(r.m); resetForces();
      lbm.sinceInit = Math.min(lbm.sinceInit, Math.round(RAMP_STEPS * 0.5));   // Körper kurz wieder etwas durchlässig: kein Druckstoß
    }
  });
  const mb = $('#modeBtn');
  const showMode = () => { mb.textContent = MODES[App.mode][0]; $('#legend').textContent = MODES[App.mode][1]; };
  mb.addEventListener('click', () => { App.mode = (App.mode + 1) % MODES.length; showMode(); }); showMode();
  $('#playBtn').addEventListener('click', () => { App.running = !App.running; $('#playBtn').textContent = App.running ? '❚❚' : '▶'; $('#playBtn').setAttribute('aria-label', App.running ? 'Pause' : 'Weiter'); });
  $('#resetBtn').addEventListener('click', () => { restart(); });
  $('#helpBtn').addEventListener('click', () => { const d = $('#help'); d.showModal(); d.scrollTop = 0; });
  $('#help').addEventListener('click', (e) => { if (e.target === $('#help')) $('#help').close(); });
  // 3D als Extra: Kann das Gerät WebGPU, öffnet der Knopf die große Fassung mit einem passenden 3D-Modell
  if (navigator.gpu) {
    const to3d = { kaefer: 'pkw', sportwagen: 'pkw', wohnmobil: 'pkw', lkw: 'lkw', bus: 'lkw', zug: 'lkw', fluegel: 'fluegel', flugzeug: 'fluegel', papierflieger: 'fluegel', drachen: 'fluegel', moewe: 'fluegel', haus: 'haus', kirche: 'haus', turm: 'schornstein', rakete: 'schornstein', flasche: 'schornstein', zeppelin: 'schornstein' };
    const b = $('#btn3d'); b.hidden = false;
    b.addEventListener('click', () => { const id = App.shape && to3d[App.shape.id] || 'kugel'; window.open('https://fbw159.github.io/windkanal/?modell=' + id, '_blank', 'noopener'); });
  }
  $('#helpClose').addEventListener('click', () => $('#help').close());
  $('#drawClear').addEventListener('click', () => { App.drawn.fill(0); lbm.setMask(App.drawn); });
  $('#drawDone').addEventListener('click', finishDraw);
  for (const b of document.querySelectorAll('#gridSeg button')) b.addEventListener('click', () => { App.grid = b.dataset.v; App.gridChosen = true; for (const x of document.querySelectorAll('#gridSeg button')) x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); rebuildGrid(); });
  // Malen mit Finger oder Maus
  const cv = $('#gl'); let last = null, drawing = false;
  cv.addEventListener('pointerdown', (e) => { if (!App.draw) return; drawing = true; cv.setPointerCapture(e.pointerId); last = paintAt(e.clientX, e.clientY, null); lbm.setMask(App.drawn); e.preventDefault(); });
  cv.addEventListener('pointermove', (e) => { if (!App.draw || !drawing) return; last = paintAt(e.clientX, e.clientY, last); lbm.setMask(App.drawn); e.preventDefault(); });
  const up = () => { drawing = false; last = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('touchmove', (e) => { if (App.draw) e.preventDefault(); }, { passive: false });
  // bei Drehung oder Größenänderung Gitter neu
  let rs = 0;
  const onResize = () => { clearTimeout(rs); rs = setTimeout(() => { const [nx, ny] = gridSize(); if (nx !== lbm.nx || Math.abs(ny - lbm.ny) > 4) rebuildGrid(); }, 300); };
  window.addEventListener('resize', onResize);
  if (window.ResizeObserver) new ResizeObserver(onResize).observe($('#stage'));
  // Verlust des WebGL-Kontexts (Safari gibt ihn im Hintergrund frei): alles neu anlegen
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); App.lost = true; toast('Die Grafikkarte wurde freigegeben, einen Moment …'); });
  cv.addEventListener('webglcontextrestored', () => { try { lbm = new Lbm(cv); App.lost = false; rebuildGrid(); } catch (err) { $('#fatal').hidden = false; $('#fatalText').textContent = err.message; } });
}

// Prüfschnittstelle (für automatische Tests)
window.WH = { App, get lbm() { return lbm; }, physParams, setShape: (id) => { const s = SHAPES.find(x => x.id === id); if (s) { setShape(s); restart(); } }, step: (n) => lbm.step(n, physParams()), force: () => lbm.readForce(), SHAPES };

function main() {
  try {
    lbm = new Lbm($('#gl'));
  } catch (e) {
    $('#fatal').hidden = false; $('#fatalText').textContent = e.message; return;
  }
  measureShapes();
  setupUI();
  if (GRIDS[QS.get('gitter')]) {
    App.grid = QS.get('gitter'); App.gridChosen = true;
    for (const x of document.querySelectorAll('#gridSeg button')) x.setAttribute('aria-pressed', x.dataset.v === App.grid ? 'true' : 'false');
  }
  App.shape = SHAPES.find(x => x.id === QS.get('form')) || SHAPES.find(x => x.id === 'kaefer');
  rebuildGrid();
  requestAnimationFrame(frame);
}
main();
