# Scénarios d'acceptation — moteur Ironman / Half-Ironman

- Branche : dev/tests-moteur-adaptation
- Statut : scénarios métier préparés après validation des trois arbitrages le 28 novembre 2026.
- Nature : spécification de tests d'acceptation ; ces résultats attendus ne décrivent pas le comportement actuel du moteur.
- Environnement cible : données synthétiques, sans accès ni écriture Supabase, sans compte athlète réel.
- Aucun changement du code applicatif ou de la production n'est inclus.

## 1. Décisions métier de référence

1. Ironman : priorité à la durabilité et à la spécificité vélo / enchaînement, sans protéger une séance longue au détriment de la santé.
2. Half-Ironman / 70.3 : davantage de place possible au travail soutenu et à l'allure cible, sans augmenter automatiquement le nombre de séances intenses.
3. Les deux formats partagent les mêmes garde-fous de douleur, de fatigue et de données manquantes. La différenciation concerne la structure du plan, la sélection des séances et l'affûtage, avec des paramètres individualisés.

## 2. Contrat de test

Chaque scénario doit préciser :
- le type de course A et le nombre de semaines avant cette course ;
- la phase du plan ;
- les séances prévues, leur discipline, leur durée, leur intensité et leur rôle (clé, accessoire, facile, enchaînement, opener, événement) ;
- les données observées (RPE, forme, douleur, adhérence, charge) et leur niveau de complétude ;
- les séances déjà réalisées et les indisponibilités ;
- le résultat attendu : séance conservée, réduite, remplacée, supprimée ou demande de validation humaine, avec une explication.

Une séance ne doit pas être considérée comme clé uniquement parce qu'elle est longue. Son rôle doit être explicite dans le plan ou calculé par une règle documentée et validée.

## 3. Scénarios communs aux deux formats

| ID | Situation | Résultat attendu Ironman | Résultat attendu 70.3 |
|---|---|---|---|
| COM-01 | Douleur préoccupante dans une discipline | Même garde-fou de sécurité ; ne pas conserver la séance clé au détriment de la santé | Même garde-fou de sécurité ; ne pas conserver la séance clé au détriment de la santé |
| COM-02 | Douleur croissante mais sous le seuil de blocage actuel | Déclencher surveillance et réévaluation ; ne pas banaliser la progression de la douleur | Identique |
| COM-03 | Fatigue générale confirmée sur plusieurs disciplines | Réduire la charge globale selon la gravité ; préserver la récupération avant la spécificité | Identique |
| COM-04 | Fatigue localisée en course à pied | Adapter d'abord les séances de course concernées ; ne pas transférer la charge sur une autre séance exigeante | Identique |
| COM-05 | Fatigue localisée à vélo | Adapter le vélo concerné ; ne pas supposer que la course peut absorber la charge retirée | Identique |
| COM-06 | RPE / forme / douleur absents ou trop peu renseignés | État incertain ; aucune progression automatique ; demander les informations utiles | Identique |
| COM-07 | Séance déjà réalisée, événement ou opener | Ne pas modifier rétroactivement ces éléments protégés | Identique |
| COM-08 | Séance manquée | Ne pas créer de dette ni programmer un rattrapage automatique | Identique |
| COM-09 | Annulation d'une adaptation | Restaurer exactement le plan et les métadonnées antérieurs | Identique |
| COM-10 | Deux athlètes avec objectifs différents | Aucune fuite de données ou de paramètres entre profils | Identique |

## 4. Scénarios différenciant les formats

| ID | Situation | Résultat attendu Ironman | Résultat attendu 70.3 |
|---|---|---|---|
| DIF-01 | Phase spécifique, semaine sans fatigue ni douleur | La séance vélo longue explicitement identifiée comme clé est reconnue comme prioritaire ; enchaînement adapté au plan | La séance soutenue / allure cible explicitement identifiée est reconnue comme prioritaire ; pas d'ajout automatique d'une deuxième séance intense |
| DIF-02 | Fatigue générale modérée, séance vélo longue clé et travail accessoire prévus | Le travail accessoire est candidat à réduction avant la séance spécifique, si la récupération permet de la maintenir | Le travail accessoire est candidat à réduction avant la séance d'allure cible, si la récupération permet de la maintenir |
| DIF-03 | Fatigue vélo localisée | Réévaluer durée et intensité de la sortie longue ; ne pas la préserver si elle aggrave le signal | Réévaluer la séance vélo soutenue ; ne pas la préserver si elle aggrave le signal |
| DIF-04 | Fatigue course localisée | Réduire / remplacer l'intensité ou l'enchaînement course ; aucune obligation de maintenir une longue course | Réduire / remplacer la séance rapide ou l'enchaînement ; aucune obligation de maintenir l'allure cible |
| DIF-05 | Semaine de récupération planifiée | Réduire la charge après le bloc spécifique coûteux, selon réponse réelle de l'athlète | Réduire la charge après le bloc soutenu, selon réponse réelle de l'athlète |
| DIF-06 | Affûtage | Préserver quelques rappels spécifiques courts et la fraîcheur ; éviter une longue séance générant une fatigue résiduelle | Préserver quelques rappels d'allure courts et la fraîcheur ; éviter l'accumulation d'intensité |
| DIF-07 | Course A à échéance proche et course B/C intermédiaire | La course secondaire ne doit pas compromettre la préparation A ; récupération adaptée à son coût | Même principe, avec la charge spécifique 70.3 |
| DIF-08 | Deux plans identiques sauf type d'objectif | Les phases et la sélection des séances spécifiques diffèrent selon la matrice validée | Les phases et la sélection des séances spécifiques diffèrent selon la matrice validée |

## 5. Tests de phase et calendrier

| ID | Situation | Résultat attendu |
|---|---|---|
| PH-01 | Même date de course et même semaine, type Ironman vs 70.3 | Les phases calendaires restent cohérentes ; les contenus spécifiques sont différenciés |
| PH-02 | Passage base → développement → spécifique | Les priorités évoluent sans saut arbitraire de volume |
| PH-03 | Entrée en affûtage | Les facteurs de réduction sont propres au format seulement après validation des paramètres |
| PH-04 | Semaine de course | Course, openers et informations de course restent protégés ; charge réduite selon le plan |
| PH-05 | Course passée | Le moteur n'essaie pas de poursuivre le plan pré-course ; transition / récupération individualisée |

## 6. Tests de robustesse et de personnalisation

| ID | Situation | Résultat attendu |
|---|---|---|
| ROB-01 | Athlète débutant avec objectif Ironman et faible historique | Ne pas imposer les volumes ou durées d'un athlète expérimenté |
| ROB-02 | Athlète expérimenté avec disponibilité élevée | Les paramètres peuvent être plus élevés si les données de tolérance le justifient ; pas de plafond arbitraire lié au seul format |
| ROB-03 | Disponibilité hebdomadaire réduite | Prioriser selon le format et les séances clés réellement prévues ; ne pas comprimer toutes les séances |
| ROB-04 | Données manquantes pendant plusieurs jours | Signaler l'incertitude et éviter toute progression automatique |
| ROB-05 | Plusieurs courses A ou calendrier incohérent | Demander arbitrage humain plutôt que choisir silencieusement une course directrice |
| ROB-06 | Séance clé absente ou non identifiée | Ne pas inventer une séance clé ; signaler que le plan nécessite une configuration |
| ROB-07 | Plan déjà adapté une première fois | Éviter les réductions successives cumulatives non voulues ; conserver la possibilité de restauration exacte |
| ROB-08 | Changement d'objectif de 70.3 vers Ironman ou inversement | Recalculer les phases et priorités de manière explicite ; ne pas réutiliser aveuglément les anciens paramètres |

## 7. Cas numériques à ne pas figer à ce stade

Les tests ne doivent pas inventer des seuils de volume, de durée longue, de nombre de séances intenses ou de réduction d'affûtage. Ces paramètres doivent être définis séparément et individualisés selon l'historique, le niveau, la disponibilité, les blessures et la réponse à l'entraînement.

Les seuils actuels de douleur, RPE, adhérence et surcharge déjà couverts par la suite unitaire restent des tests de régression communs aux deux formats. Ils ne doivent pas être rendus plus permissifs pour l'Ironman.

## 8. Critères de réussite

- Tous les scénarios communs produisent les mêmes garde-fous de sécurité pour les deux formats.
- Les scénarios différenciants montrent une différence justifiée dans la sélection des séances et les phases, sans augmenter automatiquement la charge.
- Les séances réalisées, événements et openers restent protégés.
- Les données manquantes ne déclenchent ni progression ni conclusion de récupération.
- Les adaptations sont explicables, non cumulatives par accident et réversibles.
- Les données et paramètres restent strictement isolés par athlète.
- Les tests existants de régression continuent de passer.

## 9. État de réalisation

À la date de création, la suite automatisée actuelle couvre 18 tests unitaires des règles d'adaptation communes. Les scénarios ci-dessus ne sont pas encore automatisés. Ils nécessitent d'abord une spécification technique des métadonnées de séance et des règles de sélection, puis une évolution contrôlée du moteur.

Aucun scénario de ce document ne doit être présenté comme réussi avant son implémentation et l'exécution effective du test correspondant dans GitHub Actions.
