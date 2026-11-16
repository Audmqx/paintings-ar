# DESIGN.md — portfolio de peintures

## Brief

- **Sujet :** une peintre à l'huile. Deux toiles pour l'instant, sombres, figures à peine sorties d'un
  fond brun-noir. Suite annoncée : toiles classiques sombres et gravures, univers dark fantasy.
- **Public :** amateurs, galeristes, visiteurs d'exposition (souvent sur téléphone, devant la toile).
- **Rôle du site :** montrer les toiles en vrai, donner envie d'écrire, préparer le mode AR
  (8th Wall, image targets) qui animera les toiles physiques. L'AR n'est pas dans cette passe.
- **Langue :** français.
- **Hypothèses (placeholders, voir `src/data/site.ts`) :** nom de l'artiste, titres, année,
  technique, format, email, Instagram, URL de production.

## Phase 1 — Concepts

| | A. Traîné (matière) | B. La plaque (gravure) | C. Veillée (dark fantasy) |
|---|---|---|---|
| Idée | Tout arrive sur la page comme un coup de brosse traîné vers le bas sur un fond sombre | Le site est une plaque encrée : chaque contenu est essuyé puis imprimé | Le site est éclairé par une seule flamme, les toiles sortent de l'ombre autour du pointeur |
| Ancre | Les deux toiles sont faites de traînées verticales sur un fond brun-noir (la forêt surtout, les costumes des hommes aussi) | Les gravures annoncées | Le genre dark fantasy |
| Signature | Les toiles se révèlent colonne par colonne, chaque traînée à sa vitesse, comme peintes devant vous | Hachures qui se remplissent | Halo autour du curseur |
| O/F/Fe/P | 4 / 5 / 4 / 2 | 3 / 3 / 3 / 3 (pas encore de gravures à montrer) | 2 / 3 / 5 / 5 (lampe torche = cliché, transposable partout) |

**Choix : A.** Il vient de la main de l'artiste (le geste visible dans les deux toiles), il donne
une règle pour tout (révélation, transition, survols, fond) et il prépare l'AR : la toile
« bouge » déjà sur le site. B fournit un détail : les métadonnées sont composées comme la lettre
sous une gravure (titre, technique, format), petites capitales centrées.

## Concept Card

```
Idée :        Tout ce qui apparaît ici est traîné vers le bas, comme la brosse sur le fond sombre des toiles.
Métaphore :   l'atelier : fond brun-noir posé d'abord, couleur tirée par-dessus en traînées verticales.
Signature :   révélation GL « traînée » : chaque toile se peint colonne par colonne, à vitesses inégales,
              avec une bavure de pigment au front qui disparaît. Au repos, la toile est rendue exacte.
Émotion :     3 premières secondes : silence, obscurité, puis la forêt qui coule sur l'écran.
Verbe :       traîner (drag down) : départ lent, coulée, arrêt net.
Capture :     le nom immense en Melodrama à gauche, la forêt à moitié traînée à droite.
```

## Phase 2 — Système

**Palette** (échantillonnée sur les toiles)
- `ground` #120e0d — brun-noir du fond des « Cinq hommes »
- `ink` #ece4d8 — blanc de plomb des rehauts (empâtements des visages)
- `muted` #a0968a — gris chaud des troncs (AA sur ground)
- `line` rgb(236 228 216 / 0.14)
- `accent` #c27a9f — garance-magenta du bord de table, rare : focus, soulignés, survols
- `curtain` #231917 — terre d'ombre brûlée, colonnes de transition
- Le vert lichen de la forêt (#b9b77a) n'existe que dans les toiles, jamais dans l'UI (évite le cliché noir + vert acide).

**Type**
- Display : **Melodrama** (Fontshare), condensée à fort contraste : ses fûts verticaux répondent aux traînées. Interlignage 0.86, tracking -0.02em, toujours en capitales/bas de casse naturelles, jamais d'italique.
- Texte et UI : **Switzer** 400/500, 16–18 px, UI 13 px.
- Lettre de gravure : Switzer 500 petites capitales espacées +0.08em, 12 px.

**Grille** : 12 colonnes, gouttière fluide. Trois lignes fortes : col 1, col 7, col 10.
Rythme : hero plein écran collant (190svh), œuvres en paires asymétriques « airy », atelier « normal », finale pleine hauteur.

**Forme** : rayon 0 partout (toiles = rectangles).

**Mouvement** : `expo.out` pour les entrées, `expo.inOut` pour les colonnes. Le verbe « traîner » :
- révélations texte : lignes qui descendent depuis le haut (yPercent -110 → 0), pas qui montent ;
- transition de page : 9 colonnes terre d'ombre de largeurs inégales qui coulent du haut, chacune avec son retard, puis continuent vers le bas ;
- survol nav : roulement vers le bas ;
- survol toile : bavure verticale locale sous le pointeur (petite, la toile reste lisible) + légende qui descend ;
- repos : le fond GL porte des traînées très sombres qui glissent lentement vers le bas et se tendent avec la vitesse de défilement. Les toiles, elles, ne bougent jamais au repos (fidélité à l'œuvre).

**Composition**

```
/  HERO (poster, sticky)        ŒUVRES (paires asymétriques)        ATELIER (statement)          FINALE
┌───────────────────────────┐   ┌───────────────────────────┐   ┌──────────────────────────┐  ┌──────────────────────┐
│nom            Œuvres Atelier  │ [toile 7 col]   01 titre  │   │  texte t-l sur 9 col     │  │ ÉCRIRE (mega)        │
│MEL            ┌────────┐  │   │                 lettre    │   │  col 1 → 9               │  │ email   instagram    │
│ODRA           │ forêt  │  │   │        titre  [toile 8col]│   │           ↓ 3 lignes     │  │ © année   colophon   │
│MA             │ GL     │  │   │        lettre             │   │           de faits       │  └──────────────────────┘
│ligne          └────────┘  │   └───────────────────────────┘   └──────────────────────────┘
└───────────────────────────┘
/oeuvres/<slug> : titre mega + lettre de gravure → toile pleine hauteur → notes (pair) → détails (mur) → atelier (photo chevalet, si dispo) → œuvre suivante
/404 : « Rien n'a encore été peint ici. » sur une toile vide (cadre de la bonne proportion), lien retour.
```

**Genericness test** : un modèle générique aurait fait « galerie sombre + serif italique + survol zoom ».
Changé : la serif italique devient une condensée verticale (Melodrama) ; le zoom et le split chromatique
par défaut du moteur sont supprimés (ils abîment la peinture) au profit de la traînée ; le rideau
plein devient des colonnes de traînées ; les reveals montent → descendent.

**Mouvement au repos** : oui, porté par le fond GL (traînées). Sous reduced-motion : tout immobile, fond uni.

---

## V2 (2026-11-13) — « Nocturne traîné », WebGL d'abord

Demande : nom réel (Maxim Iangaev), presque plus de titres, plus de Three.js/WebGL, un carrousel
WebGL infini de toiles sur l'accueil. Références observées : Santioni Spirits (fond anthracite brossé
à sec, grain, display Art nouveau, illustrations en gravure, cadres dessinés) et Immersive Garden
(presque aucun texte, UI minuscule aux coins, matière en WebGL). Rien n'est repris tel quel.

```
Idée :        Les toiles sont accrochées dans le noir sur un mur courbe ; seule celle du centre reçoit la lumière.
Signature :   carrousel Three.js infini (src/motion/carousel.ts) : en mouvement la peinture coule vers le bas
              selon la vitesse (traîné), au repos la toile centrale est exacte ; clic = zoom dans la toile puis page.
Verbe :       traîner (inchangé).
Capture :     MAXIM en contour au-dessus, IANGAEV plein en dessous, la forêt en pleine lumière au centre.
```

- Moteur : OGL remplacé par Three.js, un seul WebGLRenderer (fond + calques + plans DOM), horloge GSAP.
- Accueil : une seule scène 100svh, pas de défilement de page ; molette, glisser, flèches, focus clavier, toucher.
  Index 01–07 (liens réels) en bas à droite, légende en bas à gauche.
- Sans GL : bande horizontale scroll-snap des vraies images sous le nom (composée, pas cassée).
- Titres retirés : section « Œuvres », intertitres des notes. L'atelier et le contact ont leur page `/atelier/`.
- Au repos : le fond brossé glisse, le mur dérive très lentement après 4 s sans interaction.

---

## V3 (2026-11-13) — une seule page, Tainted Grail, toile brute

Retours : plus d'or (trop Elden Ring), très sombre façon Tainted Grail ; une seule page (pas de pages
d'œuvres ni d'atelier, un clic ne doit rien ouvrir) ; défilement vertical ; aucune déformation des toiles ;
pas de numéros ; un « + » à côté de chaque toile pour zoomer.

- Accueil = colonne infinie verticale (src/motion/carousel.ts). Toiles exactes au repos ; en mouvement
  léger flou vertical + désaturation + la toile se creuse un peu, retour net à l'arrêt.
- « + » qui suit chaque toile (SVG, gardé dans l'écran) → zoom : la toile déborde l'écran, le pointeur
  ou le doigt la parcourt ; ×, Échap ou clic pour fermer.
- Fond : toile de lin brute très sombre (trame tissée procédurale), à peine visible, lumière rasante
  qui suit le pointeur (src/engine/gl/shaders.ts groundFragment). Choisi par l'utilisateur parmi
  4 pistes, après refus : dorée, hachures de gravure, astrolabe + rais.
- Cendre qui tombe (src/motion/embers.ts). Loader : nuit, nom en IM Fell English SC, fil de progression ;
  le nom glisse jusqu'au coin et devient l'en-tête.
- Palette : encre #070707, os terni #c8c3b5, lichen mort #80857d, sang séché #9e4436 (filets seulement).
- Perf : aucun filtre CSS (blur, drop-shadow) au-dessus du canvas, ils faisaient tomber le GPU à < 1 i/s.
- À venir : une page pour classer peintures et gravures (par année ou par thème, pas encore décidé).

---

## ÉTAT AU 2026-11-13 (fin de session) — à reprendre ici

Fait :
- Menu plein écran (src/components/Header.astro + src/motion/menu.ts) : Accueil, Nouvelles toiles, Old works 2013-2017, Écrire, Instagram.
- /nouvelles-toiles/ : colonne infinie (src/components/Column.astro + src/motion/carousel.ts) avec la sélection récente.
- /old-works/ : même colonne, 18 toiles du profil Saatchi Art (src/data/old-works.ts, images HD 1920 px dans src/assets/old/).
  3 toiles datées 2018 gardées (à confirmer), 4 « print only » sans format.

En cours (nouvelle page d'accueil « à propos + expositions ») :
- src/pages/index.astro : écrit (hero nom, à propos, expositions par année, portes vers les toiles).
- src/motion/corridor.ts : écrit et branché dans setup.ts. Galerie 3D Three.js : la caméra avance dans une nef
  au défilement, toiles accrochées sur les deux murs, sortent de la brume à l'approche.
- Données : src/data/site.ts → `about` (texte factuel à faire relire par l'artiste) et `exhibitions`.
- CSS de l'accueil fait (fin de src/styles/site.css). Vérifié : astro check 0 erreur, build OK, captures Playwright
  desktop / 390 px / reduced motion sans erreur console ni débordement horizontal. Reste : /jury.
- untitled-2016 (photo d'accrochage, mur blanc) retirée de la nef ; toujours sur /old-works/ (à remplacer par une vraie photo de la toile).
- Galerie 3D de toiles en fond SUPPRIMÉE (corridor.ts) à la demande de l'artiste : « ça ne va pas du tout ».
- Fil conducteur v4 (src/motion/armor.ts) : seulement les gants croisés sur le pommeau, pris dans les roses
  (détail de « The Forgotten Knight », dark_igorek, CC BY 4.0, crédit en pied de page). public/models/gauntlets.glb
  = pose figée + découpe de la zone des mains (x -0.42..0.52, y 1.42..2.0 en unités du modèle), meshopt + WebP 1024,
  3,6 Mo. Source complète dans .assets-src/ (ignoré par git). Recréer : page de débogage (voir historique) puis
  `npx gltf-transform optimize raw.glb out.glb --texture-compress webp --texture-size 1024 --compress meshopt --simplify false`.
  Découpe v2 : mains + épée entière + roses autour de la lame, simplifiée (ratio 0,35) : 3,4 Mo.
  Gants visibles dès l'arrivée (voile CSS --cover qui s'efface, shaders précompilés par compileAsync), à peine éclairés ;
  la caméra descend le long de la lame (DROP 1,3) et la bougie monte jusqu'à 60 % de la page.
  Pas de second lissage du défilement (Lenis lisse déjà) : c'était la « traîne » ressentie comme du lag.
  Rendu plafonné à 1,5x la résolution sur desktop (engine/gl). Réglé sur GPU réel (Intel) : le rendu logiciel
  (swiftshader) des captures Playwright est bien plus sombre et lent que la réalité.
  Rotation légère (0,7 rad sur la page), caméra qui s'approche un peu. Cadrage plein écran, centré.
  Lumière : une seule bougie (PointLight chaude, décroissance physique) juste devant les mains, qui tremble et
  bouge à peine ; reflet d'atelier quasi nul ; vignette CSS fixe (.home.is-live::before) : pourtour presque noir.
  Rejetés : v1 traînée 2D, v2 ruban de peinture 3D, v3 armure entière (« on ne distingue rien »).
  Sans GL / mouvement réduit : page texte seule (à remplacer par une image fixe des gants).
- Textes (src/motion/home.ts) : grands titres pleine largeur « Expositions » et « Les toiles » (lettres scrubbées),
  phrase d'ouverture allumée mot à mot, nom qui se laisse traîner en quittant le premier écran, portes en lettres.
- Reste : /jury (critique externe), og.png, URL de production.
- Attention : la page d'accueil défile (Lenis) contrairement aux pages colonnes ; la colonne capte la molette.

En attente de l'artiste :
- Export Instagram REÇU (2026-11-14) : extrait dans instagram/ (ignoré par git ; seulement posts + médias, pas les
  messages). index.json (légendes réparées), tri.json + tri.html (tri proposé, à valider par l'artiste).
  Trouvé : affiche « Résonance », Médiathèque de Bram, 18 nov.-7 déc. 2025 ; article de presse 2017
  « Création dans la destruction ». Ancien texte : proposer les catégories (proposition faite : périodes dans le menu + thèmes en filtre :
  visages défaits, ateliers, figures et groupes, sous-bois).
- URL de production, email, lien Instagram exact, og.png, titres/années/formats des nouvelles toiles.

Outils : le navigateur chrome-devtools MCP fige souvent (rAF bloqué) ; vérifier plutôt avec Playwright
(~/.cache/jury, script ~/.cache/jury/check.mjs, build + serve dist sur 127.0.0.1:4400).

## Périodes (2026-11-14)

Choix de l'artiste : sur le site, peintures + dessins, classés par période.
- Menu : Accueil, 2021 à aujourd'hui (/nouvelles-toiles/ : les 2 nouvelles toiles + 17 Instagram), 2018-2020
  (/2018-2020/ : 51 Instagram), 2013-2017 (/old-works/ : 18 Saatchi HD + 57 Instagram).
- src/data/instagram.ts généré depuis instagram/tri.json (script dans l'historique de session) ; images dans
  src/assets/ig/. 18 doublons des toiles Saatchi écartés (comparaison visuelle) ; la publication 124 remplace la
  photo d'accrochage de « Untitled 2016 » (src/assets/old/untitled-2016.jpg).
- Titres « Sans titre » et textes alternatifs génériques : à préciser par l'artiste.
- Colonne : les textures se chargent à l'approche (data-tex/data-ratio dans Column.astro), images DOM lazy.

## Téléphone : fluidité (2026-11-14)
- #gl en 100lvh et resize() du moteur basé sur la taille de #gl, ignoré si inchangé : la barre d'adresse qui
  apparaît/disparaît au défilement ne réalloue plus le canvas (cause des à-coups au doigt).
- Résolution de rendu 1x sur téléphone (1,5x desktop).
- public/models/gauntlets-mobile.glb : simplifié 0,12, textures 512, 1,1 Mo (desktop : gauntlets.glb, 3,4 Mo).
- Tester la fluidité sur la version de production (astro preview --host), pas sur le serveur de dev.
- La scène des gants est pilotée par GSAP : ScrollTrigger + scrub (1,2 s au doigt, 0,5 s à la molette) sur un proxy
  { v } ; le scrub lisse les à-coups du défilement natif des téléphones.
- Diagnostic : ?fps (images/s + pire image), ?no3d (sans les gants), ?nobg (sans le fond animé).
- Transition de page : les colonnes du rideau passent par la Web Animations API (compositeur) et non GSAP :
  fluides même quand la nouvelle page se construit (gants, textures, SplitText). Ease = cubic-bezier(0.87,0,0.13,1).
- centerOnVisible(cam) (engine/gl) : décale la projection (setViewOffset) de la moitié de (100lvh - innerHeight),
  pour que toiles et gants restent au milieu de l'écran visible quand la barre d'adresse du téléphone est affichée.
- Rideau v2 : courbe cubic-bezier(0.65,0,0.35,1), 1,1 s à l'aller / 1,25 s au retour, décalage 70 ms par colonne.
  pauseGL(true) quand l'écran est couvert, pauseGL(false) quand le rideau est parti (GPU libre pendant la transition).
- Crédit CC BY du modèle retiré du pied de page à la demande de l'artiste (2026-11-14) : À REMETTRE ailleurs
  (page ou mention « Crédits ») avant la mise en ligne, la licence l'exige.
- Rideau : chaque animation fait commitStyles() puis cancel() à la fin : la position des bandes survit à l'échange
  de page d'Astro (avant, le rideau se rouvrait pendant l'échange et la nouvelle page apparaissait trop tôt).
