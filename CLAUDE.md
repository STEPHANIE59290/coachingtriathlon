# Mon Coach — consignes pour Claude

Application web de coaching sportif côté athlète, en un seul fichier (`index.html`), publiée depuis ce dépôt.
Données stockées dans le `localStorage` (clés `half04_*`), synchronisées via Supabase (connexion e-mail + mot de passe).

## Principes
- **Modifications ciblées** : ne jamais réécrire le fichier entier. Proposer un avant/après et n'éditer que ce qui est nécessaire.
- **Multi-athlètes, tous triathlètes en coaching** : l'app sert à plusieurs athlètes. Aucune règle, valeur ou texte ne doit dépendre d'un profil particulier (niveau, objectif, heures disponibles). Le triathlon (natation, vélo, course) reste le cadre : inutile de la rendre indépendante du sport.
- **Rédaction en français**, y compris les textes affichés et les commentaires.

## Avant chaque modification
1. Lancer `python3 tests/run.py` : il doit afficher « OK : aucune régression ».
2. Après un changement voulu du comportement, relancer avec `--update` pour réécrire `tests/golden.json`, et expliquer pourquoi la référence change.
3. Le démarrage doit rester sous le budget du banc de test (CPU ×4).
4. Les mêmes tests tournent sur GitHub (`.github/workflows/tests.yml`) à chaque envoi sur `main` et à chaque pull request : ne pas fusionner si le contrôle `tests` est rouge.

## Version
À chaque évolution, remplacer le numéro de version partout (méta `app-version`, titre, en-tête, `APP_VERSION`, export). Sans cela, le contrôle de mise à jour ne détecte pas la nouvelle version.

## Performances
- Ne pas calculer ce qui est replié ou hors écran : les cartes `fold closed` ne se rendent qu'à l'ouverture (`toggleFold`).
- `raceInfo` est mémoïsée : ne pas muter l'objet renvoyé.
- Éviter les `get()` (JSON.parse) répétés dans des boucles.

## Sécurité
- Ne jamais écrire de clé ou de jeton dans le dépôt. `config.js` ne contient que l'URL et la clé publique (anon) de Supabase.
- Accès Supabase par Claude : projet unique et lecture seule, de préférence sur une copie de test. Les données des athlètes (santé, séances) sont sensibles.
