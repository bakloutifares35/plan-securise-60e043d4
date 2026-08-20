-- ============================================================
-- M5 — Gestion des Plans (Resillia)
-- À exécuter dans l'éditeur SQL du projet Supabase de production.
-- ============================================================

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'PCA',                -- PCA | PRA | Crise | Communication
  titre text not null,
  numero_version int not null default 1,
  plan_parent_id uuid references public.plans(id) on delete set null,
  entite_id uuid,
  statut text not null default 'Brouillon',        -- Brouillon | En révision | Approuvé | À réviser | Archivé
  redacteur text,
  validateur_metier text,
  responsable_pca text,
  date_approbation date,
  date_revision_suivante date,
  est_actif boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.plan_sections (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  ordre int not null default 0,
  titre text not null,
  contenu text,
  statut text default 'À rédiger',                 -- À rédiger | En cours | Rédigé
  created_at timestamptz default now()
);

create table if not exists public.plan_procedures (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.plan_sections(id) on delete cascade,
  titre text not null,
  ordre int not null default 0
);

create table if not exists public.plan_etapes (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references public.plan_procedures(id) on delete cascade,
  ordre int not null default 0,
  description text,
  responsable text,
  duree_estimee_minutes int
);

create table if not exists public.plan_etape_ressources (
  id uuid primary key default gen_random_uuid(),
  etape_id uuid not null references public.plan_etapes(id) on delete cascade,
  resource_type text not null,                     -- ressources_humaines | ressources_equipements | applications_it | fournisseurs
  resource_id uuid not null
);

create table if not exists public.plan_contacts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  ordre int not null default 0,
  nom text,
  role text,
  telephone text,
  email text,
  est_suppleant boolean not null default false
);

create table if not exists public.plan_processus (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  processus_id uuid not null,
  unique (plan_id, processus_id)
);

create table if not exists public.plan_risques (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  risque_id uuid not null,
  unique (plan_id, risque_id)
);

create table if not exists public.plan_strategies (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  strategie_association_id uuid not null,
  unique (plan_id, strategie_association_id)
);

create table if not exists public.plan_workflow (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  etape text not null,                             -- Rédaction | Revue métier | Validation PCA | Validation Direction
  validateur text,
  statut text not null default 'En attente',       -- En attente | Validé | Refusé
  commentaire text,
  date timestamptz default now()
);

create table if not exists public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  numero_version int not null default 1,
  snapshot jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz default now()
);

-- Index utiles
create index if not exists idx_plan_sections_plan on public.plan_sections(plan_id);
create index if not exists idx_plan_procedures_section on public.plan_procedures(section_id);
create index if not exists idx_plan_etapes_procedure on public.plan_etapes(procedure_id);
create index if not exists idx_plan_processus_plan on public.plan_processus(plan_id);
create index if not exists idx_plan_versions_plan on public.plan_versions(plan_id);

-- ============================================================
-- GRANTS (obligatoires : PostgREST n'accorde rien par défaut)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'plans','plan_sections','plan_procedures','plan_etapes','plan_etape_ressources',
    'plan_contacts','plan_processus','plan_risques','plan_strategies','plan_workflow','plan_versions'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Accès complet %1$s" on public.%1$I', t);
    execute format('create policy "Accès complet %1$s" on public.%1$I for all using (true) with check (true)', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
