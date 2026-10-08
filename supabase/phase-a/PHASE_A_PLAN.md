# Phase A — choix et limites

## Ordre

1. `000_export_policies_privileges.sql` — snapshot de métadonnées avant migration; aucune donnée métier n'est exportée.
2. `001_identity.sql` — crée les trois tables d'identité et fonctions d'aide, sans trigger Auth ni création automatique de rôle/membership. Les tables restent sans accès pendant l'intervalle avant 002.
3. `002_policies_phase_a.sql` — dans une transaction, retire les anciennes policies métier, active RLS sur toutes les tables `public` (tables ordinaires, partitionnées et étrangères) et crée des policies `TO authenticated` explicites.
4. `003_grants.sql` — révoque les droits anon/PUBLIC, retire les droits dangereux authenticated, et configure les default privileges du rôle exécutant.
5. `004_validation_triggers.sql` — applique les contrôles de transitions de validation sur plans, associations de stratégies, tests PCA et RETEX.
6. `bootstrap_admin.sql` est exécuté manuellement après les migrations pour un utilisateur Auth existant dont l'UUID est fourni par le propriétaire.
7. `tests_phase_a.sql` — validation transactionnelle après remplacement des UUID de test.

La transaction de 002 rend le basculement de policies/RLS atomique. La classification générique couvre toutes les tables présentes au moment de l'exécution; le contrôle `check_public_coverage.sql` permet de détecter tout oubli. Les nouvelles tables créées après migration n'ont pas de grants par défaut à anon/PUBLIC et doivent recevoir RLS + policies avant d'être exposées.

## Classification des tables

Les 17 tables explicitement signalées par le propriétaire comme RLS désactivée et couvertes par la migration dynamique sont : `bia_applications`, `bia_equipements`, `bia_fournisseurs`, `bia_ressources_humaines`, `evaluations_bia`, `montee_en_charge`, `organisations`, `plans_traitement`, `processus_applications`, `processus_equipements`, `processus_fournisseurs`, `processus_metier`, `processus_ressources_humaines`, `ressources_critiques`, `scenarios_risques`, `strategies_association` et `strategies_catalogue`. `risques`, `actifs`, `contexte_analyse` et `contournements_crise` sont aussi couverts par le remplacement générique des policies.

Les tables enfants et autres relations du schéma `public` sont découvertes au moment de l'exécution via les catalogues PostgreSQL, pas par une liste codée en dur. Aucune table de base ordinaire/partitionnée/foreign n'est volontairement omise. Les trois tables identité sont exclues du DROP dynamique et reçoivent leurs policies spécifiques. Vues, fonctions, séquences et objets hors `public` ne sont pas des tables RLS de cette migration; les fonctions `SECURITY DEFINER` doivent être revues avec le snapshot.

- `menaces`, `parametres_risques`, `strategies_catalogue` : lecture pour tout membre actif; écriture/suppression admin uniquement.
- `organisations` : lecture membre actif; écriture/suppression admin uniquement.
- `incident_main_courante`, `plan_versions` : lecture et insertion pour membre actif autorisé à écrire; aucun UPDATE/DELETE même pour admin.
- Toutes les autres tables public : lecture pour membre actif; INSERT/UPDATE admin ou référent; DELETE admin seulement.
- Toutes les policies sont ciblées explicitement `TO authenticated`; les appels anon n'ont ni grant ni policy.

Le seul inventaire réel fourni pour la base ne contient pas la liste complète des tables publiques. Le mécanisme générique couvre donc les tables inattendues, mais la liste de référentiels globaux ne peut pas être confirmée exhaustivement. Dans le code local, les seuls référentiels explicitement globaux d'après les décisions sont les trois ci-dessus. `ressources_critiques` et `scenarios_risques` sont des candidats dont la portée métier est à confirmer; les tables de ressources et de processus ne sont pas classées globales sans preuve. Revoir la classification à partir du résultat de `check_public_coverage.sql` avant exécution.

## Validation métier (non implémentée sans accord)

Une policy RLS contrôle lignes/opérations, pas la signification d'une transition de statut. Le choix proposé est un trigger `BEFORE INSERT OR UPDATE` qui détecte les transitions vers les statuts de validation et appelle `can_validate()`. Il protège également les appels directs PostgREST et n'exige pas de réécrire immédiatement chaque formulaire existant. Un trigger doit être défini spécifiquement pour les colonnes/statuts réels de chaque table; les noms exacts de `strategies_association`, `tests_pca`, `incident_retex` et tables équivalentes doivent être confirmés contre le schéma de test. Le trigger ne doit pas être créé avant accord explicite.

## Limites phase A

Phase A ne filtre aucune donnée par organisation ou entité : tout rôle actif lit les données métier du projet de test. C'est une phase de réduction de risque, pas une isolation multi-tenant. `organization_id` nullable de `organization_members` n'a volontairement aucune FK. Aucune table `organisations`/entités n'est créée ou modifiée.

Le helper `current_role_name()` renvoie NULL si plusieurs memberships actifs donnent une ambiguïté; phase A suppose une seule organisation. La phase B devra remplacer cette hypothèse par un contexte d'organisation explicite.

## Edge Functions — audit en lecture seule du dépôt

`supabase/config.toml` indique un `project_id` distinct du client métier Resillia et commente un backend Lovable Cloud dans `functionsClient.ts`. Les Edge Functions semblent donc appartenir au projet Cloud identifié dans ce fichier, mais la valeur `VITE_SUPABASE_URL` du client concerné n'a pas été lue; le déploiement distant effectif n'est pas vérifié.

Neuf dossiers de fonctions existent : `bcm-ai-consultant`, `org-process-suggester`, `risk-actions-suggester`, `groq-warroom-assist`, `groq-suggest-test-objectives`, `groq-strategy-assist`, `groq-chatbot`, `groq-extract` et `groq-import-taxonomy`.

La configuration locale fixe `verify_jwt = false` pour les cinq premières fonctions listées dans `supabase/config.toml` (toutes sauf `groq-strategy-assist`, `groq-chatbot`, `groq-extract` et `groq-import-taxonomy`). Ces cinq endpoints ne vérifient donc pas un JWT à la gateway selon cette configuration. Le code parcouru ne comporte pas de `auth.getUser()`/vérification équivalente. Les quatre restantes n'ont pas de valeur `verify_jwt` déclarée; le défaut Supabase est normalement la vérification JWT, mais le déploiement réel n'est pas contrôlable depuis le dépôt.

Le commentaire de `functionsClient.ts` dit d'utiliser le client Cloud pour les Edge Functions. C'est bien le cas pour certains appels, mais `ChatbotWidget`, `OrgChart` et `RegistreTab` invoquent aussi des fonctions avec le client Resillia. Aucun changement des Edge Functions ou de leurs appels n'est inclus dans cette phase.

## Tests et rollback

Le script de tests utilise des UUID d'utilisateurs Auth réels du projet de test, préalablement configurés explicitement selon les quatre rôles et un compte sans membership. Ses fixtures métier sont créées dans une transaction puis annulées. Les scripts `rollback_002` et `rollback_003` requièrent le snapshot 000 et restaurent la configuration initiale exacte; le rollback 002 peut réactiver les policies permissives et désactiver RLS si c'était l'état initial, donc TEST uniquement. Le rollback 001 conserve les tables et lignes identité mais laisse RLS activée sans policy, en mode fermé.
