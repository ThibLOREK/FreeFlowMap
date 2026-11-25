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
7. L'environnement de développement de l'assistant est Linux, **sans Power BI Desktop** : tout ce qui dépend du sandbox Power BI (worker `blob:`, WebGL, réseau, interactions natives) est **non vérifiable** côté assistant et doit être testé par l'utilisateur.

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

### 2.11 Livrables finaux

Projet source complet ; tous les fichiers TypeScript ; fichiers de config Power BI ; `.pbiviz` compilé ; jeu de données de démonstration ; documentation d'installation ; documentation du paramétrage des champs ; documentation des limites techniques.

### 2.12 Validation finale (checklist)

1. Le projet s'installe. 2. Compilation TypeScript. 3. Génération du `.pbiviz`. 4. Chargement des données Power BI. 5. Plusieurs flux GPS. 6. Flux inverses. 7. Flux de valeurs très différentes. 8. Filtres Power BI. 9. Redimensionnement. 10. Performances avec plusieurs milliers de lignes.

---

## 3. Plan par étapes et état d'avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Architecture technique + compatibilité des bibliothèques avec le SDK | **Terminée** (validée en compilation, voir §4) |
| 2 | Création du projet structuré + fond cartographique | **À faire — attend la validation de l'utilisateur** |
| 3 | Flux GPS et flèches directionnelles | À faire |
| 4 | Algorithme de courbure et gestion des superpositions | À faire |
| 5 | Épaisseur normalisée | À faire |
| 6 | Interactions Power BI et paramètres (formatage) | À faire |
| 7 | Tests et génération du `.pbiviz` final | À faire |

**Prochaine action : étape 2**, une fois que l'utilisateur a répondu (ou accepté les valeurs par défaut) aux trois points de la section 6.

---

## 4. Ce qui a été fait (étape 1)

### 4.1 Environnement

- Node 22.23.5, npm 10.9.9 (les outils Power BI exigent Node ≥ 20.19).
- `powerbi-visuals-tools` 7.2.1 installé globalement (`pbiviz`).
- Projet de test créé avec `pbiviz new FlowMap --template default` (l'outil a normalisé le dossier en **`flowMap`**).
- Répertoire de travail utilisé : `/home/claude/work/flowMap` (peut ne pas persister ; l'utilisateur a reçu un zip des sources et le `.pbiviz` de test).

### 4.2 Versions validées (installées et compilées ensemble)

| Brique | Version | Remarque |
|---|---|---|
| powerbi-visuals-tools | 7.2.1 | |
| powerbi-visuals-api | 5.11.1 | fixée par le gabarit |
| TypeScript | **5.5.4** | fixé par le gabarit ; la 7.0.2 existe sur npm mais **n'a pas été validée** avec ces outils : ne pas l'utiliser sans test |
| D3 / @types/d3 | 7.9.0 / 7.4.3 | |
| MapLibre GL JS | 6.19.0 | |
| powerbi-visuals-utils-formattingmodel | 6.0.4 | |
| powerbi-visuals-utils-interactivityutils | 6.0.4 | |
| powerbi-visuals-utils-tooltiputils | 7.1.0 | |

### 4.3 Résultat du test

Un visuel minimal (MapLibre + D3 + worker embarqué) **compile et se package** : `.pbiviz` de ~464 Ko. **Non testé dans Power BI Desktop.**

### 4.4 Pièges découverts (déjà résolus dans le projet de test)

1. **MapLibre 6.x : pas d'export par défaut.** Utiliser `import * as maplibregl from "maplibre-gl";` (l'import par défaut échoue : `TS1192`).
2. **Le worker MapLibre ne peut pas être servi à côté du visuel** (un visuel = un seul bundle). Solution retenue : `node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs` (~550 Ko, autonome) est lu par un script et converti en chaîne dans `src/workerSource.ts` (`export const WORKER_SOURCE: string = "..."`), puis :
   ```ts
   const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
   maplibregl.setWorkerUrl(url);
   ```
   Script de génération (à transformer en étape de pré-build npm, ex. `"prepackage"` / `"prestart"`) :
   ```js
   import { readFileSync, writeFileSync } from "node:fs";
   const src = readFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "utf8");
   writeFileSync("src/workerSource.ts", "export const WORKER_SOURCE: string = " + JSON.stringify(src) + ";\n");
   ```
   Les fichiers `maplibre-gl-shared*.mjs` sont vides (0 octet) dans cette version : ils n'ont pas posé de problème.
3. **`tsconfig.json`** : ajout de `"moduleResolution": "bundler"`, `"module": "esnext"`, `"esModuleInterop": true`, `"skipLibCheck": true`.
4. **`pbiviz package` exige** dans `pbiviz.json` : `author.name`, `author.email`, `visual.supportUrl` (et `gitHubUrl` si présent). Valeurs actuelles **provisoires** (« A renseigner », `a-renseigner@example.com`, `https://example.com/support`, `https://example.com/repo`). À remplacer par celles de l'utilisateur.
5. `webpack.statistics.prod.html` est généré à chaque `package` (à ignorer / mettre dans `.gitignore`, comme `.tmp/`, `dist/`, `node_modules/`).
6. `pbiviz package` affiche des avertissements « optional features » (Color Palette, Context Menu, High Contrast, Highlight Data, Keyboard Navigation, Landing Page, Localizations, Rendering Events, Selection Across Visuals, Tooltips) : ce sont des fonctionnalités à déclarer dans `capabilities.json` / à implémenter, **pas des erreurs**. Plusieurs sont directement utiles ici (Tooltips, Highlight Data, Context Menu, Rendering Events, Selection Across Visuals).

### 4.5 État actuel des fichiers du projet de test

- `src/visual.ts` : minimal (charge le worker, crée une `maplibregl.Map` avec un style vide, ajoute un `<svg>` D3). **Aucune logique de flux.**
- `src/settings.ts` : **supprimé** (à recréer à l'étape 6 avec `powerbi-visuals-utils-formattingmodel`).
- `src/workerSource.ts` : worker embarqué (~554 Ko).
- `capabilities.json` : **encore celui du gabarit** (rôles `category` / `measure`) — à remplacer entièrement.
- `package.json` : nom `visual`, description du gabarit — à corriger.
- GUID du visuel (pbiviz.json) : `flowMapA42796B9945249CBB594ECF68C0A3B5F` ; `visualClassName: "Visual"` ; `apiVersion: 5.11.1`.

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
- **Géométrie calculée en pixels après projection**, avec décalages latéraux en pixels : la séparation reste constante au zoom, et les points GPS de départ/arrivée ne sont jamais déplacés. Les courbes (Bézier) sont donc recalculées (ou transformées) à chaque changement de vue.
- **Rendu hybride** : SVG jusqu'à environ 2 000 flux, **Canvas au-delà** (bascule automatique). Seuil indicatif à valider par mesure de performance.
- **Cache des coordonnées projetées** entre les mises à jour ; une simple modification de sélection ne doit pas reconstruire la carte ni recalculer la géométrie.
- Tangente de la courbe au point d'arrivée pour orienter la pointe.
- Agrégation par défaut des flux identiques (même départ + arrivée + catégorie) dans `dataAggregator`.
- `dataReductionAlgorithm` / limite de lignes du SDK à déclarer dans `capabilities.json` (tableau de type `table` ou `categorical` à choisir à l'étape 2/3 ; un mapping `table` est probablement plus adapté à des lignes de flux avec 4 coordonnées — à confirmer).

---

## 6. Décisions en attente de l'utilisateur (valeurs par défaut si pas de réponse)

1. **Fond de carte par défaut** : style vectoriel gratuit **sans clé**, par exemple OpenFreeMap, URL configurable dans le panneau de formatage. **Ses conditions d'utilisation n'ont pas été vérifiées** : les vérifier et les documenter. Les tuiles OSM officielles (`tile.openstreetmap.org`) sont déconseillées pour un usage intensif.
2. **Informations d'auteur** : nom, email, URL de support, nom d'affichage du visuel (valeurs provisoires actuellement).
3. **Test sur Power BI Desktop** : l'utilisateur peut-il tester les `.pbiviz` au fil des étapes ? Sans cela, le fond de carte et le worker ne peuvent pas être déclarés opérationnels.

La dernière proposition faite à l'utilisateur : s'il répond simplement « ok », partir sur OpenFreeMap, des valeurs d'auteur provisoires, et enchaîner sur l'étape 2.

---

## 7. Risques et points non vérifiés (à ne jamais présenter comme acquis)

- **Sandbox Power BI** : acceptation du worker `blob:`, de WebGL, de la politique CSP → **non testé**. Repli prévu : rendu MapLibre sans worker, ou fond de carte en **tuiles raster**.
- **Accès réseau aux tuiles** : nécessite une déclaration `privileges` / `WebAccess` dans `capabilities.json` avec la **liste exacte des domaines** (style JSON, tuiles, glyphes/polices, sprites). Domaines à lister selon le fournisseur choisi.
- **Certification** : un visuel qui fait des appels réseau externes **ne peut pas être certifié** par Microsoft ; les administrateurs de tenant peuvent le bloquer. À documenter dans le README.
- **Cross-filtering / highlighting** : dépend de la façon dont les lignes de données sont mappées à des `ISelectionId` ; à tester dans Desktop.
- **Seuil SVG → Canvas** (~2 000 flux) : indicatif, à mesurer.
- **Limite de lignes** : le SDK limite le nombre de lignes par défaut (fenêtrage, `dataReductionAlgorithm`, `fetchMoreData`) ; à documenter dans les limites techniques.

---

## 8. Commandes utiles

```bash
# Installation globale de l'outil
npm install -g powerbi-visuals-tools@7.2.1

# Dans le dossier du projet
npm install                 # installe les dépendances
pbiviz package              # compile + lint + produit dist/*.pbiviz
pbiviz start                # serveur de développement (visuel de dev dans Power BI Service)

# Régénérer le worker embarqué après une mise à jour de maplibre-gl
node scripts/gen-worker.mjs   # (à créer : voir §4.4, puis l'appeler en pré-build)
```

Erreurs déjà rencontrées et leurs causes :

| Erreur | Cause | Correctif |
|---|---|---|
| `Author information` / `supportUrl is not specified` | métadonnées manquantes dans `pbiviz.json` | renseigner `author`, `supportUrl` |
| `TS1192: Module ... has no default export` | MapLibre 6.x | `import * as maplibregl` |
| `Error parsing bundle asset ... visual.js` | conséquence d'une erreur TypeScript | corriger l'erreur TS d'abord |

---

## 9. À faire à l'étape 2 (proposition)

1. Renommer le package (`package.json`), renseigner `pbiviz.json` (displayName, description, auteur).
2. Créer l'arborescence `src/` du §2.10 (fichiers vides/squelettes documentés) ; recréer `settings.ts`.
3. Ajouter le script de génération du worker comme pré-build npm.
4. Implémenter `map/mapManager.ts` : création de la carte, style configurable (URL), zoom initial, redimensionnement (`update()` avec `viewport`), nettoyage (`destroy`/`remove`), `fitBounds` pour le zoom automatique (hook prévu).
5. Implémenter `map/projection.ts` : `lngLat → pixel` via `map.project()`, avec cache invalidé sur `move`/`zoom`/`resize`.
6. Déclarer dans `capabilities.json` : rôles de données (§2.1), `privileges` WebAccess (domaines du fournisseur de tuiles), objets de formatage de la section « Carte ».
7. Fournir un `.pbiviz` de test + un jeu de données de démonstration minimal, et demander à l'utilisateur de tester le chargement de la carte dans Desktop **avant** de passer à l'étape 3.
8. Mettre à jour ce fichier (`HANDOFF.md`) : état d'avancement, décisions prises, résultats de tests.

---

## 10. Autres éléments de contexte

- L'utilisateur est en France (fuseau Europe/Paris) et s'exprime en français.