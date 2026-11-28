# Spécification technique — rôles explicites des séances

- Branche : `dev/tests-moteur-adaptation`
- Statut : proposition technique à valider avant implémentation.
- Référence métier : `docs/MATRICE-METIER-IRONMAN-HALF.md` et `docs/SCENARIOS-TESTS-IRONMAN-HALF.md`.
- Périmètre : métadonnées des séances du planning et règles futures de sélection/adaptation.
- Aucun code applicatif, schéma Supabase, donnée d'athlète ou environnement de production n'est modifié par ce document.

## 1. Constat vérifié dans le code actuel

Le catalogue de séances construit les objets via `mkS(sport,title,min,desc,intensity,extra)`. Les objets portent notamment `quality`, `long`, `test`, `steps`, et le plan ajoute `day`, parfois `event`, `opener`, `indoor`, `moved`, etc.

La génération trie actuellement les séances avec une priorité technique `long > quality > autres` pour tenter de les placer dans les créneaux. Ce tri n'est pas une hiérarchie de valeur sportive validée.

Les séances spécifiques Ironman et 70.3 sont déjà partiellement distinctes dans `buildCatalog()` : vélo long Ironman, vélo long allure half, sorties longues course, natation longue Ironman et enchaînements. En revanche, aucun champ générique ne dit au moteur si une séance est clé, de soutien ou facile.

Le moteur d'adaptation utilise aujourd'hui `quality`, `long` ou une durée supérieure à 60 minutes pour repérer les séances à alléger. Cette heuristique peut prendre une séance longue pour une séance prioritaire, et inversement manquer une séance clé plus courte.

Les séances libres ajoutées par l'utilisateur ne passent pas nécessairement par le catalogue. Enfin, `easyLike()` fabrique un nouvel objet de séance ; une future métadonnée de rôle devra être traitée explicitement pour ne pas disparaître lors d'une adaptation. La restauration via `orig` doit continuer à rétablir l'objet initial exactement.

## 2. Modèle minimal recommandé

Ajouter un champ facultatif et versionnable à chaque séance du planning :

```js
trainingRole: 'key' | 'support' | 'easy'
```

Signification :

| Valeur | Sens | Conséquence attendue |
|---|---|---|
| `key` | Séance qui porte un objectif prioritaire du microcycle ou du bloc | À préserver si l'état de l'athlète le permet ; jamais protégée contre un signal de douleur ou de fatigue préoccupant |
| `support` | Séance utile au développement, mais secondaire par rapport aux séances clés de la semaine | Première candidate à réduction ou remplacement lorsque la charge doit baisser |
| `easy` | Récupération, endurance facile ou technique sans objectif de charge important | Généralement conservée si elle reste réellement facile et compatible avec la récupération |

Règles :
- Le champ est facultatif pour assurer la compatibilité avec les anciens plans synchronisés.
- Une valeur absente ou inconnue signifie `unclassified`, jamais `key` par défaut.
- Ne pas inférer le rôle uniquement à partir du titre, de la durée, de `quality` ou de `long`.
- `quality` et `long` restent des attributs descriptifs de séance ; ils ne sont pas remplacés par `trainingRole`.
- Le rôle ne constitue pas un niveau de sécurité : aucune séance `key` n'est immunisée contre les règles douleur/fatigue.
- Le rôle doit être expliqué dans les métadonnées du plan et visible au coach lors de la revue, sans surcharger l'écran de l'athlète.

## 3. Métadonnées distinctes à conserver

Ne pas confondre priorité sportive et nature logistique de la séance.

Les propriétés existantes `event` et `opener` restent la référence pour les événements et rappels pré-course, sous réserve d'audit de leurs usages.

Pour les enchaînements, ajouter uniquement si nécessaire un identifiant de groupe commun aux deux jambes :

```js
brickGroupId: 'identifiant-stable-du-groupe'
```

Le vélo et la course d'un même enchaînement partagent cet identifiant. Le rôle de chaque jambe reste explicite : un enchaînement n'est pas automatiquement une séance clé dans son intégralité. La suppression ou réduction d'une jambe doit être évaluée sans casser silencieusement l'autre ; le moteur doit signaler un enchaînement devenu incomplet.

Ne pas ajouter tout de suite une taxonomie complexe de sous-types. Les booléens existants, le rôle et l'identifiant d'enchaînement suffisent pour la première version.

## 4. Attribution initiale proposée

L'attribution se fait au moment où le catalogue produit la séance, dans `buildCatalog()` ou dans une étape explicite immédiatement après la construction. Elle dépend du type de course A, de la phase et de la structure réelle de la semaine.

Principes proposés :

- **Ironman — phase spécifique :** identifier comme `key` la séance de durabilité vélo explicitement prévue et, selon la structure de la semaine, un enchaînement ou une séance de course spécifique. Ne pas rendre automatiquement toutes les longues séances clés.
- **70.3 — phase spécifique :** identifier comme `key` la séance de travail à allure cible / soutenue explicitement prévue. Une séance vélo longue peut aussi être clé si le plan lui attribue ce rôle, mais pas par sa seule durée.
- **Développement :** les séances de qualité peuvent être `key` ou `support` selon leur objectif et leur place dans le microcycle ; ne pas multiplier les séances clés par défaut.
- **Base :** priorité à la régularité, la technique et la construction progressive ; la plupart des séances restent `support` ou `easy`, sauf objectif de bloc clairement identifié.
- **Affûtage :** les rappels courts spécifiques peuvent rester `key` au sens de maintien du stimulus, tandis que le volume long est réduit. Le rôle `key` ne signifie donc pas « séance longue ».
- **Semaine de récupération :** ne pas forcer une séance `key` si la récupération est la finalité du microcycle ; rôle et charge doivent refléter la semaine allégée.
- **Séance libre :** `unclassified` par défaut jusqu'à ce que le coach ou l'utilisateur lui attribue un rôle.
- **Plan ancien :** ne pas rétro-classer automatiquement les séances historiques à partir de leur titre.

Ces règles qualitatives doivent être traduites en table de décision testable avant d'être codées.

## 5. Règle de sélection lors d'une adaptation

La future adaptation doit suivre cet ordre de décision, sous réserve des garde-fous cliniques et sportifs validés :

1. Exclure les séances déjà réalisées, événements et openers protégés selon les règles existantes.
2. Appliquer d'abord les restrictions liées à la douleur et aux disciplines concernées. Une douleur préoccupante peut imposer arrêt, remplacement ou avis humain même pour une séance `key`.
3. En fatigue générale, examiner d'abord les séances `support`, puis les séances `key` uniquement si la charge reste excessive.
4. En fatigue locale, évaluer les séances de la discipline concernée ; ne pas transférer automatiquement le volume retiré vers une autre discipline.
5. Les séances `easy` ne doivent pas être transformées en séances plus exigeantes pour compenser une séance supprimée.
6. Si des séances importantes sont `unclassified`, ne pas les promouvoir automatiquement : signaler le manque de classification et demander une revue du coach.
7. Ne jamais programmer de rattrapage automatique d'une séance manquée.

Cette hiérarchie ne doit pas introduire de seuil numérique supplémentaire sans validation.

## 6. Conservation des métadonnées et réversibilité

Avant l'implémentation, cartographier chaque transformation de séance : génération, déplacement, adaptation, adaptation chaleur, modification manuelle, suppression, séance libre, synchronisation et export.

Exigences :
- Les champs `trainingRole` et `brickGroupId` doivent survivre aux opérations qui conservent la séance.
- Une séance transformée en version facile ne doit pas rester marquée `key` si cela induit l'interface ou le moteur en erreur ; conserver le rôle initial dans l'instantané `orig` et restaurer exactement cet instantané à l'annulation.
- Les adaptations successives ne doivent pas écraser l'état d'origine ni appliquer des réductions cumulatives involontaires.
- Les anciens objets sans ces champs restent lisibles et modifiables.
- Vérifier les chemins de synchronisation Supabase et de fusion multi-appareils : aucune migration destructive ni modification du schéma de base n'est justifiée pour un champ JSON facultatif sans nécessité démontrée.
- Les rôles ne doivent jamais être partagés entre athlètes ; ils appartiennent au plan de l'athlète.

## 7. Interface de revue

Pour une première version, privilégier une attribution automatique explicable par le générateur et une possibilité de correction dans la revue du planning par le coach.

Afficher un libellé discret :
- Prioritaire
- Soutien
- Facile
- À qualifier

Le coach doit pouvoir modifier le rôle d'une séance non réalisée. Les séances réalisées, événements et openers doivent conserver leurs protections existantes. L'athlète doit comprendre pourquoi une séance est proposée à l'allègement, sans avoir à gérer les règles du moteur.

Ne pas construire une nouvelle page de paramétrage complexe. La revue du planning existant est le point d'entrée naturel.

## 8. Tests techniques requis avant fusion

### Compatibilité
- Ancien plan sans `trainingRole` chargé sans erreur.
- Valeur inconnue interprétée comme `unclassified`.
- Une séance libre est `unclassified` par défaut.
- Un plan avec des rôles et groupes d'enchaînement est sérialisé / rechargé sans perte.

### Attribution
- Ironman spécifique : la séance vélo de durabilité prévue est identifiée conformément à la table de décision.
- 70.3 spécifique : la séance à allure cible prévue est identifiée conformément à la table de décision.
- Une séance longue non prioritaire n'est pas automatiquement `key`.
- Une séance courte de rappel peut être `key` en affûtage.
- Une semaine de récupération ne reçoit pas artificiellement plusieurs séances clés.
- Aucune attribution ne dépend du seul titre de séance.

### Adaptation
- Fatigue générale : une séance `support` est proposée avant une séance `key`, si les garde-fous permettent une adaptation.
- Fatigue locale : seules les séances pertinentes de la discipline sont candidates.
- Douleur préoccupante : le rôle `key` ne contourne jamais le garde-fou.
- Une séance `easy` reste facile.
- Une séance `unclassified` ne devient pas prioritaire par défaut.
- Une séance réalisée, un événement ou un opener reste protégé.
- Annuler l'adaptation restaure exactement rôle, groupe, durée, structure et autres métadonnées.
- Les données d'un athlète ne modifient jamais les rôles ou plans d'un autre.

### Non-régression
- Les 18 tests unitaires actuels restent verts.
- Les tests Playwright existants sont exécutés après intégration.
- Le comportement actuel est comparé sur les cas non concernés.
- GitHub Actions confirme les résultats sur la branche avant toute PR vers `main`.

## 9. Découpage d'implémentation recommandé

1. Valider le modèle minimal et les règles qualitatives d'attribution.
2. Ajouter le champ facultatif aux objets générés et le préserver dans les transformations, sans changer encore les décisions d'adaptation.
3. Ajouter les tests de compatibilité, sérialisation, attribution et restauration.
4. Ajouter l'affichage / correction du rôle dans la revue du planning.
5. Modifier le moteur pour utiliser les rôles après validation des tests.
6. Exécuter les tests unitaires, Playwright et GitHub Actions ; revue de sécurité multi-athlètes.
7. Proposer une PR ; aucune fusion ou mise en production sans autorisation explicite.

## 10. Décisions restant à valider avant le code

- Valider les trois rôles minimaux `key / support / easy` et le statut implicite `unclassified` pour les séances anciennes ou libres.
- Valider que l'attribution automatique est une proposition explicable, corrigible par le coach, et jamais une protection contre les garde-fous de sécurité.
- Valider le maintien des champs facultatifs dans les objets de plan JSON existants, sans migration Supabase à ce stade.
- Valider la définition précise des séances clés par format et par phase dans une table de décision, sans inventer de seuils de volume.

**État :** aucune modification du moteur, de `index.html`, de `public/index.html`, de Supabase, de Netlify ou de `main` n'est effectuée par cette spécification.
