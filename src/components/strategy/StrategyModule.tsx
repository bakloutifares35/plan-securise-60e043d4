// src/components/strategy/StrategyModule.tsx
import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { 
  Layers, CheckCircle2, AlertTriangle, FileWarning, 
  Plus, ArrowLeft, ArrowRight, Users, Monitor, Server, Handshake, 
  Building, Shield, Box, Zap, Clock, Euro, Sparkles, Loader2, List, LayoutGrid,
  AlertCircle, Pencil, Trash2 // 🔥 J'ai ajouté Pencil et Trash2 ici
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/resillia/client";
import { useStrategyData } from "./useStrategyData";
import { CatalogueTab } from "./tabs/CatalogueTab";
import { computeMaxScore, scoreToCriticality } from "@/data/bia";
import { RESILLIA, STATUT_STYLE } from "./types";

type AppView = "overview" | "catalog" | "gaps" | "create";

// ============================================================
// ONGLET : GAPS
// ============================================================
const GapsTab = ({ data, onDefineStrategy }: { data: any, onDefineStrategy: (processId: string) => void }) => {
  const { processus, associations } = data;
  const gaps = useMemo(() => {
    const linkedIds = new Set(associations.map((a: any) => a.processus_id));
    return processus.filter((p: any) => !linkedIds.has(p.id));
  }, [processus, associations]);

  const getProcessCriticality = (p: any) => {
    if (!p.impacts) return "Non défini";
    const score = computeMaxScore(p.impacts);
    return scoreToCriticality(score);
  };

  if (gaps.length === 0) {
    return (
      <Card className="border-0 shadow-sm bg-white rounded-xl p-12 text-center">
        <div className="text-[#172030]/40">
          <p className="text-lg font-serif mb-1">🎉 Tout est couvert !</p>
          <p className="text-sm">Tous les processus critiques ont au moins une stratégie associée.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm bg-white rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#F8F6F2] border-b border-[#E5E2DD]">
              <th className="text-left p-4 text-[10px] font-bold text-[#172030]/50 uppercase">Processus / Activité</th>
              <th className="text-left p-4 text-[10px] font-bold text-[#172030]/50 uppercase">Criticité</th>
              <th className="text-left p-4 text-[10px] font-bold text-[#172030]/50 uppercase">RTO</th>
              <th className="text-right p-4 text-[10px] font-bold text-[#172030]/50 uppercase">Action</th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((p: any) => {
              const crit = getProcessCriticality(p);
              let critStyle = { bg: "#E8F5E9", text: "#2E7D32" };
              if (crit === "Critique") critStyle = { bg: "#FFEBEE", text: "#C62828" };
              else if (crit === "Sévère") critStyle = { bg: "#FBE9E7", text: "#D84315" };
              else if (crit === "Majeur") critStyle = { bg: "#FFF3E0", text: "#E65100" };
              else if (crit === "Modéré") critStyle = { bg: "#FFF8E1", text: "#F57F17" };
              
              return (
                <tr key={p.id} className="border-b border-[#EFEDE8] hover:bg-[#FAF9F6]">
                  <td className="p-4 font-medium">{p.name}</td>
                  <td className="p-4">
                    <Badge variant="outline" className={cn("border-0", critStyle.bg, `text-[${critStyle.text}]`)}>
                      {crit}
                    </Badge>
                  </td>
                  <td className="p-4 font-mono text-[#172030]/60">{p.rto_hours || "—"}h</td>
                  <td className="p-4 text-right">
                    <Button size="sm" className="bg-[#2A5141] hover:bg-[#1F3E32] text-white" onClick={() => onDefineStrategy(p.id)}>
                      + Définir
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// ============================================================
// COMPOSANT WIZARD
// ============================================================
const StrategyWizard = ({ data, onComplete, onCancel, initialProcessId }: { data: any, onComplete: () => void, onCancel: () => void, initialProcessId?: string | null }) => {
  const { processus, catalogue, saveAssociation } = data;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedProcessId, setSelectedProcessId] = useState<string>("");
  const [processResources, setProcessResources] = useState<{hr: any[], equip: any[], apps: any[], suppliers: any[]}>({hr: [], equip: [], apps: [], suppliers: []});
  const [loadingResources, setLoadingResources] = useState(false);
  const [form, setForm] = useState({ nomStrategie: "", perimetre: "", hypotheses: "", scenarios: [] as string[] });
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [justification, setJustification] = useState("");
  
  // États IA
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<{recommended_option_id?: string, rationale?: string, confidence?: string} | null>(null);
  const [aiJustifying, setAiJustifying] = useState(false);

  // Mode d'affichage Étape 3
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Sauvegarde de brouillon
  const [hasDraft, setHasDraft] = useState(false);

  const getResourceBadgeColor = (type: string) => {
    switch(type) {
      case 'Ressources humaines': return { icon: Users, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
      case 'Équipements': return { icon: Monitor, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
      case 'Applications IT': return { icon: Server, bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
      case 'Prestataires': return { icon: Handshake, bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
      default: return { icon: Box, bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
    }
  };

  // --- FETCH DES RESSOURCES ---
  useEffect(() => {
    const fetchResources = async (processId: string) => {
      setLoadingResources(true);
      let hr: any[] = [], equip: any[] = [], apps: any[] = [], suppliers: any[] = [];
      const { data: hrData } = await supabase.from('processus_ressources_humaines').select('ressource_humaine_id').eq('processus_id', processId);
      if (hrData && hrData.length > 0) {
        const ids = hrData.map((l: any) => l.ressource_humaine_id);
        const { data } = await supabase.from('ressources_humaines').select('*').in('id', ids);
        hr = data || [];
      }
      const { data: equipData } = await supabase.from('processus_equipements').select('equipement_id').eq('processus_id', processId);
      if (equipData && equipData.length > 0) {
        const ids = equipData.map((l: any) => l.equipement_id);
        const { data } = await supabase.from('ressources_equipements').select('*').in('id', ids);
        equip = data || [];
      }
      const { data: appData } = await supabase.from('processus_applications').select('application_id').eq('processus_id', processId);
      if (appData && appData.length > 0) {
        const ids = appData.map((l: any) => l.application_id);
        const { data } = await supabase.from('applications_it').select('*').in('id', ids);
        apps = data || [];
      }
      const { data: suppData } = await supabase.from('processus_fournisseurs').select('fournisseur_id').eq('processus_id', processId);
      if (suppData && suppData.length > 0) {
        const ids = suppData.map((l: any) => l.fournisseur_id);
        const { data } = await supabase.from('fournisseurs').select('*').in('id', ids);
        suppliers = data || [];
      }
      setProcessResources({ hr, equip, apps, suppliers });
      setLoadingResources(false);
    };
    if (selectedProcessId) fetchResources(selectedProcessId);
    else setProcessResources({hr: [], equip: [], apps: [], suppliers: []});
  }, [selectedProcessId]);

  // --- PRÉ-SÉLECTION DEPUIS L'ONGLET GAPS ---
  useEffect(() => {
    if (initialProcessId) setSelectedProcessId(initialProcessId);
  }, [initialProcessId]);

  const selectedProcess = useMemo(() => processus.find((p: any) => p.id === selectedProcessId), [selectedProcessId, processus]);

  // --- CRITICITÉ & RTO DYNAMIQUES ---
  const dynamicCriticality = useMemo(() => {
    if (!selectedProcess?.impacts) return "—";
    return scoreToCriticality(computeMaxScore(selectedProcess.impacts));
  }, [selectedProcess]);

  // --- NAVIGATION ---
  const nextStep = () => {
    if (step === 1 && !selectedProcessId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une activité.", variant: "destructive" });
      return;
    }
    if (step === 2 && !form.nomStrategie.trim()) {
      toast({ title: "Erreur", description: "Veuillez donner un nom à la stratégie.", variant: "destructive" });
      return;
    }
    setStep(s => s + 1);
    setHasDraft(true);
  };
  const prevStep = () => setStep(s => s - 1);

  const handleCancel = () => {
    if (hasDraft) {
      if (confirm("Voulez-vous enregistrer un brouillon avant de quitter ?")) {
        toast({ title: "Brouillon enregistré", description: "Vous pourrez reprendre plus tard." });
        onCancel();
      } else {
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  const submitWizard = async () => {
    if (!selectedOptionId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une option.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const ok = await saveAssociation({
      processus_id: selectedProcessId,
      strategie_id: selectedOptionId,
      justification: justification,
      delai_estime_heures: selectedProcess?.rto_hours || 0,
      statut: "Brouillon", 
    });
    setLoading(false);
    if (ok) {
      toast({ title: "Succès", description: "Stratégie créée !" });
      onComplete();
    }
  };

  const scenarioOptions = ["Indisponibilité du site", "Panne systèmes", "Indisponibilité du personnel", "Défaillance fournisseur", "Cyberattaque"];

  // --- IA : RECOMMANDATION AUTOMATIQUE ---
  useEffect(() => {
    const fetchRecommendation = async () => {
      // 🔥 CORRECTION ICI : On retire la condition "aiRecommendation"
      if (step !== 3 || !selectedProcess) return;
      
      setAiLoading(true);
      // On réinitialise l'ancienne recommandation avant de requêter la nouvelle
      setAiRecommendation(null); 
      
      try {
        const context = {
          processName: selectedProcess.name,
          criticality: dynamicCriticality,
          rto: selectedProcess.rto_hours || 0,
          rpo: selectedProcess.rpo_hours || 0,
          resources: `${processResources.hr.length} RH, ${processResources.apps.length} Apps, ${processResources.equip.length} Équipements, ${processResources.suppliers.length} Prestataires`,
          scenarios: form.scenarios.join(", "),
          perimetre: form.perimetre,
          hypotheses: form.hypotheses,
          options: catalogue.map((opt: any) => ({ id: opt.id, nom: opt.nom, description: opt.description }))
        };
        const { data, error } = await supabase.functions.invoke('groq-strategy-assist', { body: { action: 'recommend', context } });
        if (error) throw error;
        if (data?.response) {
          try { setAiRecommendation(JSON.parse(data.response)); } catch (e) { console.error("Erreur parsing", e); }
        }
      } catch (error) {
        console.error("Erreur recommandation:", error);
      } finally {
        setAiLoading(false);
      }
    };
    fetchRecommendation();
  }, [step, selectedProcess?.id, dynamicCriticality]);

  // --- IA : GÉNÉRATION DE JUSTIFICATION ---
  const handleGenerateJustification = async () => {
    if (!selectedOptionId) return;
    const selectedOption = catalogue.find((o: any) => o.id === selectedOptionId);
    if (!selectedOption) return;
    setAiJustifying(true);
    try {
      const context = {
        processName: selectedProcess?.name,
        criticality: dynamicCriticality,
        rto: selectedProcess?.rto_hours || 0,
        rpo: selectedProcess?.rpo_hours || 0,
        selectedOptionName: selectedOption.nom,
        selectedOptionDescription: selectedOption.description || ""
      };
      const { data, error } = await supabase.functions.invoke('groq-strategy-assist', { body: { action: 'justify', context } });
      if (error) throw error;
      if (data?.justification) setJustification(data.justification);
    } catch (error) {
      console.error("Erreur justification:", error);
      toast({ title: "Erreur", description: "Impossible de générer la justification.", variant: "destructive" });
    } finally {
      setAiJustifying(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm bg-white rounded-xl overflow-hidden border-[#E5E2DD]">
      <CardContent className="p-8 md:p-12">
        
        {/* HEADER DU WIZARD (Stepper 1-4) */}
        <div className="flex justify-between items-center mb-10 border-b border-[#E5E2DD] pb-8">
          <div className="flex gap-0 items-center">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center gap-0">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-serif transition-colors duration-300 relative z-10",
                  s === step ? "bg-[#2A5141] text-white" :
                  s < step ? "bg-[#E8F0EC] text-[#2A5141]" :
                  "bg-white text-[#172030]/40 border-2 border-[#E5E2DD]"
                )}>
                  {s < step ? "✓" : s}
                </div>
                {s < 4 && <div className={cn("w-10 h-px", s < step ? "bg-[#2A5141]" : "bg-[#E5E2DD]")} />}
              </div>
            ))}
          </div>
          <span className="text-xs text-[#172030]/40 font-mono">Étape {step} sur 4</span>
        </div>

        {/* ÉTAPE 1 */}
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto py-2">
            <div className="space-y-8">
              <div>
                <h3 className="font-serif text-2xl text-[#172030] mb-1">Informations générales</h3>
                <p className="text-sm text-[#172030]/60">Sélectionnez l'activité et définissez le contexte.</p>
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Nom de la stratégie</Label>
                  <Input value={form.nomStrategie} onChange={(e) => setForm({ ...form, nomStrategie: e.target.value })} placeholder="ex. Site de repli — Salle des marchés" className="h-11 border-[#E5E2DD] focus-visible:ring-[#2A5141]" />
                </div>
                <div className="space-y-2">
                  <Label>Activité / processus concerné</Label>
                  <Select value={selectedProcessId} onValueChange={setSelectedProcessId}>
                    <SelectTrigger className="w-full h-11 border-[#E5E2DD] focus:ring-[#2A5141]">
                      <SelectValue placeholder="Rechercher une activité..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {processus.length === 0 ? <div className="p-4 text-center text-sm text-[#172030]/40">Aucune activité disponible</div> : processus.map((p: any) => {
                        const crit = p.impacts ? scoreToCriticality(computeMaxScore(p.impacts)) : "Non défini";
                        return (
                          <SelectItem key={p.id} value={p.id} className="py-2">
                            <div className="flex flex-col py-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{p.name}</span>
                                {p.rto_hours && p.rto_hours <= 4 && crit === "Critique" && (
                                  <Badge variant="outline" className="bg-[#FFEBEE] text-[#C62828] border-[#FFEBEE] text-[9px] gap-1">
                                    <AlertCircle className="h-3 w-3" /> Critique – RTO serré
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-[#172030]/50">{p.direction || "—"} • RTO: {p.rto_hours || "—"}h</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-[#172030]/40 mt-1">Sélectionnée depuis « Activités sans stratégie »</p>
                </div>
                {selectedProcess && (
                  <>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">Criticité <span className="text-[10px] bg-[#E8F0EC] text-[#2A5141] px-2 py-0.5 rounded-full">Auto — BIA</span></Label>
                      <Input value={dynamicCriticality} readOnly className="h-11 bg-[#F8F6F2] text-[#172030]/70 border-[#E5E2DD]" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">RTO <span className="text-[10px] bg-[#E8F0EC] text-[#2A5141] px-2 py-0.5 rounded-full">Auto — BIA</span></Label>
                        <Input value={`${selectedProcess.rto_hours || 0} heures`} readOnly className="h-11 bg-[#F8F6F2] text-[#172030]/70 border-[#E5E2DD]" />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">RPO <span className="text-[10px] bg-[#E8F0EC] text-[#2A5141] px-2 py-0.5 rounded-full">Auto — BIA</span></Label>
                        <Input value={`${selectedProcess.rpo_hours || 0} heures`} readOnly className="h-11 bg-[#F8F6F2] text-[#172030]/70 border-[#E5E2DD]" />
                      </div>
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label>Périmètre couvert</Label>
                  <Textarea value={form.perimetre} onChange={(e) => setForm({ ...form, perimetre: e.target.value })} rows={3} placeholder="ex. Équipe trésorerie, systèmes SWIFT Alliance Access..." className="resize-none border-[#E5E2DD]" />
                </div>
                <div className="space-y-2">
                  <Label>Scénarios de disruption couverts</Label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {scenarioOptions.map((scenario) => (
                      <label key={scenario} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E5E2DD] bg-white hover:bg-[#F8F6F2] cursor-pointer text-xs transition-colors">
                        <Checkbox checked={form.scenarios.includes(scenario)} onCheckedChange={(checked) => {
                          if (checked) setForm({...form, scenarios: [...form.scenarios, scenario]});
                          else setForm({...form, scenarios: form.scenarios.filter(s => s !== scenario)});
                        }} className="h-3.5 w-3.5 data-[state=checked]:bg-[#2A5141] data-[state=checked]:border-[#2A5141]" />
                        <span className="select-none">{scenario}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Hypothèses et contraintes</Label>
                  <Textarea value={form.hypotheses} onChange={(e) => setForm({ ...form, hypotheses: e.target.value })} rows={3} placeholder="ex. Le site de repli doit être opérationnel sous 2h..." className="resize-none border-[#E5E2DD]" />
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <h3 className="font-serif text-2xl text-[#172030] mb-1">Ressources et dépendances</h3>
                <p className="text-sm text-[#172030]/60">{selectedProcess ? "Récupérées automatiquement depuis le BIA et la cartographie." : "Sélectionnez un processus pour charger ses ressources."}</p>
              </div>
              {loadingResources ? (
                <div className="flex justify-center py-12 text-[#172030]/40"><div className="animate-pulse">Chargement des ressources...</div></div>
              ) : selectedProcess ? (
                <div className="space-y-6">
                  {Object.entries({'Ressources humaines': processResources.hr,'Applications IT': processResources.apps,'Équipements': processResources.equip,'Prestataires': processResources.suppliers}).map(([category, items]) => {
                    if (items.length === 0) return null;
                    const style = getResourceBadgeColor(category);
                    const Icon = style.icon;
                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center gap-3 mb-1">
                          <Icon className={cn("h-4 w-4", style.text)} />
                          <span className="text-sm font-medium text-[#172030]">{category}</span>
                          <Badge variant="secondary" className="h-5 px-2 rounded-full text-[10px] bg-[#F8F6F2] text-[#172030]/60 border border-[#E5E2DD]">{items.length}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {items.map((item: any) => (
                            <div key={item.id} className={cn("px-3 py-1.5 rounded-full text-sm border flex items-center gap-1.5", style.bg, style.text, style.border)}>
                              {item.name}{item.role ? ` (${item.role})` : ''}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div className="border-t border-[#E5E2DD] pt-6 mt-6">
                    <div className="flex items-center gap-2 mb-3"><Shield className="h-4 w-4 text-[#2A5141]" /><h4 className="font-medium text-[#172030]">Risques associés</h4><Badge variant="outline" className="text-[9px] bg-[#E8F0EC] text-[#2A5141] border-[#E8F0EC] ml-auto">Auto — Risques</Badge></div>
                    <p className="text-xs text-[#172030]/50 mb-2">À implémenter dans une version future.</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-[#172030]/40 border border-dashed border-[#E5E2DD] rounded-lg bg-[#F8F6F2]/50">
                  <Building className="h-12 w-12 mx-auto text-[#172030]/20 mb-2" />
                  <p className="text-sm">Sélectionnez un processus</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ÉTAPE 2 */}
        {step === 2 && (
          <div className="max-w-3xl mx-auto py-4 space-y-8">
             <div className="text-center mb-4"><h3 className="font-serif text-2xl text-[#172030] mb-2">Définition de la stratégie</h3><p className="text-sm text-[#172030]/60">Décrivez le contexte de la stratégie.</p></div>
             <div className="space-y-5">
                <div className="space-y-2"><Label>Nom de la stratégie *</Label><Input value={form.nomStrategie} onChange={(e) => setForm({ ...form, nomStrategie: e.target.value })} placeholder="ex. Site de repli — Salle des marchés" className="h-11 border-[#E5E2DD]" /></div>
                <div className="space-y-2"><Label>Description du périmètre</Label><Textarea value={form.perimetre} onChange={(e) => setForm({ ...form, perimetre: e.target.value })} rows={3} placeholder="Décrivez le périmètre..." className="resize-none border-[#E5E2DD]" /></div>
                <div className="space-y-2"><Label>Hypothèses et contraintes</Label><Textarea value={form.hypotheses} onChange={(e) => setForm({ ...form, hypotheses: e.target.value })} rows={3} placeholder="Hypothèses..." className="resize-none border-[#E5E2DD]" /></div>
             </div>
          </div>
        )}

        {/* ÉTAPE 3 */}
        {step === 3 && (
          <div className="space-y-8 py-4 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h3 className="font-serif text-2xl text-[#172030] mb-1">Comparaison des options de stratégie</h3>
                <p className="text-sm text-[#172030]/60">
                  Pour <span className="font-medium">{selectedProcess?.name || "..."}</span> 
                  {selectedProcess && ` — ${dynamicCriticality} · RTO ${selectedProcess.rto_hours || 0}h · RPO ${selectedProcess.rpo_hours || 0}h`}
                </p>
              </div>
              <div className="flex items-center gap-2 border border-[#E5E2DD] rounded-lg p-1 bg-white">
                <button onClick={() => setViewMode("grid")} className={cn("p-1.5 rounded-md transition-colors", viewMode === "grid" ? "bg-[#F8F6F2] text-[#172030]" : "text-[#172030]/40 hover:text-[#172030]")}>
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button onClick={() => setViewMode("table")} className={cn("p-1.5 rounded-md transition-colors", viewMode === "table" ? "bg-[#F8F6F2] text-[#172030]" : "text-[#172030]/40 hover:text-[#172030]")}>
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 🔥 Affichage de TOUTES les options du catalogue */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {catalogue.map((opt: any) => {
                const isSelected = selectedOptionId === opt.id;
                const isRecommended = aiRecommendation?.recommended_option_id === opt.id;
                return (
                  <div 
                    key={opt.id} 
                    onClick={() => setSelectedOptionId(opt.id)} 
                    className={cn(
                      "relative border-2 rounded-xl p-6 cursor-pointer transition-all bg-white flex flex-col h-full",
                      isSelected ? "border-[#2A5141] bg-[#E8F0EC]/50" : 
                      isRecommended ? "border-[#2A5141] border-dashed" :
                      "border-[#E5E2DD] hover:border-[#2A5141]/40 hover:shadow-md"
                    )}
                  >
                    {(isRecommended && !isSelected) && (
                      <div className="absolute -top-3 right-4 bg-[#E8F0EC] text-[#2A5141] text-[10px] font-bold px-3 py-0.5 rounded-full shadow-sm border border-[#2A5141]/20 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Recommandé
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-3">
                      <h4 className={cn("font-serif font-bold text-lg", isSelected ? "text-[#2A5141]" : "text-[#172030]")}>{opt.nom}</h4>
                      {isSelected && <CheckCircle2 className="h-5 w-5 text-[#2A5141]" />}
                    </div>
                    <p className="text-sm text-[#172030]/60 flex-1 mb-6">{opt.description || "Option de continuité disponible."}</p>
                  </div>
                );
              })}
            </div>

            {/* Encart recommandation IA */}
            {aiLoading ? (
              <div className="flex items-center gap-2 text-sm text-[#172030]/60 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#2A5141]" /> Analyse du contexte par l'IA...
              </div>
            ) : aiRecommendation?.rationale && (
              <div className="bg-[#F8F6F2] border-l-4 border-l-[#2A5141] p-4 rounded-lg text-sm flex items-start gap-3">
                <Sparkles className="h-4 w-4 text-[#2A5141] mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-[#172030]">Recommandation IA :</span> {aiRecommendation.rationale}
                  <span className="text-[#172030]/40 text-xs ml-2">(Confiance : {aiRecommendation.confidence})</span>
                </div>
              </div>
            )}

            {/* Justification */}
            <div className="space-y-3 max-w-3xl mx-auto mt-4 border-t border-[#E5E2DD] pt-8">
              <div className="flex justify-between items-end">
                <Label>Justification du choix</Label>
                <Button variant="outline" size="sm" className="border-[#2A5141] text-[#2A5141] hover:bg-[#F8F6F2] gap-2" onClick={handleGenerateJustification} disabled={aiJustifying || !selectedOptionId}>
                  {aiJustifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {aiJustifying ? "Génération..." : "Générer avec l'IA"}
                </Button>
              </div>
              <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={4} placeholder="Expliquez votre choix, ou laissez l'IA le générer pour vous." className="resize-none border-[#E5E2DD]" />
            </div>
          </div>
        )}

        {/* ÉTAPE 4 : RÉSUMÉ RICHE */}
        {step === 4 && (
          <div className="max-w-4xl mx-auto py-4 space-y-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-[#E8F0EC] flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="h-8 w-8 text-[#2A5141]" /></div>
              <h3 className="font-serif text-2xl text-[#172030] mb-2">Prêt pour la validation</h3>
              <p className="text-sm text-[#172030]/60">Vérifiez le résumé avant de créer la stratégie.</p>
            </div>

            {/* Carte Résumé Riche */}
            <Card className="border border-[#E5E2DD] shadow-sm bg-white rounded-xl overflow-hidden">
              <div className="bg-[#F8F6F2] px-6 py-4 border-b border-[#E5E2DD]">
                <h4 className="font-serif font-semibold text-[#172030]">Résumé de la stratégie</h4>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-bold text-[#172030]/50 uppercase tracking-wider mb-2">Activité</p>
                    <p className="font-medium">{selectedProcess?.name}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="bg-[#E8F5E9] text-[#2E7D32] border-[#E8F5E9] text-xs">{dynamicCriticality}</Badge>
                      <span className="text-xs text-[#172030]/60">RTO {selectedProcess?.rto_hours || 0}h</span>
                      <span className="text-xs text-[#172030]/60">RPO {selectedProcess?.rpo_hours || 0}h</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#172030]/50 uppercase tracking-wider mb-2">Stratégie retenue</p>
                    <p className="font-medium">{form.nomStrategie}</p>
                    <p className="text-xs text-[#172030]/60 mt-1">{catalogue.find((c:any) => c.id === selectedOptionId)?.nom}</p>
                  </div>
                </div>

                <div className="border-t border-[#E5E2DD] pt-6">
                  <p className="text-xs font-bold text-[#172030]/50 uppercase tracking-wider mb-3">Ressources liées</p>
                  <div className="flex flex-wrap gap-3">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{processResources.hr.length} RH</Badge>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{processResources.apps.length} Apps</Badge>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{processResources.equip.length} Équipements</Badge>
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">{processResources.suppliers.length} Prestataires</Badge>
                  </div>
                </div>

                <div className="border-t border-[#E5E2DD] pt-6">
                  <p className="text-xs font-bold text-[#172030]/50 uppercase tracking-wider mb-2">Scénarios couverts</p>
                  <div className="flex flex-wrap gap-2">
                    {form.scenarios.length === 0 ? (
                      <span className="text-sm text-[#172030]/40">Aucun scénario sélectionné.</span>
                    ) : (
                      form.scenarios.map((s) => <Badge key={s} variant="outline" className="bg-[#F8F6F2] text-[#172030]/60 border-[#E5E2DD]">{s}</Badge>)
                    )}
                  </div>
                </div>

                <div className="border-t border-[#E5E2DD] pt-6">
                  <p className="text-xs font-bold text-[#172030]/50 uppercase tracking-wider mb-2">Justification</p>
                  <p className="text-sm text-[#172030]/70 whitespace-pre-wrap">{justification || "Aucune justification fournie."}</p>
                </div>
              </div>
            </Card>

            <div className="bg-[#F8F6F2] p-4 rounded-lg border border-[#E5E2DD] text-center text-sm text-[#172030]/60">
              La stratégie sera enregistrée sous le statut <strong className="text-[#172030]">"Brouillon"</strong>.
            </div>
          </div>
        )}

        {/* BOUTONS DE NAVIGATION */}
        <div className="flex justify-between mt-10 pt-6 border-t border-[#E5E2DD]">
          <Button variant="outline" onClick={step === 1 ? handleCancel : prevStep} className="border-[#E5E2DD] text-[#172030]/70 hover:bg-[#F8F6F2]">
            {step === 1 ? "Annuler" : <><ArrowLeft className="h-4 w-4 mr-2" /> Retour</>}
          </Button>
          <Button onClick={step === 4 ? submitWizard : nextStep} disabled={loading || (step === 1 && !selectedProcessId)} className="bg-[#2A5141] hover:bg-[#1F3E32] text-white min-w-[120px]">
            {loading ? "Enregistrement..." : step === 4 ? "Valider et créer" : <>{step === 3 ? "Valider le choix" : "Continuer"} <ArrowRight className="h-4 w-4 ml-2" /></>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================
// MODULE PRINCIPAL (AVEC MODIFICATION ET SUPPRESSION DANS LE TABLEAU)
// ============================================================
export const StrategyModule = () => {
  const [currentView, setCurrentView] = useState<AppView>("overview");
  const [wizardProcessId, setWizardProcessId] = useState<string | null>(null);

  // 🔥 On récupère les fonctions du hook pour les utiliser dans le tableau
  const strategyData = useStrategyData(); 

  const [actionPlans, setActionPlans] = useState<any[]>([]);
  const [loadingRiskData, setLoadingRiskData] = useState(true);

  useEffect(() => {
    const loadRiskData = async () => {
      setLoadingRiskData(true);
      const { data: actionData } = await supabase.from("plans_traitement").select("id, risque_id, mesure, statut, avancement, responsable");
      setActionPlans(actionData || []);
      setLoadingRiskData(false);
    };
    loadRiskData();
  }, []);

  const data = { ...strategyData, actionPlans, loadingActions: loadingRiskData };

  const processusWithCriticality = useMemo(() => {
    return strategyData.processus.map((p: any) => {
      let level = "Non défini";
      if (p.impacts) {
        const score = computeMaxScore(p.impacts);
        level = scoreToCriticality(score);
      }
      return { ...p, calculatedLevel: level };
    });
  }, [strategyData.processus]);

  const stats = useMemo(() => {
    const linkedIds = new Set(strategyData.associations.map(a => a.processus_id));
    const covered = strategyData.processus.filter(p => linkedIds.has(p.id));
    const sansStrategie = strategyData.processus.length - covered.length;

    const statuses = {
      brouillon: strategyData.associations.filter(a => a.statut === "Brouillon").length,
      revue: strategyData.associations.filter(a => a.statut === "En revue").length,
      valider: strategyData.associations.filter(a => a.statut === "À valider").length,
      validees: strategyData.associations.filter(a => a.statut === "Validée").length,
      revoir: strategyData.associations.filter(a => a.statut === "À revoir").length,
    };
    
    return { 
      total: strategyData.catalogue.length, 
      coveredCount: covered.length,
      sansStrategie, 
      statuses 
    };
  }, [strategyData.catalogue, strategyData.associations, strategyData.processus]);

  const typeDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    strategyData.associations.forEach((a: any) => {
      const s = strategyData.catalogue.find((c: any) => c.id === a.strategie_id);
      if (s?.nom) map[s.nom] = (map[s.nom] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [strategyData.associations, strategyData.catalogue]);

  const [filterStatut, setFilterStatut] = useState<string>("all");
  const filteredAssociations = useMemo(() => {
    if (filterStatut === "all") return strategyData.associations;
    return strategyData.associations.filter((a: any) => a.statut === filterStatut);
  }, [strategyData.associations, filterStatut]);

  const openWizard = (processId?: string) => {
    setWizardProcessId(processId || null);
    setCurrentView("create");
  };
  const closeWizard = () => {
    setWizardProcessId(null);
    setCurrentView("overview");
    strategyData.reload();
  };

  // 🔥 FONCTIONS POUR MODIFIER / SUPPRIMER DEPUIS LE TABLEAU
  const handleEditInTable = (id: string) => {
    // Pour l'instant, on rouvre le wizard en mode édition avec l'association existante
    // Note : Ceci est une amélioration future, l'édition directe se fait via le dialogue.
    const assoc = strategyData.associations.find(a => a.id === id);
    if (!assoc) return;
    // Dans une version future, on ouvrira ici le dialog d'édition.
    toast({ title: "Info", description: "Double-cliquez sur la ligne pour éditer (à implémenter)." });
  };

  const handleDeleteInTable = async (id: string, strategyName: string) => {
    if (confirm(`Voulez-vous vraiment supprimer l'association pour la stratégie "${strategyName}" ?`)) {
      const ok = await strategyData.deleteAssociation(id);
      if (ok) {
        toast({ title: "Association supprimée", description: "La stratégie a été dissociée de ce processus." });
      }
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 font-sans pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-[#172030]">Stratégies de continuité</h2>
          <p className="text-sm text-[#172030]/60 mt-1">Définissez le plan de réponse pour chaque activité critique.</p>
        </div>
        {currentView !== "create" && (
          <Button onClick={() => openWizard()} className="bg-[#2A5141] hover:bg-[#1F3E32] text-white shadow-sm">
            <Plus className="h-4 w-4 mr-2" /> Nouvelle stratégie
          </Button>
        )}
      </div>

      {/* Menu de navigation */}
      {currentView !== "create" && (
        <div className="flex flex-wrap gap-1.5 border-b border-[#E5E2DD] pb-1 mt-2">
          {[
            { id: "overview", label: "Vue d'ensemble", icon: Layers },
            { id: "catalog", label: "Catalogue des options", icon: FileWarning },
            { id: "gaps", label: "À couvrir", icon: AlertTriangle },
          ].map((t) => {
            const active = currentView === t.id;
            return (
              <button key={t.id} onClick={() => setCurrentView(t.id as AppView)} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-t-md text-sm font-medium transition-colors", active ? "bg-[#F8F6F2] text-[#172030] border-b-2 border-[#2A5141]" : "text-[#172030]/60 hover:bg-[#F8F6F2]/50 hover:text-[#172030]")}>
                <t.icon className="h-4 w-4" />
                {t.label}
                {t.id === "gaps" && stats.sansStrategie > 0 && <Badge className="bg-[#C62828] text-white text-[10px] font-bold rounded-full ml-1 px-2 py-0.5">{stats.sansStrategie}</Badge>}
              </button>
            );
          })}
        </div>
      )}

      <div className="pt-4">
        {currentView === "create" ? (
          <StrategyWizard data={{ ...data, saveAssociation: strategyData.saveAssociation }} initialProcessId={wizardProcessId} onComplete={closeWizard} onCancel={closeWizard} />
        ) : currentView === "catalog" ? (
          <CatalogueTab data={data} />
        ) : currentView === "gaps" ? (
          <GapsTab data={data} onDefineStrategy={openWizard} />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {[
                { label: "Stratégies définies", value: stats.total, icon: Layers, bg: "#F8F6F2", color: "#172030" },
                { label: "Sans stratégie", value: stats.sansStrategie, icon: AlertTriangle, bg: "#FFEBEE", color: "#C62828" },
                { label: "Validées", value: stats.statuses.validees, icon: CheckCircle2, bg: "#E8F5E9", color: "#2E7D32" },
                { label: "En validation", value: stats.statuses.revue + stats.statuses.valider, icon: Clock, bg: "#FFF8E1", color: "#A38730" },
                { label: "À compléter", value: stats.statuses.brouillon, icon: FileWarning, bg: "#F1EFE8", color: "#444441" },
              ].map((k) => (
                <div key={k.label} className="rounded-xl p-4 border border-[#E5E2DD] bg-white shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/80 border border-[#E5E2DD]">
                      <k.icon className="h-3.5 w-3.5" style={{ color: k.color }} />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: k.color }}>{k.label}</span>
                  </div>
                  <div className="text-3xl font-bold font-serif" style={{ color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm bg-white rounded-xl">
                <CardContent className="p-6">
                  <h3 className="font-serif text-[#172030] text-lg mb-1">Processus par niveau de criticité</h3>
                  <p className="text-sm text-[#172030]/60 mb-6">Calculé dynamiquement depuis les impacts du BIA</p>
                  <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
                    <div className="w-48 h-48 relative flex-shrink-0 flex items-center justify-center">
                      <div className="w-48 h-48 rounded-full border-[16px] border-[#FFEBEE] absolute inset-0 opacity-100"></div>
                      <div className="w-48 h-48 rounded-full border-[16px] border-[#FFF8E1] absolute inset-0 opacity-100" style={{ clipPath: 'polygon(50% 50%, 0 0, 100% 0)' }}></div>
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-full w-32 h-32 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-sm border border-[#E5E2DD]">
                        <span className="text-2xl font-bold font-serif text-[#172030]">{strategyData.processus.length}</span>
                        <span className="text-xs text-[#172030]/40">processus</span>
                      </div>
                    </div>
                    <div className="space-y-2 w-full md:w-auto">
                      {[
                        { label: "Critique", count: processusWithCriticality.filter(p => p.calculatedLevel === "Critique").length, color: "#FFEBEE" },
                        { label: "Majeur", count: processusWithCriticality.filter(p => p.calculatedLevel === "Majeur").length, color: "#FFF8E1" },
                        { label: "Modéré", count: processusWithCriticality.filter(p => p.calculatedLevel === "Modéré").length, color: "#FFF3E0" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between text-sm w-40">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-[#172030]">{item.label}</span>
                          </div>
                          <span className="text-[#172030]/60 font-mono">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-white rounded-xl">
                <CardContent className="p-6">
                  <h3 className="font-serif text-[#172030] text-lg mb-1">Types de stratégies retenues</h3>
                  <p className="text-sm text-[#172030]/60 mb-6">Répartition des {strategyData.associations.length} stratégies définies</p>
                  <div className="space-y-4">
                    {typeDistribution.length === 0 ? (
                      <p className="text-sm text-[#172030]/40 text-center py-4">Aucune stratégie retenue.</p>
                    ) : (
                      typeDistribution.slice(0, 6).map(([name, count]) => {
                        const maxCount = typeDistribution.length > 0 ? typeDistribution[0][1] : 1;
                        const width = Math.max((count / maxCount) * 100, 10);
                        return (
                          <div key={name} className="flex items-center gap-4">
                            <span className="text-sm w-32 truncate text-[#172030]">{name}</span>
                            <div className="flex-1 h-2.5 rounded-full bg-[#F1EFEA] overflow-hidden relative">
                              <div className="h-full rounded-full bg-[#2A5141] transition-all duration-700" style={{ width: `${width}%` }} />
                            </div>
                            <span className="text-sm font-mono text-[#172030]/60 w-8 text-right">{count}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 🔥 TABLEAU AVEC BOUTONS MODIFIER / SUPPRIMER */}
            <Card className="border-0 shadow-sm bg-white rounded-xl overflow-hidden">
              <div className="p-6 border-b border-[#E5E2DD]">
                <h3 className="font-serif text-[#172030] text-lg mb-4">Toutes les stratégies</h3>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button onClick={() => setFilterStatut("all")} className={cn("rounded-full px-4 py-2 text-sm font-medium border transition-colors", filterStatut === "all" ? "bg-[#172030] text-white border-[#172030]" : "bg-white text-[#172030]/60 border-[#E5E2DD] hover:bg-[#F8F6F2]")}>
                    Toutes ({strategyData.associations.length})
                  </button>
                  {[
                    { label: "Brouillon", key: "Brouillon", count: stats.statuses.brouillon },
                    { label: "En revue", key: "En revue", count: stats.statuses.revue },
                    { label: "À valider", key: "À valider", count: stats.statuses.valider },
                    { label: "Validées", key: "Validée", count: stats.statuses.validees },
                    { label: "À revoir", key: "À revoir", count: stats.statuses.revoir },
                  ].map((btn) => (
                    <button key={btn.key} onClick={() => setFilterStatut(btn.key === "Validées" ? "Validée" : btn.key)} className={cn("rounded-full px-4 py-2 text-sm font-medium border transition-colors", filterStatut === (btn.key === "Validées" ? "Validée" : btn.key) ? "bg-[#172030] text-white border-[#172030]" : "bg-white text-[#172030]/60 border-[#E5E2DD] hover:bg-[#F8F6F2]")}>
                      {btn.label} ({btn.count})
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#F8F6F2] border-b border-[#E5E2DD]">
                      <th className="text-left p-4 text-[10px] font-bold text-[#172030]/50 uppercase">Stratégie</th>
                      <th className="text-left p-4 text-[10px] font-bold text-[#172030]/50 uppercase">Activité</th>
                      <th className="text-left p-4 text-[10px] font-bold text-[#172030]/50 uppercase">Criticité</th>
                      <th className="text-left p-4 text-[10px] font-bold text-[#172030]/50 uppercase">RTO</th>
                      <th className="text-left p-4 text-[10px] font-bold text-[#172030]/50 uppercase">Statut</th>
                      <th className="text-left p-4 text-[10px] font-bold text-[#172030]/50 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssociations.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-[#172030]/40">Aucune association trouvée.</td></tr>
                    ) : (
                      filteredAssociations.map((a: any) => {
                        const p = data.processus.find((pr: any) => pr.id === a.processus_id);
                        const s = data.catalogue.find((c: any) => c.id === a.strategie_id);
                        
                        let dynamicCrit = "Non défini";
                        if (p?.impacts) {
                          const score = computeMaxScore(p.impacts);
                          dynamicCrit = scoreToCriticality(score);
                        }

                        let critStyle = { bg: "#E8F5E9", text: "#2E7D32" };
                        if (dynamicCrit === "Critique") critStyle = { bg: "#FFEBEE", text: "#C62828" };
                        else if (dynamicCrit === "Sévère") critStyle = { bg: "#FBE9E7", text: "#D84315" };
                        else if (dynamicCrit === "Majeur") critStyle = { bg: "#FFF3E0", text: "#E65100" };
                        else if (dynamicCrit === "Modéré") critStyle = { bg: "#FFF8E1", text: "#F57F17" };
                        
                        const statutStyle = STATUT_STYLE[a.statut] || STATUT_STYLE["Brouillon"];
                        
                        return (
                          <tr key={a.id} className="border-b border-[#EFEDE8] hover:bg-[#FAF9F6] transition-colors">
                            <td className="p-4 font-medium text-[#172030]">{s?.nom || "—"}</td>
                            <td className="p-4 text-[#172030]/70">{p?.name || "—"}</td>
                            <td className="p-4">
                              <Badge variant="outline" className={cn("border-0", critStyle.bg, `text-[${critStyle.text}]`)}>
                                {dynamicCrit}
                              </Badge>
                            </td>
                            <td className="p-4 font-mono text-[#172030]/70">{p?.rto_hours || "—"}h</td>
                            <td className="p-4">
                              <Badge variant="outline" className={cn("border-0 capitalize", statutStyle.bg, `text-[${statutStyle.text}]`)}>
                                {a.statut || "Brouillon"}
                              </Badge>
                            </td>
                            <td className="p-4 flex items-center gap-2">
                              <button onClick={() => handleEditInTable(a.id)} className="p-1 text-[#172030]/30 hover:text-[#2A5141]" aria-label="Modifier">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button onClick={() => handleDeleteInTable(a.id, s?.nom || "cette stratégie")} className="p-1 text-[#172030]/30 hover:text-[#B91C1C]" aria-label="Supprimer">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default StrategyModule;