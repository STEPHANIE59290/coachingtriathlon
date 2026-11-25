// Configuration du compte en ligne (Supabase). Ce fichier ne change jamais d'une mise à jour à l'autre.
// Tant que les deux valeurs sont vides, l'app fonctionne SANS compte, avec les données sur l'appareil.
// Où trouver ces valeurs : Supabase > Project Settings > API (voir GUIDE-COMPTES.md).
// ATTENTION : colle ici la clé « anon public » UNIQUEMENT. Ne colle JAMAIS la clé « service_role ».
window.SB_CONFIG = {
  url: '',      // ex. https://abcdefghijkl.supabase.co
  anonKey: ''   // clé « anon public » (publique par conception, protégée par les règles de sécurité de la base)
};
