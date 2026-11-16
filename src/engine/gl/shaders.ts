// Concept « traîné » (DESIGN.md). Les toiles ne sont jamais déformées au repos :
// pas de zoom, pas de split chromatique, pas de courbure. Le geste vit dans la révélation,
// dans une petite bavure sous le pointeur et dans le fond.
export const vertex = /* glsl */ `
attribute vec3 position;
attribute vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const noiseLib = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}`;

const common = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uPlane;
uniform float uTime;
uniform float uHover;
uniform float uVelocity;
uniform float uReveal;
uniform vec2 uMouse;
${noiseLib}
// Vitesse de chaque traînée : des bandes verticales de largeur inégale (0 = rapide, 1 = lente).
float strokeLag(float x) {
  return clamp(noise(vec2(x * 34.0, 0.0)) * 0.65 + noise(vec2(x * 7.0, 4.2)) * 0.35, 0.0, 1.0);
}
// d > 0 : la brosse est passée. uReveal 0 → rien, 1 → toute la toile.
float dragFront(vec2 uv, float lag) {
  const float spread = 0.6;
  float front = uReveal * (1.0 + spread + 0.04) - lag * spread;
  return front - (1.0 - uv.y);
}`;

export const imageFragment = /* glsl */ `
${common}
uniform sampler2D tMap;
uniform vec2 uImage;
vec2 cover(vec2 uv) {
  vec2 r = vec2(min((uPlane.x / uPlane.y) / (uImage.x / uImage.y), 1.0), min((uPlane.y / uPlane.x) / (uImage.y / uImage.x), 1.0));
  return uv * r + (1.0 - r) * 0.5;
}
void main() {
  vec2 uv = vUv;
  float lag = strokeLag(uv.x);
  float d = dragFront(uv, lag);
  float mask = smoothstep(0.0, 0.015, d);
  // Au front, le pigment est encore tiré vers le bas : on échantillonne plus haut, puis ça se pose.
  float wet = (1.0 - smoothstep(0.0, 0.22, d)) * (1.0 - smoothstep(0.86, 1.0, uReveal));
  uv.y += wet * 0.09 * (0.6 + 0.4 * noise(vec2(uv.x * 60.0, 1.0)));
  // Survol : une bavure étroite sous le pointeur, quelques pixels, jamais plus.
  float band = exp(-pow((vUv.x - uMouse.x) * 16.0, 2.0)) * smoothstep(0.55, 0.0, abs(vUv.y - uMouse.y));
  uv.y += band * uHover * 0.014 * (0.5 + noise(vec2(vUv.x * 90.0, uTime * 0.6)));
  vec3 col = texture2D(tMap, cover(uv)).rgb;
  col *= 1.0 - wet * 0.35; // le bord humide est plus sombre
  gl_FragColor = vec4(col, 1.0) * mask;
}`;

// Pas de toile ? Une surface brossée dans la palette (honnête : jamais une fausse œuvre).
export const proceduralFragment = /* glsl */ `
${common}
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform float uSeed;
void main() {
  vec2 uv = vUv;
  float lag = strokeLag(uv.x + uSeed);
  float d = dragFront(uv, lag);
  float s = fbm(vec2(uv.x * 40.0 + uSeed * 9.0, uv.y * 2.0));
  vec3 col = mix(uC1, uC2, smoothstep(0.35, 0.8, s));
  col = mix(col, uC3, smoothstep(0.72, 0.95, s) * 0.5);
  gl_FragColor = vec4(col, 1.0) * smoothstep(0.0, 0.015, d);
}`;

// Fond plein écran : une toile de lin brute, très sombre, sur laquelle les peintures sont accrochées.
// Trame tissée (fils de chaîne et de trame qui passent dessus/dessous, épaisseurs irrégulières, nœuds),
// taches et usure à grande échelle, lumière rasante qui suit le pointeur et fait lever le grain.
export const groundFragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime, uScrollY, uVelocity;
uniform vec2 uMouse, uResolution;
uniform vec3 uDeep, uThread, uLight;
uniform sampler2D tNoise;
float N(vec2 p) { return texture2D(tNoise, p / 256.0).r; }
void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vUv * vec2(aspect, 1.0);
  // Trame : un fil fait ~4.5 px CSS.
  vec2 g = vUv * uResolution / 4.5;
  vec2 cell = floor(g);
  vec2 f = fract(g);
  // Fils irréguliers : chaque fil a son épaisseur, et des nœuds le long du fil.
  float tx = 0.32 + 0.16 * N(vec2(cell.x * 3.1, 1.0)) + 0.1 * N(vec2(cell.x * 3.1, g.y * 0.35));
  float ty = 0.32 + 0.16 * N(vec2(2.0, cell.y * 3.1)) + 0.1 * N(vec2(g.x * 0.35, cell.y * 3.1));
  float warp = smoothstep(tx, tx * 0.25, abs(f.x - 0.5));   // fil vertical
  float weft = smoothstep(ty, ty * 0.25, abs(f.y - 0.5));   // fil horizontal
  float over = mod(cell.x + cell.y, 2.0);                    // armure toile : dessus, dessous
  float h = over > 0.5 ? max(warp, weft * 0.55) : max(weft, warp * 0.55);
  vec2 slope = over > 0.5 ? vec2((f.x - 0.5) * 2.0 * warp, 0.0) : vec2(0.0, (f.y - 0.5) * 2.0 * weft);

  // Lumière rasante : une lampe basse en haut à gauche, et le pointeur comme une bougie qu'on approche.
  vec2 m = uMouse * vec2(aspect, 1.0);
  vec2 toLamp = normalize(vec2(-0.7, 0.7));
  vec2 toCandle = normalize(m - p + 1e-4);
  float candle = smoothstep(0.75, 0.0, distance(p, m));
  float lamp = 0.35 + 0.65 * smoothstep(1.6, 0.0, distance(p, vec2(0.0, 1.0)));
  float shade = h * (0.55 + 0.45 * dot(slope, toLamp)) * lamp + h * (0.6 + 0.6 * dot(slope, toCandle)) * candle * 0.9;

  // Toile vieillie : taches, zones plus sombres, la trame qui disparaît dans le noir.
  float stain = N(p * 3.0) * 0.6 + N(p * 9.0) * 0.4;
  float age = mix(0.55, 1.0, smoothstep(0.25, 0.75, stain));
  vec3 col = uDeep + uThread * shade * age;
  col += uLight * candle * candle * 0.035;
  vec2 v = vUv - 0.5;
  col *= 1.0 - 0.8 * pow(length(v * vec2(1.0, 1.25)) * 1.3, 2.0);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

// Agrandissement du fond + grain plein résolution (bon marché).
export const blitFragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tMap;
uniform float uTime;
uniform vec2 uResolution;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 col = texture2D(tMap, vUv).rgb;
  col += (hash(vUv * uResolution + fract(uTime * 7.0)) - 0.5) * 0.028;
  gl_FragColor = vec4(col, 1.0);
}`;
