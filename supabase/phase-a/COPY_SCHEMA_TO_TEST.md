# Préparer un projet Supabase de test sans données

Ne jamais exécuter les scripts de phase A sur la production. Utiliser un projet de test isolé, puis vérifier son project ref avant toute commande d'écriture.

1. Depuis le projet source, exporter uniquement le schéma `public` (pas les données) avec `pg_dump --schema-only --schema=public --no-owner --no-privileges`. Stocker le fichier temporairement hors du dépôt et ne pas l'envoyer dans Git.
2. Créer un projet Supabase de test neuf. Il fournit déjà les schémas `auth` et `storage`; ne pas copier les utilisateurs ni les tables Auth du projet source.
3. Restaurer le schéma public avec `psql` et l'option `--single-transaction`. Préserver les policies/grants du dump pour permettre le snapshot initial.
4. Confirmer dans le dashboard que le project ref actif est celui du test. Le schéma public copié ne contient pas de données métier; les utilisateurs Auth de test doivent être créés explicitement dans ce projet.
5. Exécuter `000_export_policies_privileges.sql`, conserver son `snapshot_id`, puis seulement ensuite exécuter `001_identity.sql`, `002_policies_phase_a.sql` et `003_grants.sql` dans cet ordre.
6. Exécuter `check_public_coverage.sql` et `tests_phase_a.sql` sur le projet de test. Ne pas considérer une réussite comme preuve de l'état de production.

Exemple de commandes locales (les chaînes de connexion sont fournies dans des variables d'environnement du terminal, jamais écrites ici, affichées ou commitées) :

```sh
pg_dump "$SOURCE_TEST_COPY_URL" --schema-only --schema=public --no-owner --no-privileges > public_schema.sql
psql "$EMPTY_TEST_DATABASE_URL" --set ON_ERROR_STOP=1 --single-transaction --file public_schema.sql
```

Ces commandes ne font pas partie de la phase A et ne sont pas exécutées par Codex. Elles nécessitent d'abord de confirmer que la source ne contient que le schéma souhaité et que la cible est le projet de test.
