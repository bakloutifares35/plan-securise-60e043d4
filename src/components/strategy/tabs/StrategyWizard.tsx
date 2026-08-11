// src/components/strategy/tabs/StrategyWizard.tsx
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const ICON_MAP: Record<string, any> = {
  "Site de repli": "Building",
  "Télétravail": "Users",
  "Haute dispo.": "Database",
  "Sauvegarde/restauration": "Database",
  "Prestataire secours": "Handshake",
  "Procédure manuelle": "AlertTriangle",
};

export const StrategyWizard = ({ data, onComplete, onCancel }: { data: any, onComplete: () => void, onCancel: () => void }) => {
  const { processus, catalogue, saveAssociation } = data;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Choix de l'activité (Étape 1)
  const [selectedProcessId, setSelectedProcessId] = useState<string>("");
  const selectedProcess = useMemo(() => processus.find((p: any) => p.id === selectedProcessId), [selectedProcessId, processus]);

  // Définition (Étape 2)
  const [form, setForm] = useState({
    nom: "",
    perimetre: "",
    scenarios: [] as string[],
    hypotheses: "",
  });

  // Comparaison (Étape 3)
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [justification, setJustification] = useState("");

  // Gestion du changement d'étape
  const nextStep = () => {
    if (step === 1 && !selectedProcessId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une activité.", variant: "destructive" });
      return;
    }
    if (step === 2 && !form.nom.trim()) {
      toast({ title: "Erreur", description: "Veuillez donner un nom à la stratégie.", variant: "destructive" });
      return;
    }
    setStep(s => s + 1);
  };

  const prevStep = () => setStep(s => s - 1);

  const submitWizard = async () => {
    if (!selectedOptionId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une option.", variant: "destructive" });
      return;
    }
    setLoading(true);
    
    // Création de l'association finale
    const ok = await saveAssociation({
      processus_id: selectedProcessId,
      strategie_id: selectedOptionId,
      justification: justification,
      delai_estime_heures: selectedProcess?.rto_hours || 0,
      statut: "Proposée", // À valider
    });

    setLoading(false);
    if (ok) {
      toast({ title: "Succès", description: "Stratégie créée et envoyée en validation." });
      onComplete();
    }
  };

  // Rendu des étapes
  return (
    <Card className="border-0 shadow-sm bg-white rounded-xl">
      <CardContent className="p-8">
        <div className="flex justify-between items-center mb-8 border-b border-[#E5E2DD] pb-4">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={cn("flex items-center gap-2 text-sm font-medium", s === step ? "text-[#2A5141]" : "text-[#172030]/40")}>
                <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs", s === step ? "bg-[#2A5141] text-white" : "bg-[#E5E2DD] text-[#172030]/40")}>
                  {s < step ? "✓" : s}
                </span>
                {s < 4 && <span className="w-6 h-px bg-[#E5E2DD]"></span>}
              </div>
            ))}
          </div>
          <span className="text-xs text-[#172030]/40 font-mono">Étape {step} sur 4</span>
        </div>

        {/* ÉTAPE 1 : Activité */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="font-serif text-xl text-[#172030] mb-1">Activité concernée</h3>
              <p className="text-sm text-[#172030]/60">Sélectionnez l'activité critique qui nécessite une stratégie de continuité.</p>
            </div>
            <div>
              <Label>Processus / Activité</Label>
              <Select value={selectedProcessId} onValueChange={setSelectedProcessId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Rechercher une activité..." /></SelectTrigger>
                <SelectContent>
                  {processus.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs text-[#172030]/40">{p.direction || "—"} • RTO: {p.rto_hours || "—"}h</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedProcess && (
              <div className="bg-[#F8F6F2] p-4 rounded-lg space-y-2 border border-[#E5E2DD]">
                <p className="text-xs text-[#172030]/40 uppercase font-semibold tracking-wider">Données BIA (Auto)</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-[#172030]/60">Criticité :</span> <span className="font-medium">{selectedProcess.criticality_level || "—"}</span></div>
                  <div><span className="text-[#172030]/60">RTO :</span> <span className="font-medium">{selectedProcess.rto_hours || "—"}h</span></div>
                  <div><span className="text-[#172030]/60">RPO :</span> <span className="font-medium">{selectedProcess.rpo_hours || "—"}h</span></div>
                  <div><span className="text-[#172030]/60">Responsable :</span> <span className="font-medium">{selectedProcess.owner || "—"}</span></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ÉTAPE 2 : Définition */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="font-serif text-xl text-[#172030] mb-1">Définition de la stratégie</h3>
              <p className="text-sm text-[#172030]/60">Décrivez le périmètre et les hypothèses de la stratégie.</p>
            </div>
            <div>
              <Label>Nom de la stratégie</Label>
              <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex: Site de repli — Salle des marchés" className="mt-1" />
            </div>
            <div>
              <Label>Périmètre couvert</Label>
              <Textarea value={form.perimetre} onChange={(e) => setForm({ ...form, perimetre: e.target.value })} rows={2} placeholder="ex. Équipe trésorerie, systèmes SWIFT..." className="mt-1" />
            </div>
            <div>
              <Label>Hypothèses et contraintes</Label>
              <Textarea value={form.hypotheses} onChange={(e) => setForm({ ...form, hypotheses: e.target.value })} rows={3} placeholder="ex. Le site de repli doit être opérationnel sous 2h..." className="mt-1" />
            </div>
          </div>
        )}

        {/* ÉTAPE 3 : Options (Comparaison) */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="font-serif text-xl text-[#172030] mb-1">Options de stratégie</h3>
              <p className="text-sm text-[#172030]/60">Comparez les options disponibles et choisissez la plus adaptée.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalogue.map((opt: any) => {
                const isSelected = selectedOptionId === opt.id;
                // Petite simulation de coût/délai pour la maquette (à remplacer par de vraies données si tu les as)
                const costSim = ["€", "€€", "€€€", "€€€€"][Math.floor(Math.random() * 4)];
                return (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedOptionId(opt.id)}
                    className={cn(
                      "border-2 rounded-lg p-4 cursor-pointer transition-all bg-white",
                      isSelected ? "border-[#2A5141] bg-[#E8F0EC]" : "border-[#E5E2DD] hover:border-[#2A5141]/50"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-serif font-bold text-[#172030]">{opt.nom}</h4>
                      {isSelected && <CheckCircle2 className="h-5 w-5 text-[#2A5141]" />}
                    </div>
                    <p className="text-sm text-[#172030]/60 line-clamp-2 mb-3">{opt.description || "Option de continuité disponible."}</p>
                    <div className="flex justify-between text-xs text-[#172030]/40">
                      <span>Délai: <span className="font-medium text-[#172030]">Variable</span></span>
                      <span>Coût: <span className="font-medium text-[#172030]">{costSim}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div>
              <Label>Justification du choix</Label>
              <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={3} placeholder="Pourquoi cette option est-elle retenue par rapport aux autres..." className="mt-1" />
            </div>
          </div>
        )}

        {/* ÉTAPE 4 : Validation */}
        {step === 4 && (
          <div className="space-y-6 text-center py-8">
            <div className="w-16 h-16 rounded-full bg-[#E8F0EC] flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-[#2A5141]" />
            </div>
            <h3 className="font-serif text-2xl text-[#172030]">Prêt pour la validation</h3>
            <p className="text-[#172030]/60 max-w-md mx-auto">
              La stratégie sera enregistrée avec le statut <strong>"À valider"</strong>.
              Vous pourrez la modifier ou l'envoyer pour approbation ultérieurement.
            </p>
          </div>
        )}

        {/* Pied de page avec boutons */}
        <div className="flex justify-between mt-8 pt-6 border-t border-[#E5E2DD]">
          <Button variant="outline" onClick={step === 1 ? onCancel : prevStep} className="border-[#E5E2DD]">
            {step === 1 ? "Annuler" : <><ArrowLeft className="h-4 w-4 mr-2" /> Retour</>}
          </Button>
          <Button 
            onClick={step === 4 ? submitWizard : nextStep} 
            disabled={loading}
            className="bg-[#2A5141] hover:bg-[#1F3E32] text-white"
          >
            {loading ? "Enregistrement..." : step === 4 ? "Valider et créer" : <>{step === 3 ? "Valider le choix" : "Continuer"} <ArrowRight className="h-4 w-4 ml-2" /></>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};