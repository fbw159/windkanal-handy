/* Taschen-Windkanal – Strömung um Silhouetten im Browser, gerechnet auf der Grafikkarte des Handys.
   Lattice-Boltzmann D2Q9 in WebGL2 (läuft auf praktisch jedem Handy), Wirbelviskosität nach Smagorinsky,
   Stoß regularisiert, Wand als Rückprall, Rauchfäden als mitgeführter Farbstoff.
   Aufbau: Hilfsfunktionen, Formen, Rechenkern (WebGL), Bedienung. Eine einzige Datei, kein Server. */
'use strict';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const DEG = Math.PI / 180;
const NU_AIR = 1.5e-5;        // Zähigkeit der Luft in m²/s
const RHO_AIR = 1.204;        // Dichte der Luft in kg/m³
const U_LB = 0.1;             // Gitterwind (Zellen je Schritt)
const RAMP_STEPS = 400;       // sanfter Start: so viele Schritte, bis der Körper ganz dicht ist
const QS = new URLSearchParams(location.search);

// Zahl mit Komma, feste Nachkommastellen
function fmt(v, d = 0) {
  if (!Number.isFinite(v)) return '–';
  return v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// Farbtabellen (hex, 3 Byte je Stufe): turbo (Geschwindigkeit), coolwarm (Druck)
const LUT_VEL = '__LUT_VEL__';
const LUT_PRES = '__LUT_PRES__';
function lutBytes(hex) {
  const n = hex.length / 6, out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { out[i * 4] = parseInt(hex.substr(i * 6, 2), 16); out[i * 4 + 1] = parseInt(hex.substr(i * 6 + 2, 2), 16); out[i * 4 + 2] = parseInt(hex.substr(i * 6 + 4, 2), 16); out[i * 4 + 3] = 255; }
  return out;
}
