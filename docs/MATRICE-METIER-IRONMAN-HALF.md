# Matrice métier — préparation Ironman et Half-Ironman (70.3)

- Branche de travail : `dev/tests-moteur-adaptation`
- Statut : **proposition métier à valider**, pas une spécification déjà implémentée.
- Périmètre : règles de planification et d'adaptation selon l'objectif A.
- Hors périmètre : modification du moteur, des données Supabase, de `index.html`, de `public/index.html` ou du déploiement Netlify.

## 1. Ce que fait réellement l'application aujourd'hui

L'inspection de `index.html` sur cette branche montre que l'application sait déjà distinguer les formats à plusieurs endroits :

- Une course est enregistrée avec un type `70.3`, `Ironman` ou `Autre`, une date et une priorité A/B/C.
- La course A pilote les phases du plan : base, développement, spécifique, affûtage et approche de course.
- La phase spécifique est nommée « Spécifique Ironman » ou « Spécifique 70.3 ».
- Les volumes de référence par défaut du champ fitness/CTL sont 105 pour Ironman et 85 pour 70.3 ; ces nombres sont des valeurs techniques de référence, pas des objectifs universels validés pour chaque athlète.
- La génération de volume applique actuellement une progression générique (jusqu'à +10 % par semaine, avec une semaine de récupération sur quatre) aux deux formats.
- La phase d'affûtage et ses multiplicateurs par discipline sont actuellement communs aux deux formats.
- Le moteur `adaptiveWeekSignal()` / `applyAdaptiveWeek()` ne différencie pas encore ses décisions selon le type de course. Il applique les mêmes seuils et facteurs d'allègement.

**Conclusion :** l'application distingue déjà certains éléments de calendrier et de course, mais pas encore les règles de charge et d'adaptation du moteur. La matrice ci-dessous propose cette couche métier manquante.

## 2. Principes non négociables

1. **La sécurité prime sur la course.** Une douleur importante, croissante, inhabituelle ou persistante ne doit jamais être relativisée parce que l'objectif est un Ironman.
2. **Pas de rattrapage de séances.** Une séance manquée ne crée pas une dette à compenser.
3. **Pas de progression sur données insuffisantes.** L'absence de RPE, de douleur ou de données de récupération signifie « incertain », pas « tout va bien ».
4. **Une alerte locale reste locale** tant qu'un signal global ne justifie pas une adaptation plus large.
5. **Ne pas sacrifier la cohérence du plan.** L'adaptation doit considérer la phase, le temps restant avant la course et les séances déjà réalisées.
6. **Le type de course ne remplace pas le profil.** Expérience, historique récent, disponibilité, tolérance à la charge, blessures et niveau actuel déterminent les volumes réels.

## 3. Différences de préparation proposées

| Dimension | Ironman | Half-Ironman / 70.3 | Règle de décision proposée |
|---|---|---|---|
| Finalité dominante | Durabilité sur une très longue durée et capacité à courir après un vélo long | Puissance/endurance soutenue et capacité à maintenir une allure élevée après le vélo | Le moteur doit reconnaître les séances clés propres au format, sans déduire leur importance du seul intitulé « long » |
| Vélo | Priorité forte à la sortie longue spécifique, à la régularité de puissance et à la nutrition à vélo | Priorité à la qualité soutenue (tempo/seuil selon niveau), à l'allure cible et à une sortie longue adaptée | Identifier une séance vélo clé par semaine uniquement si le plan de l'athlète en prévoit une |
| Course à pied | Construire la résistance à la durée et la capacité à courir après le vélo ; limiter le coût mécanique | Développer l'allure soutenue et l'économie de course tout en conservant une base d'endurance | La séance clé de course dépend du bloc et du niveau ; ne pas conserver une séance rapide si douleur ou fatigue locale |
| Natation | Efficacité, économie et continuité sur la distance complète ; eau libre et orientation | Efficacité et maintien d'une allure soutenue sur une distance plus courte | La natation reste régulière dans les deux formats ; la priorité technique dépend du besoin individuel |
| Enchaînement vélo-course | Spécificité importante, avec durée progressive et contrôle de la fatigue | Enchaînements plus ciblés sur l'allure de course et la tolérance à l'intensité | L'enchaînement est une séance clé uniquement lorsqu'il est explicitement planifié et toléré |
| Renforcement | Entretien de la robustesse, économie gestuelle et prévention de la fatigue mécanique | Entretien de la force et soutien de la qualité/intensité | Le renforcement ne doit pas créer une fatigue qui dégrade les séances clés ; alléger si besoin |
| Répartition de l'intensité | Grande majorité facile ; intensité introduite avec prudence et selon expérience | Toujours majoritairement facile, avec davantage de place possible pour du travail soutenu si l'athlète le tolère | Aucun quota fixe par format sans validation du coach et données de l'athlète |
| Récupération | Coût cumulé des longues séances à surveiller de près | Récupération également essentielle ; ne pas supposer qu'un 70.3 autorise une densité élevée | La récupération dépend d'abord de la réponse individuelle, pas d'un seuil de douleur ou de fatigue plus permissif |

## 4. Adaptation en cas de fatigue ou de douleur

| Signal | Réponse commune aux deux formats | Nuance selon le format |
|---|---|---|
| Douleur élevée (notamment ≥4/10 selon le seuil actuel) | Bloquer toute adaptation automatique qui pourrait masquer le problème ; évaluation humaine et avis médical si nécessaire | Aucune différence : l'Ironman ne justifie jamais de tolérer davantage de douleur |
| Douleur modérée ou croissante dans une discipline | Surveillance locale, réduction/ remplacement à décider selon localisation, évolution et avis professionnel | En Ironman, ne pas préserver une longue sortie course à pied au détriment d'une douleur ; en 70.3, ne pas préserver une séance rapide au même prix |
| Fatigue locale sans douleur | Adapter d'abord la discipline concernée ; conserver les autres si les signaux sont bons | Préserver éventuellement une séance clé non concernée, mais seulement si elle reste compatible avec la récupération |
| Fatigue générale / plusieurs disciplines | Réduire la charge globale ; supprimer ou raccourcir les séances les moins prioritaires ; ne pas transformer mécaniquement toutes les séances en séances faciles si une réorganisation est préférable | Ironman : protéger la récupération après les grosses charges vélo/enchaînement. 70.3 : protéger la récupération autour des séances soutenues |
| RPE en hausse, forme basse ou bilans défavorables répétés | Confirmer la tendance et tenir compte du nombre de données disponibles ; pas de progression automatique | Les seuils de détection restent communs au départ ; seule la sélection des séances à réorganiser dépend du format |
| Données absentes ou trop peu nombreuses | État « données insuffisantes » ; demander le retour de l'athlète, conserver le plan prudent et ne pas augmenter la charge | Aucune différence |

**Point faible à éviter :** une règle du type « en Ironman, on garde coûte que coûte la sortie longue » serait dangereuse. La séance clé est une priorité de planification, pas un droit à passer outre les signaux de douleur ou de fatigue.

## 5. Progression de charge et semaines de récupération

### Règle commune proposée

- Partir de la charge réellement tolérée et observée, pas d'un volume théorique lié à la distance.
- Individualiser la progression à partir des 4 dernières semaines, de l'historique, des disponibilités et de la réponse aux séances.
- Ne pas considérer +10 % comme une autorisation automatique : c'est une limite actuellement affichée dans l'application, à valider ou remplacer par une logique individualisée.
- Une semaine de récupération ne doit pas être déclenchée uniquement par le numéro de semaine ; elle doit aussi tenir compte de la fatigue réelle, des contraintes et du calendrier.
- Ne jamais augmenter la charge pour compenser une semaine incomplète.

### Différences à définir par le coach

| Sujet | Ironman | Half-Ironman / 70.3 |
|---|---|---|
| Volume maximal | Peut être supérieur chez un athlète expérimenté et disponible, mais ne doit pas être imposé par le type de course | Généralement calibré autour de l'objectif et du niveau ; pas de plafond automatique universel |
| Progression du vélo | La progression de la durée spécifique est un enjeu majeur ; surveiller son coût sur les jours suivants | Développer la capacité à soutenir l'allure cible sans empiler les séances dures |
| Progression de la course | Prudence accrue sur l'accumulation de durée et de fatigue mécanique ; l'enchaînement doit être comptabilisé | Progression également prudente ; la qualité ne doit pas se superposer à une hausse de volume |
| Semaine allégée | Peut être nécessaire après un bloc vélo/enchaînement exigeant | Peut être nécessaire après un bloc de travail soutenu ou une hausse de charge |
| Critère de reprise de progression | Signaux de récupération revenus à un niveau acceptable et absence de douleur préoccupante | Même critère |

Aucun volume hebdomadaire fixe (heures, kilomètres ou TSS) n'est proposé ici : sans niveau, historique et disponibilité, ce serait une fausse précision.

## 6. Phases et affûtage

| Phase | Ironman | Half-Ironman / 70.3 | Comportement attendu du moteur |
|---|---|---|---|
| Base | Construire une base aérobie régulière, technique et tolérance progressive aux durées | Même socle, avec développement progressif de l'économie et de la qualité | Ne pas augmenter automatiquement la charge si les données de récupération sont incomplètes |
| Développement | Développer la capacité à absorber les longues charges et la régularité | Développer la puissance soutenue et l'endurance spécifique | Tenir compte du volume déjà réalisé et de la disponibilité réelle |
| Spécifique | Priorité à la durabilité vélo, à la nutrition testée et aux enchaînements maîtrisés | Priorité à l'allure cible, aux efforts soutenus et aux enchaînements adaptés | Les séances clés doivent être explicitement identifiées dans le plan, et non devinées par leur durée seule |
| Affûtage | Réduire la fatigue tout en conservant quelques rappels spécifiques ; éviter une longue séance qui laisse des traces | Même principe, avec rappels courts d'allure et fraîcheur | Respecter l'affûtage prévu ; ne pas appliquer une seconde réduction générique sur des séances déjà allégées |
| Semaine de course | Fraîcheur, logistique et rappels très courts | Même principe | Protéger les openers, la course et les événements |
| Après course | Transition/récupération adaptée au coût de l'épreuve | Transition/récupération adaptée au coût de l'épreuve | Ne pas appliquer une reprise standard : attendre le retour de l'athlète et tenir compte des symptômes |

**À corriger dans une future évolution :** le code actuel utilise déjà des phases et des multiplicateurs, mais les règles d'affûtage sont essentiellement communes aux deux formats. Il faudra valider séparément la durée et le contenu du taper avec le coach avant de changer ces paramètres.

## 7. Hiérarchie des séances lors d'une adaptation

Proposition de hiérarchie, à appliquer uniquement si les signaux de sécurité le permettent :

1. Séances déjà réalisées, événements, openers et course : protégés des modifications automatiques.
2. Séances qui aggraveraient une douleur ou une fatigue locale : à retirer, remplacer ou réévaluer en premier.
3. Séances accessoires ou redondantes : premières candidates à la suppression ou à la réduction.
4. Séance clé spécifique non concernée par les signaux : peut être conservée ou raccourcie si cela ne compromet pas la récupération.
5. Séances faciles : à conserver si elles favorisent une récupération active et restent réellement faciles ; repos si nécessaire.

| Situation | Arbitrage Ironman | Arbitrage 70.3 |
|---|---|---|
| Fatigue vélo seule | Réévaluer d'abord la durée/intensité de la séance vélo clé ; ne pas déplacer la fatigue vers la course | Réévaluer d'abord la séance vélo soutenue ; préserver la course facile si elle est bien tolérée |
| Fatigue course seule | Retirer en priorité l'intensité ou l'enchaînement course ; ne pas « sauver » une longue course douloureuse | Retirer en priorité la séance rapide ou l'enchaînement ; conserver le vélo seulement si récupération correcte |
| Fatigue générale | Supprimer le travail accessoire et réduire les charges clés selon gravité ; priorité à la récupération | Même logique ; ne pas garder toutes les séances de qualité par peur de perdre l'allure |
| Douleur préoccupante | Pas de hiérarchie sportive : la sécurité prime | Pas de hiérarchie sportive : la sécurité prime |

## 8. Paramètres à ne pas coder avant validation

Les éléments suivants doivent être définis avec le coach et/ou calibrés sur les données des athlètes :

- critères permettant de marquer une séance comme « clé » (type, phase, durée, intensité, objectif) ;
- volume et durée des séances longues par niveau d'expérience ;
- fréquence des séances de qualité par discipline ;
- progression maximale et fréquence des semaines allégées ;
- durée et contenu de l'affûtage pour chaque format ;
- règles de reprise après une douleur ou une fatigue importante ;
- seuils de données suffisantes pour établir une tendance fiable ;
- cas des athlètes préparant plusieurs courses A ou une course B/C proche de la course principale.

Les valeurs par défaut actuelles (CTL 105 / 85, progression jusqu'à 10 %, facteurs d'affûtage et réductions de 55 % / 70 %) ne doivent pas être considérées comme validées par cette matrice.

## 9. Critères d'acceptation avant développement

La matrice sera considérée comme validée lorsque :

1. Le coach confirme la hiérarchie des séances clés pour chaque format.
2. Les règles de douleur et de fatigue sont identiques en niveau de sécurité pour les deux formats.
3. Les paramètres de charge et d'affûtage sont individualisables et ne reposent pas uniquement sur le type de course.
4. Les données absentes conduisent à la prudence, jamais à une progression.
5. Le moteur peut expliquer pourquoi une séance est conservée, réduite, remplacée ou supprimée.
6. Les tests couvrent les mêmes signaux pour Ironman et 70.3, puis vérifient les différences attendues de sélection des séances et de phases.

## 10. Décision métier — validée

**Validation explicite de l'utilisateur : les trois arbitrages ci-dessous sont validés le 28 novembre 2026.** Cette validation autorise la préparation des scénarios de tests et de la spécification technique, mais pas encore la modification du moteur, de Supabase ou de la production.

Arbitrages validés :

- **Ironman :** priorité à la durabilité et à la spécificité vélo/enchaînement, sans protéger une séance longue au détriment de la santé.
- **70.3 :** davantage de place possible au travail soutenu et à l'allure cible, sans augmenter automatiquement le nombre de séances intenses.
- **Deux formats :** mêmes garde-fous de douleur, de fatigue et de données manquantes ; différenciation dans la structure du plan, la sélection des séances et l'affûtage, avec paramètres individualisés.

Aucune modification du moteur ou de la production n'est autorisée par ce document. Une évolution du code nécessitera une étape distincte de spécification, de tests, de revue et une autorisation explicite.
