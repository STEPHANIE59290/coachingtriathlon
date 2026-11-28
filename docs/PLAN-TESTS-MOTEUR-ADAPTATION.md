# Plan de tests — moteur d’adaptation triathlon

Branche : `dev/tests-moteur-adaptation`  
Périmètre : moteur `adaptiveWeekSignal()`, `applyAdaptiveWeek()` et `undoAdaptiveWeek()`  
Statut : plan de validation à implémenter ; les scénarios ci-dessous ne sont pas encore exécutés.

## 1. Objectifs et règles de sécurité

- Vérifier que l’adaptation est cohérente avec les signaux de fatigue, de douleur, de charge et d’adhérence.
- Vérifier qu’une alerte limitée à une discipline ne dégrade pas inutilement les deux autres.
- Ne jamais augmenter la charge à la suite d’un signal de fatigue ou d’une donnée manquante.
- Ne jamais modifier les séances déjà réalisées, les événements, les séances d’ouverture (openers) ou les séances déjà adaptées.
- Vérifier que l’annulation restaure exactement le plan initial.
- Vérifier l’isolation stricte des données entre athlètes.
- Exécuter les tests sur données synthétiques, sans écriture dans Supabase ni effet sur les comptes réels.

Les seuils attendus ci-dessous reprennent les règles actuellement identifiées dans le code. Si ces règles évoluent, mettre à jour les attentes et faire valider le changement avant de régénérer les résultats de référence.

## 2. Scénarios fonctionnels prioritaires

| ID | Situation | Données simulées | Résultat attendu |
|---|---|---|---|
| N01 | Semaine normale | Douleur 0–1, RPE modéré, adhérence ≥60 %, volume ≤125 % du prévu | Aucun signal d’alerte ; plan inchangé |
| N02 | Données de récupération absentes | Pas de wellness ou peu de RPE renseignés | Ne pas interpréter l’absence de données comme une récupération parfaite ; pas d’augmentation automatique |
| F01 | Fatigue générale | Plusieurs RPE élevés, forme basse et/ou bilans défavorables | Signal global adapté au niveau de risque ; séances longues/intenses futures réduites selon la règle en vigueur |
| F02 | Fatigue vélo uniquement | Signaux élevés sur vélo, natation et course stables | Adapter uniquement le vélo si le signal reste local |
| F03 | Fatigue course uniquement | Signaux élevés sur course, autres disciplines stables | Adapter uniquement la course |
| F04 | Fatigue natation uniquement | Signaux élevés sur natation, autres disciplines stables | Adapter uniquement la natation |
| B01 | Douleur modérée localisée | Douleur 3/10 sur une discipline | Discipline concernée en surveillance ; pas de réduction injustifiée des autres sports |
| B02 | Douleur élevée | Douleur maximale ≥4/10 | Adaptation automatique bloquée ; aucune séance modifiée |
| B03 | Douleur qui augmente | Douleur passant de 1 à 3 puis 4 | Le seuil de blocage prévaut ; aucune réduction automatique ne doit masquer la nécessité d’un avis médical |
| S01 | Semaine sous-chargée | Adhérence <60 % | Signal de prudence ; ne pas compenser la semaine par une hausse brutale |
| S02 | Semaine en surcharge | Volume effectué >125 % du volume prévu | Signal soft/prudence ; ne pas augmenter la charge suivante |
| S03 | Accumulation de bilans défavorables | Au moins 3 bilans rouges, ou combinaison de rouges/oranges correspondant aux seuils actuels | Niveau global rouge/orange selon les seuils ; adaptation des séances futures concernées |
| S04 | Charge élevée sur plusieurs disciplines | Signaux locaux multiples et signal global élevé | Réduction cohérente sans double application de réduction à une même séance |
| P01 | Séances déjà réalisées | Plan contenant des séances passées/réalisées | Aucune modification de ces séances |
| P02 | Événements et openers | Plan contenant compétition, événement ou séance d’ouverture | Éléments protégés et inchangés |
| P03 | Séance déjà adaptée | Séance marquée comme adaptée | Pas de seconde réduction lors d’une nouvelle exécution |
| P04 | Annulation | Appliquer puis annuler l’adaptation | Plan strictement identique à l’état initial, y compris durée, intensité, description et métadonnées |

## 3. Préparations spécifiques

Ces scénarios vérifient que le contexte de course est correctement pris en compte. Ils ne doivent pas présumer que le moteur actuel applique déjà des règles distinctes : l’audit fonctionnel doit d’abord confirmer les différences réellement implémentées.

| ID | Objectif | Situation | Résultat attendu |
|---|---|---|---|
| IM01 | Ironman | Bloc de développement, fatigue générale modérée | Préserver la structure spécifique longue distance ; réduire prioritairement les séances longues/intenses à risque |
| IM02 | Ironman | Surcharge vélo après une longue sortie, course à pied stable | Ajustement ciblé du vélo ; conserver les séances de course faciles si aucun signal ne les concerne |
| IM03 | Ironman | Douleur course à pied ≥4/10 | Blocage de l’adaptation automatique ; ne pas remplacer une décision médicale par une séance allégée |
| IM04 | Ironman | Période d’affûtage (taper) | Ne pas appliquer une réduction générique qui détruit le taper déjà planifié |
| HM01 | Half-Ironman / 70.3 | Bloc spécifique avec fatigue modérée | Préserver les séances clés propres au format 70.3 et ajuster sans copier mécaniquement la logique Ironman |
| HM02 | Half-Ironman / 70.3 | Surcharge sur une discipline | Adaptation localisée, sans réduire automatiquement les autres sports |
| HM03 | Half-Ironman / 70.3 | Période d’affûtage | Préserver les openers et la progressivité de l’affûtage |
| OBJ01 | Comparaison des objectifs | Même profil de fatigue, objectif Ironman puis 70.3 | Vérifier les différences prévues par les règles métier ; documenter toute absence de différenciation |

## 4. Tests de seuils et cas limites

Tester explicitement les valeurs juste en dessous, exactement au seuil et juste au-dessus :

- Douleur : 2, 3 et 4/10.
- RPE : 6, 7, 8 et 9 ; vérifier le nombre minimal de séances requis.
- Adhérence : 59 %, 60 % et 61 %.
- Volume effectué / prévu : 124 %, 125 % et 126 %.
- Nombre de bilans rouges/oranges : juste avant et juste après chaque seuil du moteur.
- Historique : moins de 2 RPE récents, exactement 2, et données suffisantes sur la période de comparaison.
- Semaine sans séance, semaine partiellement renseignée et discipline sans historique.

Attendu : les comparaisons de seuil doivent être déterministes, sans effet de bord lié à l’arrondi ou aux données absentes.

## 5. Multi-athlètes et synchronisation

| ID | Situation | Résultat attendu |
|---|---|---|
| M01 | Deux athlètes avec plans et douleurs différents | L’adaptation de A ne modifie aucune donnée de B |
| M02 | Deux sessions du même athlète sur appareils différents | Pas d’écrasement silencieux d’un plan plus récent |
| M03 | Conflit de synchronisation pendant une adaptation | Conflit détecté ou fusion conforme ; aucune perte silencieuse |
| M04 | Déconnexion réseau puis reconnexion | Adaptation locale cohérente et synchronisation contrôlée |
| M05 | Changement de compte sur le même navigateur | Aucune donnée du compte précédent visible dans le nouveau compte |

Ces tests doivent utiliser des comptes de test dédiés et des données fictives. Ne pas lancer de scénario destructif sur les comptes d’athlètes réels.

## 6. Critères d’acceptation

1. Tous les scénarios critiques B02, P01 à P04 et M01 à M05 passent.
2. Une douleur ≥4/10 bloque l’adaptation automatique sans exception.
3. Une alerte locale n’entraîne pas de réduction des autres disciplines, sauf règle globale explicitement déclenchée.
4. Aucune séance protégée (réalisée, événement, opener) n’est modifiée.
5. L’annulation restaure le plan initial à l’identique.
6. Les données manquantes ne déclenchent jamais une progression automatique.
7. Les profils Ironman et 70.3 respectent leurs règles métier respectives, ou les écarts non implémentés sont clairement identifiés.
8. Aucun test ne touche les données de production.

## 7. Organisation d’exécution

Ordre recommandé :

1. Tests unitaires déterministes des fonctions de signal et d’adaptation.
2. Tests des seuils et cas limites.
3. Tests d’intégration de l’application avec plans simulés.
4. Tests multi-athlètes et synchronisation sur environnement de test.
5. Tests de non-régression du banc Playwright existant.

Le banc existant `tests/run.py` compare actuellement les références `normal` et `fatigue` et contrôle aussi le démarrage/performance. Il ne suffit pas à valider les scénarios détaillés de ce document. Conserver ces tests de non-régression et ajouter une suite dédiée au moteur d’adaptation.

Ne pas utiliser `--update` sur les golden tests pour faire disparaître un écart sans avoir identifié et validé la modification attendue.

## 8. Contraintes techniques

- GitHub : conserver le travail sur une branche dédiée et passer par une pull request avant fusion.
- Netlify : ne pas déclencher de mise en production depuis cette branche sans validation explicite du déploiement.
- Supabase : rester sur l’offre gratuite ; utiliser uniquement des données et comptes de test pour les tests d’intégration.
- Aucun secret, mot de passe, clé API ou donnée personnelle d’athlète dans les fixtures ou les journaux de test.
