# Tendance longitudinale de charge — spécification

## But
Compléter les signaux hebdomadaires par une lecture descriptive de la charge réellement effectuée sur 4 semaines glissantes, sans transformer un indicateur en diagnostic ni déclencher seul une adaptation automatique.

## Mesures
- Volume externe : minutes réellement enregistrées sur les 7 derniers jours, comparées à la moyenne hebdomadaire des 3 semaines précédentes.
- Charge interne indicative : durée × RPE, uniquement lorsque le RPE est renseigné ; mesure séparée du volume.
- Les données absentes ne sont jamais interprétées comme des jours de récupération confirmés.

## Qualité minimale des données
La comparaison est déclarée insuffisante si les 7 derniers jours contiennent moins de 2 séances ou si moins de 2 des 3 semaines antérieures contiennent des séances. La charge interne exige en plus au moins 2 RPE récents et 4 RPE antérieurs. Si les conditions ne sont pas remplies, la mesure correspondante est omise.

## Interprétation
Une hausse supérieure à 20 % est un signal de revue, pas un seuil de blessure ni une consigne automatique. Le moteur doit la croiser avec douleur, fatigue, RPE, forme, phase, objectif Ironman/70.3 et disponibilité. Aucun rattrapage de séances manquées. Les mêmes garde-fous s'appliquent aux deux formats ; la spécificité du plan et de l'affûtage reste différenciée.

## Limites et prochaine étape
L'implémentation initiale est consultative : elle ajoute des signaux à la prévision sur 7 jours mais ne modifie ni les paramètres de progression, ni le planning, ni les adaptations automatiques. Le seuil de 20 % est un repère de vigilance à valider sur les données des athlètes ; il ne constitue pas une limite physiologique universelle. Les tests utilisent uniquement des données synthétiques.
