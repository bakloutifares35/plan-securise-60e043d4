import { useState } from "react";
import { useEbios, uid, EbiosStrategieTraitement } from "@/contexts/EbiosContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

const STRATS: EbiosStrategieTraitement[] = ["Réduire", "Transférer", "Accepter", "Éviter"];
const STRAT_COLOR: Record<EbiosStrategieTraitement, string> = {
  Réduire: "bg-primary/15 text-primary",
  Transférer: "bg-accent/20 text-accent-foreground",
  Accepter: "bg-warning/15 text-warning",
  Éviter: "bg-destructive/15 text-destructive",
};

const Level = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" onClick={() => onChange(n)}
        className={`h-7 w-7 rounded text-xs font-medium border ${value >= n ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>{n}</button>
    ))}
  </div>
);

export const EBIOSAtelier5 = () => {
  const { state, update } = useEbios();
  const a = state.atelier5;
  const [m, setM] = useState<{ libelle: string; strategie: EbiosStrategieTraitement; risqueResiduel: number }>({
    libelle: "", strategie: "Réduire", risqueResiduel: 2,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Atelier 5 — Traitement du risque</CardTitle>
          <CardDescription>Définir la stratégie de traitement et évaluer les risques résiduels.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Mesure de sécurité</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label>Libellé</Label>
              <Input value={m.libelle} onChange={(e) => setM({ ...m, libelle: e.target.value })} />
            </div>
            <div>
              <Label>Stratégie</Label>
              <Select value={m.strategie} onValueChange={(v) => setM({ ...m, strategie: v as EbiosStrategieTraitement })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STRATS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Risque résiduel (1-5)</Label>
            <Level value={m.risqueResiduel} onChange={(v) => setM({ ...m, risqueResiduel: v })} />
          </div>
          <Button size="sm" disabled={!m.libelle} onClick={() => {
            update("atelier5", { ...a, mesures: [...a.mesures, { id: uid(), ...m }] });
            setM({ libelle: "", strategie: "Réduire", risqueResiduel: 2 });
          }}><Plus className="h-4 w-4 mr-1" />Ajouter la mesure</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Plan de traitement ({a.mesures.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {a.mesures.map((x) => (
            <div key={x.id} className="flex items-center justify-between p-3 rounded-md border">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-1 rounded ${STRAT_COLOR[x.strategie]}`}>{x.strategie}</span>
                <span className="font-medium">{x.libelle}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Résiduel {x.risqueResiduel}</Badge>
                <Button variant="ghost" size="icon" onClick={() => update("atelier5", { ...a, mesures: a.mesures.filter((y) => y.id !== x.id) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
          {a.mesures.length === 0 && <div className="text-sm text-muted-foreground italic">Aucune mesure définie.</div>}
        </CardContent>
      </Card>
    </div>
  );
};
