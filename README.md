# Mon Coach Half + serveur MCP sur le même site

Ce dossier contient **l'app (version 1.7.0) et le serveur MCP ensemble** :
- `public/index.html` : ton app, à la racine du site ;
- `netlify/functions/mcp.mjs` : le serveur MCP, à l'adresse `/mcp/TON_JETON`.

**Pour mettre à jour l'app plus tard**, il suffit de remplacer `public/index.html` dans GitHub (« Add file » > « Upload files », même nom de fichier, puis « Commit ») : Netlify redéploie tout seul. Le serveur n'est pas touché et ne dépend pas de la version de l'app.

**Attention aux données de l'app** : elles sont enregistrées dans ton navigateur, **par adresse de site**. Si l'app change d'adresse (nouveau site Netlify), elle repart à vide. Avant de changer, ouvre l'ancienne adresse > Suivi > « Exporter toutes mes données », puis sur la nouvelle adresse > « Restaurer une sauvegarde ». La clé intervals.icu n'est pas dans la sauvegarde : ressaisis-la.

Ne mets jamais le jeton MCP ni une clé API dans `index.html` : ce fichier est public.

---

# Serveur MCP intervals.icu pour Claude

Ce petit serveur donne à Claude un accès à ton compte intervals.icu : séances réalisées, détail des blocs, courbes, récupération (sommeil, VFC), condition physique (fitness, fatigue), calendrier. En option, il peut créer des séances planifiées.

**Important : l'adresse du connecteur est un mot de passe.** Quiconque la connaît peut lire tes données d'entraînement. Ne la partage pas et ne la publie pas.

## Contenu du dossier
- `netlify/functions/mcp.mjs` : le serveur (aucune dépendance).
- `netlify.toml` : réglages Netlify.
- `public/index.html` : page vide (Netlify en demande une).
- `tests/test_mcp.mjs` : tests avec une fausse API intervals.icu (`node tests/test_mcp.mjs`).

## 1. Déployer sur Netlify
Les fonctions Netlify ne se déposent pas, à ma connaissance, par simple glisser-déposer : utilise GitHub ou la ligne de commande.

**Avec GitHub (le plus simple)**
1. Crée un dépôt privé sur GitHub et envoie-y tout le contenu de ce dossier (bouton « Add file » > « Upload files », en gardant les sous-dossiers).
2. Sur Netlify : « Add new site » > « Import an existing project » > GitHub > choisis le dépôt. Les réglages sont lus dans `netlify.toml` : laisse les champs de build vides.
3. Tu peux aussi relier ce dépôt à un site existant (par exemple celui que tu as déjà créé) plutôt qu'à un nouveau.

**Avec la ligne de commande**
```
npm install -g netlify-cli
netlify login
netlify deploy --prod
```
(choisis ou crée le site quand l'outil le demande.)

## 2. Définir les variables (Site configuration > Environment variables)
| Variable | Valeur |
|---|---|
| `INTERVALS_API_KEY` | **une clé neuve** (intervals.icu > Settings > Developer Settings). Ne réutilise pas celle écrite dans une conversation. |
| `MCP_TOKEN` | un jeton secret d'au moins 24 caractères, de préférence 40 ou plus (gestionnaire de mots de passe, ou `openssl rand -hex 24`) |
| `INTERVALS_ATHLETE_ID` | facultatif ; `0` par défaut = le propriétaire de la clé |
| `ALLOW_WRITE` | **ne pas définir au début.** `true` active la création et la suppression de séances. |

Après avoir enregistré les variables, **relance un déploiement** (Deploys > Trigger deploy) : elles ne sont prises en compte qu'à ce moment.

## 3. Vérifier que le serveur répond
Remplace SITE et JETON :
```
curl -s -X POST https://SITE.netlify.app/mcp/JETON \
  -H "content-type: application/json" -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
Tu dois obtenir la liste des outils. Avec un mauvais jeton, la réponse est « Not found » (404), c'est voulu.

## 4. Ajouter le connecteur dans Claude
Dans Claude : Paramètres > Connecteurs > « Ajouter un connecteur personnalisé » (disponible selon ton abonnement) :
- Adresse : `https://SITE.netlify.app/mcp/JETON`
- Ne renseigne aucune identification OAuth.

Claude se connecte depuis le cloud d'Anthropic : le site doit donc être public sur Internet, d'où le jeton dans l'adresse.

Exemples de demandes : « Analyse mes 4 dernières semaines et compare le réalisé au prévu », « Montre ma fitness, ma fatigue et ma forme depuis janvier », « Qu'est-ce que mon sommeil et ma VFC disent de cette semaine ? ».

## Outils
Lecture seule : `get_activities`, `get_activity`, `get_activity_streams`, `get_wellness`, `get_events`, `get_athlete_settings`.
Écriture (seulement si `ALLOW_WRITE=true`) : `create_workouts` (met à jour au lieu de dupliquer si tu donnes un `external_id`), `delete_workouts` (uniquement par `external_id`).

## Sécurité
- Le jeton et la clé ne sont jamais renvoyés par le serveur. La clé reste dans les variables Netlify.
- Si l'adresse a fuité : change `MCP_TOKEN`, redéploie et mets à jour le connecteur dans Claude.
- Désactive ou supprime le connecteur quand tu n'en as plus besoin.
- Pour l'entraînement d'une autre personne, utilise un autre site avec sa propre clé, et seulement avec son accord.

## Limites
Le code a été testé avec une fausse API (voir `tests/`), pas avec ton vrai compte ni avec Claude. Les champs de l'API intervals.icu ont été vérifiés dans leur documentation publique et leur forum. Si un outil renvoie une erreur, copie le message : il indique en général le champ ou l'accès en cause.
