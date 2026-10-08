-- PHASE A / 003_grants
-- À exécuter après 001 et 002, sur TEST seulement.
BEGIN;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, PUBLIC;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, PUBLIC;
REVOKE UPDATE ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Bloquer aussi l'appel public/anonyme direct de fonctions SQL du schéma public.
-- Les triggers n'exigent pas que l'appelant ait EXECUTE sur leur fonction.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, PUBLIC;

-- Le rôle qui créera les futures tables doit exécuter cette migration afin que
-- les nouvelles tables ne reçoivent aucun privilège implicite pour anon/PUBLIC.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM anon, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, PUBLIC;

-- Les policies n'accordent rien à anon/PUBLIC. Les grants authenticated ne
-- contournent pas les policies RLS ; aucune table n'est laissée sans RLS par 002.
COMMIT;
