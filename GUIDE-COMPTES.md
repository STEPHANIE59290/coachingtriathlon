# Comptes Mon Coach Half : mise en place (environ 20 minutes)

L'app fonctionne **sans compte** tant que `config.js` est vide. Ces étapes activent la connexion
par e-mail et mot de passe, **sur invitation uniquement**, et la synchronisation entre appareils.

## 1. Créer le projet Supabase
1. Crée un compte sur supabase.com, puis **New project**.
2. **Region** : choisis l'Europe (Paris ou Frankfurt). Note le mot de passe de la base, tu n'en auras plus besoin.
3. Attends que le projet soit prêt.

## 2. Créer la base
1. Menu **SQL Editor** → **New query**.
2. Colle tout le contenu de `supabase.sql` → **Run**. Tu dois voir « Success ».

## 3. Réglages de sécurité (Authentication)
1. **Sign In / Providers → Email** :
   - **Allow new users to sign up : désactivé** (inscription sur invitation uniquement) ;
   - **Minimum password length : 10** ;
   - active la protection contre les mots de passe compromis si elle est proposée.
2. **URL Configuration** :
   - **Site URL** : l'adresse de ton app (le lien Netlify) ;
   - **Redirect URLs** : ajoute la même adresse.

## 4. Relier l'app
1. **Project Settings → API**. Copie **Project URL** et la clé **anon public**.
2. Ouvre `config.js` dans ton dépôt GitHub, colle les deux valeurs entre les guillemets, valide (commit).
3. **Ne colle jamais la clé « service_role »** : elle donne accès à toutes les données.
4. Ce fichier ne change plus ensuite : seules les mises à jour de `index.html` sont à remplacer.

## 5. Inviter une personne
1. **Authentication → Users → Invite user**, saisis son e-mail.
2. Elle reçoit un e-mail, touche le lien, arrive sur l'app et **choisit son mot de passe**.
3. Ensuite elle se connecte avec son e-mail et son mot de passe, sur n'importe quel appareil.
4. Pour toi : invite ta propre adresse. À la première connexion, l'app te propose d'envoyer vers ton compte les
   données déjà présentes sur ton téléphone.

## 6. À savoir avant d'inviter d'autres personnes
- **E-mails** : le service d'envoi gratuit de Supabase est très limité (quelques e-mails par heure). Dès que tu invites
  plusieurs personnes, configure un SMTP personnalisé (Authentication → SMTP Settings).
- **Projet gratuit** : il est mis en pause après environ une semaine sans activité et n'a pas de sauvegarde automatique.
  Ton usage régulier le garde actif ; fais aussi un export JSON de temps en temps.
- **Données de santé** (sommeil, VFC, ressenti) : en hébergeant celles d'autres personnes, tu deviens responsable de leur
  traitement : informe-les, recueille leur accord, et réponds à leurs demandes. Chaque utilisateur peut **exporter** ses
  données et **supprimer son compte** depuis Profil → Mon compte.
- **Clé intervals.icu** : elle reste sur chaque appareil et n'est jamais envoyée au compte.
- **Se déconnecter** efface les données de l'appareil (elles restent dans le compte).
