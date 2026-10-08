-- Contrôle en lecture seule après 001/002/003.
-- Résultat attendu : aucune ligne dans les trois premiers résultats.

-- 1. Tables public sans RLS.
SELECT n.nspname AS schema_name, c.relname AS table_name, c.relkind,
       c.relrowsecurity AS rls_enabled
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'f')
  AND NOT c.relrowsecurity
ORDER BY c.relname;

-- 2. Policies résiduelles ciblant PUBLIC/anon ou policies sans rôle explicite.
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND ('public' = ANY (roles) OR 'anon' = ANY (roles))
ORDER BY tablename, policyname;

-- 3. Tables exposées par grants à anon ou PUBLIC.
SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- 4. Inventaire exhaustif des tables et classe de policy attendue.
-- Les tables non classées explicitement reçoivent le modèle métier générique.
SELECT c.relname AS table_name,
       CASE
         WHEN c.relname IN ('profiles', 'organization_members', 'member_entities') THEN 'identity'
         WHEN c.relname IN ('menaces', 'parametres_risques', 'strategies_catalogue') THEN 'global_reference'
         WHEN c.relname = 'organisations' THEN 'organization_directory'
         WHEN c.relname IN ('incident_main_courante', 'plan_versions') THEN 'append_only_audit'
         ELSE 'business_default'
       END AS phase_a_policy_class,
       c.relrowsecurity AS rls_enabled,
       count(p.policyname) AS policy_count,
       array_agg(DISTINCT p.cmd) FILTER (WHERE p.policyname IS NOT NULL) AS commands,
       array_agg(DISTINCT p.roles::text) FILTER (WHERE p.policyname IS NOT NULL) AS policy_roles
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
LEFT JOIN pg_policies AS p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'f')
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;

-- 5. Tables avec une opération requise manquante. Les journaux n'ont volontairement
-- pas UPDATE/DELETE; les référentiels et organisations ont une écriture admin dédiée.
SELECT n.nspname AS schema_name, c.relname AS table_name
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'f')
  AND NOT c.relrowsecurity
ORDER BY c.relname;

-- 6. Policies UPDATE/ALL qui doivent obligatoirement avoir WITH CHECK.
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd IN ('UPDATE', 'ALL')
  AND with_check IS NULL
ORDER BY tablename, policyname;
