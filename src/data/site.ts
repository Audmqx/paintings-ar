// Tout le contenu visible du site.
// HYPOTHÈSES À REMPLACER (placeholder: true) :
//  - email, Instagram, URL de production
import type { ImageMetadata } from 'astro';

export const site = {
  name: 'Maxim Iangaev',
  role: 'Peintre',
  url: 'https://example.com', // placeholder: URL de production
  description:
    'Peintures à l’huile sombres : des figures à peine sorties du fond, des sous-bois traînés à la brosse. Bientôt des gravures et de la dark fantasy.',
  email: 'atelier@example.com', // placeholder
  socials: [{ label: 'Instagram', href: 'https://www.instagram.com/' }], // placeholder
  placeholder: true,
};

export type Slide = { src: ImageMetadata; label: string; note: string; href?: string; alt: string };

// ---- Accueil : à propos et expositions (données fournies par l'artiste) ----
export const about = {
  // Texte de présentation, version sobre demandée par l'artiste.
  lead: 'Peinture, gravure et code.',
  text: [
    'Peinture à l’huile, visages et corps. Kitchen gravure : estampes tirées sur Tetra Pak.',
    'Les toiles ont une animation en réalité augmentée : depuis ce site, avec l’appareil photo d’un téléphone, une 3D codée apparaît sur chacune.',
  ],
  placeholder: false,
};

export type Show = { place: string; title?: string; city: string; kind: 'perso' | 'collective'; note?: string };
export const exhibitions: { year: string; shows: Show[] }[] = [
  { year: '2025', shows: [
    { place: 'Médiathèque de Bram', city: 'Bram', kind: 'perso', note: 'Exposition personnelle' },
    { place: 'La Sauce Bramaise', city: 'Bram', kind: 'collective' },
  ] },
  { year: '2017', shows: [
    { place: 'Cabinet Pisani', city: 'Beaulieu-sur-Mer', kind: 'collective' },
  ] },
  { year: '2016', shows: [
    { place: 'Galerie Chantiers Boîte Noire', title: 'La timidité des cimes', city: 'Montpellier', kind: 'collective' },
    { place: 'Art et Leadership', city: 'Nice', kind: 'collective' },
  ] },
  { year: '2015', shows: [
    { place: '59 Rivoli', city: 'Paris', kind: 'collective', note: 'Lauréat des Canson Art School Awards' },
    { place: 'Château des Évêques', title: 'Partis pris II', city: 'Lavérune', kind: 'collective' },
    { place: 'Le Gai Savoir', title: 'Tout nu dans un corps', city: 'Arles', kind: 'collective' },
    { place: 'Comptoir des Terroirs', city: 'Nice Vallées', kind: 'collective' },
  ] },
];
