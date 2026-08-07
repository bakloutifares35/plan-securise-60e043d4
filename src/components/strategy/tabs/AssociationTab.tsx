// src/components/strategy/tabs/AssociationTab.tsx
import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/resillia/client";
import { StrategyData } from "../useStrategyData";
import {
  FAISABILITES, FAISABILITE_STYLE, STATUTS_STRATEGIE, STATUT_STYLE,
  StrategieAssociation, checkRto, emptyAssociation,
} from "../types";

// 🔥 STYLE DES RISQUES INTÉGRÉ DIRECTEMENT ICI (pour éviter l'erreur d'import)
const NIVEAU_STYLE: Record<string, { badge: string }> = {
  Faible: { badge: "bg-green-100 text-green-700" },
  Modéré: { badge: "bg-yellow-100 text-yellow-700" },
  Élevé: { badge: "bg-orange-100 text-orange-700" },
  Critique: { badge: "bg-red-100 text-red-700" },
};

const Badge = ({ label, bg, text }: { label: string; bg: string; text: string }) => (
  <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: bg, color: text }}>
    {label}
  </span>
);

export const AssociationTab = ({ data }: { data: StrategyData }) => {
  const { catalogue, associations, saveAssociation, deleteAssociation, demoteOthers } = data;

  // États pour les PROCESSUS
  const [localProcessus, setLocalProcessus] = useState<any[]>([]);
  const [loadingProcessus, setLoadingProcessus] = useState(true);

  // 🔥 AJOUT : États pour les RISQUES
  const [localRisques, setLocalRisques] = useState<any[]>([]);
  const [loadingRisques, setLoadingRisques] = useState(true);

  // Chargement initial des données
  useEffect(() => {
    const fetchData = async () => {
      // 1. Charger les processus
      setLoadingProcessus(true);
      const { data: procData, error: procError } = await supabase
        .from("processus_metier")
        .select("id, name, direction, owner, description, criticality_level, rto_hours, rpo_hours, status, is_critical")
        .order("name");
      
      if (procError) {
        console.error("Erreur chargement processus :", procError);
        toast({ title: "Erreur", description: "Impossible de charger les processus BIA", variant: "destructive" });
      } else {
        setLocalProcessus(procData || []);
      }
      setLoadingProcessus(false);

      // 2. Charger les risques depuis la table "risques"
      setLoadingRisques(true);
      const { data: riskData, error: riskError } = await supabase
        .from("risques")
        .select("id, title, category, niveau, status")
        .order("title");
      
      if (riskError) {
        console.error("Erreur chargement risques :", riskError);
        toast({ title: "Erreur", description: "Impossible de charger les risques", variant: "destructive" });
      } else {
        setLocalRisques(riskData || []);
      }
      setLoadingRisques(false);
    };

    fetchData();
  }, []);

  const [query, setQuery] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<StrategieAssociation>>(emptyAssociation());
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<StrategieAssociation | null>(null);
  const [confirmRetenue, setConfirmRetenue] = useState(false);

  // Maps pour un accès rapide
  const procById = useMemo(() => Object.fromEntries(localProcessus.map((p) => [p.id, p])), [localProcessus]);
  const stratById = useMemo(() => Object.fromEntries(catalogue.map((s) => [s.id, s])), [catalogue]);
  // 🔥 AJOUT : Map pour les risques
  const riskById = useMemo(() => Object.fromEntries(localRisques.map((r) => [r.id, r])), [localRisques]);

  const selectedProcess = form.processus_id ? procById[form.processus_id] : undefined;
  const rtoCheck = checkRto(form.delai_estime_heures, selectedProcess?.rto_hours ?? null);

  const openCreate = () => {
    setForm(emptyAssociation());
    setOpen(true);
  };
  const openEdit = (a: StrategieAssociation) => {
    setForm({ ...a, scenario_id: a.scenario_id ?? "" });
    setOpen(true);
  };

  const setField = <K extends keyof StrategieAssociation>(k: K, v: StrategieAssociation[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    if (!form.processus_id || !form.strategie_id) {
      toast({ title: "Champs requis", description: "Sélectionnez un processus et une stratégie.", variant: "destructive" });
      return false;
    }
    if (form.tiers_critique && (!form.contrat_reference?.trim() || !form.sla_reference?.trim())) {
      toast({
        title: "Conformité tiers critique",
        description: "La référence de contrat et la référence de SLA sont obligatoires pour un tiers critique.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const rivalRetenue = associations.find(
    (a) =>
      a.processus_id === form.processus_id &&
      (a.scenario_id ?? "") === (form.scenario_id ?? "") &&
      a.statut === "Retenue" &&
      a.id !== form.id
  );

  const persist = async (demote: boolean) => {
    setSaving(true);
    if (demote) await demoteOthers(form.processus_id!, form.scenario_id ?? null, form.id);
    const ok = await saveAssociation(form);
    setSaving(false);
    if (ok) setOpen(false);
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (form.statut === "Retenue" && rivalRetenue) {
      setConfirmRetenue(true);
      return;
    }
    await persist(false);
  };

  // 🔥 MISE À JOUR DU FILTRE : On affiche le titre du risque au lieu de l'ID brut
  const filtered = associations.filter((a) => {
    const q = query.trim().toLowerCase();
    if (q) {
      const riskTitle = riskById[a.scenario_id]?.title || a.scenario_id || "";
      const txt = `${procById[a.processus_id]?.name ?? ""} ${stratById[a.strategie_id]?.nom ?? ""} ${riskTitle}`.toLowerCase();
      if (!txt.includes(q)) return false;
    }
    if (filterStatut !== "all" && a.statut !== filterStatut) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-[#172030]">Association processus / stratégie</h3>
          <p className="text-sm text-[#172030]/60">Vérification automatique du délai estimé face au RTO cible du BIA.</p>
        </div>
        <Button onClick={openCreate} className="bg-[#2A5141] hover:bg-[#1F3E32] text-white shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> Nouvelle association
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#172030]/40" />
          <Input
            placeholder="Rechercher un processus, une stratégie..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 border-[#E5E2DD] focus-visible:ring-[#2A5141] bg-white shadow-sm"
          />
        </div>
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="w-full md:w-[200px] border-[#E5E2DD] focus:ring-[#2A5141] bg-white shadow-sm">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUTS_STRATEGIE.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-0 shadow-sm bg-white rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#F8F6F2] border-b border-[#E5E2DD]">
                {/* 🔥 COLONNES FAISABILITÉ ET ROBUSTESSE SUPPRIMÉES */}
                {["Processus", "Risque / Scénario", "Stratégie", "RTO cible", "Délai estimé", "Coût", "Statut", "Actions"].map((h) => (
                  <th key={h} className="text-left text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider p-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-[#172030]/40">Aucune association enregistrée.</td></tr>
              ) : filtered.map((a) => {
                const p = procById[a.processus_id];
                const chk = checkRto(a.delai_estime_heures, p?.rto_hours ?? null);
                const ss = STATUT_STYLE[a.statut] ?? STATUT_STYLE.Proposée;
                // 🔥 On récupère le titre du risque pour l'afficher
                const riskTitle = riskById[a.scenario_id]?.title || a.scenario_id || "—";
                return (
                  <tr key={a.id} className="border-b border-[#EFEDE8] hover:bg-[#FAF9F6]">
                    <td className="p-3 font-medium text-[#172030]">{p?.name ?? "—"}</td>
                    <td className="p-3 text-[#172030]/70">{riskTitle}</td>
                    <td className="p-3 text-[#172030]/70">{stratById[a.strategie_id]?.nom ?? "—"}</td>
                    <td className="p-3 text-[#172030]/70">{p?.rto_hours != null ? `${p.rto_hours} h` : "—"}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[#172030]">{a.delai_estime_heures} h</span>
                        {chk.known && (
                          <Badge
                            label={chk.ok ? "✅ Atteignable" : `⚠️ +${chk.ecart}h`}
                            bg={chk.ok ? "#E8F0EC" : "#FCE9E9"}
                            text={chk.ok ? "#2A5141" : "#B91C1C"}
                          />
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-[#172030]/70">{Number(a.cout_estime).toLocaleString("fr-FR")} €</td>
                    <td className="p-3"><Badge label={a.statut} bg={ss.bg} text={ss.text} /></td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(a)} className="text-[#172030]/30 hover:text-[#2A5141]" aria-label="Modifier">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setToDelete(a)} className="text-[#172030]/30 hover:text-[#B91C1C]" aria-label="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Formulaire - Dialogue d'association */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#172030]">
              {form.id ? "Modifier l'association" : "Nouvelle association"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Processus - Sélecteur */}
            <div className="md:col-span-2">
              <Label>Sélectionner un processus *</Label>
              <Select value={form.processus_id || ""} onValueChange={(v) => setField("processus_id", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Rechercher et sélectionner un processus..." />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  {loadingProcessus ? (
                    <div className="p-4 text-center text-sm text-[#172030]/60">
                      Chargement des processus...
                    </div>
                  ) : localProcessus.length === 0 ? (
                    <div className="p-4 text-center text-sm text-[#172030]/60 flex flex-col gap-3 items-center">
                      <span>⚠️ Aucun processus trouvé dans la base.</span>
                      <p className="text-xs text-[#172030]/40">Vérifie la table <strong>processus_metier</strong> dans Supabase.</p>
                    </div>
                  ) : (
                    localProcessus.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="py-2">
                        <div className="flex flex-col w-full pr-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{p.name}</span>
                            <span className="text-xs text-[#2A5141] bg-[#E8F0EC] px-2 py-0.5 rounded-full">
                              RTO {p.rto_hours || "—"}h
                            </span>
                          </div>
                          {p.direction && (
                            <span className="text-[10px] text-[#172030]/60 mt-0.5">{p.direction}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* 🔥 MODIFICATION 1 : Remplacement du Scénario par les Risques */}
            <div>
              <Label>Risque / Scénario de crise</Label>
              <Select value={form.scenario_id || ""} onValueChange={(v) => setField("scenario_id", v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un risque..." /></SelectTrigger>
                <SelectContent>
                  {loadingRisques ? (
                    <div className="p-4 text-center text-sm text-[#172030]/60">Chargement des risques...</div>
                  ) : localRisques.length === 0 ? (
                    <div className="p-4 text-center text-sm text-[#172030]/60 flex flex-col gap-2 items-center">
                      <span>Aucun risque trouvé, créez-en un dans le module Risques.</span>
                    </div>
                  ) : (
                    localRisques.map((r) => {
                      // Récupération du style du niveau
                      const style = NIVEAU_STYLE[r.niveau as keyof typeof NIVEAU_STYLE] || NIVEAU_STYLE.Faible;
                      
                      return (
                        <SelectItem key={r.id} value={r.id} className="py-2">
                          <div className="flex flex-col w-full pr-2 gap-1">
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{r.title}</span>
                              <Badge className={cn("text-[9px] font-medium border-0 rounded-full px-2 py-0.5", style?.badge)}>
                                {r.niveau || "Faible"}
                              </Badge>
                            </div>
                            {r.category && (
                              <span className="text-[10px] text-[#172030]/60 mt-0.5">
                                {r.category}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Stratégie *</Label>
              <Select value={form.strategie_id || ""} onValueChange={(v) => setField("strategie_id", v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une stratégie" /></SelectTrigger>
                <SelectContent>
                  {catalogue.map((s) => <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Délai estimé (heures)</Label>
              <Input type="number" min={0} value={form.delai_estime_heures ?? 0} onChange={(e) => setField("delai_estime_heures", Number(e.target.value))} />
            </div>
            <div>
              <Label>RTO cible (BIA)</Label>
              <Input readOnly value={selectedProcess?.rto_hours != null ? `${selectedProcess.rto_hours} h` : "—"} className="bg-[#F8F6F2]" />
            </div>

            <div className="md:col-span-2">
              {rtoCheck.known ? (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: rtoCheck.ok ? "#E8F0EC" : "#FCE9E9", color: rtoCheck.ok ? "#2A5141" : "#B91C1C" }}>
                  {rtoCheck.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {rtoCheck.ok ? `✅ Objectif atteignable : ${form.delai_estime_heures}h ≤ RTO ${selectedProcess?.rto_hours}h` : `⚠️ Délai non atteignable : ${rtoCheck.ecart}h au-delà du RTO`}
                </div>
              ) : (
                <div className="rounded-lg px-3 py-2 text-sm bg-[#F1EFEA] text-[#172030]/60">Sélectionnez un processus disposant d'un RTO pour la vérification de faisabilité.</div>
              )}
            </div>

            <div>
              <Label>Coût estimé (€)</Label>
              <Input type="number" min={0} value={form.cout_estime ?? 0} onChange={(e) => setField("cout_estime", Number(e.target.value))} />
            </div>

            {/* 🔥 MODIFICATION 2 : Retrait de Faisabilité et Robustesse du formulaire */}

            <div className="md:col-span-2">
              <Label>Justification</Label>
              <Textarea rows={2} value={form.justification ?? ""} onChange={(e) => setField("justification", e.target.value)} />
            </div>

            <div className="md:col-span-2">
              <Label>Prérequis</Label>
              <Textarea rows={2} value={form.prerequis ?? ""} onChange={(e) => setField("prerequis", e.target.value)} placeholder="Contrats, ressources, formations..." />
            </div>

            <div className="md:col-span-2 flex items-center justify-between rounded-lg bg-[#F8F6F2] px-3 py-2">
              <div>
                <p className="text-sm font-medium text-[#172030]">Tiers critique impliqué</p>
                <p className="text-xs text-[#172030]/55">Contrat et SLA deviennent obligatoires.</p>
              </div>
              <Switch checked={!!form.tiers_critique} onCheckedChange={(v) => { setField("tiers_critique", v); if (!v) { setField("contrat_reference", ""); setField("sla_reference", ""); } }} />
            </div>

            {form.tiers_critique && (
              <>
                <div>
                  <Label>Référence contrat *</Label>
                  <Input value={form.contrat_reference ?? ""} onChange={(e) => setField("contrat_reference", e.target.value)} className={!form.contrat_reference?.trim() ? 'border-red-300' : ''} />
                  {!form.contrat_reference?.trim() && <p className="text-xs text-[#B91C1C] mt-1">Obligatoire pour un tiers critique</p>}
                </div>
                <div>
                  <Label>Référence SLA *</Label>
                  <Input value={form.sla_reference ?? ""} onChange={(e) => setField("sla_reference", e.target.value)} className={!form.sla_reference?.trim() ? 'border-red-300' : ''} />
                  {!form.sla_reference?.trim() && <p className="text-xs text-[#B91C1C] mt-1">Obligatoire pour un tiers critique</p>}
                </div>
              </>
            )}

            <div>
              <Label>Statut</Label>
              <Select value={form.statut || "Proposée"} onValueChange={(v) => setField("statut", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUTS_STRATEGIE.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div>
              <Label>Lien plan PCA / PRA (optionnel)</Label>
              <Input value={form.lien_pca_id ?? ""} onChange={(e) => setField("lien_pca_id", e.target.value)} placeholder="Référence du plan" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#2A5141] hover:bg-[#1F3E32] text-white">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRetenue} onOpenChange={setConfirmRetenue}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Une stratégie est déjà retenue</AlertDialogTitle>
            <AlertDialogDescription>« {rivalRetenue ? stratById[rivalRetenue.strategie_id]?.nom : ""} » est déjà retenue pour ce couple processus / scénario. Voulez-vous la rebasculer en « Proposée » et retenir celle-ci ?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-[#2A5141] hover:bg-[#1F3E32] text-white" onClick={async () => { setConfirmRetenue(false); await persist(true); }}>Rebasculer et retenir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Supprimer cette association ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-[#B91C1C] hover:bg-[#991B1B] text-white" onClick={async () => { if (toDelete) await deleteAssociation(toDelete.id); setToDelete(null); }}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};