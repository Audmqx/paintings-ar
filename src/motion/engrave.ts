// Gravure : les plans de la vidéo de l'atelier redessinés en traits verticaux, comme une taille-douce.
// Chaque case de la grille lit la vidéo en son centre ; la largeur du trait suit la luminosité.
// À l'approche (ou à l'arrivée sur la page pour l'ouverture), les niveaux et la finesse de la grille font monter la gravure.
//   <figure data-engrave="4" [data-engrave-intro]><canvas></canvas><img (repli)><video src="/video/plan-4.mp4" muted loop playsinline></video></figure>
// Sans WebGL 2 ou en mouvement réduit : l'image fixe du plan s'affiche.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { isMobile, onPage, prefersReducedMotion } from '../engine';

gsap.registerPlugin(ScrollTrigger);

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uRes;            // canvas, px
uniform vec2 uMedia;          // vidéo, px
uniform float uCell;          // largeur d'une colonne de traits, px
uniform float uBlack, uWhite; // niveaux, 0..1
uniform float uMin, uMax;     // largeur du trait, en fraction de la colonne
uniform vec3 uInk, uBg;
uniform float uGamma;
uniform vec2 uFocus;          // point de la vidéo gardé au centre quand le recadrage coupe (le peintre)
uniform float uGain;          // éclaircissement du calque 1 (plan détouré sombre : fort ; plan plein cadre : léger)
uniform float uCut;           // calque 1 : en dessous, c'est du fond (plan plein cadre : ses ombres deviennent le fond uni)
uniform float uDuo;           // 0 : gravure pure ; 1 : image en deux tons (olive / sable), trame légère par-dessus
uniform float uTopFray;       // 1 : le haut s'effiloche aussi ; 0 : bord haut franc (l'ouverture touche le haut de l'écran)

// Recadrage « cover » : la vidéo remplit le canvas sans se déformer, centrée sur uFocus.
vec2 cover(vec2 uv) {
  float r = (uRes.x / uRes.y) / (uMedia.x / uMedia.y);
  vec2 s = r > 1.0 ? vec2(1.0, 1.0 / r) : vec2(r, 1.0);
  return (uv - 0.5) * s + 0.5 + (uFocus - 0.5) * (1.0 - s);
}

// La vidéo empile trois calques, de haut en bas : le corps détouré (devant), la toile peinte détourée (derrière lui),
// et le passage où il peint (le fond, plein cadre). Calques détourés : fond en noir pur, sujet jamais sous 16/255.
// Texture retournée : le calque du haut est en v > 2/3.
float lum(vec2 p, float layer) {
  vec2 uv = cover(p / uRes);
  uv.y = (clamp(uv.y, 0.003, 0.997) + 2.0 - layer) / 3.0;
  return dot(texture(uTex, uv).rgb, vec3(0.299, 0.587, 0.114));
}
const float CUT = 0.035;   // calques détourés : leur fond est en noir pur

// Bruit lissé par colonne : chaque colonne de traits s'arrête à sa hauteur, les arrêts dessinent des crêtes.
float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float ridge(float col, float seed) {
  float f = col / 9.0, i = floor(f), u = fract(f);
  float smooth1 = mix(hash(i + seed), hash(i + 1.0 + seed), u * u * (3.0 - 2.0 * u));
  return clamp(smooth1 * 0.75 + hash(col + seed * 3.1) * 0.25, 0.0, 1.0);
}
// Le bas de chaque calque se défait : pas de bord droit, les traits s'effilochent dans le fond uni.
bool frayed(vec2 px, float cell, float seed, float zone) {
  float col = floor(px.x / cell);
  return vUv.y < zone * (0.15 + 0.85 * ridge(col, seed));
}

// Dans le calque, et pas sur son bord (aucune case voisine n'est du fond) : le contour reste net, sans bavure.
bool inside(vec2 c, vec2 size, float layer, float cut, out float raw) {
  raw = lum(c, layer);
  return raw >= cut && lum(c + vec2(size.x, 0.0), layer) >= cut && lum(c - vec2(size.x, 0.0), layer) >= cut
      && lum(c + vec2(0.0, size.y), layer) >= cut && lum(c - vec2(0.0, size.y), layer) >= cut;
}

// gain : le plan détouré est sombre (étalonnage de la vidéo) ; on l'éclaircit avant les niveaux, par calque,
// pour que les lumières (visage, main) prennent des traits épais et que les ombres restent en traits fins.
float line(vec2 px, float cell, float raw, float gain, float lo, float hi) {
  float b = clamp((pow(raw * gain, uGamma) - uBlack) / max(uWhite - uBlack, 1e-3), 0.0, 1.0);
  float w = mix(lo, hi, b); // un sujet a toujours au moins un trait fin : sa silhouette se lit même dans le noir
  float x = abs(fract(px.x / cell) - 0.5);
  float aa = 0.75 / cell;
  return 1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, x);
}

void main() {
  vec2 px = vUv * uRes;
  // Cases plus basses que larges : le trait reste continu, ses variations d'épaisseur suivent les volumes.
  vec2 size = vec2(uCell, uCell * 0.5);
  float raw;

  // 1. Le sujet (le corps détouré, ou tout le plan quand il est gravé plein cadre). Haut et bas effilochés.
  vec2 c = (floor(px / size) + 0.5) * size;
  bool top1 = uTopFray > 0.5 && vUv.y > 0.985 - 0.2 * ridge(floor(px.x / uCell), 5.0);
  if (!frayed(px, uCell, 1.0, 0.36) && !top1 && inside(c, size, 0.0, uCut, raw)) {
    // Les gros plans ne se lisent pas en traits seuls : ils se fondent en image deux tons, la trame reste en filigrane.
    float ink = line(px, uCell, raw, uGain, uMin, uMax);
    float tone = smoothstep(0.03, 0.6, raw * uGain); // niveaux de l'image : plus ouverts que ceux des traits
    outColor = vec4(mix(uBg, uInk, mix(ink, tone * (0.86 + 0.14 * ink), uDuo)), 1.0);
    return;
  }
  // 2. La toile, derrière lui : même grille, traits plus sourds.
  vec2 s2 = size;
  c = (floor(px / s2) + 0.5) * s2;
  bool topFrayed = vUv.y > 0.985 - 0.22 * ridge(floor(px.x / s2.x), 21.0); // le haut de la toile aussi : pas de bord droit
  if (!frayed(px, s2.x, 7.0, 0.45) && !topFrayed && inside(c, s2, 1.0, CUT, raw)) {
    outColor = vec4(mix(uBg, uInk, line(px, s2.x, raw, 1.2, 0.06, 0.8) * 0.55), 1.0);
    return;
  }
  // 3. Le fond : le passage où il peint, en longs traits sourds sur l'olive uni. Le haut de l'olive est une crête
  //    irrégulière (colonne par colonne) : au-dessus, la page ; le corps et la toile peuvent dépasser de la crête.
  vec2 s3 = vec2(uCell * 2.0, uCell);
  float col = floor(px.x / s3.x);
  if (vUv.y < 0.94 - 0.34 * ridge(col, 13.0)) {
    // Ses traits s'arrêtent bien avant le bas du canvas : le bas est de l'olive pur, sans couture avec la section.
    if (vUv.y < 0.12 + 0.3 * ridge(col, 31.0)) { outColor = vec4(uBg, 1.0); return; }
    c = (floor(px / s3) + 0.5) * s3;
    raw = lum(c, 2.0);
    outColor = vec4(mix(uBg, uInk, line(px, s3.x, raw, 1.3, 0.0, 0.65) * 0.55), 1.0);
    return;
  }
  outColor = vec4(0.0); // transparent : au-dessus de la crête, on voit la page
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}

const cssColor = (name: string) => {
  const h = getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};

// Les plans (public/video/plan-N.mp4, chacun en aller-retour : la boucle ne se voit pas). Trois calques empilés
// par fichier : le plan 4 est détouré (corps, toile, et le passage 2 derrière) ; les plans 2 et 3 sont pleins cadres.
// (Le plan 1, la peinture prise sur la palette, a été retiré à la demande de l'artiste.)
//   focus : point horizontal gardé quand le recadrage coupe (ordinateur / téléphone)
//   duo : part d'image deux tons atteinte à l'approche (0 : gravure pure ; les gros plans ont besoin de l'image)
//   gain, cut : lumière du calque 1, et seuil sous lequel il devient du fond uni. Plein cadre : cut 0, toute la gamme
//   (les ombres gardent un trait fin) ; sinon un gros plan se réduit à des taches et ne se lit plus.
//   2 de profil devant le portrait de femme   3 la main au pinceau   4 de profil qui peint
const CUT_DETOURE = 0.035;
const SHOTS: Record<string, { focus: number; focusMobile: number; gain: number; cut: number; duo: number }> = {
  2: { focus: 0.22, focusMobile: 0.3, gain: 1.15, cut: 0, duo: 0.92 },
  3: { focus: 0.45, focusMobile: 0.45, gain: 1.05, cut: 0, duo: 0.92 },
  4: { focus: 0.4, focusMobile: 0.22, gain: 1.7, cut: CUT_DETOURE, duo: 0 },
};

function engrave(fig: HTMLElement) {
  const canvas = fig.querySelector('canvas')!;
  const video = fig.querySelector('video')!;
  const shot = SHOTS[fig.dataset.engrave ?? '4'] ?? SHOTS[4];
  const intro = fig.hasAttribute('data-engrave-intro');
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false });
  if (!gl) { video.pause(); video.removeAttribute('autoplay'); return; } // repli : l'image fixe reste affichée

  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const u = (n: string) => gl.getUniformLocation(prog, n);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // Couleurs prises dans la vidéo (le sable de la lumière, l'olive des ombres), partagées avec le fond de l'accueil.
  gl.uniform3fv(u('uInk'), cssColor('--c-reel-ink'));
  gl.uniform3fv(u('uBg'), cssColor('--c-reel-bg'));
  gl.uniform1f(u('uGamma'), 1.35);
  gl.uniform1f(u('uMin'), 0.08);
  gl.uniform1f(u('uMax'), 0.92);
  gl.uniform2f(u('uFocus'), isMobile() ? shot.focusMobile : shot.focus, 0.5);
  gl.uniform1f(u('uGain'), shot.gain);
  gl.uniform1f(u('uCut'), shot.cut);
  gl.uniform1f(u('uTopFray'), intro ? 0 : 1);

  // Ce que l'animation pilote. cell : largeur d'une colonne en px CSS (grossière au départ, fine ensuite).
  const fine = isMobile() ? 4 : 5;
  const st = { black: 0.95, white: 1, cell: fine * 2.6, duo: 0 };
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  let hasFrame = false, lastTime = -1, visible = false, raf = 0;

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const draw = () => {
    raf = visible ? requestAnimationFrame(draw) : 0;
    if (video.readyState >= 2 && video.currentTime !== lastTime) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      lastTime = video.currentTime;
      hasFrame = true;
    }
    if (!hasFrame) return;
    gl.uniform2f(u('uRes'), canvas.width, canvas.height);
    gl.uniform2f(u('uMedia'), video.videoWidth, video.videoHeight / 3); // trois calques empilés
    gl.uniform1f(u('uCell'), st.cell * dpr);
    gl.uniform1f(u('uBlack'), st.black);
    gl.uniform1f(u('uWhite'), st.white);
    gl.uniform1f(u('uDuo'), st.duo);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // Ne décode et ne dessine que lorsque la figure est à l'écran.
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) { video.play().catch(() => {}); if (!raf) raf = requestAnimationFrame(draw); }
    else video.pause();
  }, { rootMargin: '10% 0px' });
  io.observe(fig);

  fig.classList.add('is-engraved');

  // Les lumières se gravent d'abord, puis les demi-tons ; la grille s'affine ; un gros plan se révèle en image. L'ouverture se grave à l'arrivée
  // sur la page ; les autres plans à l'approche, au rythme du défilement.
  const to = { black: 0.14, white: 0.8, cell: fine, duo: shot.duo }; // les traits se fondent en image : une épreuve qui se révèle
  const tw = intro
    ? gsap.to(st, { ...to, duration: 2.4, delay: 0.3, ease: 'power2.out' })
    : gsap.to(st, { ...to, ease: 'power1.out', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'center 60%', scrub: 0.6 } });

  return () => {
    tw.scrollTrigger?.kill(); tw.kill();
    io.disconnect(); ro.disconnect();
    cancelAnimationFrame(raf);
    video.pause();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

// Bord de section en traits : le fond uni coule dans la suite de la page par colonnes de longueurs inégales,
// au rythme du défilement. Canvas 2D : quelques centaines de rectangles par image, rien de plus.
//   <canvas data-drips="up">    au-dessus du bord haut : les colonnes montent
//   <canvas data-drips="down">  sous le bord bas : les colonnes descendent (couleur = fond de la section)
function drips(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const color = getComputedStyle(canvas).color;
  const up = canvas.dataset.drips === 'up';
  const col = isMobile() ? 5 : 7;  // colonnes larges, un pixel d'écart : une masse au bord découpé, pas des fils
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let lens: number[] = [];
  const st = { p: 0 };

  const draw = () => {
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    const cw = col * dpr;
    lens.forEach((r, i) => {
      // Chaque colonne a son seuil : les longues partent les premières, les courtes suivent.
      const k = Math.min(1, Math.max(0, (st.p - (1 - r) * 0.55) / 0.45));
      const len = Math.round(h * r * k);
      if (len > 0) ctx.fillRect(i * cw, up ? h - len : 0, cw - dpr, len);
    });
  };

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    // Bruit lissé sur quelques colonnes : des crêtes et des creux, pas du grésillement.
    const n = Math.ceil(canvas.width / (col * dpr));
    const raw = Array.from({ length: n }, () => Math.random());
    lens = raw.map((_, i) => {
      let s = 0, c = 0;
      for (let j = -3; j <= 3; j++) { const v = raw[i + j]; if (v !== undefined) { s += v; c++; } }
      // Toutes les colonnes descendent au moins d'un tiers : le bord reste plein, seule sa découpe varie.
      return Math.min(1, 0.32 + 0.68 * Math.max(0, (s / c - 0.5) * 2.2 + 0.5) * (0.6 + raw[i] * 0.4));
    });
    draw();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const tw = gsap.to(st, {
    p: 1, ease: 'none', onUpdate: draw,
    scrollTrigger: up
      ? { trigger: canvas, start: 'top 95%', end: 'bottom 55%', scrub: 0.4 }
      : { trigger: canvas, start: 'top bottom', end: 'bottom 30%', scrub: 0.4 },
  });
  return () => { tw.scrollTrigger?.kill(); tw.kill(); ro.disconnect(); };
}

export function engraving() {
  onPage(() => {
    const figs = document.querySelectorAll<HTMLElement>('[data-engrave]');
    const edges = document.querySelectorAll<HTMLCanvasElement>('canvas[data-drips]');
    if (prefersReducedMotion()) { figs.forEach((f) => f.querySelector('video')?.removeAttribute('autoplay')); return; }
    const offs = [
      ...[...figs].map((f) => { try { return engrave(f); } catch { return undefined; } }),
      ...[...edges].map(drips),
    ];
    return () => offs.forEach((off) => off?.());
  });
}
