// ---------- Rechenkern: Lattice-Boltzmann D2Q9 in WebGL2 ----------
// Zustand in drei Texturen je Satz (Ping-Pong): T0 = (f0 f1 f2 f3), T1 = (f4 f5 f6 f7), T2 = (f8, rho-1, ux, uy).
// Gespeichert werden die Verteilungen nach dem Stoß; das Strömen passiert beim Lesen der Nachbarn (Ziehen).
// Dazu eine Maske (fest/frei), ein Farbstofffeld (Rauch) und ein Kraftfeld (Impulsaustausch an der Wand),
// das über eine Kette von Halbierungen aufsummiert und einmal je Bild ausgelesen wird.

const VS = `#version 300 es
precision highp float;
const vec2 Q[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(Q[gl_VertexID], 0.0, 1.0); }`;

// Gitterrichtungen D2Q9: 0 Ruhe, 1 +x, 2 +y, 3 -x, 4 -y, 5 (+,+), 6 (-,+), 7 (-,-), 8 (+,-)
const D2Q9_HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
const ivec2 C[9] = ivec2[9](ivec2(0,0), ivec2(1,0), ivec2(0,1), ivec2(-1,0), ivec2(0,-1), ivec2(1,1), ivec2(-1,1), ivec2(-1,-1), ivec2(1,-1));
const float W[9] = float[9](4.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/36.0, 1.0/36.0, 1.0/36.0, 1.0/36.0);
const int OPP[9] = int[9](0, 3, 4, 1, 2, 7, 8, 5, 6);
const int MIRY[9] = int[9](0, 1, 4, 3, 2, 8, 7, 6, 5);
float feq(int i, float rho, vec2 u) {
  float cu = float(C[i].x) * u.x + float(C[i].y) * u.y;
  return W[i] * rho * (1.0 + 3.0 * cu + 4.5 * cu * cu - 1.5 * dot(u, u));
}
`;

const FS_STEP = D2Q9_HEAD + `
uniform sampler2D t0; uniform sampler2D t1; uniform sampler2D t2; uniform sampler2D mask;
uniform ivec2 N;
uniform float tau0;     // Relaxationszeit aus der Zähigkeit
uniform float uin;      // Einlassgeschwindigkeit (Gitter)
uniform float csm;      // Smagorinsky-Konstante
uniform int ground;     // 1: Boden unten haftet (Fahrzeuge, Gebäude), 0: glatte Wand
uniform float spongeIn; // Länge der Dämpfungszone am Einlass (Zellen)
uniform float spongeOut;// ... am Auslass
uniform float spongeWall;// ... an Decke und Boden
uniform float sigmaG;   // schwache Dichtedämpfung im ganzen Kanal (je Schritt)
uniform float beta;     // Dichtheit des Körpers beim Start (0 durchlässig … 1 fest)
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
layout(location = 3) out vec4 o3;
float fetchF(int i, ivec2 p) {
  if (i < 4) return texelFetch(t0, p, 0)[i];
  if (i < 8) return texelFetch(t1, p, 0)[i - 4];
  return texelFetch(t2, p, 0).x;
}
bool isSolid(ivec2 p) { return texelFetch(mask, p, 0).r > 0.5; }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  bool solidP = isSolid(p);
  if (solidP && beta >= 1.0) {
    // feste Zelle: Ruhe (so startet sie sauber, falls sie wieder frei wird)
    o0 = vec4(W[0], W[1], W[2], W[3]); o1 = vec4(W[4], W[5], W[6], W[7]); o2 = vec4(W[8], 0.0, 0.0, 0.0); o3 = vec4(0.0);
    return;
  }
  // Sanfter Start (beta < 1): Der Körper ist zunächst durchlässig und wird über einige hundert Schritte dicht
  // (teilweiser Rückprall in den Körperzellen). Ein schlagartig auftauchender Körper würde einen Druckstoß
  // vom Zehnfachen des Staudrucks auslösen, der lange durch den Kanal liefe.
  float f[9];
  vec2 F = vec2(0.0);
  int wallBits = 0;
  if (p.x == 0) {
    // Einlass: Wind vorgegeben, Dichte von der Nachbarzelle (Gleichgewicht)
    float rin = 1.0 + texelFetch(t2, ivec2(1, p.y), 0).y;
    for (int i = 0; i < 9; i++) f[i] = feq(i, rin, vec2(uin, 0.0));
  } else if (p.x == N.x - 1) {
    // Auslass: Druck vorgegeben (Dichte 1), Geschwindigkeit von der Nachbarzelle; das verankert den Druck im Kanal
    vec2 uo = texelFetch(t2, ivec2(N.x - 2, p.y), 0).zw;
    for (int i = 0; i < 9; i++) f[i] = feq(i, 1.0, uo);
  } else {
    for (int i = 0; i < 9; i++) {
      ivec2 n = p - C[i];
      int j = i;
      if (n.y < 0) {
        if (ground == 1) { f[i] = fetchF(OPP[i], p); wallBits |= (1 << i); continue; }   // Boden haftet: Rückprall
        n.y = 0; j = MIRY[i];                                                   // glatte Wand: Spiegelung
      }
      if (n.y >= N.y) { n.y = N.y - 1; j = MIRY[i]; }                           // Decke: Spiegelung
      if (beta >= 1.0 && isSolid(n)) {
        f[i] = fetchF(OPP[i], p);                                               // Wand: Rückprall an der halben Zelle
        F += 2.0 * (f[i] - W[i]) * vec2(C[OPP[i]]);                             // Impuls an die Wand (ohne den Ruhedruck,
                                                                                // der sich nur bei geschlossenen Körpern aufhebt; Räder auf dem Boden sind offen)
        wallBits |= (1 << i);
        continue;
      }
      f[i] = fetchF(j, n);
    }
    // Eingeklemmte Richtungspaare (Spalt von einer Zelle, etwa Reifen am Boden): beide Verteilungen mitteln, sonst
    // schwingt der Impuls dort jeden Schritt hin und her
    for (int i = 1; i < 3; i++) {
      int o = OPP[i];
      if ((wallBits & (1 << i)) != 0 && (wallBits & (1 << o)) != 0) { float m = 0.5 * (f[i] + f[o]); F -= vec2(C[i]) * (m - f[i]); F += vec2(C[i]) * (m - f[o]); f[i] = m; f[o] = m; }
    }
    if ((wallBits & 32) != 0 && (wallBits & 128) != 0) { float m = 0.5 * (f[5] + f[7]); F -= vec2(C[5]) * (m - f[5]); F += vec2(C[5]) * (m - f[7]); f[5] = m; f[7] = m; }
    if ((wallBits & 64) != 0 && (wallBits & 256) != 0) { float m = 0.5 * (f[6] + f[8]); F -= vec2(C[6]) * (m - f[6]); F += vec2(C[6]) * (m - f[8]); f[6] = m; f[8] = m; }
  }
  float rho = 0.0; vec2 m = vec2(0.0);
  for (int i = 0; i < 9; i++) { rho += f[i]; m += f[i] * vec2(C[i]); }
  rho = max(rho, 0.2);
  vec2 u = m / rho;
  float um = length(u);
  if (um > 0.4) u *= 0.4 / um;
  // Nichtgleichgewicht und Spannungstensor
  float e[9]; float pxx = 0.0, pyy = 0.0, pxy = 0.0;
  for (int i = 0; i < 9; i++) {
    e[i] = feq(i, rho, u);
    float d = f[i] - e[i];
    pxx += d * float(C[i].x * C[i].x); pyy += d * float(C[i].y * C[i].y); pxy += d * float(C[i].x * C[i].y);
  }
  // Smagorinsky: Wirbelviskosität aus dem Nichtgleichgewicht
  float pn = sqrt(pxx * pxx + pyy * pyy + 2.0 * pxy * pxy);
  float tau = 0.5 * (tau0 + sqrt(tau0 * tau0 + 18.0 * 1.4142136 * csm * csm * pn / rho));
  // Dämpfungszonen an beiden Enden: Dort werden Dichte (und am Einlass auch die Geschwindigkeit) sanft auf den
  // Sollzustand gezogen, damit Druckwellen vom Start und von Wirbeln nicht hin und her laufen; vor dem Auslass wird
  // außerdem das Nichtgleichgewicht stärker geglättet (Wirbel klingen ab, statt an der Wand zu reflektieren).
  // Die Einlasszone liegt im verdeckten Vorlauf, die Auslasszone ist schmal.
  float sIn = max(0.0, 1.0 - float(p.x) / spongeIn);
  float sOut = max(0.0, 1.0 - float(N.x - 1 - p.x) / spongeOut);
  // Decke und (bei freien Formen) Boden dämpfen nur den Druck: Querwellen laufen sonst endlos zwischen den Wänden
  float sWall = max(0.0, 1.0 - float(N.y - 1 - p.y) / spongeWall);
  if (ground == 0) sWall = max(sWall, max(0.0, 1.0 - float(p.y) / spongeWall));
  float om1 = (1.0 - 1.0 / tau) * (1.0 - 0.9 * sOut * sOut);
  // Lange Druckwellen (Kanallänge) kann keine Zone schlucken; sie werden überall ganz schwach gedämpft (Zeitmaß 500 Schritte),
  // das verfälscht die Strömung um weniger als ein Prozent
  float sigma = max(max(0.1 * sIn * sIn, 0.1 * sOut * sOut), 0.3 * sWall * sWall) + sigmaG;
  float rhoT = 1.0;
  vec2 uT = sIn > 0.0 ? mix(u, vec2(uin, 0.0), sIn * sIn) : u;
  float g[9];
  for (int i = 0; i < 9; i++) {
    // regularisiert: nur der Spannungsanteil des Nichtgleichgewichts bleibt
    float cx = float(C[i].x), cy = float(C[i].y);
    float q = (cx * cx - 1.0 / 3.0) * pxx + (cy * cy - 1.0 / 3.0) * pyy + 2.0 * cx * cy * pxy;
    g[i] = e[i] + om1 * W[i] * 4.5 * q;
    if (sigma > 0.0) g[i] -= sigma * (e[i] - feq(i, rhoT, uT));
  }
  if (solidP) {
    // durchlässiger Körper beim Start: Anteil beta wird zurückgeworfen; die Kraft ist der dabei abgegebene Impuls
    float h[9];
    for (int i = 0; i < 9; i++) h[i] = mix(g[i], g[OPP[i]], beta);
    for (int i = 0; i < 9; i++) g[i] = h[i];
    F = 2.0 * beta * m;
    u = vec2(0.0); um = 0.0;
  }
  o0 = vec4(g[0], g[1], g[2], g[3]);
  o1 = vec4(g[4], g[5], g[6], g[7]);
  o2 = vec4(g[8], rho - 1.0, u);
  o3 = vec4(F, um, 0.0);
}`;

// Anfangszustand: Gleichgewicht mit Wind überall (feste Zellen in Ruhe)
const FS_INIT = D2Q9_HEAD + `
uniform sampler2D mask; uniform float uin;
layout(location = 0) out vec4 o0; layout(location = 1) out vec4 o1; layout(location = 2) out vec4 o2; layout(location = 3) out vec4 o3;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec2 u = vec2(uin, 0.0);   // auch in den Körperzellen: beim sanften Start sind sie zunächst durchlässig
  o0 = vec4(feq(0, 1.0, u), feq(1, 1.0, u), feq(2, 1.0, u), feq(3, 1.0, u));
  o1 = vec4(feq(4, 1.0, u), feq(5, 1.0, u), feq(6, 1.0, u), feq(7, 1.0, u));
  o2 = vec4(feq(8, 1.0, u), 0.0, u);
  o3 = vec4(0.0);
}`;

// Rauch: Farbstoff mit der Strömung mitführen (rückwärts verfolgen), am Einlass in Fäden einspeisen
const FS_DYE = `#version 300 es
precision highp float; precision highp sampler2D;
uniform sampler2D dye; uniform sampler2D t2; uniform sampler2D mask;
uniform vec2 N; uniform float dt; uniform float decay; uniform float spacing; uniform float phase;
out vec4 o;
void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  if (texelFetch(mask, ip, 0).r > 0.5) { o = vec4(0.0); return; }
  vec2 u = texelFetch(t2, ip, 0).zw;
  vec2 src = (gl_FragCoord.xy - u * dt) / N;
  float d = texture(dye, src).r * decay;
  float yy = mod(gl_FragCoord.y + phase, spacing);
  if (gl_FragCoord.x < 3.0 && yy < 1.0) d = 1.0;
  o = vec4(d, 0.0, 0.0, 1.0);
}`;

// Summen: je 2×2 Zellen zusammenfassen (Kraft summieren, Geschwindigkeit: Größtwert)
const FS_REDUCE = `#version 300 es
precision highp float; precision highp sampler2D;
uniform sampler2D src;
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy) * 2, hi = textureSize(src, 0) - 1;   // am Rand (ungerade Größen) nicht über die Textur hinauslesen
  vec4 a = texelFetch(src, p, 0), b = texelFetch(src, min(p + ivec2(1, 0), hi), 0), c = texelFetch(src, min(p + ivec2(0, 1), hi), 0), d = texelFetch(src, min(p + ivec2(1, 1), hi), 0);
  o = vec4(a.xy + b.xy + c.xy + d.xy, max(max(a.z, b.z), max(c.z, d.z)), 0.0);
}`;

// Bild: Feld einfärben, Modell zeichnen, Rauch darüber
const FS_DRAW = `#version 300 es
precision highp float; precision highp sampler2D;
uniform sampler2D t2; uniform sampler2D mask; uniform sampler2D dye; uniform sampler2D lutV; uniform sampler2D lutP;
uniform vec2 N; uniform vec2 view;   // view: Bildgröße in Pixeln
uniform int mode;                    // 0 Rauch, 1 Geschwindigkeit, 2 Druck, 3 Wirbel
uniform float uin; uniform float pref; uniform float wscale;
uniform float x0;                    // verdeckter Vorlauf: das Bild beginnt bei dieser Zelle
out vec4 o;
vec4 fetch(ivec2 p) { p = clamp(p, ivec2(0), ivec2(N) - 1); return texelFetch(t2, p, 0); }
vec4 bil(vec2 q) {   // bilinear aus Zellmitten
  vec2 g = q - 0.5; ivec2 i = ivec2(floor(g)); vec2 f = g - vec2(i);
  return mix(mix(fetch(i), fetch(i + ivec2(1, 0)), f.x), mix(fetch(i + ivec2(0, 1)), fetch(i + ivec2(1, 1)), f.x), f.y);
}
float solidAt(vec2 q) { return texture(mask, q / N).r; }
void main() {
  vec2 q = vec2(x0, 0.0) + gl_FragCoord.xy / view * vec2(N.x - x0, N.y);   // Gitterkoordinate (Zellen)
  vec4 m = bil(q);
  vec2 u = m.zw;
  vec3 col;
  if (mode == 0) {
    float s = length(u) / (2.2 * uin);
    col = mix(vec3(0.055, 0.075, 0.105), vec3(0.11, 0.20, 0.32), clamp(s, 0.0, 1.0));
  } else if (mode == 1) {
    float s = clamp(length(u) / (2.2 * uin), 0.0, 1.0);
    col = texture(lutV, vec2(s, 0.5)).rgb;
  } else if (mode == 2) {
    float cp = (m.y - pref) / 3.0 / (0.5 * uin * uin);
    float s = 0.5 + 0.5 * sign(cp) * pow(min(abs(cp), 1.0), 0.7);
    col = texture(lutP, vec2(s, 0.5)).rgb;
  } else {
    // Wirbelstärke, über 3×3 Zellen geglättet (sonst flimmert das Gitterrauschen)
    float w = 0.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      ivec2 c = ivec2(q) + ivec2(i, j);
      w += (fetch(c + ivec2(1, 0)).w - fetch(c - ivec2(1, 0)).w) - (fetch(c + ivec2(0, 1)).z - fetch(c - ivec2(0, 1)).z);
    }
    float s = clamp(w / 9.0 * wscale / uin, -1.0, 1.0);
    vec3 neg = vec3(0.15, 0.45, 0.95), pos = vec3(0.98, 0.42, 0.2), mid = vec3(0.09, 0.11, 0.14);
    col = s < 0.0 ? mix(mid, neg, pow(-s, 0.6)) : mix(mid, pos, pow(s, 0.6));
  }
  if (mode == 0 || mode == 1) {
    float d = texture(dye, q / N).r;
    col = mix(col, vec3(0.95, 0.96, 0.98), clamp(d * 0.95, 0.0, 1.0));
  }
  // Modell: hellgrau mit weichem Rand
  float sd = 0.0;
  for (int k = 0; k < 4; k++) { vec2 e = vec2(k == 0 ? 0.5 : k == 1 ? -0.5 : 0.0, k == 2 ? 0.5 : k == 3 ? -0.5 : 0.0); sd += solidAt(q + e); }
  sd *= 0.25;
  col = mix(col, vec3(0.80, 0.84, 0.88), smoothstep(0.2, 0.8, sd));
  o = vec4(col, 1.0);
}`;

class Lbm {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('Kein WebGL2. Dieses Gerät oder dieser Browser kann die Rechnung nicht ausführen.');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('Die Grafikkarte kann keine Fließkomma-Texturen (EXT_color_buffer_float). Bitte einen anderen Browser versuchen.');
    this.gl = gl; this.canvas = canvas;
    this.P = {
      step: this.program(FS_STEP), init: this.program(FS_INIT), dye: this.program(FS_DYE), reduce: this.program(FS_REDUCE), draw: this.program(FS_DRAW),
    };
    this.vao = gl.createVertexArray();
    this.lutV = this.lutTexture(lutBytes(LUT_VEL)); this.lutP = this.lutTexture(lutBytes(LUT_PRES));
    this.steps = 0;
  }
  program(fs) {
    const gl = this.gl, sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Programm: ' + gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  lutTexture(bytes) {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, bytes.length / 4, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  tex(w, h, ifmt, fmt, type, filter) {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, ifmt, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  fbo(texs) {
    const gl = this.gl, f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    texs.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
    gl.drawBuffers(texs.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Framebuffer unvollständig (' + st + '). Die Grafikkarte kann die Texturen nicht als Zeichenziel nutzen.');
    return f;
  }
  // Gitter anlegen (nx × ny Zellen)
  build(nx, ny, x0 = 0) {
    const gl = this.gl;
    this.destroyGrid();
    this.nx = nx; this.ny = ny; this.x0 = x0;   // x0: verdeckter Vorlauf am Einlass (wird nicht gezeichnet)
    const S = () => this.tex(nx, ny, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
    this.sets = [0, 1].map(() => { const t = [S(), S(), S(), S()]; return { t, f: this.fbo(t) }; });
    this.parity = 0;
    this.mask = this.tex(nx, ny, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);   // nur der rote Kanal zählt (RGBA ist überall verlässlich)
    this.maskData = new Uint8Array(nx * ny); this.maskRGBA = new Uint8Array(nx * ny * 4);
    this.dyes = [0, 1].map(() => { const t = this.tex(nx, ny, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR); return { t, f: this.fbo([t]) }; });
    this.dyeParity = 0;
    // Kette für die Summen
    this.red = []; let w = nx, h = ny;
    while (w > 1 || h > 1) { w = Math.ceil(w / 2); h = Math.ceil(h / 2); const t = this.tex(w, h, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST); this.red.push({ w, h, t, f: this.fbo([t]) }); }
    this.readBuf = new Float32Array(4);
    this.steps = 0;
  }
  destroyGrid() {
    const gl = this.gl;
    if (!this.sets) return;
    for (const s of this.sets) { gl.deleteFramebuffer(s.f); s.t.forEach(t => gl.deleteTexture(t)); }
    for (const d of this.dyes) { gl.deleteFramebuffer(d.f); gl.deleteTexture(d.t); }
    for (const r of this.red) { gl.deleteFramebuffer(r.f); gl.deleteTexture(r.t); }
    gl.deleteTexture(this.mask);
    this.sets = null;
  }
  setMask(data) {
    const gl = this.gl; this.maskData.set(data);
    const m = this.maskRGBA; for (let i = 0; i < data.length; i++) { const v = data[i] ? 255 : 0; m[i * 4] = v; m[i * 4 + 1] = v; m[i * 4 + 2] = v; m[i * 4 + 3] = 255; }
    gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, this.mask);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.nx, this.ny, gl.RGBA, gl.UNSIGNED_BYTE, m);
  }
  bindTex(unit, t) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); }
  run(prog, fbo, w, h, setup) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, w, h);
    gl.useProgram(prog.p); gl.bindVertexArray(this.vao);
    setup(prog.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // Anfangszustand setzen (Wind überall), Rauch löschen
  init(uin) {
    const gl = this.gl;
    for (const s of this.sets) this.run(this.P.init, s.f, this.nx, this.ny, (u) => { this.bindTex(0, this.mask); gl.uniform1i(u.mask, 0); gl.uniform1f(u.uin, uin); });
    for (const d of this.dyes) { gl.bindFramebuffer(gl.FRAMEBUFFER, d.f); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    this.steps = 0; this.sinceInit = 0;
  }
  // n Zeitschritte
  step(n, prm) {
    const gl = this.gl;
    for (let k = 0; k < n; k++) {
      const src = this.sets[this.parity], dst = this.sets[1 - this.parity];
      const t = Math.min(1, (this.sinceInit || 0) / RAMP_STEPS), beta = prm.beta !== undefined ? prm.beta : t * t * (3 - 2 * t);
      this.sinceInit++;
      this.run(this.P.step, dst.f, this.nx, this.ny, (u) => {
        this.bindTex(0, src.t[0]); this.bindTex(1, src.t[1]); this.bindTex(2, src.t[2]); this.bindTex(3, this.mask);
        gl.uniform1i(u.t0, 0); gl.uniform1i(u.t1, 1); gl.uniform1i(u.t2, 2); gl.uniform1i(u.mask, 3);
        gl.uniform2i(u.N, this.nx, this.ny);
        gl.uniform1f(u.tau0, 0.5 + 3 * prm.nu); gl.uniform1f(u.uin, prm.uin); gl.uniform1f(u.csm, prm.csm); gl.uniform1i(u.ground, prm.ground ? 1 : 0);
        // Dämpfungszonen: der ganze verdeckte Vorlauf, 15 % der Länge vor dem Auslass, 12 % der Höhe an Decke und Boden
        gl.uniform1f(u.spongeIn, Math.max(8, (this.x0 || 0) - 2)); gl.uniform1f(u.spongeOut, Math.max(12, 0.15 * this.nx)); gl.uniform1f(u.spongeWall, Math.max(2, (prm.wallFrac !== undefined ? prm.wallFrac : 0.12) * this.ny));
        gl.uniform1f(u.sigmaG, prm.sigmaG !== undefined ? prm.sigmaG : 0.002);
        gl.uniform1f(u.beta, beta);
      });
      this.parity = 1 - this.parity;
      this.steps++;
    }
  }
  // Rauch um dt Schritte weiterführen
  dye(dt, spacing, phase) {
    const gl = this.gl, src = this.dyes[this.dyeParity], dst = this.dyes[1 - this.dyeParity], cur = this.sets[this.parity];
    this.run(this.P.dye, dst.f, this.nx, this.ny, (u) => {
      this.bindTex(0, src.t); this.bindTex(1, cur.t[2]); this.bindTex(2, this.mask);
      gl.uniform1i(u.dye, 0); gl.uniform1i(u.t2, 1); gl.uniform1i(u.mask, 2);
      gl.uniform2f(u.N, this.nx, this.ny); gl.uniform1f(u.dt, dt); gl.uniform1f(u.decay, Math.pow(0.9997, dt)); gl.uniform1f(u.spacing, spacing); gl.uniform1f(u.phase, phase);
    });
    this.dyeParity = 1 - this.dyeParity;
  }
  // Kraft auf das Modell (Summe) und größte Geschwindigkeit: [Fx, Fy, umax]
  readForce() {
    const gl = this.gl;
    let src = this.sets[this.parity].t[3];
    for (const r of this.red) {
      this.run(this.P.reduce, r.f, r.w, r.h, (u) => { this.bindTex(0, src); gl.uniform1i(u.src, 0); });
      src = r.t;
    }
    const last = this.red[this.red.length - 1];
    gl.bindFramebuffer(gl.FRAMEBUFFER, last.f);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, this.readBuf);
    return [this.readBuf[0], this.readBuf[1], this.readBuf[2]];
  }
  // mittlere Dichteabweichung einer Spalte (Bezugsdruck: Spalte hinter dem Einlass)
  readColumnRho(x) {
    const gl = this.gl, cur = this.sets[this.parity];
    if (!this.colBuf || this.colBuf.length !== this.ny * 4) this.colBuf = new Float32Array(this.ny * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, cur.f); gl.readBuffer(gl.COLOR_ATTACHMENT2);
    gl.readPixels(x, 0, 1, this.ny, gl.RGBA, gl.FLOAT, this.colBuf);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    let s = 0; for (let y = 0; y < this.ny; y++) s += this.colBuf[y * 4 + 1];
    return s / this.ny;
  }
  // Bild zeichnen
  draw(mode, prm, w, h) {
    const gl = this.gl, cur = this.sets[this.parity];
    this.run(this.P.draw, null, w, h, (u) => {
      this.bindTex(0, cur.t[2]); this.bindTex(1, this.mask); this.bindTex(2, this.dyes[this.dyeParity].t); this.bindTex(3, this.lutV); this.bindTex(4, this.lutP);
      gl.uniform1i(u.t2, 0); gl.uniform1i(u.mask, 1); gl.uniform1i(u.dye, 2); gl.uniform1i(u.lutV, 3); gl.uniform1i(u.lutP, 4);
      gl.uniform2f(u.N, this.nx, this.ny); gl.uniform2f(u.view, w, h); gl.uniform1i(u.mode, mode);
      gl.uniform1f(u.uin, prm.uref || prm.uin); gl.uniform1f(u.pref, prm.pref || 0); gl.uniform1f(u.wscale, prm.wscale || 8);
      gl.uniform1f(u.x0, this.x0 || 0);
    });
  }
}
