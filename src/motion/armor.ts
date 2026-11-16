// Accueil : des gants d'armure croisés sur le pommeau d'une épée, pris dans des roses, dans le noir.
// Les gants apparaissent dès l'arrivée, éclairés par une bougie. En descendant, la caméra glisse le long de la lame
// jusque vers sa pointe (les roses au premier plan défilent plus vite : parallaxe), l'ensemble tourne un peu.
// Modèle : détail de « The Forgotten Knight » par dark_igorek, CC BY 4.0 (crédit dans le pied de page).
// public/models/gauntlets.glb : pose figée, découpée depuis le modèle complet (.assets-src/) : mains, épée entière,
// roses autour de la lame ; meshopt + WebP 1024.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { onPage, isMobile, isTouch } from '../engine';

gsap.registerPlugin(ScrollTrigger);
import { addLayer, centerOnVisible, getRenderer } from '../engine/gl';

// Téléphone : modèle plus simplifié et textures 512 px (gauntlets-mobile.glb).
const MODEL = isMobile() ? '/models/gauntlets-mobile.glb' : '/models/gauntlets.glb';
let model: Promise<THREE.Group> | null = null;
let env: THREE.Texture | null = null;
const load = () => (model ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(MODEL).then((g) => g.scene));

// Les mains croisées sur le pommeau, en coordonnées du modèle (repérées sur une vue de face).
const HANDS = new THREE.Vector3(0.08, 1.74, 0.12);
const DROP = 1.3; // descente de la caméra le long de la lame, en unités du modèle (le pommeau est à 0)
const TURN = 0.7; // rotation totale sur la page, en radians (un peu, pas un manège)
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function armor() {
  onPage(() => {
    const root = document.querySelector<HTMLElement>('.home');
    const r = getRenderer();
    if (!root || !r) return;
    root.classList.add('is-live');
    let alive = true;

    const scene = new THREE.Scene();
    const mobile = isMobile();
    const cam = new THREE.PerspectiveCamera(mobile ? 38 : 30, 1, 0.01, 20);
    const pivot = new THREE.Group();
    scene.add(pivot);

    // Sans rien à refléter, du métal reste noir : un atelier très atténué lui donne ses reflets.
    if (!env) { const pm = new THREE.PMREMGenerator(r); env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); }
    scene.environment = env;
    scene.environmentIntensity = 0;
    // Une bougie tenue juste devant les mains : la lumière tombe vite, seul le milieu sort du noir.
    const flame = new THREE.PointLight('#ff9a48', 0, 0, 2);
    const rim = new THREE.DirectionalLight('#9fb6b0', 0); // contre-jour vert-de-gris, à peine : garde un fil de silhouette
    scene.add(flame, rim);
    let ready = false;
    // Le défilement pilote la scène par GSAP (ScrollTrigger + scrub) : la valeur rattrape la position avec une petite
    // animation au lieu de suivre chaque à-coup. Au doigt, le défilement natif du téléphone arrive par saccades :
    // le rattrapage est plus long sur écran tactile.
    const prog = { v: 0 };
    gsap.to(prog, {
      v: 1, ease: 'none',
      scrollTrigger: { trigger: document.documentElement, start: 0, end: 'max', scrub: isTouch() ? 1.2 : 0.5 },
    });
    const appear = { v: 0 };

    load().then((src) => {
      if (!alive) return;
      const g = src.clone(true);
      g.position.sub(HANDS); // la rotation tourne autour des mains
      pivot.add(g);
      // Shaders compilés avant la première image : pas de gel au moment où les gants apparaissent.
      return r.compileAsync(scene, cam).then(() => {
        if (!alive) return;
        ready = true;
        // Un voile noir (CSS) s'efface : les gants sortent du noir, jamais une silhouette posée sur le fond.
        gsap.to(appear, { v: 1, duration: 2.2, ease: 'power2.out', onUpdate: () => root.style.setProperty('--cover', String(1 - appear.v)) });
      });
    }).catch((e) => console.warn('gants non chargés', e));

    const look = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointer = (e: PointerEvent) => { look.tx = e.clientX / innerWidth - 0.5; look.ty = e.clientY / innerHeight - 0.5; };
    if (!isTouch()) addEventListener('pointermove', onPointer, { passive: true });

    const off = addLayer({
      z: 8,
      resize: (w, h) => { cam.aspect = w / h; cam.userData.shift = -1; cam.updateProjectionMatrix(); },
      render: (rr, t) => {
        if (!ready) return;
        const k = 1 - Math.pow(0.84, gsap.ticker.deltaRatio());
        const p = prog.v;
        look.x += (look.tx - look.x) * k * 0.5;
        look.y += (look.ty - look.y) * k * 0.5;
        const S = 0.8; // taille de la zone cadrée (gants + roses), en unités du modèle

        // Visibles dès l'arrivée mais à peine éclairés ; la bougie monte en descendant.
        const light = 0.06 + 0.94 * smooth(0, 0.6, p);
        pivot.rotation.y = -TURN / 2 + p * TURN + Math.sin(t * 0.2) * 0.02;
        pivot.rotation.x = 0.12 - p * 0.1;

        // Très près : les gants remplissent toute la hauteur d'écran, centrés.
        const dist = S * (mobile ? 1.45 : 1.25) * (1 - p * 0.1);
        const cy = -DROP * smooth(0, 1, p); // la caméra descend le long de la lame
        cam.position.set(look.x * S * 0.04, cy + S * 0.03 - look.y * S * 0.03, dist);
        cam.lookAt(0, cy, 0);

        // La flamme tremble : sinus désaccordés et un peu de hasard, jamais une pulsation régulière.
        const flicker = 0.88 + 0.07 * Math.sin(t * 7.3) + 0.04 * Math.sin(t * 13.1 + 1.7) + 0.03 * Math.random();
        // La flamme bouge un peu, comme portée à la main.
        flame.position.set(-S * 0.05 + Math.sin(t * 0.7) * S * 0.015 + look.x * S * 0.08, cy + S * 0.08 + Math.sin(t * 1.1) * S * 0.01, S * 0.42);
        flame.intensity = 0.9 * light * flicker;
        rim.position.set(S, cy + S * 0.5, -S);
        rim.intensity = 0.5 * light;
        scene.environmentIntensity = 0.06 * light; // juste assez pour que le métal ne soit pas noir

        const tone = rr.toneMapping, exp = rr.toneMappingExposure;
        rr.toneMapping = THREE.ACESFilmicToneMapping;
        rr.toneMappingExposure = 0.85;
        rr.clearDepth();
        centerOnVisible(cam);
        rr.render(scene, cam);
        rr.toneMapping = tone;
        rr.toneMappingExposure = exp;
      },
    });

    return () => {
      alive = false;
      off();
      removeEventListener('pointermove', onPointer);
      root.classList.remove('is-live');
      root.style.removeProperty('--cover');
    };
  });
}
