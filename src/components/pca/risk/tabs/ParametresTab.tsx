import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Save } from "lucide-react";
import type { RiskData } from "../useRiskData";
import { NIVEAU_STYLE, type ParametresRisques, type EchelonEchelle } from "../riskModel";

// Version simplifiée sans les axes d'impact
const DEFAULT_PARAMS: ParametresRisques = {
  cle: "default",
  echelle_probabilite: [
    { n: 1, label: "Très improbable", desc: "Moins d'une fois tous les 10 ans" },
    { n: 2, label: "Improbable", desc: "Une fois tous les 5 à 10 ans" },
    { n: 3, label: "Possible", desc: "Une fois par an" },
    { n: 4, label: "Probable", desc: "Plusieurs fois par an" },
    { n: 5, label: "Quasi certain", desc: "Mensuel ou plus fréquent" },
  ],
  echelle_impact: [
    { n: 1, label: "Négligeable", desc: "Aucun effet significatif" },
    { n: 2, label: "Mineur", desc: "Effet limité, absorbé en interne" },
    { n: 3, label: "Modéré", desc: "Effet notable sur les activités" },
    { n: 4, label: "Majeur", desc: "Atteinte forte, remontée COMEX" },
    { n: 5, label: "Catastrophique", desc: "Survie de l'organisation en jeu" },
  ],
  ponderation_axes: {},
  seuil_acceptable: 6,
  seuil_tolerable: 12,
  periodicite_revue_mois: 6,
};

const EchelleEditor = ({
  title,
  description,
  rows,
  onChange,
}: {
  title: string;
  description: string;
  rows: EchelonEchelle[];
  onChange: (rows: EchelonEchelle[]) => void;
}) => (
  <Card className="border-[#172030]/10">
    <CardHeader className="pb-3">
      <CardTitle className="font-serif text-[#172030] text-base">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {rows.map((row, i) => (
        <div key={row.n} className="grid gap-2 sm:grid-cols-[auto_1fr_2fr] sm:items-center">
          <span className="h-8 w-8 rounded-md bg-[#2A5141] text-white grid place-items-center text-sm font-medium">
            {row.n}
          </span>
          <Input 
            value={row.label} 
            placeholder="Libellé"
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))} 
          />
          <Input 
            value={row.desc} 
            placeholder="Description / critère"
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, desc: e.target.value } : r)))} 
          />
        </div>
      ))}
    </CardContent>
  </Card>
);

type Props = {
  data: RiskData;
};

export const ParametresTab = ({ data }: Props) => {
  const [draft, setDraft] = useState<ParametresRisques>(DEFAULT_PARAMS);

  useEffect(() => {
    // Si data.params existe, l'utiliser, sinon utiliser les valeurs par défaut
    if (data.params && Object.keys(data.params).length > 0) {
      setDraft(data.params);
    }
  }, [data.params]);

  const set = <K extends keyof ParametresRisques>(k: K, v: ParametresRisques[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const handleSave = () => {
    if (data.saveParams) {
      data.saveParams(draft);
    }
  };

  const handleReset = () => {
    setDraft({ ...DEFAULT_PARAMS });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl text-[#172030]">Paramètres de l'analyse</h2>
          <p className="text-sm text-[#172030]/60">
            Échelles, pondérations et seuils utilisés pour tous les calculs du module.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Valeurs par défaut
          </Button>
          <Button className="bg-[#2A5141] hover:bg-[#2A5141]/90 text-white" onClick={handleSave}>
            <Save className="h-4 w-4 mr-1.5" /> Enregistrer
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <EchelleEditor
          title="Échelle de probabilité (1 → 5)"
          description="Fréquence estimée de survenance du risque."
          rows={draft.echelle_probabilite || DEFAULT_PARAMS.echelle_probabilite}
          onChange={(rows) => set("echelle_probabilite", rows)}
        />
        <EchelleEditor
          title="Échelle d'impact (1 → 5)"
          description="Gravité des conséquences sur chacun des axes."
          rows={draft.echelle_impact || DEFAULT_PARAMS.echelle_impact}
          onChange={(rows) => set("echelle_impact", rows)}
        />
      </div>

      <Card className="border-[#172030]/10">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-[#172030] text-base">Seuils d'appétence au risque</CardTitle>
          <CardDescription>Bornes appliquées au score résiduel (1 à 25).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label className="text-sm text-[#172030]/70">Seuil acceptable (≤)</Label>
              <Input 
                type="number" 
                min={1} 
                max={25} 
                value={draft.seuil_acceptable || 6}
                onChange={(e) => set("seuil_acceptable", Number(e.target.value))}
                className="mt-1 border-[#172030]/20 focus:border-[#2A5141]"
              />
            </div>
            <div>
              <Label className="text-sm text-[#172030]/70">Seuil tolérable (≤)</Label>
              <Input 
                type="number" 
                min={1} 
                max={25} 
                value={draft.seuil_tolerable || 12}
                onChange={(e) => set("seuil_tolerable", Number(e.target.value))}
                className="mt-1 border-[#172030]/20 focus:border-[#2A5141]"
              />
            </div>
            <div>
              <Label className="text-sm text-[#172030]/70">Périodicité de revue (mois)</Label>
              <Input 
                type="number" 
                min={1} 
                max={60} 
                value={draft.periodicite_revue_mois || 6}
                onChange={(e) => set("periodicite_revue_mois", Number(e.target.value))}
                className="mt-1 border-[#172030]/20 focus:border-[#2A5141]"
              />
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-[#172030]/50 mb-2">APERÇU DES NIVEAUX</p>
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                { 
                  n: "Faible" as const, 
                  r: `1 – ${draft.seuil_acceptable || 6}` 
                },
                { 
                  n: "Modéré" as const, 
                  r: `${(draft.seuil_acceptable || 6) + 1} – ${draft.seuil_tolerable || 12}` 
                },
                { 
                  n: "Élevé" as const, 
                  r: `${(draft.seuil_tolerable || 12) + 1} – 18` 
                },
                { 
                  n: "Critique" as const, 
                  r: "19 – 25" 
                },
              ].map((x) => {
                const style = NIVEAU_STYLE[x.n] || NIVEAU_STYLE.Faible;
                return (
                  <div 
                    key={x.n} 
                    className={`rounded-lg border px-3 py-2 text-sm ${style.badge}`}
                  >
                    <p className="font-medium">{x.n}</p>
                    <p className="text-xs opacity-80">Score {x.r}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};