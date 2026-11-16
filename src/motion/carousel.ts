// Colonne infinie de toiles (Three.js, calque du renderer partagé). Seule page du site.
// Faire défiler fait monter les toiles sur un mur à peine courbe, dans la brume : seule celle du centre sort
// du noir. Les toiles ne sont jamais déformées. Un « + » suit chaque toile et ouvre le zoom :
// la toile remplit l'écran et le pointeur (ou le doigt) la parcourt. Échap, × ou un clic referment.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { onPage, isMobile, isTouch } from '../engine';
import { addLayer, centerOnVisible, getRenderer, loadTexture, viewport } from '../engine/gl';

const VERT = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float uCurve;
uniform float uVel;
varying vec2 vUv;
varying float vY;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vY = w.y;
  w.z -= w.y * w.y * uCurve;   // le mur s'éloigne doucement en haut et en bas
  // En mouvement, la toile se creuse comme une feuille tendue qui prend l'air (revient à plat à l'arrêt).
  float k = position.x;        // -0.5..0.5 sur la largeur
  w.z -= (0.25 - k * k) * abs(uVel) * 1.6;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
uniform float uReveal;
uniform float uHalf;
uniform float uFocus;
uniform float uVel;
uniform vec3 uGround;
varying vec2 vUv;
varying float vY;
void main() {
  // Flou de mouvement vertical, proportionnel à la vitesse (nul à l'arrêt : la toile est exacte).
  float b = clamp(uVel, -0.6, 0.6) * 0.035;
  vec3 col = texture2D(tMap, vUv).rgb * 0.36;
  col += texture2D(tMap, vUv + vec2(0.0, b * 0.5)).rgb * 0.22;
  col += texture2D(tMap, vUv - vec2(0.0, b * 0.5)).rgb * 0.22;
  col += texture2D(tMap, vUv + vec2(0.0, b)).rgb * 0.1;
  col += texture2D(tMap, vUv - vec2(0.0, b)).rgb * 0.1;
  float g = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(g), min(abs(uVel) * 1.2, 0.5));
  // Hors du centre, la toile s'enfonce dans la nuit (uFocus = 1 pendant le zoom : pleine lumière).
  float light = mix(1.0 - smoothstep(0.38, 1.18, abs(vY) / uHalf), 1.0, uFocus);
  light *= uReveal;
  col = mix(uGround, col, smoothstep(0.0, 0.75, light));
  float a = smoothstep(0.0, 0.3, light);
  gl_FragColor = vec4(col * a, a);
}`;

type Slide = { mesh: THREE.Mesh; mat: THREE.RawShaderMaterial; w: number; h: number; base: number; y: number; i: number; ratio: number; plus: HTMLButtonElement; tex: string; asked: boolean };

const FOV = 30;
const CAM_Z = 7;
const wrap = (x: number, L: number) => ((((x + L / 2) % L) + L) % L) - L / 2;

export function carousel() {
  onPage(({ intro }) => {
    const root = document.querySelector<HTMLElement>('[data-carousel]');
    const renderer = getRenderer();
    if (!root || !renderer) return;
    root.classList.add('is-live');
    const items = [...root.querySelectorAll<HTMLButtonElement>('.reel button')];
    items.forEach((b) => { b.tabIndex = -1; });
    root.querySelector('.reel')?.setAttribute('aria-hidden', 'true');
    const pluses = root.querySelector<HTMLElement>('[data-pluses]')!;
    const capLabel = root.querySelector<HTMLElement>('[data-cap-label]');
    const capNote = root.querySelector<HTMLElement>('[data-cap-note]');
    const live = root.querySelector<HTMLElement>('[data-live]');
    const closeBtn = root.querySelector<HTMLButtonElement>('[data-zoom-close]')!;

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
    cam.position.z = CAM_Z;
    const geo = new THREE.PlaneGeometry(1, 1, 16, 16);
    const viewH = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    let viewW = viewH;
    let pxToWorld = 0.01;
    const ground = new THREE.Vector3(0x07 / 255, 0x07 / 255, 0x07 / 255);
    const slides: Slide[] = [];
    let L = 1;

    const layout = () => {
      const H = viewH * (isMobile() ? 0.5 : 0.62);
      const maxW = viewW * (isMobile() ? 0.78 : 0.5);
      const gap = viewH * 0.34; // la toile suivante reste hors champ : la légende ne la touche jamais
      let acc = 0;
      slides.forEach((s) => {
        s.h = Math.min(H, maxW / s.ratio);
        s.w = s.h * s.ratio;
        s.base = acc + s.h / 2;
        acc += s.h + gap;
      });
      L = acc;
      const b0 = slides[0]?.base || 0;
      slides.forEach((s) => (s.base -= b0));
    };

    items.forEach((btn, i) => {
      const mat = new THREE.RawShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false, premultipliedAlpha: true,
        uniforms: { tMap: { value: null }, uReveal: { value: 0 }, uHalf: { value: 2 }, uFocus: { value: 0 }, uVel: { value: 0 }, uGround: { value: ground }, uCurve: { value: 0.025 } },
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.className = 'plus';
      plus.setAttribute('aria-label', `Agrandir : ${btn.dataset.label}, ${btn.dataset.note}`);
      plus.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 4v16M4 12h16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg>';
      pluses.appendChild(plus);
      // Proportions et texture viennent des data-attributs : la colonne n'attend aucune image pour se mettre en page,
      // et une toile ne charge sa texture qu'à l'approche (voir render) : des dizaines de toiles restent légères.
      const s: Slide = { mesh, mat, w: 1, h: 1, base: 0, y: 0, i, ratio: parseFloat(btn.dataset.ratio || '0.8'), plus, tex: btn.dataset.tex || '', asked: false };
      slides.push(s);
      plus.addEventListener('click', () => openZoom(s));
    });
    layout();

    // ---- état ----
    const st = { target: 0, current: 0, vel: 0, active: -1, lastInput: 0, dragging: false, zoom: null as Slide | null };
    const look = { x: 0, y: 0, tx: 0, ty: 0 }; // regard dans la toile zoomée, -1..1
    const nearest = () => slides.reduce((b, s) => (Math.abs(s.y) < Math.abs(b.y) ? s : b), slides[0]);
    const centerOn = (s: Slide) => { st.target = st.current + s.y; st.lastInput = performance.now(); };
    const step = (dir: 1 | -1) => {
      const c = nearest();
      const cand = slides.filter((s) => (dir > 0 ? s.y > c.y + 0.01 : s.y < c.y - 0.01)).sort((a, b) => dir * (a.y - b.y));
      if (cand[0]) centerOn(cand[0]);
    };

    // Légende : on attend que la toile soit vraiment au centre, puis fondu sortant / fondu entrant,
    // toujours repris depuis l'état courant (jamais de coupure, même si on change vite d'œuvre).
    let capCall: gsap.core.Tween | null = null;
    const fadeTo = (el: HTMLElement | null, text: string, delay = 0) => {
      if (!el || (el.dataset.target ?? el.textContent) === text) return;
      el.dataset.target = text;
      if (el.textContent === text) { // retour à l'œuvre affichée pendant son fondu : on la rallume
        gsap.to(el, { autoAlpha: 1, yPercent: 0, duration: 0.8, ease: 'power3.out', overwrite: true });
        return;
      }
      gsap.to(el, {
        autoAlpha: 0, yPercent: -35, duration: 0.55, ease: 'power2.inOut', overwrite: true, delay,
        onComplete: () => {
          el.textContent = el.dataset.target || text;
          gsap.fromTo(el, { yPercent: 35 }, { autoAlpha: 1, yPercent: 0, duration: 1.2, ease: 'power3.out', overwrite: true });
        },
      });
    };
    const setCaption = (s: Slide) => {
      const btn = items[s.i];
      slides.forEach((o) => (o.plus.tabIndex = o === s ? 0 : -1));
      capCall?.kill();
      capCall = gsap.delayedCall(0.25, () => {
        if (live) live.textContent = `${btn.dataset.label}, ${btn.dataset.note}`;
        fadeTo(capNote, btn.dataset.note || '');
        fadeTo(capLabel, btn.dataset.label || '', 0.08);
      });
    };

    // ---- zoom ----
    let zoomTl: gsap.core.Timeline | null = null;
    const zoomZ = (s: Slide) => {
      // La toile déborde un peu l'écran, pour qu'on la parcoure.
      const fitH = s.h / (2 * tanHalf);
      const fitW = s.w / (2 * tanHalf * (viewW / viewH));
      return Math.min(fitH, fitW) * (isMobile() ? 0.62 : 0.72);
    };
    function openZoom(s: Slide) {
      if (st.zoom) return;
      st.zoom = s;
      centerOn(s);
      root!.classList.add('is-zoom');
      look.tx = look.ty = 0;
      zoomTl?.kill();
      zoomTl = gsap.timeline()
        .to(cam.position, { z: zoomZ(s), duration: 1.1, ease: 'expo.inOut' }, 0)
        .to(s.mat.uniforms.uFocus, { value: 1, duration: 0.8, ease: 'power2.out' }, 0)
        .to(slides.filter((o) => o !== s).map((o) => o.mat.uniforms.uReveal), { value: 0, duration: 0.6, ease: 'power2.out' }, 0);
      closeBtn.focus({ preventScroll: true });
    }
    function closeZoom() {
      const s = st.zoom;
      if (!s) return;
      st.zoom = null;
      root!.classList.remove('is-zoom');
      zoomTl?.kill();
      zoomTl = gsap.timeline()
        .to(cam.position, { z: CAM_Z, x: 0, y: 0, duration: 1, ease: 'expo.inOut' }, 0)
        .to(s.mat.uniforms.uFocus, { value: 0, duration: 0.8, ease: 'power2.out' }, 0.2)
        .to(slides.map((o) => o.mat.uniforms.uReveal), { value: 1, duration: 0.8, ease: 'power2.out' }, 0.3);
      s.plus.focus({ preventScroll: true });
    }
    closeBtn.addEventListener('click', closeZoom);

    // ---- entrées ----
    const hit = (cx: number, cy: number) => {
      const { w, h } = viewport();
      const px = (cx / w - 0.5) * viewW, py = (0.5 - cy / h) * viewH;
      return slides.find((s) => Math.abs(px) < s.w / 2 && Math.abs(py + s.y) < s.h / 2) || null;
    };
    // Un geste = une toile. Molette et pavé tactile envoient des rafales d'événements : la première
    // assez franche avance d'une toile, la suite de la rafale est ignorée jusqu'à une courte pause.
    let wheelLock = 0, lastWheel = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (st.zoom) return;
      const now = performance.now();
      const dom = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      const quiet = now - lastWheel > 220;
      lastWheel = now;
      if (now < wheelLock && !quiet) return;
      if (Math.abs(dom) < 4) return;
      step(dom > 0 ? 1 : -1);
      wheelLock = now + 650;
    };
    let downX = 0, downY = 0, lastX = 0, lastY = 0, moved = 0;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('a, button')) return;
      st.dragging = true; downX = lastX = e.clientX; downY = lastY = e.clientY; moved = 0;
      root.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const { w, h } = viewport();
      if (st.zoom && !isTouch()) { look.tx = (e.clientX / w) * 2 - 1; look.ty = (e.clientY / h) * 2 - 1; }
      if (!st.dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY));
      if (st.zoom) { // au doigt : on fait glisser la toile
        look.tx = gsap.utils.clamp(-1, 1, look.tx - (dx / w) * 3);
        look.ty = gsap.utils.clamp(-1, 1, look.ty - (dy / h) * 3);
        return;
      }
      st.target -= dy * pxToWorld * 1.3;
      st.lastInput = performance.now();
    };
    const onUp = (e: PointerEvent) => {
      if (!st.dragging) return;
      st.dragging = false;
      if (moved >= 6) {
        // Glisser : la toile suit le doigt, puis on passe à la suivante (ou on revient) au relâché.
        if (!st.zoom && Math.abs(e.clientY - downY) > 40) {
          const c = nearest();
          const dir = e.clientY < downY ? 1 : -1;
          if (dir * c.y > 0.05) centerOn(c); else step(dir);
        }
        return;
      }
      if (st.zoom) return closeZoom();
      const s = hit(e.clientX, e.clientY);
      if (s) centerOn(s);
    };
    const onKey = (e: KeyboardEvent) => {
      if (document.documentElement.classList.contains('menu-open')) return;
      if (e.key === 'Escape') return closeZoom();
      if (st.zoom) return;
      if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); step(1); }
      if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); step(-1); }
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onUp);
    addEventListener('keydown', onKey);

    // ---- rendu (calque du renderer partagé, horloge GSAP) ----
    const proj = new THREE.Vector3();
    const off = addLayer({
      resize: (w, h) => {
        cam.userData.shift = -1; // décalage de projection à recalculer (centerOnVisible)
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
        viewW = viewH * cam.aspect;
        pxToWorld = viewH / h;
        layout();
      },
      render: (r) => {
        const idle = performance.now() - st.lastInput;
        if (!st.dragging && !st.zoom && idle > 160 && idle < 6000 && Math.abs(st.vel) < 0.004) {
          const n = nearest();
          if (Math.abs(n.y) > 0.0005) st.target = st.current + n.y;
        }
        if (!st.dragging && !st.zoom && idle > 6000) st.target += 0.0007; // la colonne dérive lentement
        const k = 1 - Math.pow(0.9, gsap.ticker.deltaRatio());
        const prev = st.current;
        st.current += (st.target - st.current) * k;
        st.vel = st.current - prev;
        // Regard dans la toile zoomée.
        look.x += (look.tx - look.x) * k * 0.8;
        look.y += (look.ty - look.y) * k * 0.8;
        if (st.zoom && !gsap.isTweening(cam.position)) {
          const z = cam.position.z, vh = 2 * z * tanHalf, vw = vh * cam.aspect;
          cam.position.x = look.x * Math.max(0, (st.zoom.w - vw) / 2);
          cam.position.y = -st.zoom.y - look.y * Math.max(0, (st.zoom.h - vh) / 2);
        }
        const half = viewH / 2;
        const { w, h } = viewport();
        for (const s of slides) {
          s.y = wrap(s.base - st.current, L);
          s.mesh.position.set(0, -s.y, 0);
          s.mesh.scale.set(s.w, s.h, 1);
          const u = s.mat.uniforms;
          u.uHalf.value = half;
          u.uVel.value += (gsap.utils.clamp(-1, 1, st.vel * 9) - u.uVel.value) * 0.2;
          // ponytail: les textures chargées restent en mémoire ; les libérer loin du centre si une page dépasse ~150 toiles.
          if (!s.asked && Math.abs(s.y) < half * 4 && s.tex) {
            s.asked = true;
            loadTexture(s.tex).then((t) => { u.tMap.value = t; }).catch(() => {});
          }
          const vis = !!u.tMap.value && Math.abs(s.y) < half + s.h;
          s.mesh.visible = vis;
          // Le « + » suit le coin haut droit de sa toile.
          proj.set(s.w / 2, -s.y + s.h / 2, -((s.y - s.h / 2) ** 2) * 0.025).project(cam);
          const sx = (proj.x * 0.5 + 0.5) * w, sy = (0.5 - proj.y * 0.5) * h;
          const fade = Math.max(0, 1 - Math.abs(s.y) / (half * 0.8)) * u.uReveal.value * (1 - u.uFocus.value);
          // Toujours dans l'écran : s'il n'y a pas la place à droite de la toile, il se met dans son coin.
          const size = 44, m = 16;
          let px = sx + 14, py = sy;
          if (px + size > w - m) { px = sx - size - 12; py = sy + 12; }
          px = gsap.utils.clamp(m, w - size - m, px);
          py = gsap.utils.clamp(m + 56, h - size - m, py);
          s.plus.style.translate = `${px}px ${py}px`;
          s.plus.style.opacity = String(fade);
          s.plus.style.visibility = vis && fade > 0.05 ? 'visible' : 'hidden';
        }
        const n = nearest();
        if (n && n.i !== st.active) { st.active = n.i; setCaption(n); }
        centerOnVisible(cam);
        r.render(scene, cam);
      },
    });

    intro.add(() => {
      const order = [...slides].sort((a, b) => Math.abs(a.y) - Math.abs(b.y));
      gsap.to(order.map((s) => s.mat.uniforms.uReveal), { value: 1, duration: 2.2, ease: 'power2.out', stagger: 0.18 });
    }, 0.2);

    return () => {
      off();
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);
      removeEventListener('keydown', onKey);
      closeBtn.removeEventListener('click', closeZoom);
      slides.forEach((s) => { scene.remove(s.mesh); s.mat.dispose(); s.plus.remove(); });
      geo.dispose();
    };
  });
}
