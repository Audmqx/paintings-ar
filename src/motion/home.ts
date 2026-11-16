// Accueil : le texte suit le défilement (scrub), en plus des révélations déclenchées par le front du fil.
//   [data-big]        grand titre plein écran : les lettres descendent dans leur masque au rythme du défilement
//   [data-chars-lit]  bloc de texte (un ou plusieurs paragraphes) dont les lettres s'allument une à une, de 0,1 à 1,
//                     dans l'ordre de lecture et sur un seul défilement : la lumière court d'un paragraphe à l'autre
//   .h-name__line     le nom se laisse traîner vers le bas en quittant le premier écran
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { onPage, prefersReducedMotion } from '../engine';

gsap.registerPlugin(ScrollTrigger, SplitText);

export function home() {
  onPage(() => {
    const root = document.querySelector<HTMLElement>('.home');
    if (!root || prefersReducedMotion()) return;

    root.querySelectorAll<HTMLElement>('[data-big]').forEach((el) => {
      SplitText.create(el, {
        type: 'chars', mask: 'chars', autoSplit: true,
        onSplit: (self) => gsap.timeline({
          scrollTrigger: { trigger: el, start: 'top 98%', end: 'top 40%', scrub: 0.8 },
        })
          .from(self.chars, { yPercent: -115, stagger: { each: 0.06, from: 'random' }, ease: 'none' }, 0)
          .from(el, { scale: 0.86, letterSpacing: '0.08em', ease: 'none' }, 0),
      });
    });

    root.querySelectorAll<HTMLElement>('[data-chars-lit]').forEach((el) => {
      SplitText.create(el, {
        type: 'words,chars', autoSplit: true,
        onSplit: (self) => gsap.fromTo(self.chars, { opacity: 0.1 }, {
          opacity: 1, stagger: 0.04, ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true },
        }),
      });
    });

    // Les deux lignes du nom ne descendent pas à la même vitesse : la seconde traîne.
    root.querySelectorAll<HTMLElement>('.h-name__line').forEach((line, i) => {
      gsap.to(line, {
        yPercent: 35 + i * 30, opacity: 0.15, ease: 'none',
        scrollTrigger: { trigger: '.h-hero', start: 'top top', end: 'bottom top', scrub: true },
      });
    });

    // Les positions changent quand les polices arrivent : sans ça, des révélations partent avant d'être à l'écran.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
  });
}
