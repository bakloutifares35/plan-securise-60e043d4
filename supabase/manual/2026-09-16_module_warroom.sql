-- ============================================================
-- M6 — War Room / Gestion de crise (Resillia)
-- À exécuter dans l'éditeur SQL du projet Supabase de production.
-- Convention identique aux autres modules : RLS activée + policy
-- d'accès complet (pas d'authentification applicative pour l'instant).
-- ============================================================

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  type text,
  titre text not null,
  date_heure_debut timestamptz not null default now(),
  date_heure_fin timestamptz,
  niveau_severite text not null default 'P3',        -- P1 | P2 | P3 | P4
  statut text not null default 'Déclaré',            -- Déclaré | En cours | Sous contrôle | Clôturé
  declarant text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.incident_processus (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  processus_id uuid not null,                        -- référence logique vers processus_metier (BIA)
  unique (incident_id, processus_id)
);

create table if not exists public.incident_membres_cellule (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  nom text not null,
  role text,
  telephone text,
  email text,
  heure_activation timestamptz default now()
);

-- Audit trail : jamais modifiable ni supprimable depuis l'UI.
create table if not exists public.incident_main_courante (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  horodatage timestamptz not null default now(),
  auteur text,
  type text not null default 'Information',          -- Décision | Action | Information | Communication
  contenu text not null
);

create table if not exists public.incident_actions (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  description text not null,
  responsable text,
  echeance timestamptz,
  statut text not null default 'À faire',            -- À faire | En cours | Fait
  plan_associe_id uuid,                              -- référence souple vers public.plans (M5), sans FK stricte
  created_at timestamptz default now()
);

-- Plans PCA/PRA activés pendant la crise. plan_id renseigné si le module M5
-- est installé, sinon libelle libre.
create table if not exists public.incident_plans (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  plan_id uuid,
  libelle text,
  created_at timestamptz default now()
);

-- Communication de crise : suivi rédactionnel uniquement, aucun envoi réel.
create table if not exists public.incident_communications (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  objet text not null,
  message text,
  statut text not null default 'Brouillon',          -- Brouillon | Validé | Envoyé
  auteur text,
  created_at timestamptz default now()
);

create table if not exists public.incident_retex (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  resume text,
  causes_racines text,
  points_positifs text,
  points_amelioration text,
  actions_correctives text,
  valide_par text,
  date_validation timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (incident_id)
);

create index if not exists idx_incident_processus_incident on public.incident_processus(incident_id);
create index if not exists idx_incident_mc_incident on public.incident_main_courante(incident_id);
create index if not exists idx_incident_actions_incident on public.incident_actions(incident_id);
create index if not exists idx_incident_comms_incident on public.incident_communications(incident_id);

-- ============================================================
-- GRANTS (obligatoires : PostgREST n'accorde rien par défaut)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'incidents','incident_processus','incident_membres_cellule','incident_main_courante',
    'incident_actions','incident_plans','incident_communications','incident_retex'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Accès complet %1$s" on public.%1$I', t);
    execute format('create policy "Accès complet %1$s" on public.%1$I for all using (true) with check (true)', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
