// src/components/plans/PlanEditor.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge"; // ✅ IMPORT AJOUTÉ
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Plus, Trash2, Save, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronRight,
  Users, Link2, History, GitBranch, Loader2, Phone, Mail, ListChecks, FileDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/db";
import { RichTextEditor } from "./RichTextEditor";
import { PlansData, ProcessLite } from "./usePlans"; // ✅ Import du type enrichi
import {
  Plan, PlanContact, PlanEtape, PlanProcedure, PlanSection, PlanVersion, WorkflowEntry,
  PLAN_STATUTS, PLAN_TYPES, RESOURCE_TYPES, STATUT_STYLE, WORKFLOW_ETAPES,
  effectiveStatut, fmtDate,
} from "./types";
import { computeMaxScore, scoreToCriticality, type Criticality } from "@/data/bia";

const SECTION_STATUTS = ["À rédiger", "En cours", "Rédigé"];

// **STYLE DES PASTILLES D'ÉTAT POUR LES SECTIONS**
const SECTION_STATUS_STYLES = {
  "Rédigé": { bg: "#E8F5E9", text: "#2E7D32", dot: "#2E7D32" },
  "En cours": { bg: "#FFF8E1", text: "#F57F17", dot: "#F57F17" },
  "À rédiger": { bg: "#F1EFE8", text: "#6C7A8A", dot: "#6C7A8A" },
};

// Palette pour les cards
const CRITICALITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "Critique": { bg: "#FFEBEE", text: "#C62828", border: "#EF9A9A" },
  "Sévère": { bg: "#FBE9E7", text: "#D84315", border: "#FFAB91" },
  "Majeur": { bg: "#FFF3E0", text: "#E65100", border: "#FFCC80" },
  "Modéré": { bg: "#FFF8E1", text: "#F57F17", border: "#FFE082" },
  "Mineur": { bg: "#E8F5E9", text: "#2E7D32", border: "#A5D6A7" },
};

const RTO_STYLES: Record<string, string> = {
  "4h": "#FFEBEE",
  "8h": "#FBE9E7",
  "12h": "#FFF3E0",
  "24h": "#FFF8E1",
  "72h": "#E8F5E9",
};

export const PlanEditor = ({
  planId,
  data,
  onBack,
}: {
  planId: string;
  data: PlansData;
  onBack: () => void;
}) => {
  const plan = data.plans.find((p) => p.id === planId);
  const [sections, setSections] = useState<PlanSection[]>([]);
  const [procedures, setProcedures] = useState<PlanProcedure[]>([]);
  const [etapes, setEtapes] = useState<PlanEtape[]>([]);
  const [etapeRes, setEtapeRes] = useState<any[]>([]);
  const [contacts, setContacts] = useState<PlanContact[]>([]);
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowEntry[]>([]);
  const [resources, setResources] = useState<Record<string, any[]>>({});
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [openProcs, setOpenProcs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("contenu"); // ✅ État d'onglet préservé
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState<Partial<Plan>>({});

  const loadDetail = useCallback(async () => {
    setLoading(true);
    const { data: secs } = await supabase.from("plan_sections").select("*").eq("plan_id", planId).order("ordre");
    const sectionIds = ((secs as any[]) ?? []).map((s) => s.id);
    const { data: procs } = sectionIds.length
      ? await supabase.from("plan_procedures").select("*").in("section_id", sectionIds).order("ordre")
      : { data: [] as any[] };
    const procIds = ((procs as any[]) ?? []).map((p) => p.id);
    const { data: steps } = procIds.length
      ? await supabase.from("plan_etapes").select("*").in("procedure_id", procIds).order("ordre")
      : { data: [] as any[] };
    const stepIds = ((steps as any[]) ?? []).map((s) => s.id);
    const { data: stepRes } = stepIds.length
      ? await supabase.from("plan_etape_ressources").select("*").in("etape_id", stepIds)
      : { data: [] as any[] };

    const [ctc, ver, wf, rh, eq, app, four] = await Promise.all([
      supabase.from("plan_contacts").select("*").eq("plan_id", planId).order("ordre"),
      supabase.from("plan_versions").select("*").eq("plan_id", planId).order("numero_version", { ascending: false }),
      supabase.from("plan_workflow").select("*").eq("plan_id", planId).order("date"),
      supabase.from("ressources_humaines").select("id, name").limit(500),
      supabase.from("ressources_equipements").select("id, name").limit(500),
      supabase.from("applications_it").select("id, name").limit(500),
      supabase.from("fournisseurs").select("id, name").limit(500),
    ]);

    setSections((secs as PlanSection[]) ?? []);
    setProcedures((procs as PlanProcedure[]) ?? []);
    setEtapes((steps as PlanEtape[]) ?? []);
    setEtapeRes((stepRes as any[]) ?? []);
    setContacts((ctc.data as PlanContact[]) ?? []);
    setVersions((ver.data as PlanVersion[]) ?? []);
    setWorkflow((wf.data as WorkflowEntry[]) ?? []);
    setResources({
      ressources_humaines: (rh.data as any[]) ?? [],
      ressources_equipements: (eq.data as any[]) ?? [],
      applications_it: (app.data as any[]) ?? [],
      fournisseurs: (four.data as any[]) ?? [],
    });
    setActiveSection((prev) => prev ?? ((secs as any[]) ?? [])[0]?.id ?? null);
    setLoading(false);
  }, [planId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);
  useEffect(() => { if (plan) setMeta(plan); }, [plan?.id, plan?.updated_at]);

  const linkedProcess = useMemo(
    () => data.links.processus.filter((l) => l.plan_id === planId).map((l) => l.processus_id),
    [data.links.processus, planId]
  );
  const linkedRisks = useMemo(
    () => data.links.risques.filter((l) => l.plan_id === planId).map((l) => l.risque_id),
    [data.links.risques, planId]
  );
  const linkedStrats = useMemo(
    () => data.links.strategies.filter((l) => l.plan_id === planId).map((l) => l.strategie_association_id),
    [data.links.strategies, planId]
  );

  const completion = useMemo(() => {
    if (!sections.length) return 0;
    const done = sections.filter((s) => s.statut === "Rédigé").length;
    return Math.round((done / sections.length) * 100);
  }, [sections]);

  if (!plan) {
    return (
      <div className="py-20 text-center text-[#172030]/50">
        Plan introuvable. <Button variant="link" onClick={onBack}>Retour à la bibliothèque</Button>
      </div>
    );
  }

  const statut = effectiveStatut(plan);
  const st = STATUT_STYLE[statut] || STATUT_STYLE.Brouillon;

  // ---------- Sections ----------
  const saveSection = async (s: PlanSection, patch: Partial<PlanSection>) => {
    setSections((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...patch } : x)));
    await supabase.from("plan_sections").update(patch).eq("id", s.id);
  };

  const addSection = async () => {
    const titre = prompt("Titre de la nouvelle section :");
    if (!titre) return;
    await supabase.from("plan_sections").insert({ plan_id: planId, titre, ordre: sections.length, statut: "À rédiger", contenu: "" });
    await loadDetail();
  };

  const removeSection = async (id: string) => {
    if (!confirm("Supprimer cette section et ses procédures ?")) return;
    await supabase.from("plan_sections").delete().eq("id", id);
    setActiveSection(null);
    await loadDetail();
  };

  // ---------- Procédures / étapes ----------
  const addProcedure = async (sectionId: string) => {
    const titre = prompt("Titre de la procédure :");
    if (!titre) return;
    const count = procedures.filter((p) => p.section_id === sectionId).length;
    await supabase.from("plan_procedures").insert({ section_id: sectionId, titre, ordre: count });
    await loadDetail();
  };

  const addEtape = async (procedureId: string) => {
    const count = etapes.filter((e) => e.procedure_id === procedureId).length;
    await supabase.from("plan_etapes").insert({ procedure_id: procedureId, ordre: count, description: "", responsable: "", duree_estimee_minutes: 15 });
    await loadDetail();
  };

  const saveEtape = async (id: string, patch: Partial<PlanEtape>) => {
    setEtapes((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    await supabase.from("plan_etapes").update(patch).eq("id", id);
  };

  const toggleEtapeResource = async (etapeId: string, type: string, resourceId: string) => {
    const existing = etapeRes.find((r) => r.etape_id === etapeId && r.resource_id === resourceId && r.resource_type === type);
    if (existing) {
      await supabase.from("plan_etape_ressources").delete().eq("id", existing.id);
    } else {
      await supabase.from("plan_etape_ressources").insert({ etape_id: etapeId, resource_type: type, resource_id: resourceId });
    }
    const { data: refreshed } = await supabase
      .from("plan_etape_ressources")
      .select("*")
      .in("etape_id", etapes.map((e) => e.id));
    setEtapeRes((refreshed as any[]) ?? []);
  };

  // ---------- Contacts ----------
  const addContact = async () => {
    await supabase.from("plan_contacts").insert({ plan_id: planId, ordre: contacts.length, nom: "", role: "", telephone: "", email: "", est_suppleant: false });
    await loadDetail();
  };
  const saveContact = async (id: string, patch: Partial<PlanContact>) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    await supabase.from("plan_contacts").update(patch).eq("id", id);
  };
  const removeContact = async (id: string) => {
    await supabase.from("plan_contacts").delete().eq("id", id);
    await loadDetail();
  };

  // ---------- Associations ----------
  const toggleLink = async (table: string, column: string, value: string, isLinked: boolean) => {
    if (isLinked) {
      await supabase.from(table).delete().eq("plan_id", planId).eq(column, value);
    } else {
      await supabase.from(table).insert({ plan_id: planId, [column]: value });
    }
    await data.reload();
  };

  // ---------- Métadonnées / workflow / versions ----------
  const saveMeta = async () => {
    setSaving(true);
    await data.updatePlan(planId, {
      titre: meta.titre,
      type: meta.type,
      statut: meta.statut,
      redacteur: meta.redacteur,
      validateur_metier: meta.validateur_metier,
      responsable_pca: meta.responsable_pca,
      date_approbation: meta.date_approbation || null,
      date_revision_suivante: meta.date_revision_suivante || null,
    });
    setSaving(false);
    toast({ title: "Plan enregistré" });
  };

  const snapshot = () => ({
    plan: { ...plan, ...meta },
    sections,
    procedures,
    etapes,
    contacts,
  });

  const createVersion = async () => {
    const next = (plan.numero_version ?? 1) + 1;
    await supabase.from("plan_versions").insert({
      plan_id: planId,
      numero_version: plan.numero_version ?? 1,
      snapshot: snapshot(),
      created_by: plan.redacteur || null,
    });
    await data.updatePlan(planId, { numero_version: next });
    await loadDetail();
    toast({ title: `Version ${plan.numero_version ?? 1} archivée`, description: `Le plan passe en version ${next}.` });
  };

  const advanceWorkflow = async (etape: string, statutWf: "Validé" | "Refusé", validateur: string, commentaire: string) => {
    await supabase.from("plan_workflow").insert({
      plan_id: planId,
      etape,
      statut: statutWf,
      validateur: validateur || null,
      commentaire: commentaire || null,
      date: new Date().toISOString(),
    });

    if (statutWf === "Refusé") {
      await data.updatePlan(planId, { statut: "En révision" });
    } else if (etape === "Validation Direction") {
      const approba = new Date();
      const next = new Date();
      next.setFullYear(next.getFullYear() + 1);
      await data.updatePlan(planId, {
        statut: "Approuvé",
        date_approbation: approba.toISOString().slice(0, 10),
        date_revision_suivante: next.toISOString().slice(0, 10),
      });
      toast({ title: "Plan approuvé", description: "Prochaine révision programmée dans 12 mois." });
    } else {
      await data.updatePlan(planId, { statut: "En révision" });
    }
    await loadDetail();
  };

  const exportMarkdown = () => {
    const strip = (h?: string | null) => (h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    let out = `# ${plan.titre} (${plan.type}) — v${plan.numero_version ?? 1}\n\n`;
    sections.forEach((s) => {
      out += `## ${s.titre}\n${strip(s.contenu) || "_(à rédiger)_"}\n\n`;
      procedures.filter((p) => p.section_id === s.id).forEach((p) => {
        out += `### ${p.titre}\n`;
        etapes.filter((e) => e.procedure_id === p.id).forEach((e, i) => {
          out += `${i + 1}. ${e.description || ""} — ${e.responsable || "—"} (${e.duree_estimee_minutes ?? 0} min)\n`;
        });
        out += "\n";
      });
    });
    if (contacts.length) {
      out += `## Annuaire de crise\n`;
      contacts.forEach((c) => {
        out += `- ${c.nom || "—"} (${c.role || "—"})${c.est_suppleant ? " [suppléant]" : ""} — ${c.telephone || "—"} — ${c.email || "—"}\n`;
      });
    }
    const blob = new Blob([out], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${plan.titre.replace(/\s+/g, "_")}_v${plan.numero_version ?? 1}.md`;
    a.click();
  };

  const currentSection = sections.find((s) => s.id === activeSection) || null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={onBack} className="text-[#172030]/70">
          <ArrowLeft className="h-4 w-4 mr-1" /> Bibliothèque
        </Button>
        <div className="flex-1 min-w-[220px]">
          <h2 className="text-2xl text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>{plan.titre}</h2>
          <p className="text-xs text-[#172030]/45">
            {plan.type} · Version {plan.numero_version ?? 1} · Révision : {fmtDate(plan.date_revision_suivante)}
          </p>
        </div>
        <span className="text-[11px] font-medium rounded-full px-2.5 py-1" style={{ backgroundColor: st.bg, color: st.text }}>
          {statut}
        </span>
        <Button variant="outline" onClick={exportMarkdown} className="border-[#E8E4DC]">
          <FileDown className="h-4 w-4 mr-1" /> Exporter
        </Button>
        <Button onClick={saveMeta} disabled={saving} className="bg-[#2A5141] hover:bg-[#20402F] text-white">
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Enregistrer
        </Button>
      </div>

      {/* Barre de progression Stylisée */}
      <Card className="border border-[#E8E4DC] bg-white rounded-xl overflow-hidden">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs text-[#172030]/55 mb-1">
              <span className="font-medium">Avancement de la rédaction</span>
              <span className="font-semibold text-[#2A5141]">{completion}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#F1EFE8] overflow-hidden relative">
              <div className="h-full bg-gradient-to-r from-[#2A5141] to-[#4A7A6A] transition-all duration-700" style={{ width: `${completion}%` }} />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20" />
            </div>
          </div>
          <div className="text-xs text-[#172030]/45 whitespace-nowrap">
            {sections.filter((s) => s.statut === "Rédigé").length}/{sections.length} sections rédigées
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#F1EFE8]">
          <TabsTrigger value="contenu">Contenu</TabsTrigger>
          <TabsTrigger value="contacts">Annuaire de crise</TabsTrigger>
          <TabsTrigger value="associations">Associations</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="infos">Informations</TabsTrigger>
        </TabsList>

        {/* ---------------- CONTENU ---------------- */}
        <TabsContent value="contenu" className="mt-4">
          {loading ? (
            <div className="py-16 text-center text-[#172030]/40"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : (
            <div className="grid lg:grid-cols-[260px_1fr] gap-5">
              <Card className="border border-[#E8E4DC] bg-white rounded-xl h-fit">
                <CardContent className="p-2">
                  {sections.map((s) => {
                    const statusStyle = SECTION_STATUS_STYLES[s.statut as keyof typeof SECTION_STATUS_STYLES] || SECTION_STATUS_STYLES["À rédiger"];
                    return (
                      <button
                        key={s.id}
                        onClick={() => setActiveSection(s.id)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 transition-colors",
                          activeSection === s.id ? "bg-[#E8F0EC] text-[#2A5141] font-medium" : "text-[#172030]/70 hover:bg-[#F5F3EF]"
                        )}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0 border"
                          style={{ backgroundColor: statusStyle.dot, borderColor: statusStyle.dot }}
                        />
                        <span className="flex-1 truncate">{s.titre}</span>
                        {s.statut === "Rédigé" && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                      </button>
                    );
                  })}
                  <Button variant="ghost" size="sm" onClick={addSection} className="w-full mt-1 text-[#2A5141]">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Section
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-4">
                {currentSection ? (
                  <>
                    <Card className="border border-[#E8E4DC] bg-white rounded-xl">
                      <CardContent className="p-5 space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <Input
                            value={currentSection.titre}
                            onChange={(e) => saveSection(currentSection, { titre: e.target.value })}
                            className="flex-1 min-w-[200px] border-[#E8E4DC] font-medium"
                          />
                          <Select
                            value={currentSection.statut || "À rédiger"}
                            onValueChange={(v) => saveSection(currentSection, { statut: v })}
                          >
                            <SelectTrigger className="w-[150px] border-[#E8E4DC]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SECTION_STATUTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" className="text-rose-600" onClick={() => removeSection(currentSection.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <RichTextEditor
                          value={currentSection.contenu || ""}
                          onChange={(html) => saveSection(currentSection, { contenu: html })}
                        />
                      </CardContent>
                    </Card>

                    <Card className="border border-[#E8E4DC] bg-white rounded-xl">
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-[#172030] flex items-center gap-2">
                            <ListChecks className="h-4 w-4 text-[#2A5141]" /> Procédures opérationnelles
                          </p>
                          <Button size="sm" variant="outline" className="border-[#E8E4DC]" onClick={() => addProcedure(currentSection.id)}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Procédure
                          </Button>
                        </div>

                        {procedures.filter((p) => p.section_id === currentSection.id).length === 0 && (
                          <p className="text-xs text-[#172030]/40 py-3">Aucune procédure dans cette section.</p>
                        )}

                        {procedures.filter((p) => p.section_id === currentSection.id).map((proc) => {
                          const open = openProcs.includes(proc.id);
                          const steps = etapes.filter((e) => e.procedure_id === proc.id);
                          return (
                            <div key={proc.id} className="rounded-lg border border-[#E8E4DC] overflow-hidden">
                              <div className="flex items-center gap-2 bg-[#FAF9F6] px-3 py-2">
                                <button onClick={() => setOpenProcs((p) => open ? p.filter((x) => x !== proc.id) : [...p, proc.id])}>
                                  {open ? <ChevronDown className="h-4 w-4 text-[#172030]/50" /> : <ChevronRight className="h-4 w-4 text-[#172030]/50" />}
                                </button>
                                <Input
                                  value={proc.titre}
                                  onChange={async (e) => {
                                    const titre = e.target.value;
                                    setProcedures((prev) => prev.map((x) => x.id === proc.id ? { ...x, titre } : x));
                                    await supabase.from("plan_procedures").update({ titre }).eq("id", proc.id);
                                  }}
                                  className="h-8 border-transparent bg-transparent font-medium text-sm px-1"
                                />
                                <span className="text-[10px] text-[#172030]/40 whitespace-nowrap">{steps.length} étape(s)</span>
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7 text-rose-600"
                                  onClick={async () => {
                                    if (!confirm("Supprimer cette procédure ?")) return;
                                    await supabase.from("plan_procedures").delete().eq("id", proc.id);
                                    await loadDetail();
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>

                              {open && (
                                <div className="p-3 space-y-3">
                                  {steps.map((e, i) => (
                                    <div key={e.id} className="rounded-lg border border-[#EFEDE7] p-3 space-y-2">
                                      <div className="flex items-start gap-2">
                                        <span className="mt-2 h-6 w-6 shrink-0 grid place-items-center rounded-full bg-[#E8F0EC] text-[#2A5141] text-[11px] font-semibold">
                                          {i + 1}
                                        </span>
                                        <Textarea
                                          value={e.description || ""}
                                          onChange={(ev) => saveEtape(e.id, { description: ev.target.value })}
                                          placeholder="Action à réaliser…"
                                          className="min-h-[52px] border-[#E8E4DC]"
                                        />
                                        <Button
                                          variant="ghost" size="icon" className="text-rose-600"
                                          onClick={async () => {
                                            await supabase.from("plan_etapes").delete().eq("id", e.id);
                                            await loadDetail();
                                          }}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                      <div className="grid sm:grid-cols-2 gap-2 pl-8">
                                        <Input
                                          value={e.responsable || ""}
                                          onChange={(ev) => saveEtape(e.id, { responsable: ev.target.value })}
                                          placeholder="Responsable"
                                          className="h-8 text-xs border-[#E8E4DC]"
                                        />
                                        <Input
                                          type="number"
                                          value={e.duree_estimee_minutes ?? ""}
                                          onChange={(ev) => saveEtape(e.id, { duree_estimee_minutes: Number(ev.target.value) })}
                                          placeholder="Durée (min)"
                                          className="h-8 text-xs border-[#E8E4DC]"
                                        />
                                      </div>
                                      <div className="pl-8 space-y-1">
                                        <p className="text-[10px] uppercase tracking-wider text-[#172030]/35">Ressources mobilisées</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {RESOURCE_TYPES.map((rt) => (
                                            <Select
                                              key={rt.id}
                                              value=""
                                              onValueChange={(v) => toggleEtapeResource(e.id, rt.id, v)}
                                            >
                                              <SelectTrigger className="h-7 w-[170px] text-[11px] border-[#E8E4DC]">
                                                <SelectValue placeholder={`${rt.icon} ${rt.label}`} />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {(resources[rt.id] ?? []).map((r) => (
                                                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          ))}
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                          {etapeRes.filter((r) => r.etape_id === e.id).map((r) => {
                                            const name = (resources[r.resource_type] ?? []).find((x) => x.id === r.resource_id)?.name || "Ressource";
                                            return (
                                              <button
                                                key={r.id}
                                                onClick={() => toggleEtapeResource(e.id, r.resource_type, r.resource_id)}
                                                className="text-[10px] rounded-full bg-[#F1EFE8] text-[#172030]/70 px-2 py-0.5 hover:bg-rose-50 hover:text-rose-700"
                                                title="Retirer"
                                              >
                                                {name} ✕
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  <Button size="sm" variant="ghost" className="text-[#2A5141]" onClick={() => addEtape(proc.id)}>
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter une étape
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <p className="text-sm text-[#172030]/45">Sélectionnez une section.</p>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ---------------- CONTACTS ---------------- */}
        <TabsContent value="contacts" className="mt-4">
          <Card className="border border-[#E8E4DC] bg-white rounded-xl">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#172030] flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#2A5141]" /> Annuaire de crise
                </p>
                <Button size="sm" variant="outline" className="border-[#E8E4DC]" onClick={addContact}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Contact
                </Button>
              </div>
              {contacts.length === 0 && (
                <div className="text-center py-10">
                  <div className="h-12 w-12 rounded-full bg-[#F0F7F4] mx-auto flex items-center justify-center mb-3">
                    <Users className="h-6 w-6 text-[#2A5141]" />
                  </div>
                  <p className="text-sm text-[#172030] font-medium">Aucun contact enregistré</p>
                  <p className="text-xs text-[#172030]/50 mt-1">Ajoutez les personnes clés à contacter en cas de crise.</p>
                </div>
              )}
              <div className="space-y-2">
                {contacts.map((c) => (
                  <div key={c.id} className="grid md:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto_auto] gap-2 items-center rounded-lg border border-[#EFEDE7] p-2">
                    <Input value={c.nom || ""} onChange={(e) => saveContact(c.id, { nom: e.target.value })} placeholder="Nom" className="h-8 text-xs border-[#E8E4DC]" />
                    <Input value={c.role || ""} onChange={(e) => saveContact(c.id, { role: e.target.value })} placeholder="Rôle" className="h-8 text-xs border-[#E8E4DC]" />
                    <Input value={c.telephone || ""} onChange={(e) => saveContact(c.id, { telephone: e.target.value })} placeholder="Téléphone" className="h-8 text-xs border-[#E8E4DC]" />
                    <Input value={c.email || ""} onChange={(e) => saveContact(c.id, { email: e.target.value })} placeholder="Email" className="h-8 text-xs border-[#E8E4DC]" />
                    <label className="flex items-center gap-1.5 text-[11px] text-[#172030]/60 whitespace-nowrap">
                      <Checkbox checked={!!c.est_suppleant} onCheckedChange={(v) => saveContact(c.id, { est_suppleant: !!v })} />
                      Suppléant
                    </label>
                    <Button variant="ghost" size="icon" className="text-rose-600" onClick={() => removeContact(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              {contacts.length > 0 && (
                <div className="flex gap-4 pt-2 text-xs text-[#172030]/50">
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {contacts.filter((c) => c.telephone).length} joignables</span>
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {contacts.filter((c) => c.email).length} emails</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- ASSOCIATIONS (REFONTE DESIGN) ---------------- */}
        <TabsContent value="associations" className="mt-4">
          <div className="grid lg:grid-cols-3 gap-4">
            {/* PROCESSUS */}
            <Card className="border border-[#E8E4DC] bg-white rounded-xl">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-[#172030] mb-3 flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-[#2A5141]" /> Processus (BIA)
                </p>
                <div className="max-h-[420px] overflow-y-auto space-y-2">
                  {data.processus.map((p: ProcessLite) => {
                    const linked = linkedProcess.includes(p.id);
                    const criticite = p.criticite || "Mineur"; // ✅ Utilisation de la vraie criticité
                    const style = CRITICALITY_STYLES[criticite] || CRITICALITY_STYLES["Mineur"];
                    const rto = p.rto_hours ? `${p.rto_hours}h` : "—";
                    const rtoBg = RTO_STYLES[rto] || "#F1EFE8";

                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleLink("plan_processus", "processus_id", p.id, linked)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl border transition-all",
                          linked ? "bg-[#F0F7F4] border-[#2A5141] shadow-sm" : "bg-white border-[#E8E4DC] hover:border-[#2A5141]/50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[#172030] truncate">{p.name}</span>
                          {/* Criticité */}
                          <Badge className="text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: style.bg, color: style.text }}>
                            {criticite}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] text-[#172030]/50">{p.direction || "—"}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: rtoBg, color: "#172030" }}>
                            RTO {rto}
                          </span>
                          {linked && <CheckCircle2 className="h-4 w-4 text-[#2A5141] ml-auto" />}
                        </div>
                      </button>
                    );
                  })}
                  {data.processus.length === 0 && (
                    <div className="text-center py-8">
                      <div className="h-10 w-10 rounded-full bg-[#F0F7F4] mx-auto flex items-center justify-center mb-2">
                        <Link2 className="h-5 w-5 text-[#2A5141]" />
                      </div>
                      <p className="text-xs text-[#172030]/50">Aucun processus disponible</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* RISQUES */}
            <Card className="border border-[#E8E4DC] bg-white rounded-xl">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-[#172030] mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#2A5141]" /> Risques couverts
                </p>
                <div className="max-h-[420px] overflow-y-auto space-y-2">
                  {data.risques.map((r) => {
                    const linked = linkedRisks.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        onClick={() => toggleLink("plan_risques", "risque_id", r.id, linked)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl border transition-all",
                          linked ? "bg-[#F0F7F4] border-[#2A5141] shadow-sm" : "bg-white border-[#E8E4DC] hover:border-[#2A5141]/50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[#172030] truncate">{r.titre || r.title}</span>
                          {linked && <CheckCircle2 className="h-4 w-4 text-[#2A5141]" />}
                        </div>
                      </button>
                    );
                  })}
                  {data.risques.length === 0 && (
                    <div className="text-center py-8">
                      <div className="h-10 w-10 rounded-full bg-[#F0F7F4] mx-auto flex items-center justify-center mb-2">
                        <AlertTriangle className="h-5 w-5 text-[#2A5141]" />
                      </div>
                      <p className="text-xs text-[#172030]/50">Aucun risque enregistré</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* STRATÉGIES */}
            <Card className="border border-[#E8E4DC] bg-white rounded-xl">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-[#172030] mb-3 flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-[#2A5141]" /> Stratégies retenues
                </p>
                <div className="max-h-[420px] overflow-y-auto space-y-2">
                  {data.strategies.map((s) => {
                    const linked = linkedStrats.includes(s.id);
                    const proc = data.processus.find((p) => p.id === s.processus_id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleLink("plan_strategies", "strategie_association_id", s.id, linked)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl border transition-all",
                          linked ? "bg-[#F0F7F4] border-[#2A5141] shadow-sm" : "bg-white border-[#E8E4DC] hover:border-[#2A5141]/50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[#172030] truncate">{s.nom || "Stratégie"}</span>
                          {linked && <CheckCircle2 className="h-4 w-4 text-[#2A5141]" />}
                        </div>
                        <p className="text-[10px] text-[#172030]/50 mt-1">{proc?.name || "—"}</p>
                      </button>
                    );
                  })}
                  {data.strategies.length === 0 && (
                    <div className="text-center py-8">
                      <div className="h-10 w-10 rounded-full bg-[#F0F7F4] mx-auto flex items-center justify-center mb-2">
                        <GitBranch className="h-5 w-5 text-[#2A5141]" />
                      </div>
                      <p className="text-xs text-[#172030]/50">Aucune stratégie enregistrée</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------- WORKFLOW ---------------- */}
        <TabsContent value="workflow" className="mt-4">
          <WorkflowPanel plan={plan} workflow={workflow} onAdvance={advanceWorkflow} />
        </TabsContent>

        {/* ---------------- VERSIONS ---------------- */}
        <TabsContent value="versions" className="mt-4">
          <Card className="border border-[#E8E4DC] bg-white rounded-xl">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#172030] flex items-center gap-2">
                  <History className="h-4 w-4 text-[#2A5141]" /> Historique des versions
                </p>
                <Button size="sm" onClick={createVersion} className="bg-[#2A5141] hover:bg-[#20402F] text-white">
                  Archiver la version {plan.numero_version ?? 1}
                </Button>
              </div>
              {versions.length === 0 ? (
                <p className="text-xs text-[#172030]/40">Aucune version archivée. La version courante est la v{plan.numero_version ?? 1}.</p>
              ) : (
                <div className="space-y-2">
                  {versions.map((v) => {
                    const secs = (v.snapshot?.sections ?? []) as PlanSection[];
                    const diff = sections.length - secs.length;
                    return (
                      <div key={v.id} className="rounded-lg border border-[#EFEDE7] p-3 flex items-center gap-3">
                        <span className="h-8 w-8 rounded-full bg-[#E8F0EC] text-[#2A5141] grid place-items-center text-xs font-semibold">
                          v{v.numero_version}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm text-[#172030]">Archivée le {fmtDate(v.created_at)}</p>
                          <p className="text-[11px] text-[#172030]/45">
                            {secs.length} section(s) · {diff === 0 ? "structure identique à la version courante" : `${diff > 0 ? "+" : ""}${diff} section(s) depuis`}
                          </p>
                        </div>
                        {v.created_by && <span className="text-[11px] text-[#172030]/45">{v.created_by}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- INFOS ---------------- */}
        <TabsContent value="infos" className="mt-4">
          <Card className="border border-[#E8E4DC] bg-white rounded-xl">
            <CardContent className="p-5 grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Titre</Label>
                <Input className="mt-1 border-[#E8E4DC]" value={meta.titre || ""} onChange={(e) => setMeta({ ...meta, titre: e.target.value })} />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={meta.type || "PCA"} onValueChange={(v) => setMeta({ ...meta, type: v })}>
                  <SelectTrigger className="mt-1 border-[#E8E4DC]"><SelectValue /></SelectTrigger>
                  <SelectContent>{PLAN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Statut</Label>
                <Select value={meta.statut || "Brouillon"} onValueChange={(v) => setMeta({ ...meta, statut: v })}>
                  <SelectTrigger className="mt-1 border-[#E8E4DC]"><SelectValue /></SelectTrigger>
                  <SelectContent>{PLAN_STATUTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rédacteur</Label>
                <Input className="mt-1 border-[#E8E4DC]" value={meta.redacteur || ""} onChange={(e) => setMeta({ ...meta, redacteur: e.target.value })} />
              </div>
              <div>
                <Label>Validateur métier</Label>
                <Input className="mt-1 border-[#E8E4DC]" value={meta.validateur_metier || ""} onChange={(e) => setMeta({ ...meta, validateur_metier: e.target.value })} />
              </div>
              <div>
                <Label>Responsable PCA</Label>
                <Input className="mt-1 border-[#E8E4DC]" value={meta.responsable_pca || ""} onChange={(e) => setMeta({ ...meta, responsable_pca: e.target.value })} />
              </div>
              <div>
                <Label>Date d'approbation</Label>
                <Input type="date" className="mt-1 border-[#E8E4DC]" value={meta.date_approbation || ""} onChange={(e) => setMeta({ ...meta, date_approbation: e.target.value })} />
              </div>
              <div>
                <Label>Prochaine révision</Label>
                <Input type="date" className="mt-1 border-[#E8E4DC]" value={meta.date_revision_suivante || ""} onChange={(e) => setMeta({ ...meta, date_revision_suivante: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Button onClick={saveMeta} disabled={saving} className="bg-[#2A5141] hover:bg-[#20402F] text-white">
                  <Save className="h-4 w-4 mr-1" /> Enregistrer les informations
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ============================================================
// WORKFLOW
// ============================================================
const WorkflowPanel = ({
  plan,
  workflow,
  onAdvance,
}: {
  plan: Plan;
  workflow: WorkflowEntry[];
  onAdvance: (etape: string, statut: "Validé" | "Refusé", validateur: string, commentaire: string) => Promise<void>;
}) => {
  const [validateur, setValidateur] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [busy, setBusy] = useState(false);

  const validated = WORKFLOW_ETAPES.filter((e) =>
    workflow.some((w) => w.etape === e && w.statut === "Validé")
  );
  const currentIndex = Math.min(validated.length, WORKFLOW_ETAPES.length - 1);
  const currentEtape = WORKFLOW_ETAPES[currentIndex];
  const isComplete = validated.length === WORKFLOW_ETAPES.length;

  const act = async (statut: "Validé" | "Refusé") => {
    setBusy(true);
    await onAdvance(currentEtape, statut, validateur, commentaire);
    setValidateur("");
    setCommentaire("");
    setBusy(false);
  };

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4">
      <Card className="border border-[#E8E4DC] bg-white rounded-xl">
        <CardContent className="p-5">
          <p className="text-sm font-semibold text-[#172030] mb-5">Circuit de validation</p>
          <div className="space-y-0">
            {WORKFLOW_ETAPES.map((e, i) => {
              const entries = workflow.filter((w) => w.etape === e);
              const last = entries[entries.length - 1];
              const done = !!entries.find((w) => w.statut === "Validé");
              const refused = last?.statut === "Refusé" && !done;
              const active = !isComplete && e === currentEtape;
              return (
                <div key={e} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "h-8 w-8 rounded-full grid place-items-center text-xs font-semibold border-2",
                      done ? "bg-[#2A5141] border-[#2A5141] text-white"
                        : refused ? "bg-rose-50 border-rose-400 text-rose-600"
                        : active ? "bg-white border-[#2A5141] text-[#2A5141]"
                        : "bg-white border-[#E8E4DC] text-[#172030]/35"
                    )}>
                      {done ? <CheckCircle2 className="h-4 w-4" /> : refused ? <AlertTriangle className="h-4 w-4" /> : i + 1}
                    </div>
                    {i < WORKFLOW_ETAPES.length - 1 && (
                      <div className={cn("w-0.5 flex-1 min-h-[42px]", done ? "bg-[#2A5141]" : "bg-[#E8E4DC]")} />
                    )}
                  </div>
                  <div className="pb-6 flex-1">
                    <p className={cn("text-sm font-medium", active ? "text-[#2A5141]" : "text-[#172030]")}>{e}</p>
                    {last ? (
                      <p className="text-[11px] text-[#172030]/45">
                        {last.statut} · {last.validateur || "—"} · {fmtDate(last.date)}
                        {last.commentaire ? ` — « ${last.commentaire} »` : ""}
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#172030]/35">En attente</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-[#E8E4DC] bg-white rounded-xl h-fit">
        <CardContent className="p-5 space-y-3">
          {isComplete ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-600" />
              <p className="mt-2 text-sm font-medium text-[#172030]">Plan approuvé</p>
              <p className="text-xs text-[#172030]/50">Approuvé le {fmtDate(plan.date_approbation)} · révision {fmtDate(plan.date_revision_suivante)}</p>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-[#172030] flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#2A5141]" /> Étape en cours : {currentEtape}
              </p>
              <div>
                <Label className="text-xs">Validateur</Label>
                <Input className="mt-1 border-[#E8E4DC]" value={validateur} onChange={(e) => setValidateur(e.target.value)} placeholder="Nom du validateur" />
              </div>
              <div>
                <Label className="text-xs">Commentaire</Label>
                <Textarea className="mt-1 border-[#E8E4DC]" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Observations…" />
              </div>
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => act("Validé")} className="flex-1 bg-[#2A5141] hover:bg-[#20402F] text-white">
                  Valider
                </Button>
                <Button disabled={busy} variant="outline" onClick={() => act("Refusé")} className="border-rose-200 text-rose-700 hover:bg-rose-50">
                  Refuser
                </Button>
              </div>
              <p className="text-[11px] text-[#172030]/40">
                La validation de la dernière étape approuve le plan et programme la révision à 12 mois.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};