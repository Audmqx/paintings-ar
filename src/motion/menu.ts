// Menu plein écran : un voile noir descend, les titres sortent un à un de leur masque.
// Accessible : aria-expanded, focus piégé dans le panneau, Échap ferme, le focus revient au bouton.
import { gsap } from 'gsap';
import { onPage, prefersReducedMotion, stopScroll, startScroll } from '../engine';

export function menu() {
  onPage(() => {
    const root = document.querySelector<HTMLElement>('[data-menu]');
    const openBtn = document.querySelector<HTMLButtonElement>('[data-menu-open]');
    const closeBtn = root?.querySelector<HTMLButtonElement>('[data-menu-close]');
    if (!root || !openBtn || !closeBtn) return;
    const panel = root.querySelector<HTMLElement>('.menu__panel')!;
    const texts = root.querySelectorAll('.menu__text');
    const meta = root.querySelectorAll('.menu__meta li, .menu__close');
    const reduced = prefersReducedMotion();
    let isOpen = false;

    const open = () => {
      if (isOpen) return;
      isOpen = true;
      root.hidden = false;
      openBtn.setAttribute('aria-expanded', 'true');
      document.documentElement.classList.add('menu-open');
      stopScroll();
      gsap.killTweensOf([panel, texts, meta]);
      if (reduced) gsap.set(panel, { clipPath: 'inset(0% 0% 0% 0%)' });
      else gsap.timeline()
        .fromTo(panel, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.inOut' })
        .fromTo(texts, { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 }, 0.45)
        .fromTo(meta, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, stagger: 0.05 }, 0.6);
      closeBtn.focus({ preventScroll: true });
    };
    const close = (restore = true) => {
      if (!isOpen) return;
      isOpen = false;
      openBtn.setAttribute('aria-expanded', 'false');
      document.documentElement.classList.remove('menu-open');
      startScroll();
      const done = () => { root.hidden = true; };
      if (reduced) done();
      else gsap.timeline({ onComplete: done })
        .to(texts, { yPercent: -110, duration: 0.45, ease: 'power3.in', stagger: 0.04 })
        .to(panel, { clipPath: 'inset(100% 0% 0% 0%)', duration: 0.8, ease: 'expo.inOut' }, 0.15);
      if (restore) openBtn.focus({ preventScroll: true });
    };
    const onKey = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key === 'Tab') { // focus piégé
        const f = [...root.querySelectorAll<HTMLElement>('a, button')];
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const onLink = (e: MouseEvent) => { if ((e.target as HTMLElement).closest('a')) close(false); };
    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', () => close());
    root.addEventListener('click', onLink);
    addEventListener('keydown', onKey, true);
    return () => { removeEventListener('keydown', onKey, true); document.documentElement.classList.remove('menu-open'); };
  });
}
