// Un seul renderer Three.js pour tout le site (fond, plans synchronisés au DOM, calques comme le carrousel).
//   <div data-gl><img></div>   plan image dessiné exactement sur le rectangle DOM (l'<img> reste : SEO, a11y, repli)
//   data-gl-intro              la révélation attend l'événement 'gl:reveal' (lancé par l'intro de la page)
//   data-gl-scrub | data-gl-instant | data-gl-duration | data-delay
// Désactivé sous reduced motion, sans WebGL ou avec Save-Data : les images DOM s'affichent telles quelles.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { vertex, imageFragment, proceduralFragment, blitFragment } from './shaders';
import { scrollState } from '../scroll';
import { isMobile, prefersReducedMotion } from '../env';

type Item = { el: HTMLElement; mesh: THREE.Mesh; mat: THREE.RawShaderMaterial; hover: { v: number }; revealed: boolean; scrub: boolean; io?: IntersectionObserver; off: () => void };
export type Layer = { render: (r: THREE.WebGLRenderer, time: number) => void; resize: (w: number, h: number) => void; z?: number };

let renderer: THREE.WebGLRenderer | null = null;
let camera: THREE.OrthographicCamera;
const scene = new THREE.Scene();
const items: Item[] = [];
const layers = new Set<Layer>();
const textures = new Map<string, Promise<THREE.Texture>>();
let vw = 0, vh = 0, velocity = 0;
let bg: { scene: THREE.Scene; mat: THREE.RawShaderMaterial; target: THREE.WebGLRenderTarget; blit: THREE.Scene; blitMat: THREE.RawShaderMaterial } | null = null;
const BG_SCALE = 1; // résolution du fond (la trame de toile a besoin de pixels nets)

/** Texture de bruit tuilable (valeur aléatoire + filtrage linéaire = bruit doux), faite une fois. */
function noiseTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) { const v = Math.random() * 255; data.set([v, v, v, 255], i * 4); }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
let geometry: THREE.PlaneGeometry;

const hex = (h: string) => new THREE.Vector3(...[16, 8, 0].map((s) => ((parseInt(h.slice(1), 16) >> s) & 255) / 255));

export function glSupported() {
  if (prefersReducedMotion()) return false;
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return false;
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

export const getRenderer = () => renderer;
export const viewport = () => ({ w: vw, h: vh });

/** Le canvas fait 100lvh : sur téléphone, quand la barre d'adresse est visible, son centre est plus bas que le centre
 *  visible. Décale la projection de la caméra pour que le centre de la scène tombe au milieu de ce qu'on voit. */
export function centerOnVisible(cam: THREE.PerspectiveCamera) {
  const d = Math.max(0, Math.round((vh - innerHeight) / 2));
  if (cam.userData.shift === d) return;
  cam.userData.shift = d;
  if (d > 0) cam.setViewOffset(vw, vh, 0, d, vw, vh); else cam.clearViewOffset();
}

/** Ajoute un calque rendu entre le fond et les plans DOM (ex. le carrousel). Retourne le retrait. */
export function addLayer(l: Layer) {
  layers.add(l);
  l.resize(vw, vh);
  return () => { layers.delete(l); };
}

/** Texture partagée et mise en cache, à partir d'une URL d'image (même origine). */
export function loadTexture(src: string) {
  let p = textures.get(src);
  if (!p) {
    p = new THREE.TextureLoader().loadAsync(src).then((t) => {
      t.colorSpace = THREE.NoColorSpace; // shaders bruts : on garde les octets sRGB tels quels
      t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      return t;
    });
    textures.set(src, p);
  }
  return p;
}

export function initGL() {
  if (renderer || !glSupported()) return;
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile() ? 1 : 1.5)); // téléphone : moins de pixels, plus d'images/s
  renderer.autoClear = false;
  const canvas = renderer.domElement;
  canvas.classList.add('gl-canvas');
  canvas.setAttribute('aria-hidden', 'true');
  (document.getElementById('gl') || document.body).appendChild(canvas);
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  geometry = new THREE.PlaneGeometry(1, 1);
  document.documentElement.classList.add('gl-on');
  resize();
  addEventListener('resize', resize);
  addEventListener('pointermove', (e) => { mouse.tx = e.clientX / vw; mouse.ty = 1 - e.clientY / vh; }, { passive: true });
  gsap.ticker.add(render);
}

/** Calque plein écran sous tout le reste. Uniforms fournis : uTime, uResolution, uScroll, uScrollY, uVelocity, uMouse. */
export function setBackground(fragment: string, uniforms: Record<string, THREE.IUniform> = {}) {
  if (!renderer) return null;
  const quadVert = `attribute vec3 position; attribute vec2 uv; varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }`;
  const mat = new THREE.RawShaderMaterial({
    vertexShader: quadVert,
    fragmentShader: fragment,
    uniforms: {
      uTime: { value: 0 }, uResolution: { value: new THREE.Vector2(vw, vh) }, uScroll: { value: 0 }, uScrollY: { value: 0 },
      uVelocity: { value: 0 }, uMouse: { value: new THREE.Vector2(0.5, 0.5) }, tNoise: { value: noiseTexture() }, ...uniforms,
    },
    depthTest: false, depthWrite: false,
  });
  const s = new THREE.Scene();
  const m = new THREE.Mesh(geometry, mat);
  m.frustumCulled = false;
  s.add(m);
  const target = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const blitMat = new THREE.RawShaderMaterial({
    vertexShader: quadVert, fragmentShader: blitFragment, depthTest: false, depthWrite: false,
    uniforms: { tMap: { value: target.texture }, uTime: { value: 0 }, uResolution: { value: new THREE.Vector2(vw, vh) } },
  });
  const blit = new THREE.Scene();
  const bm = new THREE.Mesh(geometry, blitMat);
  bm.frustumCulled = false;
  blit.add(bm);
  bg = { scene: s, mat, target, blit, blitMat };
  resize();
  return mat;
}
export function clearBackground() { bg = null; }

function resize() {
  if (!renderer) return;
  // Taille du conteneur #gl (100lvh) et non de la fenêtre : stable quand la barre d'adresse du téléphone bouge.
  const box = document.getElementById('gl');
  const w = box?.clientWidth || innerWidth, h = box?.clientHeight || innerHeight;
  if (w === vw && h === vh) return; // rien n'a changé : pas de réallocation
  vw = w; vh = h;
  renderer.setSize(vw, vh);
  Object.assign(camera, { left: -vw / 2, right: vw / 2, top: vh / 2, bottom: -vh / 2 });
  camera.updateProjectionMatrix();
  const dpr = Math.min(devicePixelRatio, isMobile() ? 1 : 1.5) * BG_SCALE;
  bg?.target.setSize(Math.ceil(vw * dpr), Math.ceil(vh * dpr));
  layers.forEach((l) => l.resize(vw, vh));
}

function add(el: HTMLElement) {
  if (!renderer) return;
  const procedural = el.dataset.gl === 'procedural';
  const uniforms: Record<string, THREE.IUniform> = {
    uPlane: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uHover: { value: 0 },
    uVelocity: { value: 0 },
    uReveal: { value: el.hasAttribute('data-gl-instant') ? 1 : 0 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
  };
  if (procedural) {
    const [c1, c2, c3] = (el.dataset.colors || '#111111,#888888,#eeeeee').split(',').map(hex);
    Object.assign(uniforms, { uC1: { value: c1 }, uC2: { value: c2 }, uC3: { value: c3 }, uSeed: { value: parseFloat(el.dataset.seed || '1') } });
  } else {
    Object.assign(uniforms, { tMap: { value: null }, uImage: { value: new THREE.Vector2(1, 1) } });
  }
  const mat = new THREE.RawShaderMaterial({ vertexShader: vertex, fragmentShader: procedural ? proceduralFragment : imageFragment, uniforms, transparent: true, depthTest: false, depthWrite: false, premultipliedAlpha: true });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  const img = el.querySelector('img');
  if (img && !procedural) {
    const go = () => loadTexture(img.currentSrc || img.src).then((t) => {
      uniforms.tMap.value = t;
      const im = t.image as HTMLImageElement; (uniforms.uImage.value as THREE.Vector2).set(im.width || 1, im.height || 1);
    }).catch(() => {});
    if (img.complete && img.naturalWidth) go(); else img.addEventListener('load', go, { once: true });
  }
  const hover = { v: 0 };
  const enter = () => gsap.to(hover, { v: 1, duration: 0.9, ease: 'expo.out' });
  const leave = () => gsap.to(hover, { v: 0, duration: 0.9, ease: 'expo.out' });
  const move = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    (uniforms.uMouse.value as THREE.Vector2).set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
  };
  el.addEventListener('pointerenter', enter);
  el.addEventListener('pointerleave', leave);
  el.addEventListener('pointermove', move);
  const scrub = el.hasAttribute('data-gl-scrub');
  const item: Item = {
    el, mesh, mat, hover, revealed: false, scrub,
    off: () => { el.removeEventListener('pointerenter', enter); el.removeEventListener('pointerleave', leave); el.removeEventListener('pointermove', move); },
  };
  const revealNow = () => {
    if (item.revealed) return;
    item.revealed = true;
    gsap.to(uniforms.uReveal, { value: 1, duration: parseFloat(el.dataset.glDuration || '2'), ease: 'power2.inOut', delay: parseFloat(el.dataset.delay || '0') });
  };
  if (el.hasAttribute('data-gl-intro')) el.addEventListener('gl:reveal', revealNow, { once: true });
  else if (!el.hasAttribute('data-gl-instant') && !scrub) {
    item.io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { revealNow(); item.io?.disconnect(); } }, { rootMargin: '0px 0px -10% 0px' });
    item.io.observe(el);
  }
  items.push(item);
}

export function mountGL(root: ParentNode = document) {
  if (!renderer) return;
  root.querySelectorAll<HTMLElement>('[data-gl]').forEach(add);
}

export function unmountGL() {
  while (items.length) {
    const it = items.pop()!;
    it.off();
    it.io?.disconnect();
    scene.remove(it.mesh);
    it.mat.dispose();
  }
}

export function hideGL(duration = 0.6) {
  return gsap.to(items.map((i) => i.mat.uniforms.uReveal), { value: 0, duration, ease: 'expo.in' });
}

let paused = false;
/** Coupe le rendu WebGL (et vide le canvas) pendant un changement de page : la carte graphique laisse le rideau
 *  s'animer seul, et la nouvelle page prépare shaders et textures sans lui voler d'images. */
export function pauseGL(p: boolean) {
  paused = p;
  if (p && renderer) { renderer.setClearColor(0x000000, 0); renderer.clear(); }
}

function render(t: number) {
  if (!renderer || document.hidden || paused) return;
  const target = Math.max(-40, Math.min(40, scrollState().velocity));
  velocity += (target - velocity) * 0.12;
  for (const it of items) {
    const r = it.el.getBoundingClientRect();
    const onScreen = r.bottom > -100 && r.top < vh + 100 && r.width > 0;
    it.mesh.visible = onScreen;
    if (!onScreen) continue;
    it.mesh.scale.set(r.width, r.height, 1);
    it.mesh.position.set(r.left + r.width / 2 - vw / 2, vh / 2 - (r.top + r.height / 2), 0);
    const u = it.mat.uniforms;
    u.uPlane.value.set(r.width, r.height);
    u.uTime.value = t;
    u.uHover.value = it.hover.v;
    u.uVelocity.value = velocity * 0.05;
    if (it.scrub) u.uReveal.value = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.75)));
  }
  mouse.x += (mouse.tx - mouse.x) * 0.08;
  mouse.y += (mouse.ty - mouse.y) * 0.08;
  renderer.clear();
  if (bg) {
    const u = bg.mat.uniforms;
    const s = scrollState();
    u.uTime.value = t; u.uResolution.value.set(vw, vh); u.uScroll.value = s.progress; u.uScrollY.value = s.y;
    u.uVelocity.value = velocity; u.uMouse.value.set(mouse.x, mouse.y);
    renderer.setRenderTarget(bg.target);
    renderer.render(bg.scene, camera);
    renderer.setRenderTarget(null);
    bg.blitMat.uniforms.uTime.value = t;
    bg.blitMat.uniforms.uResolution.value.set(vw, vh);
    renderer.render(bg.blit, camera);
  }
  [...layers].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).forEach((l) => l.render(renderer!, t));
  renderer.render(scene, camera);
}
