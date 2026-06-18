import { useState } from "react";
import { useEbios, uid } from "@/contexts/EbiosContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

const Level = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" onClick={() => onChange(n)}
        className={`h-7 w-7 rounded text-xs font-medium border ${value >= n ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>
        {n}
      </button>
    ))}
  </div>
);

export const EBIOSAtelier3 = () => {
  const { state, update } = useEbios();
  const a = state.atelier3;
  const [pp, setPp] = useState({ nom: "", type: "", menace: 3, dependance: 3, confiance: 3 });
  const [sc, setSc] = useState({ nom: "", description: "", severite: 3 });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Atelier 3 — Scénarios stratégiques</CardTitle>
          <CardDescription>Cartographier l'écosystème et identifier les chemins d'attaque stratégiques.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Parties prenantes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-5 gap-3 items-end">
            <Input placeholder="Nom" value={pp.nom} onChange={(e) => setPp({ ...pp, nom: e.target.value })} />
            <Input placeholder="Type (fournisseur, partenaire...)" value={pp.type} onChange={(e) => setPp({ ...pp, type: e.target.value })} />
            <div><Label className="text-xs">Menace</Label><Level value={pp.menace} onChange={(v) => setPp({ ...pp, menace: v })} /></div>
            <div><Label className="text-xs">Dépendance</Label><Level value={pp.dependance} onChange={(v) => setPp({ ...pp, dependance: v })} /></div>
            <div><Label className="text-xs">Confiance</Label><Level value={pp.confiance} onChange={(v) => setPp({ ...pp, confiance: v })} /></div>
          </div>
          <Button size="sm" disabled={!pp.nom} onClick={() => {
            update("atelier3", { ...a, partiesPrenantes: [...a.partiesPrenantes, { id: uid(), ...pp }] });
            setPp({ nom: "", type: "", menace: 3, dependance: 3, confiance: 3 });
          }}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
          <div className="space-y-2">
            {a.partiesPrenantes.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-md border">
                <div><div className="font-medium">{p.nom}</div><div className="text-sm text-muted-foreground">{p.type}</div></div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">M {p.menace}</Badge>
                  <Badge variant="outline">D {p.dependance}</Badge>
                  <Badge variant="outline">C {p.confiance}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => update("atelier3", { ...a, partiesPrenantes: a.partiesPrenantes.filter((x) => x.id !== p.id) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Scénarios stratégiques</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-3 items-end">
            <Input placeholder="Nom" value={sc.nom} onChange={(e) => setSc({ ...sc, nom: e.target.value })} />
            <Input placeholder="Description" value={sc.description} onChange={(e) => setSc({ ...sc, description: e.target.value })} className="md:col-span-2" />
            <div><Label className="text-xs">Sévérité</Label><Level value={sc.severite} onChange={(v) => setSc({ ...sc, severite: v })} /></div>
          </div>
          <Button size="sm" disabled={!sc.nom} onClick={() => {
            update("atelier3", { ...a, scenarios: [...a.scenarios, { id: uid(), ...sc }] });
            setSc({ nom: "", description: "", severite: 3 });
          }}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
          <div className="space-y-2">
            {a.scenarios.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-md border">
                <div><div className="font-medium">{s.nom}</div><div className="text-sm text-muted-foreground">{s.description}</div></div>
                <div className="flex items-center gap-2"><Badge variant="destructive">Sévérité {s.severite}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => update("atelier3", { ...a, scenarios: a.scenarios.filter((x) => x.id !== s.id) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
