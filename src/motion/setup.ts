// Mouvement global du site (concept « nocturne traîné », DESIGN.md). Exécuté une fois, avant la première page.
import { gsap } from 'gsap';
import { ease, onScroll, pauseGL, setBackground, setLoaderExit, setLoaderFormat, setTransition } from '../engine';
import { groundFragment } from '../engine/gl/shaders';
import { carousel } from './carousel';
import { embers } from './embers';
import { menu } from './menu';
import { armor } from './armor';
import { home } from './home';

// Chaque colonne coule avec son propre retard : des traînées, pas un rideau.
// Web Animations API et non GSAP : une animation de transform tourne sur le compositeur, elle reste fluide pendant
// que la nouvelle page se construit sur le fil principal (modèle 3D, textures, découpage des textes).
// Courbe douce (cubic in-out) : l'expo.inOut d'avant jaillissait trop vite au milieu.
const DRAG_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
const drag = (cols: Element[], from: number, to: number, duration = 1.1) => {
  const order = gsap.utils.shuffle(cols.map((_, i) => i));
  return Promise.all(cols.map((col, i) => {
    col.getAnimations().forEach((a) => a.cancel());
    return col.animate([{ transform: `translateY(${from}%)` }, { transform: `translateY(${to}%)` }], {
      duration: duration * 1000, delay: order[i] * 70, easing: DRAG_EASE, fill: 'forwards',
    }).finished.then((anim) => {
      // La position finale est écrite dans le style de la bande : elle survit au remplacement de la page par Astro
      // (sinon le rideau se rouvre pendant l'échange et la nouvelle page apparaît avant d'être révélée).
      anim.commitStyles();
      anim.cancel();
    });
  }));
};

export function setupMotion() {
  setLoaderFormat((p) => String(Math.round(p)).padStart(3, '0'));

  // Le nom du loader devient l'en-tête : même texte, il glisse et se réduit jusqu'au coin.
  setLoaderExit((root) => {
    const name = root.querySelector<HTMLElement>('[data-loader-name]')!;
    const head = document.querySelector<HTMLElement>('.frame__name');
    const a = name.getBoundingClientRect();
    const b = head?.getBoundingClientRect();
    const tl = gsap.timeline();
    tl.to(root.querySelectorAll('.loader__track, .loader__count'), { autoAlpha: 0, duration: 0.25, ease: 'power2.in' });
    if (b) tl.to(name, { x: b.left - a.left, y: b.top - a.top, scale: b.height / a.height, transformOrigin: '0 0', duration: 0.8, ease: ease.inOut }, 0.05);
    tl.to(root, { backgroundColor: 'rgba(5,6,6,0)', duration: 0.7, ease: 'power2.inOut' }, 0.15)
      .add(() => document.documentElement.classList.add('name-docked'))
      .to(name, { autoAlpha: 0, duration: 0.15 });
    return tl;
  });

  setTransition({
    // Écran couvert : la 3D s'arrête ; elle repart quand le rideau a fini de se retirer.
    leave: (c) => { gsap.set(c, { autoAlpha: 1 }); return drag([...c.querySelectorAll('.curtain__col')], -112, 0).then(() => pauseGL(true)); },
    enter: (c) => drag([...c.querySelectorAll('.curtain__col')], 0, 112, 1.25).then(() => { gsap.set(c, { autoAlpha: 0 }); pauseGL(false); }),
  });

  // Le fond : une toile de lin brute, sombre, en lumière rasante (null sans GL : le fond CSS prend le relais).
  if (!new URLSearchParams(location.search).has('nobg')) setBackground(groundFragment, {
    uDeep: { value: [0x07 / 255, 0x06 / 255, 0x06 / 255] },
    uThread: { value: [0.07, 0.062, 0.054] },  // lin brut, presque éteint
    uLight: { value: [0.75, 0.62, 0.45] },       // bougie
  });

  embers();
  carousel();
  menu();
  // Diagnostic sur téléphone : ?fps affiche les images par seconde, ?no3d coupe les gants, ?nobg le fond animé.
  const q = new URLSearchParams(location.search);
  if (!q.has('no3d')) armor();
  if (q.has('fps')) {
    const el = Object.assign(document.createElement('div'), { style: 'position:fixed;left:8px;bottom:8px;z-index:999;font:12px monospace;color:#0f0;background:#000a;padding:4px 6px;pointer-events:none' });
    document.body.append(el);
    let n = 0, t0 = performance.now(), worst = 0, last = t0;
    gsap.ticker.add(() => {
      const now = performance.now(); worst = Math.max(worst, now - last); last = now; n++;
      if (now - t0 > 1000) { el.textContent = `${Math.round((n * 1000) / (now - t0))} img/s, pire ${Math.round(worst)} ms`; n = 0; worst = 0; t0 = now; }
    });
  }
  home();

  let last = 0;
  onScroll(({ y }) => {
    if (Math.abs(y - last) < 4) return;
    document.documentElement.classList.toggle('frame-away', y > 160 && y > last);
    last = y;
  });
}
