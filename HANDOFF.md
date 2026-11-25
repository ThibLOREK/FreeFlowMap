# HANDOFF — Visuel Power BI de cartographie des flux GPS

Document de reprise destiné à un LLM (ou un développeur) qui doit continuer ce projet sans avoir accès à la conversation d'origine. Langue de travail avec l'utilisateur : **français**.

---

## 0. Règles de conduite (à respecter impérativement)

1. **Procéder par étapes, avec validation de l'utilisateur entre chaque étape.** Ne pas produire tout le code d'un coup.
2. À chaque étape : fournir le code complet des fichiers concernés et expliquer les choix techniques.
3. **Ne jamais prétendre qu'une fonctionnalité est opérationnelle si elle n'a pas été testée.** Distinguer explicitement « compile / se package » de « fonctionne dans Power BI Desktop ».
4. Toute limitation liée à Power BI doit être signalée clairement, avec une solution alternative.
5. Ne pas intégrer de clé API fictive. Le fournisseur de tuiles doit être configurable.
6. Éviter les dépendances inutiles. Code modulaire, propre, documenté.
7. L'environnement de développement de l'assistant n'a **pas Power BI Desktop** : tout ce qui dépend du sandbox Power BI (worker `blob:`, WebGL, réseau, interactions natives) est **non vérifiable** côté assistant et doit être testé par l'utilisateur.
8. Messages de commit en français, à l'impératif. Jamais de `git push --force`, de réécriture d'historique ni de suppression de branche sans accord.
9. Pas de commit de `node_modules/`, `.tmp/`, `dist/`, `webpack.statistics.prod.html` (ignorés par `.gitignore`).

---

## 1. Objectif du projet

Développer un **véritable visuel personnalisé Power BI** (Custom Visual SDK), compilable et installable (`.pbiviz`), qui représente des **flux géographiques** entre des coordonnées GPS de départ et d'arrivée, sur un fond cartographique routier interactif. Ce n'est ni une page HTML ni une démo : c'est un projet `pbiviz` exploitable dans Power BI Desktop.

Résultat final recherché : un visuel professionnel avec flèches directionnelles courbes, épaisseur proportionnelle normalisée à une valeur quantitative, gestion intelligente des flux inverses et des superpositions, et fond cartographique routier interactif.

### Technologies imposées

- Power BI Custom Visual SDK
- TypeScript (toute la logique)
- D3.js (rendu et calculs graphiques des flèches)
- MapLibre GL JS (fond cartographique)
- CSS/LESS
- npm

---

## 2. Spécification fonctionnelle complète

### 2.1 Champs de données (glisser-déposer)

| Champ | Type | Obligatoire |
|---|---|---|
| Latitude départ | Nombre décimal | Oui |
| Longitude départ | Nombre décimal | Oui |
| Latitude arrivée | Nombre décimal | Oui |
| Longitude arrivée | Nombre décimal | Oui |
| Valeur quantitative | Nombre | Oui |
| Identifiant du flux | Texte | Non |
| Catégorie | Texte | Non |

- Fonctionne avec des données agrégées **ou** des déplacements individuels.
- La valeur quantitative est agrégée selon le contexte Power BI : somme, nombre, ou mesure DAX.

### 2.2 Fond cartographique (MapLibre GL JS)

- Carte routière : routes, autoroutes, routes secondaires, villes, noms de lieux, informations géographiques principales.
- Zoom avant/arrière, déplacement, **zoom automatique sur les flux affichés**.
- Conservation des coordonnées géographiques lors des déplacements/zooms.
- Gestion correcte du redimensionnement.
- **Fournisseur de tuiles configurable**, pas de clé API fictive.
- Documenter les restrictions réseau et les conditions d'utilisation des fonds de carte dans Power BI.

### 2.3 Représentation des flux

Chaque déplacement = une flèche reliant départ et arrivée, avec : point de départ, point d'arrivée, ligne ou courbe directionnelle, pointe de flèche visible, épaisseur variable, couleur configurable. La pointe indique toujours précisément le sens. Projection correcte des coordonnées sur la carte.

### 2.4 Courbes et superpositions (fonctionnalité essentielle)

Cas à gérer :

- **A — Flux inverses** (A→B et B→A) : courbes distinctes et parallèles, jamais exactement superposées.
- **B — Flux identiques** (A→B plusieurs fois) : agrégation configurable ou décalage visuel. **Par défaut : agréger** les flux de même départ, même arrivée et même catégorie.
- **C — Flux proches** (départs/arrivées proches) : décalage progressif des courbes.
- **D — Croisements** : algorithme limitant croisements et superpositions, avec courbes de Bézier quadratiques ou cubiques.

L'algorithme doit : identifier les flux ayant des segments communs ou proches ; calculer un décalage latéral ; distribuer les courbes autour de leur axe central ; maintenir la séparation visuelle au zoom ; éviter les courbures excessives. **Ne jamais déformer artificiellement les coordonnées GPS** de départ et d'arrivée. Prévoir une gestion particulière des **trajets très courts**.

### 2.5 Épaisseur normalisée

- Échelle de 2 à 12 px, fonction racine carrée par défaut :
  `épaisseur = 2 + 10 × sqrt(valeur / valeur_max)`
  (`valeur_max` = maximum des flux **actuellement affichés**).
- Gérer : valeurs nulles, négatives, identiques, extrêmes.
- Épaisseurs min/max modifiables dans le panneau de formatage.
- **Recalcul après chaque filtrage Power BI.**

### 2.5 bis Pointes de flèche

Intégrées à chaque trajet, orientées dans le sens du déplacement, positionnées près de l'arrivée, proportionnelles à l'épaisseur, visibles même sur flux fins. **Calculées à partir de la tangente de la courbe au point d'arrivée**, pas à partir de l'angle entre les coordonnées GPS.

### 2.6 Couleurs

Modes : couleur unique ; par catégorie ; palette automatique ; selon une mesure quantitative. Configurables dans le panneau de formatage. **Légende** si les couleurs représentent des catégories.

### 2.7 Interactivité Power BI

Sélection d'une flèche ; interaction avec les filtres ; cross-filtering et cross-highlighting si possible ; infobulle au survol (coordonnées GPS, valeur, catégorie, identifiant) ; sélection multiple. Utiliser les mécanismes standards du Power BI Visuals API.

### 2.8 Panneau de formatage

- **Carte** : style du fond, zoom initial, affichage des routes, noms de villes.
- **Flèches** : épaisseur min, épaisseur max, taille des pointes, courbure, espacement des flux inverses, opacité.
- **Couleurs** : couleur principale, couleur par catégorie, couleur des flux sélectionnés.
- **Comportement** : agrégation des flux identiques, infobulles, zoom automatique, nombre maximal de flux affichés.

### 2.9 Performance

Plusieurs milliers de flux. Limitation selon les capacités du SDK, optimisation des calculs géométriques, **mise en cache des coordonnées projetées**, mises à jour ciblées (ne pas reconstruire toute la carte pour un simple changement de sélection), Canvas ou WebGL si SVG/D3 deviennent insuffisants. Ne pas sacrifier la qualité des flèches ni la précision géographique.

### 2.10 Structure de projet demandée

```
src/
  visual.ts
  settings.ts
  data/            dataParser.ts, dataAggregator.ts
  map/             mapManager.ts, projection.ts
  flows/           flowRenderer.ts, curveCalculator.ts, arrowRenderer.ts,
                   collisionManager.ts, thicknessScale.ts
  interactions/    selectionManager.ts, tooltipManager.ts
style/
  visual.less      (convention SDK : le dossier est « style/ », pas « src/styles/ »)
capabilities.json, pbiviz.json, package.json, tsconfig.json, README.md
```

Les fichiers de `data/`, `flows/` et `interactions/` sont créés avec leur étape (pas de squelettes vides en avance).

### 2.11 Livrables finaux

Projet source complet ; tous les fichiers TypeScript ; fichiers de config Power BI ; `.pbiviz` compilé ; jeu de données de démonstration ; documentation d'installation ; documentation du paramétrage des champs ; documentation des limites techniques.

### 2.12 Validation finale (checklist)

1. Le projet s'installe. 2. Compilation TypeScript. 3. Génération du `.pbiviz`. 4. Chargement des données Power BI. 5. Plusieurs flux GPS. 6. Flux inverses. 7. Flux de valeurs très différentes. 8. Filtres Power BI. 9. Redimensionnement. 10. Performances avec plusieurs milliers de lignes.

---

## 3. Plan par étapes et état d'avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Architecture technique + compatibilité des bibliothèques avec le SDK | **Terminée** (compilation validée, voir §4) |
| 2 | Projet structuré + fond cartographique | **Code poussé sur `main` (commit `fec87e7`), NON compilé, NON testé.** En attente des sorties de compilation et du test Desktop de l'utilisateur (voir §9 et §10) |
| 3 | Flux GPS et flèches directionnelles | À faire |
| 4 | Algorithme de courbure et gestion des superpositions | À faire |
| 5 | Épaisseur normalisée | À faire |
| 6 | Interactions Power BI et paramètres (formatage) | À faire |
| 7 | Tests et génération du `.pbiviz` final | À faire |

**Prochaine action** : récupérer les sorties de `npm install`, `tsc`, `npm run lint`, `npm run package` de l'utilisateur sur le code de l'étape 2 et corriger les erreurs éventuelles ; puis son retour du test Desktop ; ensuite seulement, attendre sa validation avant l'étape 3.

---

## 4. Ce qui a été fait (étape 1)

### 4.1 Environnement

- Node 22.23.5, npm 10.9.9 (les outils Power BI exigent Node ≥ 20.19).
- `powerbi-visuals-tools` 7.2.1 installé globalement (`pbiviz`).
- Projet de test créé avec `pbiviz new FlowMap --template default` (l'outil a normalisé le dossier en **`flowMap`**).

### 4.2 Versions validées (installées et compilées ensemble)

| Brique | Version | Remarque |
|---|---|---|
| powerbi-visuals-tools | 7.2.1 | |
| powerbi-visuals-api | 5.11.1 | fixée par le gabarit |
| TypeScript | **5.5.4** | fixé par le gabarit ; la 7.0.2 existe sur npm mais **n'a pas été validée** avec ces outils : ne pas l'utiliser sans test |
| D3 / @types/d3 | 7.9.0 / 7.4.3 | |
| MapLibre GL JS | 6.19.0 (`^6.19.0` dans package.json, figée par package-lock.json) | |
| powerbi-visuals-utils-formattingmodel | 6.0.4 | |
| powerbi-visuals-utils-interactivityutils | 6.0.4 | déclaré « deprecated » par npm (voir §4.6) |
| powerbi-visuals-utils-tooltiputils | 7.1.0 | |

### 4.3 Résultat du test (étape 1)

Un visuel minimal (MapLibre + D3 + worker embarqué) **compile et se package** : `.pbiviz` de ~464 Ko. **Non testé dans Power BI Desktop.**

### 4.4 Pièges découverts (déjà résolus)

1. **MapLibre 6.x : pas d'export par défaut.** Utiliser `import * as maplibregl from "maplibre-gl";` (l'import par défaut échoue : `TS1192`).
2. **Le worker MapLibre ne peut pas être servi à côté du visuel** (un visuel = un seul bundle). Solution : `node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs` (~550 Ko, autonome) est converti en chaîne dans `src/workerSource.ts` par `scripts/gen-worker.mjs`, puis chargé via `URL.createObjectURL(new Blob([WORKER_SOURCE]))` et `maplibregl.setWorkerUrl(url)`. Les fichiers `maplibre-gl-shared*.mjs` sont vides (0 octet) : pas de problème constaté.
3. **`tsconfig.json`** : `"moduleResolution": "bundler"`, `"module": "esnext"`, `"esModuleInterop": true`, `"skipLibCheck": true`.
4. **`pbiviz package` exige** dans `pbiviz.json` : `author.name`, `author.email`, `visual.supportUrl`. Valeurs actuelles **provisoires** (« A renseigner », `a-renseigner@example.com`, `https://example.com/support`) : l'utilisateur a demandé de ne rien mettre pour le moment. `gitHubUrl` pointe désormais vers le dépôt réel.
5. `webpack.statistics.prod.html` est généré à chaque `package` : retiré du dépôt et listé dans `.gitignore`.
6. `pbiviz package` affiche des avertissements « optional features » (Allow Interactions, Color Palette, Context Menu, High Contrast, Highlight Data, Keyboard Navigation, Landing Page, Localizations, Rendering Events, Selection Across Visuals, Tooltips) : fonctionnalités à déclarer/implémenter, **pas des erreurs**. Plusieurs sont utiles ici (Tooltips, Highlight Data, Context Menu, Rendering Events, Selection Across Visuals).

### 4.5 Vérification de la base (25/11/2026, machine de l'utilisateur, Windows)

Avant les modifications de l'étape 2, l'utilisateur a exécuté avec succès : `npm install` (0 vulnérabilité), `npx tsc -v` (5.5.4), `npx tsc --noEmit -p tsconfig.json` (aucune erreur), `npm run lint` (aucune erreur), `pbiviz package` (« Build completed successfully », `.pbiviz` créé). Environnement : Node v26.13.1, npm 11.20.0, Git 2.51.0, powerbi-visuals-tools 7.2.1 (donc **plus récents que Node 22 / npm 10 de l'étape 1, sans problème constaté**).

Messages observés, non bloquants :

- `Create certificate error: 'pwsh' n'est pas reconnu` : `pbiviz` tente de générer un certificat de développement via PowerShell 7 (`pwsh`). Sans effet sur `package`. Concerne `pbiviz start` ; installer PowerShell 7 si besoin.
- `error Some features are going to be required soon ... Format Pane` : le visuel doit déclarer/implémenter le nouveau volet de format (`getFormattingModel`). L'étape 2 l'implémente ; **à confirmer** par un nouveau `package`.
- npm : `powerbi-visuals-utils-interactivityutils@6.0.4` marqué « no longer supported » et `eslint@9.39.5` « no longer supported ». À traiter à l'étape 6 (interactions) ; ne pas changer de version sans test.

---

## 5. Architecture technique retenue

Flux de traitement (en boucle) :

```
Power BI (dataView, filtres, formatage)
   → Données (dataParser, dataAggregator)
   → Carte MapLibre (mapManager, projection : GPS → pixels)
   → Géométrie en pixels (curveCalculator, collisionManager, thicknessScale)
   → Rendu sur la carte (arrowRenderer, flowRenderer : SVG ou Canvas)
   → Interactions (selectionManager, tooltipManager)
   → Power BI (sélection, infobulles)
```

Décisions clés :

- **MapLibre sous le visuel**, une **couche D3/SVG superposée** pour les flux, recalculée à chaque événement `move` / `zoom` / `resize` de la carte.
- **Géométrie calculée en pixels après projection**, avec décalages latéraux en pixels : la séparation reste constante au zoom, et les points GPS de départ/arrivée ne sont jamais déplacés. Les courbes (Bézier) sont recalculées à chaque changement de vue.
- **Rendu hybride** : SVG jusqu'à environ 2 000 flux, **Canvas au-delà** (bascule automatique). Seuil indicatif à valider par mesure.
- **Cache des coordonnées projetées** (`ProjectionCache`, vidé sur `move`/`resize`) ; une simple modification de sélection ne doit pas reconstruire la carte ni recalculer la géométrie.
- Tangente de la courbe au point d'arrivée pour orienter la pointe.
- Agrégation par défaut des flux identiques (même départ + arrivée + catégorie) dans `dataAggregator`.
- **Mapping de données `table`** (confirmé par l'utilisateur) : une ligne = un flux avec 4 coordonnées ; `dataReductionAlgorithm.window.count = 30000` dans `capabilities.json` (le SDK limite par défaut le nombre de lignes ; à documenter et à tester, voir `fetchMoreData`).

---

## 6. Décisions de l'utilisateur

1. **Fond de carte** : **OpenFreeMap confirmé**, style par défaut `https://tiles.openfreemap.org/styles/liberty`, URL configurable dans le panneau de formatage. Conditions vérifiées sur openfreemap.org/tos (consultées le 25/11/2026) : service gratuit, sans clé ni inscription, usage commercial possible, fourni « tel quel » sans garantie, attribution à conserver (MapLibre l'affiche). Le service peut changer ou disparaître : à documenter dans le README. Les tuiles OSM officielles (`tile.openstreetmap.org`) sont déconseillées pour un usage intensif.
2. **Auteur** : « rien pour le moment » → valeurs provisoires conservées dans `pbiviz.json`. **À redemander avant toute diffusion.**
3. **Test Power BI Desktop** : l'utilisateur **peut** tester les `.pbiviz` au fil des étapes.
4. **Compilation** : l'assistant n'a pas de shell ; l'utilisateur lance les commandes (protocole en §8) et renvoie les sorties. Pas de GitHub Action pour l'instant.
5. **Mapping `table`** : confirmé.
6. **Workflow Git** : l'utilisateur a demandé de **pousser directement sur `main`** (pas de branche ni de PR pour l'instant), contrairement à la méthode initiale. L'assistant écrit via l'API GitHub avec confirmation avant chaque écriture.

---

## 7. Risques et points non vérifiés (à ne jamais présenter comme acquis)

- **Code de l'étape 2 jamais compilé** par l'assistant : API `formattingSettings` (6.0.4), types MapLibre 6.19 (`e.error`, `LngLatBounds`, `fitBounds`), règles ESLint Power BI.
- **Sandbox Power BI** : acceptation du worker `blob:`, de WebGL, de la politique CSP → **non testé**. Repli prévu : rendu MapLibre sans worker, ou fond de carte en **tuiles raster**.
- **Accès réseau aux tuiles** : `WebAccess` déclaré uniquement pour `https://tiles.openfreemap.org`. Si le style charge des sprites, polices ou tuiles depuis d'autres domaines, ils sont bloqués : **domaines réels à relever lors du test Desktop**.
- **Certification** : un visuel qui fait des appels réseau externes **ne peut pas être certifié** par Microsoft ; les administrateurs de tenant peuvent le bloquer. À documenter dans le README.
- **Cross-filtering / highlighting** : dépend du mapping des lignes à des `ISelectionId` ; à tester dans Desktop.
- **Seuil SVG → Canvas** (~2 000 flux) : indicatif, à mesurer.
- **Limite de lignes** : fenêtrage du SDK (30 000 déclarés, non testé) ; à documenter dans les limites techniques.
- `package-lock.json` : le champ `name` du lock est encore `visual` ; il sera mis à jour au prochain `npm install` (à committer).

---

## 8. Commandes utiles (Windows / PowerShell)

```powershell
npm install -g powerbi-visuals-tools@7.2.1   # une fois
cd E:\Git\FreeFlowMap
git pull
npm install
npx tsc --noEmit -p tsconfig.json
npm run lint
npm run package      # IMPORTANT : passe par le script npm, donc par "prepackage" (régénère src/workerSource.ts)
npm run gen-worker   # régénère le worker seul (après mise à jour de maplibre-gl)
```

`pbiviz package` lancé directement **ne déclenche pas** `prepackage` (suffisant tant que `src/workerSource.ts` est à jour). `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` peut être nécessaire si PowerShell bloque npm.

Erreurs déjà rencontrées :

| Erreur | Cause | Correctif |
|---|---|---|
| `Author information` / `supportUrl is not specified` | métadonnées manquantes dans `pbiviz.json` | renseigner `author`, `supportUrl` |
| `TS1192: Module ... has no default export` | MapLibre 6.x | `import * as maplibregl` |
| `Error parsing bundle asset ... visual.js` | conséquence d'une erreur TypeScript | corriger l'erreur TS d'abord |
| `'pwsh' n'est pas reconnu` | génération du certificat de dev | ignorable pour `package` |

---

## 9. Étape 2 : contenu poussé (commits `fec87e7`, `d7300b3`)

- `.gitignore` ; `webpack.statistics.prod.html` retiré du dépôt.
- `scripts/gen-worker.mjs` + scripts npm `gen-worker`, `prestart`, `prepackage`.
- `package.json` : `name` = `flowmap`, description, dépôt ; **aucune version de dépendance modifiée**.
- `pbiviz.json` : seul `gitHubUrl` modifié.
- `capabilities.json` : 7 rôles (`latStart`, `lonStart`, `latEnd`, `lonEnd`, `value`, `flowId`, `category`), mapping `table`, `privileges` WebAccess, objet de formatage `map` (`styleUrl`, `initialZoom`, `autoZoom`).
- `src/settings.ts` : `VisualFormattingSettingsModel` avec la carte « Carte » ; constantes `DEFAULT_STYLE_URL`, `DEFAULT_ZOOM`.
- `src/map/mapManager.ts` : création de la carte (style par URL, centre par défaut France, zoom), `applySettings`, `resize`, `fitToPoints` (hook du zoom automatique, non appelé avant l'étape 3), `destroy`, callbacks d'erreur/chargement.
- `src/map/projection.ts` : `ProjectionCache` (`map.project()` + cache vidé sur `move`/`resize`).
- `src/visual.ts` : worker blob configuré une seule fois, carte + calque SVG D3 superposé (`pointer-events: none`), boîte d'état pour afficher les erreurs de carte, `getFormattingModel`, `destroy`. **Aucun rendu de flux.**
- `autoZoom` est déclaré mais **pas encore utilisé**.
- Pas encore fait : jeu de données de démonstration (CSV), README, icône et textes localisés.

---

## 10. Tests attendus de l'utilisateur pour l'étape 2 (résultats non encore reçus)

Compilation : `git pull`, `npm install`, `npx tsc --noEmit -p tsconfig.json`, `npm run lint`, `npm run package` ; renvoyer les sorties complètes.

Power BI Desktop :

1. Importer `dist/*.pbiviz`.
2. Ajouter le visuel : la carte de France doit s'afficher (routes, villes, attribution).
3. Déplacer, zoomer, redimensionner.
4. Changer « Carte > URL du style » et « Zoom initial » dans le volet Format.
5. Relever toute erreur (boîte rouge/blanche en haut à gauche, console F12 si disponible) : worker `blob:`, WebGL, domaines bloqués.
6. Glisser des colonnes dans les 7 champs de données (aucun flux dessiné à ce stade).

---

## 11. Autres éléments de contexte

- L'utilisateur est en France (fuseau Europe/Paris), s'exprime en français, travaille sous Windows (`E:\Git\FreeFlowMap`).
- L'assistant n'a accès qu'à l'API GitHub (pas de shell) : toute compilation/lint/test passe par l'utilisateur.
