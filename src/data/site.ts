// Tout le contenu visible du site.
// HYPOTHÈSES À REMPLACER (placeholder: true) :
//  - email, Instagram, URL de production
//  - titres des toiles (titres de travail descriptifs), année, technique, format
//  - photos : la toile « Cinq hommes » n'existe qu'en 1080 px (capture Instagram) : fournir des scans HD.
import type { ImageMetadata } from 'astro';
import sousBois from '../assets/sous-bois.jpg';
import sousBoisChevalet from '../assets/sous-bois-chevalet.jpg';
import sousBoisFigures from '../assets/sous-bois-figures.jpg';
import sousBoisLumiere from '../assets/sous-bois-lumiere.jpg';
import cinqHommes from '../assets/cinq-hommes.jpg';
import cinqHommesMains from '../assets/cinq-hommes-mains.jpg';
import cinqHommesVisage from '../assets/cinq-hommes-visage.jpg';

export type Detail = { src: ImageMetadata; alt: string; caption: string };

export type Work = {
  slug: string;
  title: string;
  summary: string;
  year: string;
  medium: string;
  size: string;
  image: ImageMetadata;
  alt: string;
  notes: { heading: string; text: string }[];
  details: Detail[];
  studio?: Detail;
  placeholder?: boolean;
};

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

export const works: Work[] = [
  {
    slug: 'sous-bois',
    title: 'Sous-bois, deux figures',
    summary: 'Deux silhouettes au fond d’une forêt, dans la seule clairière de lumière jaune.',
    year: '2025',
    medium: 'Huile sur toile',
    size: 'Format à préciser',
    image: sousBois,
    alt: 'Forêt sombre peinte en longues traînées verticales grises, une lumière jaune-vert au centre, deux figures floues, l’une rose, l’autre bleue, au pied des arbres.',
    notes: [
      {
        heading: 'Le fond',
        text: 'Les troncs ne sont pas dessinés, ils sont traînés. Chaque passage de brosse descend, laisse le grain de la toile apparaître, et la forêt se construit par recouvrement.',
      },
      {
        heading: 'La lumière',
        text: 'Le jaune ne vient pas d’un ciel. Il est posé entre les troncs, comme si la clairière éclairait de l’intérieur. Tout le reste reste gris et froid.',
      },
      {
        heading: 'Les figures',
        text: 'Deux personnes, une en rose, une en bleu pâle. Elles arrivent en dernier et restent à moitié prises dans les traînées, on ne sait pas si elles entrent ou si elles s’effacent.',
      },
    ],
    details: [
      { src: sousBoisLumiere, alt: 'Détail : traînées jaune-vert et grises, une tache de blanc cassé en haut.', caption: 'La clairière, au centre de la toile.' },
      { src: sousBoisFigures, alt: 'Détail : deux figures floues, rose et bleu pâle, au milieu des traînées sombres.', caption: 'Les deux figures, prises dans les traînées.' },
    ],
    studio: { src: sousBoisChevalet, alt: 'La toile posée sur un chevalet en bois devant un mur gris, à l’atelier.', caption: 'À l’atelier, sur le chevalet.' },
    placeholder: true,
  },
  {
    slug: 'cinq-hommes',
    title: 'Cinq hommes inclinés',
    summary: 'Cinq hommes en costume penchés au-dessus d’une table, les visages défaits par la matière.',
    year: '2025',
    medium: 'Huile sur toile',
    size: 'Format à préciser',
    image: cinqHommes,
    alt: 'Cinq hommes en costume sombre penchés vers une table sur fond brun-noir, visages et mains peints en empâtements roses et blancs, bande magenta au bas de la toile.',
    notes: [
      {
        heading: 'Le fond',
        text: 'Presque noir, chaud, brun. Les costumes s’y fondent : on lit les corps par les bords, un col, une épaule, un revers.',
      },
      {
        heading: 'La matière',
        text: 'Les visages et les mains sont montés en pâte épaisse, roses, blancs, un peu de jaune. Plus la figure est proche, plus elle se défait.',
      },
      {
        heading: 'La table',
        text: 'Une seule bande de couleur pure en bas, magenta. C’est elle qui tient la composition et qui donne le sol à ces cinq hommes courbés.',
      },
    ],
    details: [
      { src: cinqHommesMains, alt: 'Détail : deux mains peintes en empâtements roses et blancs sur un costume noir.', caption: 'Les mains, montées en pâte.' },
      { src: cinqHommesVisage, alt: 'Détail : un visage penché, défait en touches roses, blanches et jaunes.', caption: 'Le cinquième homme, le visage effacé par la matière.' },
    ],
    placeholder: true,
  },
];

// Sélection du carrousel d'accueil : les toiles, puis leurs détails et l'atelier (chaque entrée renvoie à sa toile).
export type Slide = { src: ImageMetadata; label: string; note: string; href?: string; alt: string };
const [sb, ch] = works;
export const selection: Slide[] = [
  { src: sb.image, label: sb.title, note: 'Toile', href: `/oeuvres/${sb.slug}/`, alt: sb.alt },
  { src: ch.image, label: ch.title, note: 'Toile', href: `/oeuvres/${ch.slug}/`, alt: ch.alt },
  { src: sb.details[0].src, label: sb.title, note: 'Détail, la clairière', href: `/oeuvres/${sb.slug}/`, alt: sb.details[0].alt },
  { src: ch.details[0].src, label: ch.title, note: 'Détail, les mains', href: `/oeuvres/${ch.slug}/`, alt: ch.details[0].alt },
  { src: sb.studio!.src, label: sb.title, note: 'À l’atelier', href: `/oeuvres/${sb.slug}/`, alt: sb.studio!.alt },
  { src: sb.details[1].src, label: sb.title, note: 'Détail, les figures', href: `/oeuvres/${sb.slug}/`, alt: sb.details[1].alt },
  { src: ch.details[1].src, label: ch.title, note: 'Détail, le cinquième homme', href: `/oeuvres/${ch.slug}/`, alt: ch.details[1].alt },
];

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
